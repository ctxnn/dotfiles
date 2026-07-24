# Plan: Interactive Subagent Supervisor Dashboard

**Status:** Implemented — automated validation passed; live TUI smoke review and publication pending parent review

## Goal

Add a global Pi extension that provides a more readable, interactive dashboard for current-session `pi-subagents` work without modifying the installed `pi-subagents` package.

## Evidence and constraints

- The installed native fleet (`pi-subagents/src/tui/fleet.ts`) is an inspection-only two-column overlay. It refreshes every 750 ms and currently supports select, transcript scroll, refresh, and close.
- `pi-subagents` exposes a public in-process RPC bridge: `subagents:rpc:v1:*` with `status`, `interrupt`, and `stop` operations.
- The existing native fleet owns `/subagents-fleet` and `Ctrl+Alt+F`; the dashboard must not override either.
- Dashboard scope is the current parent Pi session, matching the native fleet security/visibility model.
- Stop/interrupt can affect running work. Both require an interactive confirmation. No steering, spawning, resume, or direct filesystem mutation is included in v1.
- The destructive-command permission gate remains independent and unchanged.

## Proposed UX

```text
╭────────────── Subagent Control Center ──────────────╮
│ 2 running · 1 queued · 3 completed · live refresh   │
├───────────────────┬─────────────────────────────────┤
│ FILTERED RUNS     │ SELECTED RUN                     │
│ ● scout           │ status/model/phase/duration      │
│ ◦ researcher      │ current tool/path/tokens/cost    │
│ ✓ reviewer        │ compact live transcript          │
│ ✗ failed worker   │ readable error/fallback detail   │
├───────────────────┴─────────────────────────────────┤
│ ↑↓ select · Enter detail · t transcript · f filter  │
│ i interrupt · s stop · o artifacts · c copy ID      │
│ r refresh · Esc close                               │
╰─────────────────────────────────────────────────────╯
```

## Files

```text
pi/agent/extensions/subagent-dashboard/
├── index.ts       # command/shortcut registration and RPC client
├── dashboard.ts   # TUI state, rendering, navigation, controls
└── types.ts       # narrow status/result types and view-model helpers
```

Documentation updates:

```text
pi/agent/AGENTS.md
pi/agent/CONFIG.md
docs/PI.md
```

## Checklist

- [x] Build a narrow RPC client for `ping`, `status`, `interrupt`, and `stop`, with request IDs, timeout/error states, and cleanup of reply listeners.
- [x] Subscribe to the documented `pi-subagents` ready/start/complete/control events so the view refreshes quickly; retain a conservative timed refresh fallback.
- [x] Normalize current-session status data into dashboard rows with role, task label, phase, state, duration, current tool/path, model/thinking, tokens/cost, fallback attempts, and readable errors.
- [x] Implement a responsive roster/compact-detail/focused-transcript overlay with an additional read-only artifact view; preserve selection/filter/scroll state across live refreshes.
- [x] Add filters for active, completed, failed/stopped, and all; provide keyboard shortcuts `1`–`4` and `f`.
- [x] Add read-only actions: copy selected run ID and show artifact/session/output paths. Do not open external programs or mutate files.
- [x] Add safe run controls: `i` soft-interrupt and `s` stop only for eligible selected runs, each with a confirmation dialog and visible result/error notification.
- [x] Register `/subagents-dashboard` and `Ctrl+Alt+D`. Preserve native `/subagents-fleet` and `Ctrl+Alt+F` as a fallback.
- [x] Provide a no-UI textual fallback that explains how to use `/subagents-fleet` and status commands rather than attempting an interactive dashboard in print/JSON mode.
- [x] Update Pi documentation with dashboard purpose, shortcut map, scope limitation, and safe-control behavior.
- [ ] Add focused unit-style tests for view-model filtering and state/eligibility logic (**done: 6 passing tests**), then run a manual TUI smoke test with a harmless async scout (**pending parent; child orchestration boundary prevents this worker from launching another subagent**).
- [x] Validate TypeScript loading through Pi, JSON/shell integrity, no shortcut/command collisions, no credential exposure, and repository security scans.
- [ ] Sync the extension into `~/.pi/agent` (**done**) and verify live discovery (**done**); reload the already-running parent TUI, smoke-test the overlay, review, and publish (**pending parent**).

## Acceptance criteria

1. `/subagents-dashboard` opens a readable live overlay in TUI mode without breaking `/subagents-fleet`.
2. The dashboard correctly renders queued, running, complete, failed, paused, and stopped current-session children.
3. Selection, filters, transcript scrolling, and auto-follow work during periodic/event-driven refreshes.
4. `i` and `s` never act without confirmation; unavailable actions clearly explain why.
5. The extension invokes only documented `pi-subagents` RPC/events and does not import private package internals.
6. Print/JSON/headless use stays safe and does not block or crash.
7. No source/runtime credentials or subagent artifacts are committed.

## Non-goals for v1

- Replacing the native fleet UI.
- Workflows dashboard integration.
- Starting new agents from the dashboard.
- Steering/resuming agents from the dashboard.
- Cross-session or cross-machine monitoring.
- Editing project files from the dashboard.
