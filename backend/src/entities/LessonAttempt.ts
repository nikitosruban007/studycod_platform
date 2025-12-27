// src/entities/LessonAttempt.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { EduLesson } from "./EduLesson";
import { Student } from "./Student";
import { ControlWork } from "./ControlWork";

export type ControlWorkStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

@Entity("lesson_attempts")
export class LessonAttempt {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => EduLesson, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "lesson_id" })
  lesson?: EduLesson | null; // Для старої системи (deprecated)

  @ManyToOne(() => ControlWork, (cw) => cw.attempts, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "control_work_id" })
  controlWork?: ControlWork | null; // Для нової системи

  @ManyToOne(() => Student, { onDelete: "CASCADE" })
  @JoinColumn({ name: "student_id" })
  student!: Student;

  @Column({ type: "datetime", name: "started_at" })
  startedAt!: Date; // Час початку спроби

  @Column({ type: "datetime", nullable: true, name: "finished_at" })
  finishedAt?: Date | null; // Час завершення спроби

  @Column({ type: "int", name: "time_limit_minutes" })
  timeLimitMinutes!: number; // Обмеження часу в хвилинах (на момент початку)

  @Column({ 
    type: "enum", 
    enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"],
    default: "NOT_STARTED",
    name: "status"
  })
  status!: ControlWorkStatus; // Статус контрольної роботи

  @Column({ type: "boolean", default: false, name: "is_finished" })
  isFinished!: boolean; // Deprecated: використовується status замість цього

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

