import * as fs from "node:fs";
import * as path from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { copyToClipboard, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import { openSubagentDashboard, type DashboardActions } from "./dashboard.ts";
import {
  applyExactStatus,
  mergeRuns,
  parseFleetStatus,
  runFromExactStatus,
  runsFromLifecycleEvent,
  type DashboardRun,
  type DashboardSnapshot,
} from "./types.ts";

const RPC_VERSION = 1;
const RPC_REQUEST = "subagents:rpc:v1:request";
const RPC_REPLY_PREFIX = "subagents:rpc:v1:reply:";
const RPC_TIMEOUT_MS = 5_000;
const MAX_RECENT_RUNS = 20;
const MAX_TRANSCRIPT_BYTES = 128 * 1024;

interface RpcReply {
  version: number;
  requestId: string;
  success: boolean;
  data?: { text?: string; details?: unknown; isError?: boolean };
  error?: { code?: string; message?: string };
}

class SubagentRpcClient {
  constructor(private readonly pi: ExtensionAPI) {}

  request(method: "ping" | "status" | "interrupt" | "stop", params?: Record<string, unknown>): Promise<{ text: string; details?: unknown }> {
    const requestId = randomUUID();
    const replyEvent = `${RPC_REPLY_PREFIX}${requestId}`;
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = (unsubscribe: (() => void) | void, timer: ReturnType<typeof setTimeout>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (typeof unsubscribe === "function") unsubscribe();
      };
      let unsubscribe: (() => void) | void;
      const timer = setTimeout(() => {
        cleanup(unsubscribe, timer);
        reject(new Error(`pi-subagents RPC '${method}' timed out after ${RPC_TIMEOUT_MS / 1000}s. Run /subagents-doctor.`));
      }, RPC_TIMEOUT_MS);
      timer.unref?.();
      unsubscribe = this.pi.events.on(replyEvent, (value: unknown) => {
        const reply = value as RpcReply;
        if (!reply || reply.requestId !== requestId) return;
        cleanup(unsubscribe, timer);
        if (!reply.success) {
          reject(new Error(reply.error?.message || `pi-subagents RPC '${method}' failed.`));
          return;
        }
        resolve({ text: reply.data?.text ?? "", ...(reply.data?.details !== undefined ? { details: reply.data.details } : {}) });
      });
      this.pi.events.emit(RPC_REQUEST, {
        version: RPC_VERSION,
        requestId,
        method,
        ...(params ? { params } : {}),
        source: { extension: "subagent-dashboard" },
      });
    });
  }
}

function expandHome(value: string): string {
  return value === "~" ? homedir() : value.startsWith("~/") ? path.join(homedir(), value.slice(2)) : value;
}

function readTail(filePath: string, maxBytes = MAX_TRANSCRIPT_BYTES): string | undefined {
  try {
    const absolute = expandHome(filePath);
    const stat = fs.statSync(absolute);
    if (!stat.isFile()) return undefined;
    const length = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(length);
    const descriptor = fs.openSync(absolute, "r");
    try {
      fs.readSync(descriptor, buffer, 0, length, Math.max(0, stat.size - length));
    } finally {
      fs.closeSync(descriptor);
    }
    const text = buffer.toString("utf8");
    return (stat.size > maxBytes ? `… transcript truncated to latest ${Math.round(maxBytes / 1024)} KiB …\n` : "") + text;
  } catch {
    return undefined;
  }
}

function transcriptFor(run: DashboardRun): string | undefined {
  const candidates: string[] = [];
  if (run.asyncDir && run.index !== undefined) candidates.push(path.join(expandHome(run.asyncDir), `output-${run.index}.log`));
  if (run.asyncDir) candidates.push(path.join(expandHome(run.asyncDir), `subagent-log-${run.runId}.md`));
  for (const candidate of run.paths ?? []) {
    if (/\.(?:log|md|txt|jsonl)$/i.test(candidate)) candidates.push(expandHome(candidate));
  }
  for (const candidate of [...new Set(candidates)]) {
    const transcript = readTail(candidate);
    if (transcript?.trim()) return transcript;
  }
  return undefined;
}

function trimRecent(runs: DashboardRun[]): DashboardRun[] {
  const active = runs.filter((run) => run.state === "running" || run.state === "queued" || run.state === "detached");
  const terminal = runs
    .filter((run) => !active.includes(run))
    .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
    .slice(0, MAX_RECENT_RUNS);
  return [...active, ...terminal];
}

function noUiMessage(pi: ExtensionAPI, ctx: ExtensionContext): void {
  const message = "The interactive subagent dashboard requires Pi TUI mode. Use /subagents-fleet for the textual fallback, or ask for subagent status/transcript by run ID.";
  if (ctx.mode === "print") {
    process.stdout.write(`${message}\n`);
    return;
  }
  pi.sendMessage({ customType: "subagent-dashboard", content: message, display: true });
}

export default function subagentDashboard(pi: ExtensionAPI) {
  const rpc = new SubagentRpcClient(pi);
  let remembered: DashboardRun[] = [];
  let dashboardOpen = false;
  const refreshListeners = new Set<() => void>();

  const notifyRefresh = () => {
    for (const listener of refreshListeners) listener();
  };
  const rememberStart = (value: unknown) => {
    remembered = trimRecent(mergeRuns(remembered, runsFromLifecycleEvent(value, "start")));
    notifyRefresh();
  };
  const rememberComplete = (value: unknown) => {
    const completed = runsFromLifecycleEvent(value, "complete");
    const ids = new Set(completed.map((run) => run.runId));
    remembered = trimRecent(mergeRuns(remembered.filter((run) => !ids.has(run.runId)), completed));
    notifyRefresh();
  };

  pi.events.on("subagent:async-started", rememberStart);
  pi.events.on("subagent:async-complete", rememberComplete);
  pi.events.on("subagent:foreground-complete", rememberComplete);
  pi.events.on("subagent:control-event", notifyRefresh);
  pi.events.on("subagents:rpc:v1:ready", notifyRefresh);

  pi.on("session_start", async () => {
    remembered = [];
  });

  const loadSnapshot = async (): Promise<DashboardSnapshot> => {
    try {
      const response = await rpc.request("status");
      const parsed = parseFleetStatus(response.text);
      const exact = parsed.length === 0 ? runFromExactStatus(response.text) : undefined;
      const active = exact ? [exact] : parsed;
      remembered = trimRecent(mergeRuns(remembered, active));
      return { runs: remembered, refreshedAt: Date.now() };
    } catch (error) {
      return {
        runs: remembered,
        error: error instanceof Error ? error.message : String(error),
        refreshedAt: Date.now(),
      };
    }
  };

  const loadDetail = async (run: DashboardRun): Promise<DashboardRun> => {
    const response = await rpc.request("status", {
      id: run.runId,
      ...(run.index !== undefined ? { index: run.index } : {}),
    });
    const detailed = applyExactStatus(run, response.text);
    const transcript = transcriptFor(detailed);
    return { ...detailed, ...(transcript ? { transcript } : {}) };
  };

  const actionsFor = (ctx: ExtensionContext): DashboardActions => ({
    loadSnapshot,
    loadDetail,
    subscribe(refresh) {
      refreshListeners.add(refresh);
      return () => refreshListeners.delete(refresh);
    },
    async copyRunId(run) {
      await copyToClipboard(run.runId);
      ctx.ui.notify(`Copied run ID: ${run.runId}`, "info");
    },
    async interrupt(run) {
      const confirmed = await ctx.ui.confirm(
        "Interrupt subagent run?",
        `Soft-interrupt ${run.agent} in run ${run.runId}${run.index !== undefined ? ` (child ${run.index + 1})` : ""}?\n\nThe current child turn will be cancelled and the run will pause.`,
      );
      if (!confirmed) { ctx.ui.notify("Interrupt cancelled.", "info"); return; }
      await rpc.request("interrupt", { id: run.runId, ...(run.index !== undefined ? { index: run.index } : {}) });
      ctx.ui.notify(`Interrupt requested for ${run.runId}.`, "warning");
    },
    async stop(run) {
      const confirmed = await ctx.ui.confirm(
        "Stop async subagent run?",
        `Stop the entire async run ${run.runId}?\n\nThis affects every child still running in that chain/parallel run and cannot be resumed as the same run.`,
      );
      if (!confirmed) { ctx.ui.notify("Stop cancelled.", "info"); return; }
      await rpc.request("stop", { id: run.runId });
      ctx.ui.notify(`Stop requested for ${run.runId}.`, "warning");
    },
  });

  const showDashboard = async (ctx: ExtensionContext) => {
    if (ctx.mode !== "tui" || !ctx.hasUI) { noUiMessage(pi, ctx); return; }
    if (dashboardOpen) { ctx.ui.notify("Subagent dashboard is already open.", "info"); return; }
    dashboardOpen = true;
    try {
      await openSubagentDashboard(ctx, actionsFor(ctx));
    } finally {
      dashboardOpen = false;
    }
  };

  pi.registerCommand("subagents-dashboard", {
    description: "Open the interactive current-session subagent supervisor dashboard",
    handler: async (_args, ctx) => showDashboard(ctx),
  });

  pi.registerShortcut(Key.ctrlAlt("d"), {
    description: "Open interactive subagent supervisor dashboard",
    handler: async (ctx) => showDashboard(ctx),
  });
}
