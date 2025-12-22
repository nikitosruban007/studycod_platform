// Утиліта для автоматичного додавання тем у БД, якщо їх немає
import { AppDataSource } from "../data-source";
import { Topic } from "../entities/Topic";
import * as fs from "fs";
import * as path from "path";

async function readJsonFile(filePath: string): Promise<any> {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const content = await fs.promises.readFile(fullPath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err);
    return null;
  }
}

export async function seedTopicsIfNeeded(): Promise<void> {
  try {
    const topicRepo = AppDataSource.getRepository(Topic);

    // Читаємо файли з темами та теорією
    const javaTopics = await readJsonFile("topics/java_topics.json");
    const pythonTopics = await readJsonFile("topics/python_topics.json");
    const javaTheory = await readJsonFile("theories/java_theory.json");
    const pythonTheory = await readJsonFile("theories/python_theory.json");

    if (!javaTopics || !pythonTopics) {
      console.warn("Topics files not found, skipping seed");
      return;
    }

    const items: Array<{
      title: string;
      lang: "JAVA" | "PYTHON";
      theory: string;
      index: number;
    }> = [];

    // Формуємо список тем для Java
    if (Array.isArray(javaTopics)) {
      javaTopics.forEach((title: string, i: number) => {
        items.push({
          title,
          lang: "JAVA",
          theory: (javaTheory && typeof javaTheory === "object" && javaTheory[title]) || "",
          index: i,
        });
      });
    }

    // Формуємо список тем для Python
    if (Array.isArray(pythonTopics)) {
      pythonTopics.forEach((title: string, i: number) => {
        items.push({
          title,
          lang: "PYTHON",
          theory: (pythonTheory && typeof pythonTheory === "object" && pythonTheory[title]) || "",
          index: i,
        });
      });
    }

    let added = 0;
    let updated = 0;

    // Перевіряємо та додаємо/оновлюємо теми
    for (const item of items) {
      const existing = await topicRepo.findOne({
        where: {
          title: item.title,
          lang: item.lang,
        } as any,
      });

      if (existing) {
        // Оновлюємо існуючу тему, якщо теорія змінилася
        if (item.theory && item.theory !== existing.theoryMarkdown) {
          existing.theoryMarkdown = item.theory;
          existing.topicIndex = item.index;
          await topicRepo.save(existing);
          updated++;
        } else if (existing.topicIndex !== item.index) {
          existing.topicIndex = item.index;
          await topicRepo.save(existing);
          updated++;
        }
      } else {
        // Створюємо нову тему
        const newTopic = topicRepo.create({
          title: item.title,
          lang: item.lang,
          topicIndex: item.index,
          theoryMarkdown: item.theory || "Теорія буде додана пізніше.",
          isControl: false,
        } as any);
        await topicRepo.save(newTopic);
        added++;
      }
    }

    if (added > 0 || updated > 0) {
      console.log(`Topics seeded: ${added} added, ${updated} updated`);
    }
  } catch (err) {
    console.error("Error seeding topics:", err);
    // Не кидаємо помилку, щоб не блокувати старт сервера
  }
}



import { AppDataSource } from "../data-source";
import { Topic } from "../entities/Topic";
import * as fs from "fs";
import * as path from "path";

async function readJsonFile(filePath: string): Promise<any> {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const content = await fs.promises.readFile(fullPath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to read ${filePath}:`, err);
    return null;
  }
}

export async function seedTopicsIfNeeded(): Promise<void> {
  try {
    const topicRepo = AppDataSource.getRepository(Topic);

    // Читаємо файли з темами та теорією
    const javaTopics = await readJsonFile("topics/java_topics.json");
    const pythonTopics = await readJsonFile("topics/python_topics.json");
    const javaTheory = await readJsonFile("theories/java_theory.json");
    const pythonTheory = await readJsonFile("theories/python_theory.json");

    if (!javaTopics || !pythonTopics) {
      console.warn("Topics files not found, skipping seed");
      return;
    }

    const items: Array<{
      title: string;
      lang: "JAVA" | "PYTHON";
      theory: string;
      index: number;
    }> = [];

    // Формуємо список тем для Java
    if (Array.isArray(javaTopics)) {
      javaTopics.forEach((title: string, i: number) => {
        items.push({
          title,
          lang: "JAVA",
          theory: (javaTheory && typeof javaTheory === "object" && javaTheory[title]) || "",
          index: i,
        });
      });
    }

    // Формуємо список тем для Python
    if (Array.isArray(pythonTopics)) {
      pythonTopics.forEach((title: string, i: number) => {
        items.push({
          title,
          lang: "PYTHON",
          theory: (pythonTheory && typeof pythonTheory === "object" && pythonTheory[title]) || "",
          index: i,
        });
      });
    }

    let added = 0;
    let updated = 0;

    // Перевіряємо та додаємо/оновлюємо теми
    for (const item of items) {
      const existing = await topicRepo.findOne({
        where: {
          title: item.title,
          lang: item.lang,
        } as any,
      });

      if (existing) {
        // Оновлюємо існуючу тему, якщо теорія змінилася
        if (item.theory && item.theory !== existing.theoryMarkdown) {
          existing.theoryMarkdown = item.theory;
          existing.topicIndex = item.index;
          await topicRepo.save(existing);
          updated++;
        } else if (existing.topicIndex !== item.index) {
          existing.topicIndex = item.index;
          await topicRepo.save(existing);
          updated++;
        }
      } else {
        // Створюємо нову тему
        const newTopic = topicRepo.create({
          title: item.title,
          lang: item.lang,
          topicIndex: item.index,
          theoryMarkdown: item.theory || "Теорія буде додана пізніше.",
          isControl: false,
        } as any);
        await topicRepo.save(newTopic);
        added++;
      }
    }

    if (added > 0 || updated > 0) {
      console.log(`Topics seeded: ${added} added, ${updated} updated`);
    }
  } catch (err) {
    console.error("Error seeding topics:", err);
    // Не кидаємо помилку, щоб не блокувати старт сервера
  }
}



