---
name: safe-operations
description: Mandatory safety procedure for deletion, destructive Git, privilege escalation, disk/database/infrastructure destruction, or any irreversible command.
---

# Safe Operations

The global `permission-gate` extension is the enforcement boundary. This skill defines the operating procedure around it.

## Rules

1. Prefer a reversible operation when one exists: move to a backup, create a Git checkpoint, use `--dry-run`, or target one explicit resource.
2. Explain what will be changed, why it is necessary, the exact scope, and the recovery path before requesting approval.
3. Never split, encode, alias, script, or otherwise rewrite a command to evade the permission gate.
4. Approval applies to the exact displayed command once. A changed command requires a new approval.
5. If a headless or subagent process is blocked, do not retry with a bypass. Return the blocked command and rationale to the parent session so the user can decide.
6. After an approved destructive operation, verify the intended result and report unexpected effects immediately.

## Guarded categories

- recursive/forced deletion and scripted deletion;
- privilege escalation;
- destructive Git reset/clean/history/branch/stash/file operations;
- filesystem, partition, raw-disk, broad permission, shutdown, and forced process operations;
- destructive SQL;
- destructive container, cluster, infrastructure, cloud, and delete-sync operations.

The extension is intentionally fail-closed when no interactive approval UI is available.
