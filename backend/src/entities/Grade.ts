import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from "typeorm";
import { User } from "./User";
import { Task } from "./Task";

@Entity({ name: "grades" })
export class Grade {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, (u) => u.grades, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @ManyToOne(() => Task, (t) => t.grades, { onDelete: "CASCADE" })
  @JoinColumn({ name: "task_id" })
  task!: Task;

  @Column({ type: "int", nullable: true })
  total!: number | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  taskName!: string | null;

  @Column({ type: "int", nullable: true, default: 0 })
  workScore!: number | null;

  @Column({ type: "int", nullable: true, default: 0 })
  optimizationScore!: number | null;

  @Column({ type: "int", nullable: true, default: 0 })
  integrityScore!: number | null;

  @Column({ type: "text", nullable: true })
  aiFeedback!: string | null;

  @Column({ type: "int", nullable: true, name: "previous_grade_id" })
  previousGradeId!: number | null;

  @Column({ type: "text", nullable: true, name: "code_snapshot" })
  codeSnapshot!: string | null;

  @Column({ type: "text", nullable: true, name: "comparison_feedback" })
  comparisonFeedback!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}