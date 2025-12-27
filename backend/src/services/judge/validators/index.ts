/**
 * Реєстр кастомних валідаторів
 * Кожна функція приймає вивід користувача і повертає boolean
 */
export type CustomValidatorFunction = (output: string) => boolean;

export const customValidators: Record<string, CustomValidatorFunction> = {
  /**
   * Перевіряє, чи вивід містить відсортований масив чисел
   * Формат: числа через пробіл або кому
   */
  isSortedArray: (output: string): boolean => {
    try {
      const trimmed = output.trim();
      // Спробуємо розпарсити як числа через пробіл або кому
      const numbers = trimmed
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => parseFloat(s))
        .filter((n) => !isNaN(n));

      if (numbers.length === 0) return false;

      // Перевіряємо, чи відсортовано за зростанням
      for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] < numbers[i - 1]) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Перевіряє, чи вивід містить вказане ім'я
   * Використовується для задач типу "вивести своє ім'я"
   */
  containsName: (output: string): boolean => {
    const trimmed = output.trim().toLowerCase();
    // Перевіряємо наявність хоча б одного слова (ім'я)
    return trimmed.length > 0 && /^[а-яa-zіїєґ\s]+$/i.test(trimmed);
  },

  /**
   * Перевіряє, чи вивід є валідним email адресом
   */
  isValidEmail: (output: string): boolean => {
    const trimmed = output.trim();
    if (trimmed.length === 0) return false;
    // RFC 5322 спрощена перевірка email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(trimmed);
  },

  /**
   * Перевіряє, чи вивід містить паліндром
   */
  isPalindrome: (output: string): boolean => {
    const trimmed = output.trim().toLowerCase().replace(/\s+/g, "");
    if (trimmed.length === 0) return false;
    return trimmed === trimmed.split("").reverse().join("");
  },

  /**
   * Перевіряє, чи вивід містить тільки числа
   */
  isNumericOnly: (output: string): boolean => {
    const trimmed = output.trim();
    if (trimmed.length === 0) return false;
    // Перевіряємо, чи всі символи - це числа, пробіли, коми, крапки, мінуси
    return /^[\d\s,.\-]+$/.test(trimmed);
  },

  /**
   * Перевіряє, чи вивід містить правильну кількість рядків
   * Використовується для задач, де важлива кількість виведених рядків
   */
  hasCorrectLineCount: (output: string): boolean => {
    const lines = output.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
    return lines.length > 0;
  },

  /**
   * Перевіряє, чи вивід містить правильну структуру JSON
   */
  isValidJSON: (output: string): boolean => {
    try {
      JSON.parse(output.trim());
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Перевіряє, чи вивід містить правильну послідовність чисел Фібоначчі
   */
  isFibonacciSequence: (output: string): boolean => {
    try {
      const numbers = output
        .trim()
        .split(/[\s,]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 0);

      if (numbers.length < 2) return false;

      // Перевіряємо послідовність Фібоначчі
      for (let i = 2; i < numbers.length; i++) {
        if (numbers[i] !== numbers[i - 1] + numbers[i - 2]) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Отримати кастомний валідатор за ім'ям
 */
export function getCustomValidator(name: string): CustomValidatorFunction | null {
  return customValidators[name] || null;
}

/**
 * Зареєструвати новий кастомний валідатор
 */
export function registerCustomValidator(
  name: string,
  validator: CustomValidatorFunction
): void {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Validator name must be a non-empty string");
  }
  if (typeof validator !== "function") {
    throw new Error("Validator must be a function");
  }
  customValidators[name] = validator;
}

