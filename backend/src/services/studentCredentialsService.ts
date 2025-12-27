// src/services/studentCredentialsService.ts
import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * Генерує унікальний username для учня на основі ПІБ
 */
export function generateUsername(
  firstName: string,
  lastName: string,
  middleName?: string | null
): string {
  // Транслітерація українських літер
  const translit: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", є: "ye",
    ж: "zh", з: "z", и: "y", і: "i", ї: "yi", й: "y", к: "k",
    л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s",
    т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
    щ: "shch", ь: "", ю: "yu", я: "ya",
    А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Є: "Ye",
    Ж: "Zh", З: "Z", И: "Y", І: "I", Ї: "Yi", Й: "Y", К: "K",
    Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S",
    Т: "T", У: "U", Ф: "F", Х: "Kh", Ц: "Ts", Ч: "Ch", Ш: "Sh",
    Щ: "Shch", Ю: "Yu", Я: "Ya"
  };

  function transliterate(text: string): string {
    return text
      .split("")
      .map((char) => translit[char] || char)
      .join("")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  const first = transliterate(firstName);
  const last = transliterate(lastName);
  const middle = middleName ? transliterate(middleName) : "";

  // Prefer a more natural format: firstname_lastname(_middle)
  let base = `${first}_${last}`;
  // Only add middle name when it provides value (avoid very long usernames by default)
  if (middle && middle.length >= 3) {
    base += `_${middle}`;
  }

  // Додаємо випадковий суфікс для унікальності (4 символи)
  const suffix = crypto.randomBytes(2).toString("hex");
  return `${base}_${suffix}`;
}

/**
 * Генерує випадковий пароль (8-12 символів)
 */
export function generatePassword(): string {
  const length = 10;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomBytes = crypto.randomBytes(length);
  let password = "";
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  
  return password;
}

/**
 * Хешує пароль для зберігання в БД
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

