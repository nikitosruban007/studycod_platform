import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import iconv from "iconv-lite";

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
    // КРИТИЧНО ВАЖЛИВО: Встановлюємо кодування UTF-8 на рівні ОС для Java на Windows
    // БАГ: На Windows Java за замовчуванням використовує системне кодування консолі (CP1251), що ламає кирилицю
    // Рішення: Встановлюємо JAVA_TOOL_OPTIONS для глобального кодування + додаємо -Dfile.encoding=UTF-8 в команді
    const env = {
      ...process.env,
      NODE_ENV: "production",
      PYTHONIOENCODING: "utf-8", // Для Python
      // Для Java: встановлюємо кодування через JAVA_TOOL_OPTIONS для всіх JVM операцій
      // Also force dot decimal parsing for Scanner/NumberFormat by setting default locale to en_US.
      // This makes student solutions stable regardless of OS/JVM locale (e.g. comma decimals).
      JAVA_TOOL_OPTIONS: "-Dfile.encoding=UTF-8 -Duser.language=en -Duser.country=US",
    };
    
    const child = spawn(command, args, {
      cwd: options.cwd,
      env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // КРИТИЧНО ВАЖЛИВО: Збираємо чанки як Buffer[], не декодуємо поки не закриється потік
    // БАГ: Декодування по чанках ламає UTF-8, бо багатобайтові символи можуть розриватися між чанками
    // Рішення: Збираємо всі чанки як Buffer[] і декодуємо ОДИН раз після close через Buffer.concat()
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let killedByTimeout = false;
    let inputWritten = false;

    const timeoutTrigger = setTimeout(() => {
      killedByTimeout = true;
      child.kill("SIGKILL");
    }, options.timeout);

    // Система вводу/виводу: ввід через stdin, вивід через stdout
    if (options.input && child.stdin) {
      // Нормалізуємо ввід: додаємо новий рядок в кінці, якщо його немає
      const inputData = options.input.endsWith('\n') ? options.input : options.input + '\n';
      
      // Передаємо ввід одразу після запуску процесу
      // Використовуємо невелику затримку для Java, щоб процес встиг ініціалізуватися
      const writeInput = () => {
        if (child.stdin && !child.killed && !inputWritten) {
          try {
            if (!child.stdin.destroyed && child.stdin.writable) {
              // Записуємо ввід
              child.stdin.write(inputData, 'utf8', (err) => {
                if (!err) {
                  inputWritten = true;
                  // Закриваємо stdin після запису
                  // Для Java Scanner не потрібна затримка - stdin.end() не блокує читання
                  if (child.stdin && !child.stdin.destroyed) {
                    child.stdin.end();
                  }
                }
              });
            }
          } catch (err) {
            // Якщо stdin вже закритий, ігноруємо помилку
          }
        }
      };
      
      // Для Java або cmd (який запускає Java на Windows) даємо час на ініціалізацію JVM та Scanner
      if (command === 'java' || command === 'cmd') {
        setTimeout(writeInput, 100);
      } else {
        // Для Python та інших мов - передаємо одразу
        process.nextTick(writeInput);
      }
    }

    // КРИТИЧНО ВАЖЛИВО: Збираємо чанки як Buffer, НЕ декодуємо поки не закриється потік
    // UTF-8 символи можуть розриватися між чанками, тому декодування окремо кожного чанка ламає кирилицю
    child.stdout?.on("data", (data: Buffer) => {
      if (stdoutChunks.reduce((sum, chunk) => sum + chunk.length, 0) < 5 * 1024 * 1024) {
        stdoutChunks.push(data);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      if (stderrChunks.reduce((sum, chunk) => sum + chunk.length, 0) < 5 * 1024 * 1024) {
        stderrChunks.push(data);
      }
    });

    child.on("close", (code) => {
      clearTimeout(timeoutTrigger);
      
      // КРИТИЧНО ВАЖЛИВО: Декодуємо UTF-8 ОДИН раз після збору всіх чанків
      // Buffer.concat() правильно об'єднує байти, і toString('utf8') декодує весь потік як одне ціле
      const stdoutBuffer = Buffer.concat(stdoutChunks);
      const stderrBuffer = Buffer.concat(stderrChunks);
      
      const stdout = stdoutBuffer.toString('utf8').trim();
      const stderr = stderrBuffer.toString('utf8').trim();
      
      resolve({
        stdout,
        stderr: killedByTimeout ? "Execution timed out" : stderr,
        exitCode: killedByTimeout ? 124 : (code ?? 1),
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeoutTrigger);
      // При помилці декодуємо зібрані чанки
      const stdoutBuffer = Buffer.concat(stdoutChunks);
      const stderrBuffer = Buffer.concat(stderrChunks);
      const stdout = stdoutBuffer.toString('utf8').trim();
      const stderr = stderrBuffer.toString('utf8').trim();
      resolve({
        stdout,
        stderr: stderr + (err.message || "Unknown error"),
        exitCode: 1,
      });
    });
  });
}

/**
 * Executes a process with shell: true (for Windows cmd /c commands).
 * КРИТИЧНО ВАЖЛИВО: Використовується тільки для Windows cmd /c з chcp для встановлення UTF-8 code page.
 * shell: true необхідний для правильного виконання складних команд через cmd.
 * БЕЗПЕКА: command має бути повним рядком команди, args має бути пустим масивом [] для усунення DEP0190 warning.
 */
async function runProcessWithShell(
    command: string,
    args: string[], // Має бути пустим масивом [] при shell: true для безпеки
    options: { timeout: number; input?: string; cwd: string }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    // КРИТИЧНО ВАЖЛИВО: Встановлюємо кодування UTF-8 на рівні ОС для Java на Windows
    const env = {
      ...process.env,
      NODE_ENV: "production",
      PYTHONIOENCODING: "utf-8", // Для Python
      JAVA_TOOL_OPTIONS: "-Dfile.encoding=UTF-8 -Duser.language=en -Duser.country=US",
    };
    
    // БЕЗПЕКА: При shell: true command передається як повний рядок, args має бути пустим масивом
    // Це усуває security warning про неекрановані аргументи (DEP0190)
    const child = spawn(command, [], {
      cwd: options.cwd,
      env,
      shell: true, // КРИТИЧНО: shell: true для Windows cmd /c з chcp
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // КРИТИЧНО ВАЖЛИВО: Збираємо чанки як Buffer[], не декодуємо поки не закриється потік
    // БАГ: Декодування по чанках ламає UTF-8, бо багатобайтові символи можуть розриватися між чанками
    // Рішення: Збираємо всі чанки як Buffer[] і декодуємо ОДИН раз після close через Buffer.concat()
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let killedByTimeout = false;
    let inputWritten = false;

    const timeoutTrigger = setTimeout(() => {
      killedByTimeout = true;
      child.kill("SIGKILL");
    }, options.timeout);

    // Система вводу/виводу: ввід через stdin, вивід через stdout
    if (options.input && child.stdin) {
      const inputData = options.input.endsWith('\n') ? options.input : options.input + '\n';
      
      const writeInput = () => {
        if (child.stdin && !child.killed && !inputWritten) {
          try {
            if (!child.stdin.destroyed && child.stdin.writable) {
              child.stdin.write(inputData, 'utf8', (err) => {
                if (!err) {
                  inputWritten = true;
                  if (child.stdin && !child.stdin.destroyed) {
                    child.stdin.end();
                  }
                }
              });
            }
          } catch (err) {
            // Ignore
          }
        }
      };
      
      // Для cmd даємо час на ініціалізацію
      setTimeout(writeInput, 100);
    }

    // КРИТИЧНО ВАЖЛИВО: Збираємо чанки як Buffer, НЕ декодуємо поки не закриється потік
    // UTF-8 символи можуть розриватися між чанками, тому декодування окремо кожного чанка ламає кирилицю
    child.stdout?.on("data", (data: Buffer) => {
      if (stdoutChunks.reduce((sum, chunk) => sum + chunk.length, 0) < 5 * 1024 * 1024) {
        stdoutChunks.push(data);
      }
    });

    child.stderr?.on("data", (data: Buffer) => {
      if (stderrChunks.reduce((sum, chunk) => sum + chunk.length, 0) < 5 * 1024 * 1024) {
        stderrChunks.push(data);
      }
    });

    child.on("close", (code) => {
      clearTimeout(timeoutTrigger);
      
      // КРИТИЧНО ВАЖЛИВО: На Windows Java виводить в CP1251 через консоль, НЕ в UTF-8
      // БАГ: chcp 65001 не допомагає, бо Java все одно використовує консольне кодування CP1251
      // Рішення: Декодуємо як CP1251 (Windows-1251) - Node.js Buffer підтримує 'win1251'
      const stdoutBuffer = Buffer.concat(stdoutChunks);
      const stderrBuffer = Buffer.concat(stderrChunks);
      
      // КРИТИЧНО: Декодуємо як CP1251 (Windows-1251) через iconv-lite
      // Java на Windows виводить в CP1251, а не UTF-8
      // iconv-lite підтримує 'win1251', 'windows-1251' та 'cp1251'
      const stdout = iconv.decode(stdoutBuffer, 'win1251').trim();
      const stderr = iconv.decode(stderrBuffer, 'win1251').trim();
      
      resolve({
        stdout,
        stderr: killedByTimeout ? "Execution timed out" : stderr,
        exitCode: killedByTimeout ? 124 : (code ?? 1),
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeoutTrigger);
      // При помилці декодуємо зібрані чанки як CP1251
      const stdoutBuffer = Buffer.concat(stdoutChunks);
      const stderrBuffer = Buffer.concat(stderrChunks);
      // КРИТИЧНО: Декодуємо як CP1251 через iconv-lite
      const stdout = iconv.decode(stdoutBuffer, 'win1251').trim();
      const stderr = iconv.decode(stderrBuffer, 'win1251').trim();
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
      
      // Compile з явним кодуванням UTF-8 для правильного читання кирилиці з вихідного файлу
      const compileRes = await runProcess("javac", ["-encoding", "UTF-8", "Main.java"], {
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

      // Run: ввід через stdin, вивід через stdout
      const hasInput = input && input.trim().length > 0;
      const runTimeout = hasInput 
        ? Math.max(30000, timeout - 5000) // Мінімум 30 секунд для Java з вводом
        : Math.max(5000, timeout - 5000); // Мінімум 5 секунд для Java без вводу
      
      // КРИТИЧНО ВАЖЛИВО: На Windows Java використовує консольне кодування для System.out
      // БАГ: На Windows за замовчуванням використовується CP1251, що ламає кирилицю
      // Рішення: Використовуємо cmd з chcp 65001 (UTF-8 code page) перед запуском Java через shell
      // Це встановлює UTF-8 кодування консолі, яке Java використає для System.out
      let runRes;
      if (process.platform === 'win32') {
        // На Windows: chcp 65001 встановлює UTF-8 code page, >nul приховує вивід chcp
        // Використовуємо shell: true з повною командою як рядок для безпеки (без окремих args)
        // Потім запускаємо Java з -Dfile.encoding=UTF-8 для гарантії
        const cmd = `chcp 65001 >nul && java -Dfile.encoding=UTF-8 -cp . Main`;
        runRes = await runProcessWithShell(`cmd /c "${cmd}"`, [], {
          timeout: runTimeout,
          input: input || "",
          cwd: tmpDir,
        });
      } else {
        // На Linux/Mac: звичайний запуск Java з UTF-8
        runRes = await runProcess("java", ["-Dfile.encoding=UTF-8", "-cp", ".", "Main"], {
          timeout: runTimeout,
          input: input || "",
          cwd: tmpDir,
        });
      }

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

/**
 * Фільтрує системні повідомлення з stderr (Java tool options, warnings тощо)
 */
export function filterStderr(stderr: string): string {
  if (!stderr) return "";
  return stderr
    .split('\n')
    .filter(line => !line.includes('Picked up JAVA_TOOL_OPTIONS'))
    .filter(line => !line.includes('Picked up _JAVA_OPTIONS'))
    .filter(line => !line.includes('WARNING: An illegal reflective access operation has occurred'))
    .join('\n')
    .trim();
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