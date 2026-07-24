---
name: team-orchestration
description: Use for non-trivial implementation, multi-agent research, double review, or any request to orchestrate work end to end.
---

# Team Orchestration

Use the configured roles and saved chains instead of inventing an ad hoc swarm. Before launching any child or chain, obtain explicit user approval for the proposed role(s), task, and expected benefit unless the user directly requested the launch.

## Standard paths

- Need local + external context: run `research-context`.
- Need a reviewed implementation of an already-approved plan: run `execute-and-review`.
- Need adversarial review only: run `double-review`.
- Need a bespoke high-fanout workflow: use `workflow` with configured OpenAI tiers.

## Mandatory boundaries

1. Gather evidence before asking the user.
2. Before delegation, state the proposed role(s), task, expected benefit, and whether files may change; wait for explicit approval unless the user directly requested the launch.
3. Use `ask_user` for consequential ambiguity.
4. Use Plannotator for approval of non-trivial plans.
5. Keep one writer in the active worktree.
6. Use fresh context for both review stages when the user approves them.
7. Terra reviews first; Sol independently verifies second; Luna synthesizes last when the user approves the review pipeline.
8. Treat NVIDIA-NIM children as repeatable isolated tasks. Their fallback is Terra-medium.
9. Do not declare completion from a worker handoff alone.

## Child contract

Every delegated task must state:

- goal;
- exact scope and relevant paths;
- approved decisions and non-goals;
- acceptance criteria;
- validation commands or evidence;
- expected output format;
- conditions requiring escalation.

## Stop conditions

Stop and return to the user when a new product, architecture, security, deployment, billing, or destructive decision appears. Stop review loops when only optional polish remains.
