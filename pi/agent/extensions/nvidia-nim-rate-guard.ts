import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROVIDER = "nvidia-nim";
const LIMIT = 30;
const WINDOW_MS = 60_000;
const LOCK_STALE_MS = 15_000;
const LOCK_RETRY_MS = 40;

const runtimeDir = join(getAgentDir(), "runtime");
const statePath = join(runtimeDir, "nvidia-nim-rate.json");
const lockPath = `${statePath}.lock`;

type RateState = { timestamps: number[] };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function readState(now = Date.now()): RateState {
  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as Partial<RateState>;
    const timestamps = Array.isArray(parsed.timestamps)
      ? parsed.timestamps.filter((value): value is number =>
          typeof value === "number" && Number.isFinite(value) && value > now - WINDOW_MS,
        )
      : [];
    return { timestamps };
  } catch {
    return { timestamps: [] };
  }
}

function writeState(state: RateState): void {
  mkdirSync(dirname(statePath), { recursive: true });
  const tempPath = `${statePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(state)}\n`, "utf8");
  renameSync(tempPath, statePath);
}

async function acquireLock(): Promise<void> {
  mkdirSync(runtimeDir, { recursive: true });
  for (;;) {
    try {
      mkdirSync(lockPath);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
          rmSync(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        // Another process may have released the lock between checks.
      }
      await sleep(LOCK_RETRY_MS);
    }
  }
}

async function reserveRequest(): Promise<void> {
  for (;;) {
    await acquireLock();
    let waitMs = 0;
    try {
      const now = Date.now();
      const state = readState(now);
      if (state.timestamps.length < LIMIT) {
        state.timestamps.push(now);
        writeState(state);
        return;
      }
      waitMs = Math.max(50, state.timestamps[0] + WINDOW_MS - now + 25);
    } finally {
      rmSync(lockPath, { recursive: true, force: true });
    }
    await sleep(waitMs);
  }
}

export default function nvidiaNimRateGuard(pi: ExtensionAPI) {
  pi.on("before_provider_request", async (_event, ctx) => {
    if (ctx.model?.provider !== PROVIDER) return;
    await reserveRequest();
  });

  pi.registerCommand("nim-rate-status", {
    description: "Show the shared NVIDIA-NIM rolling-minute request budget",
    handler: async (_args, ctx) => {
      const now = Date.now();
      const state = readState(now);
      const remaining = Math.max(0, LIMIT - state.timestamps.length);
      const resetMs = state.timestamps.length
        ? Math.max(0, state.timestamps[0] + WINDOW_MS - now)
        : 0;
      ctx.ui.notify(
        `NVIDIA-NIM: ${state.timestamps.length}/${LIMIT} requests in the rolling minute; ${remaining} available` +
          (resetMs ? `; next slot in ${Math.ceil(resetMs / 1000)}s` : ""),
        "info",
      );
    },
  });
}
