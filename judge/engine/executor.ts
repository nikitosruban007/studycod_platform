import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";

export interface ExecOptions {
  nsjailPath: string;
  nsjailConfigPath: string;
  hostWorkDir: string;
  /** stdin to feed to jailed process */
  stdin: string;
  /** wall-time budget in ms (strict) */
  timeLimitMs: number;
  /** memory cap in bytes (enforced by nsjail cgroup + rlimit_as) */
  memoryLimitBytes: number;
  /** max combined stdout+stderr bytes we will capture before killing (output limit) */
  outputLimitBytes: number;
  /** Extra nsjail args (rare) */
  extraNsJailArgs?: string[];
  /** Command to run inside jail (argv[0] is executable path inside chroot) */
  argv: string[];
  /** Optional identifier (unused by nsjail itself; for logs/debug) */
  sandboxId?: string;
}

export interface ExecResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  timeMs: number;
  memoryKb: number | null;
}

export class NsJailExecutor {
  async exec(opts: ExecOptions): Promise<ExecResult> {
    const start = process.hrtime.bigint();

    const timeLimitSec = Math.max(1, Math.ceil(opts.timeLimitMs / 1000));
    const cpuLimitSec = Math.max(1, Math.ceil((opts.timeLimitMs + 50) / 1000));

    // rlimit_as in bytes: add a small overhead margin for runtime/loader.
    const rlimitAs = Math.min(
      opts.memoryLimitBytes + 32 * 1024 * 1024,
      1024 * 1024 * 1024
    );

    const outputCap = opts.outputLimitBytes;

    const nsArgs: string[] = [
      "--config",
      opts.nsjailConfigPath,
      // Runtime-tunable limits. These override config defaults.
      "--time_limit",
      String(timeLimitSec),
      "--rlimit_cpu",
      String(cpuLimitSec),
      "--rlimit_as",
      String(rlimitAs),
      "--rlimit_fsize",
      String(outputCap),
      // Workdir (host) is mounted as /work (rw) inside the chroot.
      "--bindmount",
      `${opts.hostWorkDir}:/work:rw`,
      "--",
      ...opts.argv,
    ];

    if (opts.extraNsJailArgs?.length) {
      const idx = nsArgs.indexOf("--");
      nsArgs.splice(idx, 0, ...opts.extraNsJailArgs);
    }

    let timedOut = false;
    let outputLimitExceeded = false;
    let killed = false;

    const child = spawn(opts.nsjailPath, nsArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let totalOut = 0;

    const killChild = () => {
      if (killed) return;
      killed = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    };

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      killChild();
    }, opts.timeLimitMs + 30);

    if (opts.stdin && child.stdin) {
      const data = opts.stdin.endsWith("\n") ? opts.stdin : opts.stdin + "\n";
      child.stdin.write(data, "utf8", () => {
        try {
          child.stdin?.end();
        } catch {
          // ignore
        }
      });
    } else {
      try {
        child.stdin?.end();
      } catch {
        // ignore
      }
    }

    child.stdout?.on("data", (buf: Buffer) => {
      if (outputLimitExceeded) return;
      totalOut += buf.length;
      if (totalOut > outputCap) {
        outputLimitExceeded = true;
        killChild();
        return;
      }
      stdoutChunks.push(buf);
    });

    child.stderr?.on("data", (buf: Buffer) => {
      if (outputLimitExceeded) return;
      totalOut += buf.length;
      if (totalOut > outputCap) {
        outputLimitExceeded = true;
        killChild();
        return;
      }
      stderrChunks.push(buf);
    });

    const { exitCode, signal } = await new Promise<{
      exitCode: number | null;
      signal: NodeJS.Signals | null;
    }>((resolve) => {
      child.on("close", (code, sig) => resolve({ exitCode: code, signal: sig }));
      child.on("error", () => resolve({ exitCode: 1, signal: null }));
    });

    clearTimeout(timeoutHandle);

    const end = process.hrtime.bigint();
    const timeMs = Number(end - start) / 1_000_000;

    const stdout = Buffer.concat(stdoutChunks).toString("utf8");
    const stderr = Buffer.concat(stderrChunks).toString("utf8");

    const memoryKb = await readCgroupPeakKb();

    return {
      exitCode,
      signal,
      stdout,
      stderr,
      timedOut,
      outputLimitExceeded,
      timeMs,
      memoryKb,
    };
  }
}

async function readCgroupPeakKb(): Promise<number | null> {
  // Config uses a fixed cgroup parent (see sandbox/nsjail.cfg). We read usage from that parent.
  // Accurate per-run only when this parent is dedicated to this judge worker and executions are serial.
  const candidates: string[] = [
    // cgroup v2 parent group
    path.posix.join("/sys/fs/cgroup", "studycod", "memory.peak"),
    path.posix.join("/sys/fs/cgroup", "studycod", "memory.current"),
    // cgroup v1 parent group
    path.posix.join("/sys/fs/cgroup/memory", "studycod", "memory.max_usage_in_bytes"),
    path.posix.join("/sys/fs/cgroup/memory", "studycod", "memory.usage_in_bytes"),
  ];

  for (const file of candidates) {
    try {
      const raw = await fs.readFile(file, "utf8");
      const v = Number(String(raw).trim());
      if (Number.isFinite(v) && v > 0) return Math.floor(v / 1024);
    } catch {
      // ignore
    }
  }
  return null;
}


