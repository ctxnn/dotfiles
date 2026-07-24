export type DashboardRunState = "queued" | "running" | "complete" | "failed" | "paused" | "stopped" | "detached" | "unknown";
export type DashboardRunSource = "async" | "foreground" | "recent";
export type DashboardFilter = "active" | "completed" | "failed" | "all";
export type DashboardView = "overview" | "details" | "transcript" | "artifacts";

export interface DashboardRun {
  key: string;
  runId: string;
  index?: number;
  source: DashboardRunSource;
  state: DashboardRunState;
  mode?: string;
  agent: string;
  title?: string;
  task?: string;
  phase?: string;
  model?: string;
  thinking?: string;
  currentTool?: string;
  currentPath?: string;
  tokens?: string;
  cost?: string;
  attemptedModels?: string[];
  startedAt?: number;
  updatedAt?: number;
  asyncDir?: string;
  error?: string;
  rawStatus?: string;
  transcript?: string;
  paths?: string[];
}

export interface DashboardSnapshot {
  runs: DashboardRun[];
  error?: string;
  refreshedAt: number;
}

export interface DashboardCounts {
  running: number;
  queued: number;
  completed: number;
  failed: number;
}

export function normalizeState(value: unknown): DashboardRunState {
  const state = String(value ?? "unknown").trim().toLowerCase();
  if (state === "completed" || state === "success" || state === "succeeded") return "complete";
  if (state === "pending") return "queued";
  if (["queued", "running", "complete", "failed", "paused", "stopped", "detached"].includes(state)) {
    return state as DashboardRunState;
  }
  return "unknown";
}

export function isActiveState(state: DashboardRunState): boolean {
  return state === "running" || state === "queued" || state === "detached";
}

export function canInterrupt(run: DashboardRun): boolean {
  return run.state === "running" || run.state === "detached";
}

export function canStop(run: DashboardRun): boolean {
  return run.source === "async" && run.state === "running";
}

export function filterRuns(runs: DashboardRun[], filter: DashboardFilter): DashboardRun[] {
  if (filter === "all") return runs;
  if (filter === "active") return runs.filter((run) => isActiveState(run.state));
  if (filter === "completed") return runs.filter((run) => run.state === "complete");
  return runs.filter((run) => run.state === "failed" || run.state === "stopped" || run.state === "paused");
}

export function countRuns(runs: DashboardRun[]): DashboardCounts {
  return {
    running: runs.filter((run) => run.state === "running" || run.state === "detached").length,
    queued: runs.filter((run) => run.state === "queued").length,
    completed: runs.filter((run) => run.state === "complete").length,
    failed: runs.filter((run) => run.state === "failed" || run.state === "stopped" || run.state === "paused").length,
  };
}

function field(text: string, name: string): string | undefined {
  const match = text.match(new RegExp(`^${name}:\\s*(.+)$`, "mi"));
  return match?.[1]?.trim();
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function parseModel(value: string | undefined): { model?: string; thinking?: string } {
  if (!value) return {};
  const separator = value.match(/^(.*?)(?:\s*[·•]\s*|\s+\(([^)]+)\)$)([^()]*)$/);
  if (!separator) return { model: value.trim() };
  const model = separator[1]?.trim();
  const thinking = (separator[2] ?? separator[3])?.trim();
  return { ...(model ? { model } : {}), ...(thinking ? { thinking } : {}) };
}

function parseActivity(value: string | undefined): Pick<DashboardRun, "currentTool" | "currentPath" | "tokens"> {
  if (!value) return {};
  const tool = value.match(/(?:tool|current tool)(?:[:=]\s*|\s+)([^,|·]+)/i)?.[1]?.trim();
  const path = value.match(/(?:path)[:=]\s*([^,|·]+)/i)?.[1]?.trim();
  const tokens = (value.match(/(?:tokens?)[:=]\s*([^,|·]+)/i)?.[1] ?? value.match(/\b([\d.]+\s*[KMB]?\s+tok)\b/i)?.[1])?.trim();
  return { ...(tool ? { currentTool: tool } : {}), ...(path ? { currentPath: path } : {}), ...(tokens ? { tokens } : {}) };
}

interface PendingParent {
  run: DashboardRun;
  children: DashboardRun[];
}

function finishParent(output: DashboardRun[], pending: PendingParent | undefined): void {
  if (!pending) return;
  if (pending.children.length) output.push(...pending.children);
  else output.push(pending.run);
}

/** Parse the stable human-readable response from RPC status(view=fleet). */
export function parseFleetStatus(text: string, now = Date.now()): DashboardRun[] {
  const output: DashboardRun[] = [];
  let source: DashboardRunSource = "async";
  let pending: PendingParent | undefined;
  // Current pi-subagents status uses zero-based step indices. Older/status-like
  // fixtures may start at 1, so infer the base from the first child row per run.
  let childIndexBase: 0 | 1 | undefined;

  for (const line of text.split(/\r?\n/)) {
    if (line === "Foreground runs:") { finishParent(output, pending); pending = undefined; source = "foreground"; childIndexBase = undefined; continue; }
    if (line === "Detached foreground runs:") { finishParent(output, pending); pending = undefined; source = "foreground"; childIndexBase = undefined; continue; }
    if (line === "Async runs:") { finishParent(output, pending); pending = undefined; source = "async"; childIndexBase = undefined; continue; }

    const parentMatch = line.match(/^-\s+([^|\s]+)\s*\|\s*([^|]+)\s*\|\s*(.+)$/);
    if (parentMatch) {
      finishParent(output, pending);
      const runId = parentMatch[1]!.trim();
      const state = normalizeState(parentMatch[2]);
      const remainder = parentMatch[3]!.split(/\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
      const mode = remainder.find((part) => ["single", "parallel", "chain", "dynamic"].includes(part));
      const activity = parseActivity(remainder.join(" | "));
      const candidateAgent = source === "foreground" && mode ? remainder[remainder.indexOf(mode) + 1] : undefined;
      childIndexBase = undefined;
      pending = {
        run: {
          key: `${source}:${runId}`,
          runId,
          source,
          state,
          ...(mode ? { mode } : {}),
          agent: candidateAgent || mode || "subagent",
          title: candidateAgent || remainder.find((part) => part !== mode),
          updatedAt: now,
          ...activity,
        },
        children: [],
      };
      continue;
    }

    const childMatch = line.match(/^\s{2}(\d+)\.\s+(.+)$/);
    if (childMatch && pending) {
      const rawIndex = Number(childMatch[1]);
      childIndexBase ??= rawIndex === 0 ? 0 : 1;
      const index = Math.max(0, rawIndex - childIndexBase);
      const parts = childMatch[2]!.split(/\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
      let display = parts[0] ?? "subagent";
      const state = normalizeState(parts[1]);
      let phase: string | undefined;
      const phaseMatch = display.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (phaseMatch) { phase = phaseMatch[1]; display = phaseMatch[2]!; }
      const agentMatch = display.match(/^(.*?)\s*\(([^()]+)\)$/);
      const title = agentMatch?.[1]?.trim() || display;
      const agent = agentMatch?.[2]?.trim() || display;
      const modelPart = parts.find((part, partIndex) => partIndex > 1 && /(?:\/|gpt-|claude|inkling|llama|gemini)/i.test(part));
      const model = parseModel(modelPart);
      pending.children.push({
        ...pending.run,
        key: `${pending.run.source}:${pending.run.runId}:${index}`,
        index,
        state,
        agent,
        title,
        ...(phase ? { phase } : {}),
        ...parseActivity(parts.slice(2).join(" | ")),
        ...model,
      });
    }
  }
  finishParent(output, pending);
  return output;
}

export function runFromExactStatus(text: string, now = Date.now()): DashboardRun | undefined {
  const runId = field(text, "Run");
  if (!runId) return undefined;
  const current = field(text, "Current");
  const currentMatch = current?.match(/^(.*?)\s+step\s+(\d+)$/i);
  const agent = currentMatch?.[1]?.trim() || current || field(text, "Agent") || field(text, "Mode") || "subagent";
  const index = currentMatch?.[2] ? Math.max(0, Number(currentMatch[2]) - 1) : undefined;
  return applyExactStatus({
    key: `foreground:${runId}${index !== undefined ? `:${index}` : ""}`,
    runId,
    ...(index !== undefined ? { index } : {}),
    source: "foreground",
    state: normalizeState(field(text, "State")),
    mode: field(text, "Mode"),
    agent,
    title: agent,
    updatedAt: now,
  }, text);
}

/** Enrich a selected row from RPC status(id) text. */
export function applyExactStatus(run: DashboardRun, text: string): DashboardRun {
  const state = normalizeState(field(text, "State") ?? run.state);
  const asyncDir = field(text, "Dir") ?? run.asyncDir;
  const paths = text.split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:Dir|Output|Result|Session|Log|Events):\s*(.+)$/i)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));
  const activity = parseActivity(field(text, "Activity"));
  const error = field(text, "Error") ?? run.error;
  const selectedLine = run.index !== undefined
    ? text.split(/\r?\n/).find((line) => new RegExp(`^(?:Step|Agent)\\s+${run.index + 1}:`, "i").test(line))
    : undefined;
  const modelGroup = selectedLine
    ? [...selectedLine.matchAll(/\(([^()]*)\)/g)].map((match) => match[1]).find((value) => value?.includes("/"))
    : undefined;
  const selectedModel = parseModel(modelGroup);
  return {
    ...run,
    state,
    ...(field(text, "Mode") ? { mode: field(text, "Mode") } : {}),
    ...(parseTimestamp(field(text, "Started")) ? { startedAt: parseTimestamp(field(text, "Started")) } : {}),
    ...(parseTimestamp(field(text, "Updated")) ? { updatedAt: parseTimestamp(field(text, "Updated")) } : {}),
    ...(asyncDir ? { asyncDir } : {}),
    ...(error ? { error } : {}),
    ...(paths.length ? { paths: [...new Set(paths)] } : {}),
    ...selectedModel,
    ...activity,
    rawStatus: text,
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function numericField(value: unknown, names: string[]): number | undefined {
  const object = record(value);
  if (!object) return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  for (const name of names) {
    const candidate = object[name];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return undefined;
}

function eventTokens(item: Record<string, unknown>, event: Record<string, unknown>): string | undefined {
  const total = numericField(item.tokens ?? item.usage, ["total", "totalTokens"])
    ?? numericField(event.totalChildUsage ?? event.totalTokens, ["total", "totalTokens"]);
  return total !== undefined ? total.toLocaleString("en-US") : undefined;
}

function eventCost(item: Record<string, unknown>, event: Record<string, unknown>): string | undefined {
  const total = numericField(item.totalCost ?? item.cost, ["total", "totalCost"])
    ?? numericField(event.totalCost, ["total", "totalCost"]);
  return total !== undefined ? `$${total.toFixed(4)}` : undefined;
}

/** Normalize documented start/complete event payloads without depending on package-private types. */
export function runsFromLifecycleEvent(value: unknown, kind: "start" | "complete", now = Date.now()): DashboardRun[] {
  const event = record(value);
  if (!event) return [];
  const runId = String(event.runId ?? event.id ?? "").trim();
  if (!runId) return [];
  const results = Array.isArray(event.results) ? event.results.map(record).filter((item): item is Record<string, unknown> => Boolean(item)) : [];
  const agents = results.length
    ? results
    : Array.isArray(event.agents)
      ? event.agents.map((agent, index) => ({ agent, index }))
      : [{ agent: event.agent ?? event.mode ?? "subagent", index: 0 }];
  const overallSuccess = event.success === true;
  return agents.map((item, position) => {
    const index = typeof item.index === "number" ? item.index : position;
    const state = kind === "start"
      ? "running"
      : normalizeState(item.status ?? item.state ?? (item.success === true || overallSuccess ? "complete" : "failed"));
    const agent = String(item.agent ?? "subagent");
    const error = typeof item.error === "string" ? item.error : typeof event.error === "string" ? event.error : undefined;
    const model = typeof item.model === "string" ? item.model : undefined;
    const thinking = typeof item.thinking === "string" ? item.thinking : undefined;
    const attemptedModels = Array.isArray(item.attemptedModels) ? item.attemptedModels.filter((value): value is string => typeof value === "string") : undefined;
    const tokens = eventTokens(item, event);
    const cost = eventCost(item, event);
    const task = typeof event.task === "string" ? event.task : typeof event.goal === "string" ? event.goal : undefined;
    return {
      key: `async:${runId}:${index}`,
      runId,
      index,
      source: "async" as const,
      state,
      mode: typeof event.mode === "string" ? event.mode : undefined,
      agent,
      title: task || agent,
      task,
      model,
      thinking,
      attemptedModels,
      tokens,
      cost,
      error,
      asyncDir: typeof event.asyncDir === "string" ? event.asyncDir : undefined,
      startedAt: typeof event.startedAt === "number" ? event.startedAt : now,
      updatedAt: now,
    };
  });
}

export function mergeRuns(previous: DashboardRun[], fresh: DashboardRun[]): DashboardRun[] {
  const merged = new Map(previous.map((run) => [run.key, run]));
  for (const run of fresh) {
    const existing = merged.get(run.key);
    merged.set(run.key, { ...existing, ...run, task: run.task ?? existing?.task, title: run.title ?? existing?.title });
  }
  return [...merged.values()].sort((left, right) => {
    const rank = (run: DashboardRun) => run.state === "running" ? 0 : run.state === "queued" ? 1 : run.state === "failed" ? 2 : 3;
    return rank(left) - rank(right) || (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
  });
}

export function elapsedLabel(run: DashboardRun, now = Date.now()): string {
  if (!run.startedAt) return "";
  const milliseconds = Math.max(0, (run.state === "running" ? now : run.updatedAt ?? now) - run.startedAt);
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
