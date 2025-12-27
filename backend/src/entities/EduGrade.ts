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
import { TopicTask } from "./TopicTask";

@Entity("edu_grades")
export class EduGrade {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Student, (s) => s.grades, { onDelete: "CASCADE" })
  @JoinColumn({ name: "student_id" })
  student!: Student;

  @ManyToOne(() => EduTask, (t) => t.grades, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "task_id" })
  task?: EduTask | null; // Для старої системи (deprecated)

  @ManyToOne(() => TopicTask, (t) => t.grades, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "topic_task_id" })
  topicTask?: TopicTask | null; // Для нової системи

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

  @Column({ 
    type: "enum", 
    enum: ["PRACTICE", "TEST"], 
    nullable: true,
    default: "PRACTICE"
  })
  type!: "PRACTICE" | "TEST" | null; // Тип оцінки: практичне завдання або тест

  @Column({ type: "boolean", default: false, name: "is_completed" })
  isCompleted!: boolean; // Чи завершено завдання достроково (закрито для редагування)

  @Column({ type: "text", nullable: true, name: "test_results" })
  testResults!: string | null; // JSON з результатами тестів для швидкого відображення

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

