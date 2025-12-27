// src/entities/TaskTheory.ts
// Теорія як додаток до завдання
// Підтримує як edu_tasks, так і topic_tasks
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { TopicTask } from "./TopicTask";
import { EduTask } from "./EduTask";

@Entity("task_theories")
export class TaskTheory {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => TopicTask, (task) => task.theory, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "topic_task_id" })
  topicTask?: TopicTask | null; // Для нової системи (topic_tasks)

  @OneToOne(() => EduTask, (task) => task.theory, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "edu_task_id" })
  eduTask?: EduTask | null; // Для старої системи (edu_tasks)

  @Column({ type: "text" })
  content!: string; // Markdown + LaTeX контент теорії

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

