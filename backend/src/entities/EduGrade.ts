// src/entities/EduGrade.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Student } from "./Student";
import { EduTask } from "./EduTask";

@Entity("edu_grades")
export class EduGrade {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Student, (s) => s.grades, { onDelete: "CASCADE" })
  @JoinColumn({ name: "student_id" })
  student!: Student;

  @ManyToOne(() => EduTask, (t) => t.grades, { onDelete: "CASCADE" })
  @JoinColumn({ name: "task_id" })
  task!: EduTask;

  @Column({ type: "int", nullable: true })
  total!: number | null; // Оцінка по 12-бальній системі (1-12)

  @Column({ type: "text", nullable: true, name: "submitted_code" })
  submittedCode!: string | null; // Код, який відправив учень

  @Column({ type: "text", nullable: true })
  feedback!: string | null; // Коментар вчителя

  @Column({ type: "boolean", default: false, name: "is_manually_graded" })
  isManuallyGraded!: boolean; // Чи була оцінка змінена вручну вчителем

  @Column({ type: "int", default: 0, name: "tests_passed" })
  testsPassed!: number; // Кількість пройдених тестів

  @Column({ type: "int", default: 0, name: "tests_total" })
  testsTotal!: number; // Загальна кількість тестів

  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true, name: "theory_grade" })
  theoryGrade!: number | null; // Оцінка за теоретичну частину (тест) для контрольної роботи

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

