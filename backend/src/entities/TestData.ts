// src/entities/TestData.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { EduTask } from "./EduTask";
import { TopicTask } from "./TopicTask";
import { Task } from "./Task";

@Entity("test_data")
export class TestData {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => EduTask, (t) => t.testData, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "task_id" })
  task?: EduTask | null; // Для старої системи (deprecated)

  @ManyToOne(() => TopicTask, (t) => t.testData, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "topic_task_id" })
  topicTask?: TopicTask | null; // Для нової системи

  @ManyToOne(() => Task, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "personal_task_id" })
  personalTask?: Task | null; // Для personal версії

  @Column({ type: "text" })
  input!: string; // Вхідні дані (JSON або текст)

  @Column({ type: "text", name: "expected_output" })
  expectedOutput!: string; // Очікуваний вихід (JSON або текст)

  /**
   * TestData v2:
   * - public tests (isHidden=false): may be shown to users (without expected output)
   * - hidden tests (isHidden=true): NEVER returned via API, expected stays backend-only for judging
   */
  @Column({ type: "boolean", default: false, name: "is_hidden" })
  isHidden!: boolean;

  @Column({ type: "int", default: 1 })
  points!: number; // Бали за цей тест (для 12-бальної системи)

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

