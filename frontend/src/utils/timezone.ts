// frontend/src/utils/timezone.ts
// Утиліти для роботи з часовими поясами та дедлайнами

/**
 * Отримує timezone користувача з браузера або збереженого значення
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    // Fallback на UTC якщо браузер не підтримує
    return "UTC";
  }
}

/**
 * Конвертує локальний час користувача в UTC
 * @param localDateTimeString - рядок у форматі "YYYY-MM-DDTHH:mm" (з datetime-local input)
 * @param timezone - IANA timezone (наприклад: "Europe/Kyiv")
 * @returns ISO string в UTC
 */
export function convertLocalToUTC(localDateTimeString: string, timezone?: string): string {
  if (!localDateTimeString) {
    return "";
  }

  const tz = timezone || getUserTimezone();
  
  try {
    // datetime-local input повертає час без timezone
    // Інтерпретуємо його як локальний час користувача в указаному timezone
    const [datePart, timePart] = localDateTimeString.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);

    // Створюємо дату в UTC, інтерпретуючи компоненти як локальний час у вказаному timezone
    // Використовуємо Intl API для правильної конвертації
    // Створюємо рядок у форматі ISO з явним вказівкою timezone
    const dateInTz = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
    
    // Отримуємо offset для вказаного timezone
    // Створюємо дату в UTC та в timezone користувача для обчислення offset
    const utcString = dateInTz.toISOString();
    const utcDate = new Date(utcString);
    
    // Отримуємо локальний час у вказаному timezone
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    
    const parts = formatter.formatToParts(utcDate);
    const tzYear = parseInt(parts.find(p => p.type === "year")?.value || "0");
    const tzMonth = parseInt(parts.find(p => p.type === "month")?.value || "0");
    const tzDay = parseInt(parts.find(p => p.type === "day")?.value || "0");
    const tzHour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
    const tzMinute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
    
    // Створюємо дату в UTC, інтерпретуючи компоненти як локальний час у timezone
    const localDateInTz = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute));
    
    // Обчислюємо offset: різниця між UTC та локальним часом у timezone
    const offsetMs = utcDate.getTime() - localDateInTz.getTime();
    
    // Створюємо дату з компонентами як локальний час у timezone
    const targetLocalDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
    
    // Конвертуємо в UTC, додаючи offset
    const utcResult = new Date(targetLocalDate.getTime() - offsetMs);
    
    return utcResult.toISOString();
  } catch (error) {
    console.error("Error converting local to UTC:", error);
    // Fallback: використовуємо простий підхід
    // datetime-local інтерпретується як локальний час браузера
    const localDate = new Date(localDateTimeString);
    // Отримуємо offset браузера (в хвилинах, негативний для UTC+)
    const offsetMs = localDate.getTimezoneOffset() * 60 * 1000;
    const utcDate = new Date(localDate.getTime() + offsetMs);
    return utcDate.toISOString();
  }
}

/**
 * Конвертує UTC в локальний час користувача для відображення
 * @param utcISOString - ISO string в UTC
 * @param timezone - IANA timezone (наприклад: "Europe/Kyiv")
 * @returns рядок у форматі "YYYY-MM-DDTHH:mm" для datetime-local input
 */
export function convertUTCToLocal(utcISOString: string | null | undefined, timezone?: string): string {
  if (!utcISOString) {
    return "";
  }

  const tz = timezone || getUserTimezone();
  
  try {
    const utcDate = new Date(utcISOString);
    
    // Використовуємо Intl API для правильної конвертації UTC → timezone користувача
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    
    // Форматуємо UTC дату в локальний час користувача
    const parts = formatter.formatToParts(utcDate);
    const year = parts.find(p => p.type === "year")?.value || "";
    const month = parts.find(p => p.type === "month")?.value || "";
    const day = parts.find(p => p.type === "day")?.value || "";
    const hour = parts.find(p => p.type === "hour")?.value || "";
    const minute = parts.find(p => p.type === "minute")?.value || "";
    
    return `${year}-${month}-${day}T${hour}:${minute}`;
  } catch (error) {
    console.error("Error converting UTC to local:", error);
    // Fallback: використовуємо локальний час браузера
    const date = new Date(utcISOString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}

/**
 * Форматує UTC дату для відображення користувачу
 * @param utcISOString - ISO string в UTC
 * @param timezone - IANA timezone (наприклад: "Europe/Kyiv")
 * @param options - опції форматування
 * @returns відформатований рядок
 */
export function formatDeadlineForDisplay(
  utcISOString: string | null | undefined,
  timezone?: string,
  options?: { dateStyle?: "full" | "long" | "medium" | "short"; timeStyle?: "full" | "long" | "medium" | "short" }
): string {
  if (!utcISOString) {
    return "";
  }

  const tz = timezone || getUserTimezone();
  
  try {
    const utcDate = new Date(utcISOString);
    
    return new Intl.DateTimeFormat("uk-UA", {
      timeZone: tz,
      dateStyle: options?.dateStyle || "short",
      timeStyle: options?.timeStyle || "short",
    }).format(utcDate);
  } catch (error) {
    console.error("Error formatting deadline:", error);
    return new Date(utcISOString).toLocaleString("uk-UA");
  }
}

/**
 * Перевіряє чи дедлайн минув (в UTC)
 * @param deadlineUTC - ISO string дедлайну в UTC
 * @returns true якщо дедлайн минув
 */
export function isDeadlineExpired(deadlineUTC: string | null | undefined): boolean {
  if (!deadlineUTC) {
    return false;
  }

  try {
    const deadline = new Date(deadlineUTC);
    const now = new Date(); // Поточна дата/час в UTC
    
    return now.getTime() > deadline.getTime();
  } catch (error) {
    console.error("Error checking deadline expiration:", error);
    return false;
  }
}

