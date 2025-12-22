// src/entities/EduLesson.ts
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
import { Class } from "./Class";
import { EduTask } from "./EduTask";

export type LessonType = "LESSON" | "CONTROL"; // Урок або Контроль знань

@Entity("edu_lessons")
export class EduLesson {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Class, (c) => c.lessons, { onDelete: "CASCADE" })
  @JoinColumn({ name: "class_id" })
  class!: Class;

  @Column({ type: "enum", enum: ["LESSON", "CONTROL"], default: "LESSON" })
  type!: LessonType;

  @Column()
  title!: string; // Назва уроку

  @Column({ type: "text", nullable: true })
  theory?: string | null; // Теорія (якщо вмикається режим теорії)

  @Column({ type: "boolean", default: false, name: "has_theory" })
  hasTheory!: boolean; // Чи є теорія

  @Column({ type: "int", nullable: true, name: "time_limit_minutes" })
  timeLimitMinutes?: number | null; // Обмеження по часу (в хвилинах)

  // Для контрольної роботи: чи включена теоретична частина
  @Column({ type: "boolean", default: false, name: "control_has_theory" })
  controlHasTheory!: boolean;

  // Для контрольної роботи: чи включена практична частина
  @Column({ type: "boolean", default: true, name: "control_has_practice" })
  controlHasPractice!: boolean;

  // JSON тест для контрольної роботи (питання у форматі АБВГД)
  @Column({ type: "text", nullable: true, name: "quiz_json" })
  quizJson?: string | null;

  @OneToMany(() => EduTask, (t) => t.lesson)
  tasks!: EduTask[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

