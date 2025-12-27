// src/entities/SummaryGrade.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { Student } from "./Student";
import { Class } from "./Class";
import { EduLesson } from "./EduLesson";
import { ControlWork } from "./ControlWork";
import { TopicNew } from "./TopicNew";
import { AssessmentType, validateAssessmentType } from "../types/AssessmentType";

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

  @ManyToOne(() => EduLesson, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "lesson_id" })
  lesson?: EduLesson | null; // Для старої системи (deprecated)

  @ManyToOne(() => ControlWork, (cw) => cw.summaryGrades, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "control_work_id" })
  controlWork?: ControlWork | null; // Для нової системи

  @ManyToOne(() => TopicNew, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "topic_id" })
  topic!: TopicNew; // Тема, для якої створюється проміжна оцінка (обов'язкова)

  @Column({ type: "varchar", length: 255 })
  name!: string; // Назва проміжної/тематичної оцінки (наприклад, "Тематична 1", "Проміжна")

  /**
   * КРИТИЧНО: Тип оцінки
   * CONTROL - контрольна робота (ФІНАЛ), НЕ входить у середні
   * INTERMEDIATE - проміжна оцінка, входить у середні
   * PRACTICE - практична оцінка, входить у середні
   */
  @Column({
    type: "enum",
    enum: AssessmentType,
    default: AssessmentType.INTERMEDIATE,
    name: "assessment_type"
  })
  assessmentType!: AssessmentType;

  @Column({ type: "decimal", precision: 5, scale: 2 })
  grade!: number; // Оцінка (може бути десятковим числом)

  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true, name: "theory_grade" })
  theoryGrade!: number | null; // Оцінка за теоретичну частину (тест) для контрольної роботи

  @Column({ type: "text", nullable: true, name: "formula_snapshot" })
  formulaSnapshot!: string | null; // Знімок формули на момент обчислення (для історії та аудиту)

  @Column({ type: "timestamp", nullable: true, name: "calculated_at" })
  calculatedAt!: Date | null; // Час останнього обчислення оцінки

  /**
   * Quiz review (CONTROL only): snapshot of student's submitted answers and per-question correctness.
   * We persist it to show the student which answers were correct/incorrect even after reload,
   * and to keep integrity if teacher edits quiz later.
   */
  @Column({ type: "text", nullable: true, name: "quiz_answers_json" })
  quizAnswersJson!: string | null;

  @Column({ type: "text", nullable: true, name: "quiz_results_json" })
  quizResultsJson!: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  /**
   * Runtime validation: CONTROL має мати controlWorkId, INTERMEDIATE/PRACTICE - не мають
   */
  @BeforeInsert()
  @BeforeUpdate()
  validateAssessmentType() {
    validateAssessmentType(
      this.assessmentType,
      this.controlWork?.id || null,
      'grade'
    );
  }
}

