import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

/**
 * Executes a process with a timeout and input.
 */
async function runProcess(
    command: string,
    args: string[],
    options: { timeout: number; input?: string; cwd: string }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, NODE_ENV: "production" },
      shell: false, // Prevent shell injection
    });

    let stdout = "";
    let stderr = "";
    let killedByTimeout = false;

    const timeoutTrigger = setTimeout(() => {
      killedByTimeout = true;
      child.kill("SIGKILL");
    }, options.timeout);

    if (options.input && child.stdin) {
      child.stdin.write(options.input);
      child.stdin.end();
    }

    child.stdout?.on("data", (data) => {
      if (stdout.length < 5 * 1024 * 1024) stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      if (stderr.length < 5 * 1024 * 1024) stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeoutTrigger);
      resolve({
        stdout: stdout.trim(),
        stderr: killedByTimeout ? "Execution timed out" : stderr.trim(),
        exitCode: killedByTimeout ? 124 : (code ?? 1),
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeoutTrigger);
      resolve({
        stdout,
        stderr: stderr + (err.message || "Unknown error"),
        exitCode: 1,
      });
    });
  });
}

export async function executeCodeWithInput(
    code: string,
    language: "JAVA" | "PYTHON",
    input: string,
    timeout: number = 10000
): Promise<CodeExecutionResult> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "code-exec-"));
  
  try {
    if (language === "PYTHON") {
      const filePath = path.join(tmpDir, "main.py");
      await fs.writeFile(filePath, code, "utf-8");
      
      const { stdout, stderr, exitCode } = await runProcess("python", [filePath], {
        timeout,
        input,
        cwd: tmpDir,
      });

      return {
        stdout,
        stderr,
        exitCode,
        success: exitCode === 0,
      };
    } else {
      const filePath = path.join(tmpDir, "Main.java");
      await fs.writeFile(filePath, code, "utf-8");
      
      // Compile
      const compileRes = await runProcess("javac", ["Main.java"], {
        timeout: 5000,
        cwd: tmpDir,
      });

      if (compileRes.exitCode !== 0) {
        return {
          stdout: "",
          stderr: compileRes.stderr || "Compilation failed",
          exitCode: compileRes.exitCode,
          success: false,
        };
      }

      // Run
      const runRes = await runProcess("java", ["-cp", ".", "Main"], {
        timeout: Math.max(1000, timeout - 5000),
        input,
        cwd: tmpDir,
      });

      return {
        stdout: runRes.stdout,
        stderr: runRes.stderr,
        exitCode: runRes.exitCode,
        success: runRes.exitCode === 0,
      };
    }
  } catch (error: any) {
    return {
      stdout: "",
      stderr: error.message || "Execution error",
      exitCode: 1,
      success: false,
    };
  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

export function compareOutput(actual: string, expected: string): boolean {
  const normalize = (str: string) => {
    const normalized = str.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    const lines = normalized.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    return lines.join("\n");
  };

  const normalizedActual = normalize(actual);
  const normalizedExpected = normalize(expected);

  if (normalizedActual === normalizedExpected) return true;

  const noSpacesActual = normalizedActual.replace(/\s+/g, "");
  const noSpacesExpected = normalizedExpected.replace(/\s+/g, "");
  if (noSpacesActual === noSpacesExpected) return true;

  const normalizeCommas = (str: string) => str.replace(/,\s+/g, ",").replace(/\s+,/g, ",");
  if (normalizeCommas(normalizedActual) === normalizeCommas(normalizedExpected)) return true;

  return false;
}