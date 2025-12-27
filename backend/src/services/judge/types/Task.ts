/**
 * Типи перевірки рішень
 */
export type JudgeMode = "EXACT" | "NUMERIC" | "REGEX" | "CUSTOM" | "MANUAL";

/**
 * Модель задачі для системи перевірки
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  input: string | null; // Вхідні дані (може бути null для задач без input)

  judgeMode: JudgeMode;

  // Для EXACT та NUMERIC
  expectedOutput?: string;

  // Для REGEX
  regexPattern?: string;
  regexFlags?: string; // Опціональні флаги для RegExp (наприклад, "gi")

  // Для NUMERIC
  tolerance?: number; // Допустима похибка (за замовчуванням 0.0001)

  // Для CUSTOM
  customValidator?: string; // Ім'я функції з реєстру кастомних валідаторів

  createdAt: Date;
}

/**
 * Результат перевірки рішення
 */
export interface JudgeResult {
  success: boolean;
  message: string;
  details?: {
    expected?: string;
    received?: string;
    difference?: number;
    matchedPattern?: boolean;
  };
}

/**
 * Помилка валідації конфігурації задачі
 */
export class TaskValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "TaskValidationError";
    Object.setPrototypeOf(this, TaskValidationError.prototype);
  }
}

