import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { assessDangerousCommand, guardedOperationCount } from "./rules.ts";

const MAX_COMMAND_DISPLAY = 4_000;

function commandPreview(command: string): string {
  if (command.length <= MAX_COMMAND_DISPLAY) return command;
  return `${command.slice(0, MAX_COMMAND_DISPLAY)}\n… (${command.length - MAX_COMMAND_DISPLAY} more characters)`;
}

function reasonText(command: string): string | undefined {
  const findings = assessDangerousCommand(command);
  if (findings.length === 0) return undefined;
  return findings.map((finding) => `• ${finding.description}`).join("\n");
}

async function requestApproval(
  command: string,
  cwd: string,
  hasUI: boolean,
  confirm: (title: string, message: string) => Promise<boolean>,
): Promise<{ approved: boolean; reason: string }> {
  const reasons = reasonText(command);
  if (!reasons) return { approved: true, reason: "not guarded" };

  if (!hasUI) {
    return {
      approved: false,
      reason: `Destructive command blocked because this process has no approval UI. Ask the parent/user to approve and execute it explicitly. Guard match: ${reasons.replaceAll("\n", "; ")}`,
    };
  }

  const approved = await confirm(
    "🛡 Destructive command approval",
    `Reasons:\n${reasons}\n\nWorking directory:\n${cwd}\n\nCommand:\n${commandPreview(command)}\n\nAllow this command once?`,
  );
  return {
    approved,
    reason: approved ? "approved once by user" : "destructive command declined by user",
  };
}

export default function permissionGate(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.setStatus("permission-gate", "🛡 guarded");
  });

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    const command = (event.input as { command?: unknown }).command;
    if (typeof command !== "string" || assessDangerousCommand(command).length === 0) return;

    const decision = await requestApproval(
      command,
      ctx.cwd,
      ctx.hasUI,
      (title, message) => ctx.ui.confirm(title, message),
    );
    if (!decision.approved) return { block: true, reason: decision.reason };
  });

  pi.on("user_bash", async (event, ctx) => {
    if (assessDangerousCommand(event.command).length === 0) return;
    const decision = await requestApproval(
      event.command,
      event.cwd,
      ctx.hasUI,
      (title, message) => ctx.ui.confirm(title, message),
    );
    if (!decision.approved) {
      return {
        result: {
          output: decision.reason,
          exitCode: 126,
          cancelled: true,
          truncated: false,
        },
      };
    }
  });

  pi.registerCommand("permissions", {
    description: "Show the destructive-command permission policy",
    handler: async (_args, ctx) => {
      ctx.ui.notify(
        `Permission gate active: ${guardedOperationCount} destructive command families; approvals are one-time; headless/subagent commands fail closed.`,
        "info",
      );
    },
  });
}
