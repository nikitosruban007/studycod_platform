/**
 * Константи обмежень ресурсів для sandbox
 */
export interface ResourceLimits {
  memoryMB: number; // RAM в мегабайтах
  cpuTimeSeconds: number; // CPU time limit в секундах
  wallTimeSeconds: number; // Wall clock time limit в секундах
  maxOutputBytes: number; // Максимальний розмір виводу (stdout + stderr)
  maxProcesses: number; // Максимальна кількість процесів
  maxFiles: number; // Максимальна кількість відкритих файлів
}

/**
 * Стандартні обмеження для sandbox
 */
export const DEFAULT_LIMITS: ResourceLimits = {
  memoryMB: 256, // 256 MB RAM
  cpuTimeSeconds: 2, // 2 секунди CPU time
  wallTimeSeconds: 3, // 3 секунди wall time (з запасом)
  maxOutputBytes: 64 * 1024, // 64 KB виводу
  maxProcesses: 1, // Заборонено fork
  maxFiles: 32, // Максимум 32 відкритих файли
};

/**
 * Обмеження для різних мов програмування
 */
export const LANGUAGE_LIMITS: Record<string, ResourceLimits> = {
  python: {
    ...DEFAULT_LIMITS,
    memoryMB: 256,
    cpuTimeSeconds: 2,
    wallTimeSeconds: 3,
  },
  cpp: {
    ...DEFAULT_LIMITS,
    memoryMB: 256,
    cpuTimeSeconds: 2,
    wallTimeSeconds: 3,
  },
  java: {
    ...DEFAULT_LIMITS,
    memoryMB: 256, // JVM heap memory
    cpuTimeSeconds: 2,
    wallTimeSeconds: 4, // Java потребує більше часу на старт JVM
  },
};

/**
 * Статуси виконання
 */
export enum ExecutionStatus {
  OK = "OK",
  TIME_LIMIT = "TIME_LIMIT",
  MEMORY_LIMIT = "MEMORY_LIMIT",
  RUNTIME_ERROR = "RUNTIME_ERROR",
  OUTPUT_LIMIT = "OUTPUT_LIMIT",
  SECURITY_VIOLATION = "SECURITY_VIOLATION",
  SYSTEM_ERROR = "SYSTEM_ERROR",
}

/**
 * Результат виконання коду
 */
export interface ExecutionResult {
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  exitCode: number;
  cpuTimeMs: number; // CPU time в мілісекундах
  wallTimeMs: number; // Wall time в мілісекундах
  memoryKB: number; // Використана пам'ять в кілобайтах
}

