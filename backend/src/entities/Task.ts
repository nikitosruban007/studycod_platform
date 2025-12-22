// src/entities/Task.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";
import { Grade } from "./Grade";
import { Topic } from "./Topic";

export type TaskType = "INTRO" | "TOPIC" | "CONTROL";
export type TaskStatus = "OPEN" | "SUBMITTED" | "GRADED";
export type TaskLang = "JAVA" | "PYTHON";

@Entity("tasks")
export class Task {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (u) => u.tasks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Topic, { nullable: true })
  @JoinColumn({ name: "topic_id" })
  topic?: Topic | null;

  // Тип завдання: вступний, звичайний урок, контрольна
  @Column({
    type: "enum",
    enum: ["INTRO", "TOPIC", "CONTROL"],
    default: "TOPIC",
  })
  type!: TaskType;

  @Column()
  title!: string;

  @Column()
  subtitle!: string;

  // Markdown + LaTeX текст завдання / уроку
  @Column({ type: "text" })
  description!: string;

  // Додаткове поле для AI-промпта.
  // НЕ мапиться в БД (без декоратора), просто опціонально
  // може виставлятись як копія description.
  descriptionMarkdown?: string;

  // Стартовий шаблон коду
  @Column({ type: "text" })
  template!: string;

  // Чернетка (оновлюється при "Зберегти")
  @Column({ type: "text", default: "" })
  draftCode!: string;

  // Остаточний код, який відправили на оцінку
  @Column({ type: "text", default: "" })
  finalCode!: string;

  // Проста відмітка виконаності (0 / 1)
  @Column({ type: "tinyint", default: 0 })
  completed!: number;

  // Мова: Java / Python
  @Column({ type: "varchar", length: 10, default: "JAVA" })
  lang!: TaskLang;

  // Difus: 0 — легкі, 1 — «подумати»
  @Column({ type: "tinyint", unsigned: true, default: 0 })
  difus!: number;

  // Порядковий номер завдання в темі (1,2,3,...)
  @Column({ type: "int", default: 0, name: "num_in_topic" })
  numInTopic!: number;

  // Індекс теми (щоб порахувати 5 тем до к.р.)
  @Column({ type: "int", default: 0, name: "topic_index" })
  topicIndex!: number;

  // JSON тест для контрольної роботи (12 питань у форматі АБВГД)
  @Column({ type: "text", nullable: true, name: "quiz_json" })
  quizJson?: string | null;

  @OneToMany(() => Grade, (g) => g.task)
  grades!: Grade[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
