// src/entities/Topic.ts
import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

export type TopicLanguage = "JAVA" | "PYTHON";

@Entity("topics")
export class Topic {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  // Мова курсу для теми
  @Column({ type: "enum", enum: ["JAVA", "PYTHON"] })
  lang!: TopicLanguage;

  // Порядковий індекс теми (для логіки 5 тем до к.р.)
  @Column({ type: "int", name: "topic_index" })
  topicIndex!: number;

  // Markdown + LaTeX теорія з таблиці topics
  @Column({ type: "text", name: "theory_markdown" })
  theoryMarkdown!: string;

  // Позначка, що тема — контрольна (якщо таке поле є — залишаємо)
  @Column({ type: "boolean", name: "is_control", default: false })
  isControl!: boolean;
}
