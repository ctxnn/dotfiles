# Pi Team Configuration

A role-routed, fallback-aware engineering system built around Pi, Plannotator, Exa, `pi-subagents`, and dynamic workflows.

## Architecture

```text
Main: Sol-medium
   │
   ├─ Understand ── Scout + Researcher (GPT-5.5 → Terra fallback)
   ├─ Decide ────── ask_user
   ├─ Plan ──────── Sol-high + Plannotator approval
   ├─ Implement ─── Sol-high, one writer
   ├─ Review I ──── Terra-high
   ├─ Review II ─── Sol-high final verifier
   └─ Synthesize ── Luna-high
```

## Quick commands

| Goal | Command |
|---|---|
| Visual planning | `/plannotator` |
| Deep research + local context | `/research-brief <question>` |
| Double review | `/deep-review <target>` |
| Approved implementation + review | `/ship-reviewed <plan or task>` |
| Run saved chain directly | `/run-chain <name> -- <task>` |
| Inspect subagent models | `/subagents-models` |
| Diagnose subagents | `/subagents-doctor` |
| Watch all subagent runs | `/subagents-fleet` or `Ctrl+Alt+F` |
| Stop a subagent | `/subagents-stop <run-id>` |
| Show permission policy | `/permissions` |
| Open workflow dashboard | `/workflows` |
| Check NIM rolling budget | `/nim-rate-status` |
| Side conversation | `/btw <question>` |

Saved chains:

- `research-context`
- `double-review`
- `execute-and-review`

## NVIDIA-NIM reliability

- Shared rolling budget: 30 requests/minute (below the provider's 40 RPM cap).
- Orchestration concurrency: 2.
- Researcher primary: `openai-codex/gpt-5.5:medium`.
- Tester primary: `nvidia-nim/thinkingmachines/inkling:high`.
- Universal terminal model/provider fallback: `openai-codex/gpt-5.6-terra:medium`.
- Dynamic workflow tiers intentionally stay on OpenAI; NVIDIA-NIM is routed through named `pi-subagents` roles where fallback is native and observable.

Pi/provider retry logic gets the first opportunity to honor server backoff. If the child still terminates with a retryable provider failure (429, quota, auth, overload, network, or availability), `pi-subagents` reruns the isolated task on Terra-medium. Tool failures are not misclassified as model failures.

## Destructive-command permission gate

`extensions/permission-gate/` intercepts dangerous shell operations before execution. Interactive commands require one-time approval for the exact displayed command. Headless and subagent processes fail closed, report the blocked operation, and require the parent session to bring it back to the user. The gate covers recursive/forced deletion, privilege escalation, destructive Git, disk/filesystem, process/system, SQL, infrastructure/cloud, and delete-sync operations. Never store bypasses or attempt to evade the gate.

Use `/permissions` to confirm the gate is active.

## BTW model

Set once per session/thread:

```text
/btw:model openai-codex gpt-5.6-luna openai-codex-responses
/btw:thinking low
```

BTW stores its override in hidden session state and does not change the main model.

## Important files

| File | Purpose |
|---|---|
| `AGENTS.md` | Global operating policy and routing map |
| `settings.json` | Main model and builtin subagent overrides |
| `agents/*.md` | Custom tester, verifier, and synthesizer roles |
| `chains/*.chain.json` | Reusable orchestration pipelines |
| `extensions/subagent/config.json` | Async/concurrency/spawn guardrails |
| `extensions/permission-gate/` | Fail-closed destructive-command approval gate |
| `extensions/nvidia-nim-rate-guard.ts` | Cross-process rolling request limiter |
| `plannotator.json` | Planning/execution/review phase models |
| `~/.pi/workflows/*.json` | Dynamic workflow tiers and defaults |

## Tuning

Change role models in `settings.json` or the relevant custom agent file, then run `/reload`. Keep provider-qualified model IDs and preserve Terra-medium as the fallback unless intentionally revising the reliability policy.
