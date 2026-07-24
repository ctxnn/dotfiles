import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi, type Component, type TUI } from "@earendil-works/pi-tui";
import {
  canInterrupt,
  canStop,
  countRuns,
  elapsedLabel,
  filterRuns,
  type DashboardFilter,
  type DashboardRun,
  type DashboardSnapshot,
  type DashboardView,
} from "./types.ts";

type Theme = ExtensionContext["ui"]["theme"];

export interface DashboardActions {
  loadSnapshot: () => Promise<DashboardSnapshot>;
  loadDetail: (run: DashboardRun) => Promise<DashboardRun>;
  subscribe: (refresh: () => void) => () => void;
  copyRunId: (run: DashboardRun) => Promise<void>;
  interrupt: (run: DashboardRun) => Promise<void>;
  stop: (run: DashboardRun) => Promise<void>;
}

const FILTERS: DashboardFilter[] = ["active", "completed", "failed", "all"];
const VIEWS: DashboardView[] = ["overview", "details", "transcript", "artifacts"];
const REFRESH_MS = 1_500;

function fit(text: string, width: number): string {
  const clipped = truncateToWidth(text, Math.max(0, width));
  return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
}

function statusGlyph(run: DashboardRun, theme: Theme): string {
  if (run.state === "running") return theme.fg("accent", "●");
  if (run.state === "queued") return theme.fg("muted", "◦");
  if (run.state === "complete") return theme.fg("success", "✓");
  if (run.state === "paused" || run.state === "stopped" || run.state === "detached") return theme.fg("warning", "■");
  if (run.state === "failed") return theme.fg("error", "✗");
  return theme.fg("dim", "?");
}

function stateText(run: DashboardRun, theme: Theme): string {
  if (run.state === "running") return theme.fg("accent", run.state);
  if (run.state === "complete") return theme.fg("success", run.state);
  if (run.state === "failed") return theme.fg("error", run.state);
  if (run.state === "paused" || run.state === "stopped" || run.state === "detached") return theme.fg("warning", run.state);
  return theme.fg("muted", run.state);
}

function pathTail(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parts = value.split(/[\\/]/);
  return parts.length > 3 ? `…/${parts.slice(-3).join("/")}` : value;
}

function compactDetail(run: DashboardRun | undefined, theme: Theme): string[] {
  if (!run) return [theme.fg("dim", "No run selected."), "", "Launch a subagent and it will appear here automatically."];
  const model = [run.model, run.thinking].filter(Boolean).join(" · ");
  const lines = [
    `${theme.bold(run.agent)}  ${stateText(run, theme)}`,
    run.title && run.title !== run.agent ? theme.fg("muted", run.title) : undefined,
    "",
    `Run: ${run.runId}${run.index !== undefined ? ` · child ${run.index + 1}` : ""}`,
    run.phase ? `Phase: ${run.phase}` : undefined,
    run.mode ? `Mode: ${run.mode}` : undefined,
    model ? `Model: ${model}` : undefined,
    elapsedLabel(run) ? `Elapsed: ${elapsedLabel(run)}` : undefined,
    run.currentTool ? `Current tool: ${run.currentTool}` : undefined,
    run.currentPath ? `Path: ${pathTail(run.currentPath)}` : undefined,
    run.tokens ? `Tokens: ${run.tokens}` : undefined,
    run.cost ? `Cost: ${run.cost}` : undefined,
    run.attemptedModels?.length ? `Attempts: ${run.attemptedModels.join(" → ")}` : undefined,
    run.error ? `Error: ${run.error}` : undefined,
    "",
    theme.fg("accent", "Recent transcript"),
    ...(run.transcript?.split(/\r?\n/).slice(-12) ?? [theme.fg("dim", "Waiting for transcript output…")]),
  ];
  return lines.filter((line): line is string => line !== undefined);
}

function viewLines(run: DashboardRun | undefined, view: DashboardView, theme: Theme): string[] {
  if (view === "overview") return compactDetail(run, theme);
  if (!run) return [theme.fg("dim", "No run selected.")];
  if (view === "details") {
    return [theme.fg("accent", "Run details"), "", ...(run.rawStatus?.split(/\r?\n/) ?? compactDetail(run, theme))];
  }
  if (view === "transcript") {
    return [
      `${theme.fg("accent", "Transcript")} ${theme.fg("dim", "· scroll up pauses follow · End resumes LIVE")}`,
      "",
      ...(run.transcript?.split(/\r?\n/) ?? [theme.fg("dim", "No transcript output is available yet.")]),
    ];
  }
  return [
    theme.fg("accent", "Artifacts and session paths"),
    "",
    ...(run.paths?.length ? run.paths.map((item) => `• ${item}`) : [theme.fg("dim", "No artifact paths reported yet.")]),
    "",
    theme.fg("dim", "This view is read-only; it never opens external programs or modifies files."),
  ];
}

function styleDetailLine(line: string, theme: Theme): string {
  if (/^(Run|State|Mode|Progress|Started|Updated|Dir|Output|Result|Session|Log|Events|Activity|Model|Phase|Elapsed|Current tool|Path|Tokens|Cost|Attempts):/i.test(line)) {
    const separator = line.indexOf(":");
    return theme.bold(line.slice(0, separator + 1)) + line.slice(separator + 1);
  }
  if (/^(Error|Warning):/i.test(line)) return theme.fg("error", line);
  return line;
}

export class SubagentDashboardComponent implements Component {
  private runs: DashboardRun[] = [];
  private filter: DashboardFilter = "all";
  private view: DashboardView = "overview";
  private selected = 0;
  private selectedKey: string | undefined;
  private scroll = 0;
  private autoFollow = true;
  private detailLineCount = 0;
  private bodyHeight = 10;
  private loading = false;
  private busyAction: string | undefined;
  private error: string | undefined;
  private refreshedAt = 0;
  private disposed = false;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly done: (value: undefined) => void,
    private readonly actions: DashboardActions,
  ) {
    this.unsubscribe = actions.subscribe(() => void this.refresh());
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
    this.timer.unref?.();
    void this.refresh();
  }

  private visibleRuns(): DashboardRun[] {
    return filterRuns(this.runs, this.filter);
  }

  private selectedRun(): DashboardRun | undefined {
    return this.visibleRuns()[this.selected];
  }

  private preserveSelection(): void {
    const visible = this.visibleRuns();
    const preserved = this.selectedKey ? visible.findIndex((run) => run.key === this.selectedKey) : -1;
    this.selected = preserved >= 0 ? preserved : Math.min(this.selected, Math.max(0, visible.length - 1));
    this.selectedKey = visible[this.selected]?.key;
  }

  private async refresh(): Promise<void> {
    if (this.loading || this.disposed) return;
    this.loading = true;
    try {
      const snapshot = await this.actions.loadSnapshot();
      this.runs = snapshot.runs;
      this.error = snapshot.error;
      this.refreshedAt = snapshot.refreshedAt;
      this.preserveSelection();
      const selected = this.selectedRun();
      if (selected) {
        try {
          const detail = await this.actions.loadDetail(selected);
          const index = this.runs.findIndex((run) => run.key === selected.key);
          if (index >= 0) this.runs[index] = detail;
        } catch (error) {
          this.error = error instanceof Error ? error.message : String(error);
        }
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
      this.tui.requestRender();
    }
  }

  private moveSelection(delta: number): void {
    const visible = this.visibleRuns();
    if (!visible.length) return;
    this.selected = Math.max(0, Math.min(visible.length - 1, this.selected + delta));
    this.selectedKey = visible[this.selected]?.key;
    this.scroll = 0;
    this.autoFollow = true;
    void this.refresh();
    this.tui.requestRender();
  }

  private setFilter(filter: DashboardFilter): void {
    this.filter = filter;
    this.selected = 0;
    this.selectedKey = this.visibleRuns()[0]?.key;
    this.scroll = 0;
    this.autoFollow = true;
    this.tui.requestRender();
  }

  private cycleFilter(): void {
    const index = FILTERS.indexOf(this.filter);
    this.setFilter(FILTERS[(index + 1) % FILTERS.length]!);
  }

  private setView(view: DashboardView): void {
    this.view = view;
    this.scroll = 0;
    this.autoFollow = true;
    this.tui.requestRender();
  }

  private scrollBy(delta: number): void {
    const maxScroll = Math.max(0, this.detailLineCount - this.bodyHeight);
    this.autoFollow = false;
    this.scroll = Math.max(0, Math.min(maxScroll, this.scroll + delta));
    if (this.scroll >= maxScroll) this.autoFollow = true;
    this.tui.requestRender();
  }

  private async control(action: "interrupt" | "stop"): Promise<void> {
    const run = this.selectedRun();
    if (!run || this.busyAction) return;
    if (action === "interrupt" && !canInterrupt(run)) { this.error = `Cannot interrupt a ${run.state} run.`; this.tui.requestRender(); return; }
    if (action === "stop" && !canStop(run)) { this.error = run.source !== "async" ? "Stop is available only for running async runs." : `Cannot stop a ${run.state} run.`; this.tui.requestRender(); return; }
    this.busyAction = action;
    this.tui.requestRender();
    try {
      await this.actions[action](run);
      await this.refresh();
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.busyAction = undefined;
      this.tui.requestRender();
    }
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c") || matchesKey(data, "q")) { this.done(undefined); return; }
    if (matchesKey(data, "up") || matchesKey(data, "k")) { this.moveSelection(-1); return; }
    if (matchesKey(data, "down") || matchesKey(data, "j")) { this.moveSelection(1); return; }
    if (matchesKey(data, "pageUp")) { this.scrollBy(-this.bodyHeight); return; }
    if (matchesKey(data, "pageDown")) { this.scrollBy(this.bodyHeight); return; }
    if (matchesKey(data, "home")) { this.scroll = 0; this.autoFollow = false; this.tui.requestRender(); return; }
    if (matchesKey(data, "end")) { this.autoFollow = true; this.tui.requestRender(); return; }
    if (matchesKey(data, "enter")) { this.setView(this.view === "details" ? "overview" : "details"); return; }
    if (matchesKey(data, "tab")) { this.setView(VIEWS[(VIEWS.indexOf(this.view) + 1) % VIEWS.length]!); return; }
    const key = data.toLowerCase();
    if (key === "t") { this.setView("transcript"); return; }
    if (key === "o") { this.setView("artifacts"); return; }
    if (key === "f") { this.cycleFilter(); return; }
    if (key === "1") { this.setFilter("active"); return; }
    if (key === "2") { this.setFilter("completed"); return; }
    if (key === "3") { this.setFilter("failed"); return; }
    if (key === "4") { this.setFilter("all"); return; }
    if (key === "r") { void this.refresh(); return; }
    if (key === "c") { const run = this.selectedRun(); if (run) void this.actions.copyRunId(run); return; }
    if (key === "i") { void this.control("interrupt"); return; }
    if (key === "s") { void this.control("stop"); }
  }

  private rosterLines(width: number, height: number): string[] {
    const visible = this.visibleRuns();
    if (!visible.length) return [this.theme.fg("dim", ` No ${this.filter === "all" ? "tracked" : this.filter} runs`)];
    const cards = Math.max(1, Math.floor(height / 2));
    const start = Math.max(0, Math.min(this.selected - cards + 1, Math.max(0, visible.length - cards)));
    const lines: string[] = [];
    for (let index = start; index < Math.min(visible.length, start + cards); index++) {
      const run = visible[index]!;
      const selected = index === this.selected;
      const marker = selected ? this.theme.fg("accent", "›") : " ";
      const child = run.index !== undefined ? ` #${run.index + 1}` : "";
      const phase = run.phase ? ` · ${run.phase}` : "";
      lines.push(fit(`${marker} ${statusGlyph(run, this.theme)} ${this.theme.bold(run.agent)}${child}${phase}`, width));
      const meta = [run.title !== run.agent ? run.title : undefined, run.currentTool, elapsedLabel(run), run.state].filter(Boolean).join(" · ");
      lines.push(fit(`    ${selected ? this.theme.fg("text", meta) : this.theme.fg("dim", meta)}`, width));
    }
    return lines;
  }

  private detailLines(width: number): string[] {
    return viewLines(this.selectedRun(), this.view, this.theme).flatMap((line) => {
      const styled = styleDetailLine(line, this.theme);
      const wrapped = wrapTextWithAnsi(styled, Math.max(1, width));
      return wrapped.length ? wrapped : [""];
    });
  }

  render(width: number): string[] {
    if (width < 44) return [truncateToWidth("Subagent dashboard needs at least 44 columns. Esc closes.", width)];
    const rows = this.tui.terminal?.rows ?? 34;
    this.bodyHeight = Math.max(6, Math.min(34, Math.floor(rows * 0.88) - 8));
    const innerWidth = width - 2;
    const split = width >= 82;
    const rosterWidth = split ? Math.max(28, Math.min(48, Math.floor(innerWidth * 0.38))) : innerWidth;
    const detailWidth = split ? innerWidth - rosterWidth - 1 : innerWidth;
    const counts = countRuns(this.runs);
    const age = this.refreshedAt ? `${Math.max(0, Math.floor((Date.now() - this.refreshedAt) / 1000))}s ago` : "starting";
    const live = this.loading ? "refreshing" : `live · ${age}`;
    const summary = `${counts.running} running · ${counts.queued} queued · ${counts.completed} completed · ${counts.failed} attention`;
    const lines = [this.theme.fg("border", `╭${"─".repeat(innerWidth)}╮`)];
    lines.push(this.theme.fg("border", "│") + fit(` ${this.theme.bold("Subagent Control Center")} ${this.theme.fg("dim", `· ${summary} · ${live}`)}`, innerWidth) + this.theme.fg("border", "│"));
    lines.push(this.theme.fg("border", "│") + fit(` Filter: ${this.theme.fg("accent", this.filter)} · View: ${this.theme.fg("accent", this.view)}${this.busyAction ? ` · ${this.theme.fg("warning", `${this.busyAction} pending`)}` : ""}`, innerWidth) + this.theme.fg("border", "│"));

    if (split) {
      lines.push(this.theme.fg("border", `├${"─".repeat(rosterWidth)}┬${"─".repeat(detailWidth)}┤`));
      const roster = this.rosterLines(rosterWidth, this.bodyHeight);
      const details = this.detailLines(detailWidth);
      this.detailLineCount = details.length;
      const maxScroll = Math.max(0, details.length - this.bodyHeight);
      if (this.autoFollow && this.view === "transcript") this.scroll = maxScroll;
      else this.scroll = Math.min(this.scroll, maxScroll);
      const visibleDetails = details.slice(this.scroll, this.scroll + this.bodyHeight);
      for (let row = 0; row < this.bodyHeight; row++) {
        lines.push(this.theme.fg("border", "│") + fit(roster[row] ?? "", rosterWidth) + this.theme.fg("border", "│") + fit(visibleDetails[row] ?? "", detailWidth) + this.theme.fg("border", "│"));
      }
      lines.push(this.theme.fg("border", `├${"─".repeat(rosterWidth)}┴${"─".repeat(detailWidth)}┤`));
    } else {
      lines.push(this.theme.fg("border", `├${"─".repeat(innerWidth)}┤`));
      const content = this.view === "overview" ? this.rosterLines(innerWidth, this.bodyHeight) : this.detailLines(innerWidth);
      this.detailLineCount = content.length;
      const maxScroll = Math.max(0, content.length - this.bodyHeight);
      if (this.autoFollow && this.view === "transcript") this.scroll = maxScroll;
      else this.scroll = Math.min(this.scroll, maxScroll);
      const visible = content.slice(this.scroll, this.scroll + this.bodyHeight);
      for (let row = 0; row < this.bodyHeight; row++) lines.push(this.theme.fg("border", "│") + fit(visible[row] ?? "", innerWidth) + this.theme.fg("border", "│"));
      lines.push(this.theme.fg("border", `├${"─".repeat(innerWidth)}┤`));
    }

    if (this.error) lines.push(this.theme.fg("border", "│") + fit(` ${this.theme.fg("error", `! ${this.error}`)}`, innerWidth) + this.theme.fg("border", "│"));
    const follow = this.view === "transcript" ? (this.autoFollow ? "LIVE" : "PAUSED") : "";
    lines.push(this.theme.fg("border", "│") + fit(this.theme.fg("dim", ` ↑↓ select · Enter detail · t transcript ${follow} · o paths · f/1-4 filter`), innerWidth) + this.theme.fg("border", "│"));
    lines.push(this.theme.fg("border", "│") + fit(this.theme.fg("dim", " i interrupt · s stop · c copy ID · r refresh · Tab view · Esc close"), innerWidth) + this.theme.fg("border", "│"));
    lines.push(this.theme.fg("border", `╰${"─".repeat(innerWidth)}╯`));
    return lines.map((line) => truncateToWidth(line, width));
  }

  invalidate(): void {
    this.tui.requestRender();
  }

  dispose(): void {
    this.disposed = true;
    clearInterval(this.timer);
    this.unsubscribe();
  }
}

export async function openSubagentDashboard(ctx: ExtensionContext, actions: DashboardActions): Promise<void> {
  await ctx.ui.custom<undefined>(
    (tui, theme, _keybindings, done) => new SubagentDashboardComponent(tui, theme, done, actions),
    {
      overlay: true,
      overlayOptions: { anchor: "center", width: "96%", minWidth: 60, maxHeight: "90%", margin: 1 },
    },
  );
}
