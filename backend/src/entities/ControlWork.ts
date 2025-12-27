// src/entities/ControlWork.ts
// Контрольна робота прив'язана до теми
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
import { TopicNew } from "./TopicNew";
import { TopicTask } from "./TopicTask";
import { LessonAttempt } from "./LessonAttempt";
import { SummaryGrade } from "./SummaryGrade";

@Entity("control_works")
export class ControlWork {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => TopicNew, (topic) => topic.controlWorks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "topic_id" })
  topic!: TopicNew;

  @Column({ type: "varchar", length: 255, nullable: true })
  title!: string | null; // Назва контрольної роботи

  @Column({ type: "int", nullable: true, name: "time_limit_minutes" })
  timeLimitMinutes?: number | null; // Обмеження часу в хвилинах

  // JSON тест для контрольної роботи (питання у форматі АБВГД)
  @Column({ type: "text", nullable: true, name: "quiz_json" })
  quizJson?: string | null;

  // Чи включена теоретична частина
  @Column({ type: "boolean", default: false, name: "has_theory" })
  hasTheory!: boolean;

  // Чи включена практична частина
  @Column({ type: "boolean", default: true, name: "has_practice" })
  hasPractice!: boolean;

  @Column({ type: "boolean", default: false, name: "is_assigned" })
  isAssigned!: boolean; // Чи призначена контрольна робота учням

  @Column({ type: "datetime", nullable: true, name: "deadline" })
  deadline?: Date | null; // Дедлайн для контрольної роботи

  // Динамічна формула для розрахунку фінальної оцінки
  // Приклади: "test + 1.3 * avg(practice)", "avg(practice)", "test"
  // Змінні: test (theoryGrade), avg(practice) (середнє за практичні завдання)
  @Column({ type: "text", nullable: true })
  formula?: string | null;

  // Контрольні завдання, які входять до цієї контрольної роботи
  // Якщо hasPractice = true, то використовуються всі TopicTask з типом CONTROL в темі
  // Або можна явно вказати через ManyToMany зв'язок (потрібна додаткова таблиця)
  // Зараз використовується неявний зв'язок: всі CONTROL завдання теми входять до КР

  @OneToMany(() => LessonAttempt, (attempt) => attempt.controlWork)
  attempts!: LessonAttempt[];

  @OneToMany(() => SummaryGrade, (grade) => grade.controlWork)
  summaryGrades!: SummaryGrade[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

