# Pi Configuration

A role-routed Pi engineering system with explicit model assignments, external research through Exa, approval gates, one-writer implementation, two-model review, reusable workflows, and guarded NVIDIA-NIM usage.

The layout follows the core pattern of [umgbhalla/pi-config](https://github.com/umgbhalla/pi-config): the Pi configuration root contains `AGENTS.md`, `settings.json`, named agent definitions, skills, extensions, and prompts as discoverable source files. Because this is a multi-tool dotfiles repository rather than a dedicated Pi repository, that root lives at `pi/agent/` and is linked into `~/.pi/agent/` by `setup.sh`.

## Architecture

```text
Main session: GPT-5.6 Sol, medium
       │
       ├── Understand
       │     ├── Scout: GPT-5.5, medium
       │     └── Researcher: GPT-5.5, medium + Exa
       │
       ├── Decide: ask_user approval gate
       ├── Plan: GPT-5.6 Sol, high + Plannotator
       ├── Implement: GPT-5.6 Sol, high; one writer
       ├── Review I: GPT-5.6 Terra, high
       ├── Review II: GPT-5.6 Sol, high; independent verification
       ├── Test: NVIDIA Inkling, high
       └── Synthesize: GPT-5.6 Luna, high
```

The main conversation stays on OpenAI for continuity. NVIDIA-NIM is used only for the isolated tester role, where a failed provider request can be rerun safely on the OpenAI fallback.

## Model routing

| Role | Primary model | Thinking | Fallback |
|---|---|---:|---|
| Main/default | `openai-codex/gpt-5.6-sol` | medium | Main-session fallback is manual |
| Planner | `openai-codex/gpt-5.6-sol` | high | Terra medium |
| Scout | `openai-codex/gpt-5.5` | medium | Terra medium |
| Context builder | `openai-codex/gpt-5.5` | medium | Terra medium |
| Researcher | `openai-codex/gpt-5.5` | medium | Terra medium |
| Worker | `openai-codex/gpt-5.6-sol` | high | Terra medium |
| Reviewer, stage I | `openai-codex/gpt-5.6-terra` | high | Terra medium |
| Final verifier, stage II | `openai-codex/gpt-5.6-sol` | high | Terra medium |
| Tester | `nvidia-nim/thinkingmachines/inkling` | high | Terra medium |
| Synthesizer | `openai-codex/gpt-5.6-luna` | high | Terra medium |
| BTW side channel | `openai-codex/gpt-5.6-luna` | low | Manual |

“Terra medium” means:

```text
openai-codex/gpt-5.6-terra:medium
```

`pi-subagents` advances to fallback models for provider-class failures such as rate limits, quota, authentication, overload, network, and availability errors. It does not hide ordinary tool or implementation failures by misclassifying them as model failures.

## Configuration layout

```text
pi/
├── agent/
│   ├── AGENTS.md                    # global engineering/orchestration policy
│   ├── CONFIG.md                    # compact in-config operator note
│   ├── settings.json                # main model, packages, builtin role overrides
│   ├── plannotator.json             # planning/execution/review phase models
│   ├── packages.txt                 # reproducible package installation list
│   ├── setup.sh                     # safe Pi-only installer
│   ├── agents/
│   │   ├── final-verifier.md
│   │   ├── synthesizer.md
│   │   └── tester.md
│   ├── chains/
│   │   ├── double-review.chain.json
│   │   ├── execute-and-review.chain.json
│   │   └── research-context.chain.json
│   ├── extensions/
│   │   ├── nvidia-nim-rate-guard.ts
│   │   └── subagent/config.json
│   ├── prompts/
│   │   ├── deep-review.md
│   │   ├── research-brief.md
│   │   └── ship-reviewed.md
│   └── skills/
│       └── team-orchestration/SKILL.md
├── workflows/
│   ├── model-tiers.json
│   └── settings.json
└── web-search.json
```

Runtime data is deliberately absent: credentials, sessions, NPM dependencies, caches, generated model catalogs, binaries, and request counters are local-only.

## Installation

From the repository root, preview all dotfile changes:

```bash
./install.sh
```

Install everything:

```bash
./install.sh --apply
```

Install only Pi:

```bash
./pi/agent/setup.sh --apply
```

The Pi setup script:

1. backs up existing tracked targets under `~/.dotfiles-backup/<timestamp>/`;
2. links source configuration into `~/.pi/agent/`;
3. links workflow settings under `~/.pi/workflows/`;
4. links the Exa preference to `~/.pi/web-search.json`;
5. installs the packages listed in `packages.txt`;
6. never creates or copies `auth.json`.

After installation, start a new Pi session or run:

```text
/reload
```

## Authentication and secrets

Credentials are local state and must never enter this repository.

Use Pi's login flow for providers, for example:

```text
/login openai-codex
/login nvidia-nim
```

Provide the Exa credential through your local secret mechanism, such as `~/.zshrc.local`:

```bash
export EXA_API_KEY="..."
```

The tracked `.gitignore` excludes Pi's `auth.json`, but always inspect staged files before pushing.

## Everyday use

Start Pi normally:

```bash
pi
```

Simple work stays in the Sol-medium main session:

```text
Explain this module.
Fix the failing login test.
Add validation to this endpoint.
```

The global `AGENTS.md` instructs Pi to inspect first, ask before consequential decisions, avoid unnecessary delegation, preserve one writer, and validate before claiming completion.

## Prompt shortcuts

These tracked prompt templates are the easiest entry points to the configured pipelines.

### Research brief

```text
/research-brief Compare the recommended OAuth PKCE flow with this repository's implementation
```

Runs local scouting and external research in parallel, then Luna creates a decision brief. Exa is the default external search provider.

### Deep review

```text
/deep-review review the current git diff for correctness, regressions, and missing tests
```

Runs:

```text
Terra adversarial review → Sol independent verification → Luna synthesis
```

Both reviewers are instructed to inspect the actual repository and remain read-only.

### Ship reviewed work

```text
/ship-reviewed Implement the approved plan in docs/plan.md
```

Runs:

```text
Sol worker → Terra review → Sol verification → Luna synthesis
```

Use this only after the user has approved the task or plan. The workflow maintains one writer in the active worktree and does not declare success unless the final verifier approves.

## Saved chains

Invoke chains directly when desired:

```text
/run-chain research-context -- <question>
/run-chain double-review -- <review target>
/run-chain execute-and-review -- <approved plan or task>
```

| Chain | Stages | Best use |
|---|---|---|
| `research-context` | GPT-5.5 researcher + GPT-5.5 scout in parallel → Luna | External evidence connected to local code |
| `double-review` | Terra → Sol → Luna | High-confidence review without implementation |
| `execute-and-review` | Sol worker → Terra → Sol → Luna | Implementing an approved plan with review |

## Planning with Plannotator

Plannotator provides a visual review/annotation interface for Markdown plans.

| Command | Purpose |
|---|---|
| `/plannotator` | Open planning/annotation flow |
| `/plannotator <plan request>` | Begin a planning session |
| `/plannotator plans/auth.md` | Open a specific plan file |
| `/plannotator-annotate <file.md>` | Annotate an existing Markdown file |
| `/plannotator-review` | Review the current implementation/diff |
| `/plannotator-last` | Reopen the last Plannotator artifact |

Configured phases:

- Planning: Sol-high
- Executing: Sol-high
- Reviewing: Terra-high

The global policy requires approval before non-trivial implementation begins.

## Named subagents

Common commands provided by `pi-subagents`:

| Command | Purpose |
|---|---|
| `/run <agent> <task>` | Launch one named agent |
| `/parallel <agent/task...>` | Run independent agents concurrently |
| `/chain <agent/task...>` | Build an ad-hoc sequential chain |
| `/run-chain <name> -- <task>` | Run a saved chain |
| `/subagents` | Inspect configured/running subagents |
| `/subagents-models [agent]` | Show effective models and fallbacks |
| `/subagents-doctor` | Diagnose configuration and providers |
| `/subagents-fleet` | View active/completed runs |
| `/subagents-stop <id>` | Stop a run |
| `/subagent-cost` | Show child-agent usage/cost |

Examples:

```text
/run scout map the authentication flow
/run researcher find primary-source guidance for OAuth token rotation
/parallel scout "inspect backend" -> researcher "check official guidance"
/chain scout "map the module" -> planner "produce an implementation plan"
```

Subagents are asynchronous by default. Global child concurrency is 2, nested delegation depth is 1, and a parent session is capped at 50 child launches.

## Dynamic workflows

`@quintinshaw/pi-dynamic-workflows` is available for workflows requiring richer orchestration, checkpoints, retries/resume, worktrees, and dashboards.

| Command | Purpose |
|---|---|
| `/workflows` | Open workflow dashboard |
| `/workflows run <prompt>` | Generate/run a workflow from a prompt |
| `/workflows status <id>` | Inspect one run |
| `/workflows pause <id>` | Pause a workflow |
| `/workflows resume <id>` | Resume a workflow |
| `/workflows stop <id>` | Stop a workflow |
| `/workflows save <name>` | Save the current workflow |
| `/workflows-models` | Show configured model tiers |
| `/workflows-progress detailed` | Use detailed progress panels |
| `/workflows-trigger status` | Inspect natural-language workflow trigger |
| `/effort off|high|ultra` | Change orchestration effort |

Configured model tiers:

| Tier | Model |
|---|---|
| `small` | GPT-5.5 medium |
| `medium` | Luna high |
| `big` | Sol high |
| `review` | Terra high |
| `verify` | Sol high |
| `synthesis` | Luna high |
| `fallback` | Terra medium |

Dynamic workflows intentionally stay on OpenAI. NVIDIA-NIM is routed through the named tester role, where model fallback is explicit and observable.

## BTW side channel

BTW answers side questions without derailing the primary conversation.

Set its intended model in each new session/thread:

```text
/btw:model openai-codex gpt-5.6-luna openai-codex-responses
/btw:thinking low
```

Commands:

| Command | Purpose |
|---|---|
| `/btw <question>` | Ask a side question |
| `/btw:new [question]` | Start a fresh side thread |
| `/btw:inject [instructions]` | Inject useful side-thread context into the main session |
| `/btw:summarize [instructions]` | Summarize the side thread |
| `/btw:clear` | Clear BTW state |
| `/btw:model` | Inspect/change the side-channel model |
| `/btw:thinking` | Inspect/change its thinking level |

## Research and web access

`pi-web-access` provides:

- `web_search` — multi-provider search, configured to prefer Exa;
- `fetch_content` — readable page, GitHub, YouTube, and media extraction;
- `get_search_content` — retrieve full stored search/fetch content;
- the `librarian` skill for source-code research with GitHub permalinks.

The orchestration policy uses the researcher for external facts and the scout for repository facts, then synthesizes only when both are needed.

## Installed packages/extensions

| Package | What it adds |
|---|---|
| `pi-web-access` | Exa-backed web search, URL/content extraction, librarian skill |
| `pi-copy-all` | `/copy-all` command for copying conversation content |
| `pi-ask-user` | Structured `ask_user` decision UI and mandatory approval-gate skill |
| `@plannotator/pi-extension` | Visual plan annotation and review |
| `pi-btw` | Non-disruptive side conversation |
| `pi-extension-nvidia-nim` | NVIDIA-NIM provider and model catalog |
| `pi-subagents` | Named roles, chains, parallel runs, async lifecycle, fallback models |
| `@quintinshaw/pi-dynamic-workflows` | Generated workflows, retries, checkpoints, worktrees, dashboards |

The package list is represented both in `settings.json` and `packages.txt` so a fresh machine can recreate the runtime without committing `node_modules`.

## Custom NVIDIA-NIM guard

`extensions/nvidia-nim-rate-guard.ts` enforces a shared cross-process rolling window:

- configured provider ceiling: 40 RPM;
- local safety budget: 30 requests per rolling minute;
- orchestrated child concurrency: 2;
- shared state: local runtime file, never committed.

Inspect the current local budget:

```text
/nim-rate-status
```

If the rolling budget is full, a request waits for the next slot. If the provider still returns a terminal retryable failure, the isolated tester run falls back to Terra-medium through `pi-subagents`.

## Other useful commands

| Command | Purpose |
|---|---|
| `/copy-all` | Copy the conversation |
| `/model` | Select/inspect the active model |
| `/login nvidia-nim` | Authenticate NVIDIA-NIM locally |
| `/reload` | Reload extensions, skills, prompts, and configuration |
| `/nim-rate-status` | Inspect the custom NVIDIA request budget |

## Maintenance and validation

After changing Pi files:

```text
/reload
/subagents-doctor
/subagents-models
```

From the shell:

```bash
jq empty pi/agent/settings.json
jq empty pi/agent/plannotator.json
jq empty pi/agent/chains/*.json
jq empty pi/workflows/*.json
pi --list-models
```

Before committing:

```bash
git diff --check
git diff --cached
```

Never add `~/.pi/agent/auth.json`, session JSONL, request state, NPM dependencies, generated model files, or provider keys.
