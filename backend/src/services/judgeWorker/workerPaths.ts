import * as fs from "fs/promises";
import * as path from "path";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves judge worker entry path.
 *
 * Priority:
 * - env JUDGE_WORKER_ENTRY
 * - repo-relative to backend runtime (works for `backend/dist/...` and `backend/src/...`)
 * - cwd-relative fallback
 */
export async function resolveJudgeWorkerEntry(): Promise<string> {
  const envPath = process.env.JUDGE_WORKER_ENTRY;
  if (envPath && (await exists(envPath))) return envPath;

  // When running compiled backend: __dirname ~ backend/dist/services/judgeWorker
  // When running ts-node-dev: __dirname ~ backend/src/services/judgeWorker
  // In both cases, going up 4 levels gets us to repo root.
  const fromDirname = path.resolve(__dirname, "..", "..", "..", "..", "judge", "dist", "index.js");
  if (await exists(fromDirname)) return fromDirname;

  const fromCwd1 = path.resolve(process.cwd(), "..", "judge", "dist", "index.js");
  if (await exists(fromCwd1)) return fromCwd1;

  const fromCwd2 = path.resolve(process.cwd(), "judge", "dist", "index.js");
  if (await exists(fromCwd2)) return fromCwd2;

  throw new Error(
    `JUDGE_WORKER_NOT_FOUND: set JUDGE_WORKER_ENTRY or build judge at ../judge/dist/index.js (checked: ${fromDirname}, ${fromCwd1}, ${fromCwd2})`
  );
}

export function resolveJudgeSandboxConfig(): string {
  // Allow overriding nsjail config path (production).
  if (process.env.NSJAIL_CONFIG) return process.env.NSJAIL_CONFIG;
  return path.resolve(__dirname, "..", "..", "..", "..", "judge", "sandbox", "nsjail.cfg");
}


