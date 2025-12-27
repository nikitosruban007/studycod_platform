import { Task, TaskValidationError, JudgeMode } from "../types/Task";

/**
 * Валідатор конфігурації задачі
 * Перевіряє коректність налаштувань перед використанням
 */
export function validateTaskConfig(task: Task): void {
  // Перевірка обов'язкових полів
  if (!task.id || typeof task.id !== "string") {
    throw new TaskValidationError("Task id is required and must be a string", "id");
  }

  if (!task.title || typeof task.title !== "string") {
    throw new TaskValidationError("Task title is required and must be a string", "title");
  }

  if (!task.description || typeof task.description !== "string") {
    throw new TaskValidationError("Task description is required and must be a string", "description");
  }

  if (!task.judgeMode) {
    throw new TaskValidationError("Judge mode is required", "judgeMode");
  }

  // Валідація для EXACT режиму
  if (task.judgeMode === "EXACT") {
    if (task.input === null) {
      throw new TaskValidationError(
        "EXACT mode requires input to be non-null. Input cannot be null for EXACT mode.",
        "input"
      );
    }
    if (!task.expectedOutput || typeof task.expectedOutput !== "string") {
      throw new TaskValidationError(
        "EXACT mode requires expectedOutput as a non-empty string",
        "expectedOutput"
      );
    }
  }

  // Валідація для NUMERIC режиму
  if (task.judgeMode === "NUMERIC") {
    if (task.input === null) {
      throw new TaskValidationError(
        "NUMERIC mode requires input to be non-null. Input cannot be null for NUMERIC mode.",
        "input"
      );
    }
    if (!task.expectedOutput || typeof task.expectedOutput !== "string") {
      throw new TaskValidationError(
        "NUMERIC mode requires expectedOutput as a non-empty string",
        "expectedOutput"
      );
    }
    // Перевірка, чи expectedOutput є валідним числом
    const expectedNum = parseFloat(task.expectedOutput);
    if (isNaN(expectedNum)) {
      throw new TaskValidationError(
        `NUMERIC mode requires expectedOutput to be a valid number. Received: "${task.expectedOutput}"`,
        "expectedOutput"
      );
    }
    if (task.tolerance === undefined || task.tolerance < 0) {
      throw new TaskValidationError(
        "NUMERIC mode requires tolerance >= 0. Default is 0.0001 if not specified.",
        "tolerance"
      );
    }
  }

  // Валідація для REGEX режиму
  if (task.judgeMode === "REGEX") {
    if (!task.regexPattern || typeof task.regexPattern !== "string") {
      throw new TaskValidationError(
        "REGEX mode requires regexPattern as a non-empty string",
        "regexPattern"
      );
    }
    // Перевірка валідності регулярного виразу
    try {
      const flags = task.regexFlags || "";
      new RegExp(task.regexPattern, flags);
    } catch (error: any) {
      throw new TaskValidationError(
        `Invalid regex pattern: ${error.message}`,
        "regexPattern"
      );
    }
  }

  // Валідація для CUSTOM режиму
  if (task.judgeMode === "CUSTOM") {
    if (!task.customValidator || typeof task.customValidator !== "string") {
      throw new TaskValidationError(
        "CUSTOM mode requires customValidator as a non-empty string (validator function name)",
        "customValidator"
      );
    }
  }

  // MANUAL режим не потребує додаткових перевірок
  // (завжди повертає success = true)
}

