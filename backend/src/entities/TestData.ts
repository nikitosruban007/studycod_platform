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

@Entity("test_data")
export class TestData {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => EduTask, (t) => t.testData, { onDelete: "CASCADE" })
  @JoinColumn({ name: "task_id" })
  task!: EduTask;

  @Column({ type: "text" })
  input!: string; // Вхідні дані (JSON або текст)

  @Column({ type: "text", name: "expected_output" })
  expectedOutput!: string; // Очікуваний вихід (JSON або текст)

  @Column({ type: "int", default: 1 })
  points!: number; // Бали за цей тест (для 12-бальної системи)

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

