import assert from "node:assert/strict";
import test from "node:test";

const modulePath = new URL("../pi/agent/extensions/subagent-dashboard/types.ts", import.meta.url);
const {
  applyExactStatus,
  canInterrupt,
  canStop,
  countRuns,
  filterRuns,
  mergeRuns,
  parseFleetStatus,
  runFromExactStatus,
  runsFromLifecycleEvent,
} = await import(modulePath.href);

const fleetText = `Active async runs: 2

- run-alpha | running | tool read | 2 tools | chain | step 1/2 | ~/repo
  1. [Evidence] Inspect repo (scout) | running | tool read | ~/repo/README.md | openai-codex/gpt-5.5 · medium
  2. [Synthesis] Merge report (synthesizer) | pending | openai-codex/gpt-5.6-luna · high
- run-beta | queued | single | step 1/1 | ~/repo
  1. tester | pending | nvidia-nim/thinkingmachines/inkling · high`;

test("parses active async list into zero-based child rows", () => {
  const runs = parseFleetStatus(fleetText, 1_000);
  assert.equal(runs.length, 3);
  assert.deepEqual(runs.map((run) => [run.runId, run.index, run.agent, run.state]), [
    ["run-alpha", 0, "scout", "running"],
    ["run-alpha", 1, "synthesizer", "queued"],
    ["run-beta", 0, "tester", "queued"],
  ]);
  assert.equal(runs[0].phase, "Evidence");
  assert.match(runs[0].currentTool, /read/);
});

test("parses the current zero-based pi-subagents step format", () => {
  const runs = parseFleetStatus(`Active async runs: 1

- run-current | running | tool read | chain | step 1/2 | ~/repo
  0. [Evidence] Inspect repo (scout) | running | tool read | openai-codex/gpt-5.5 · medium
  1. [Synthesis] Merge report (synthesizer) | pending | openai-codex/gpt-5.6-luna · high`);
  assert.deepEqual(runs.map((run) => [run.index, run.agent]), [[0, "scout"], [1, "synthesizer"]]);
});

test("filters and counts dashboard states", () => {
  const runs = [
    ...parseFleetStatus(fleetText),
    ...runsFromLifecycleEvent({ runId: "done", success: true, results: [{ agent: "reviewer", status: "complete", index: 0 }] }, "complete"),
    ...runsFromLifecycleEvent({ runId: "bad", success: false, results: [{ agent: "worker", status: "failed", index: 0, error: "boom" }] }, "complete"),
  ];
  assert.equal(filterRuns(runs, "active").length, 3);
  assert.equal(filterRuns(runs, "completed").length, 1);
  assert.equal(filterRuns(runs, "failed").length, 1);
  assert.deepEqual(countRuns(runs), { running: 1, queued: 2, completed: 1, failed: 1 });
});

test("enforces safe interrupt and stop eligibility", () => {
  const [running] = parseFleetStatus(fleetText);
  assert.equal(canInterrupt(running), true);
  assert.equal(canStop(running), true);
  assert.equal(canStop({ ...running, source: "foreground" }), false);
  assert.equal(canInterrupt({ ...running, state: "complete" }), false);
});

test("parses a foreground exact-status response", () => {
  const run = runFromExactStatus("Run: foreground-1\nState: running\nMode: single\nCurrent: scout step 1\nActivity: tool read | 3 tools");
  assert.equal(run.runId, "foreground-1");
  assert.equal(run.source, "foreground");
  assert.equal(run.index, 0);
  assert.equal(run.agent, "scout");
  assert.match(run.currentTool, /read/);
});

test("enriches a selected row from exact status text", () => {
  const [run] = parseFleetStatus(fleetText);
  const exact = `Run: run-alpha
State: running
Mode: chain
Started: 2026-07-24T10:00:00.000Z
Updated: 2026-07-24T10:01:00.000Z
Dir: /tmp/run-alpha
Output: /tmp/run-alpha/result.md
Step 1: [Evidence] Inspect repo (scout) running (openai-codex/gpt-5.5 · medium)
Session: /tmp/run-alpha/session.jsonl
Log: /tmp/run-alpha/subagent-log-run-alpha.md`;
  const enriched = applyExactStatus(run, exact);
  assert.equal(enriched.asyncDir, "/tmp/run-alpha");
  assert.equal(enriched.paths.length, 4);
  assert.match(enriched.rawStatus, /Step 1/);
  assert.ok(enriched.startedAt > 0);
});

test("merges event metadata with fresher status rows", () => {
  const eventRows = runsFromLifecycleEvent({ id: "run-alpha", mode: "chain", agents: ["scout", "synthesizer"], task: "Map repository" }, "start", 500);
  const statusRows = parseFleetStatus(fleetText, 1_000).filter((run) => run.runId === "run-alpha");
  const merged = mergeRuns(eventRows, statusRows);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].task, "Map repository");
  assert.equal(merged[0].state, "running");
});
