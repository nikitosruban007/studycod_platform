// src/entities/SummaryGrade.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from "typeorm";
import { Student } from "./Student";
import { Class } from "./Class";

@Entity("summary_grades")
export class SummaryGrade {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Student, (s) => s.summaryGrades, { onDelete: "CASCADE" })
  @JoinColumn({ name: "student_id" })
  student!: Student;

  @ManyToOne(() => Class, { onDelete: "CASCADE" })
  @JoinColumn({ name: "class_id" })
  class!: Class;

  @Column({ type: "varchar", length: 255 })
  name!: string; // Назва проміжної/тематичної оцінки (наприклад, "Тематична 1", "Проміжна")

  @Column({ type: "decimal", precision: 5, scale: 2 })
  grade!: number; // Оцінка (може бути десятковим числом)

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

