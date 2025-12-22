// src/entities/Student.ts
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
import { User } from "./User";
import { EduGrade } from "./EduGrade";
import { SummaryGrade } from "./SummaryGrade";

@Entity("students")
export class Student {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Class, (c) => c.students, { onDelete: "CASCADE" })
  @JoinColumn({ name: "class_id" })
  class!: Class;

  // Зв'язок з User (якщо учень має аккаунт)
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user?: User | null;

  @Column({ type: "varchar", length: 100, name: "first_name" })
  firstName!: string; // Ім'я

  @Column({ type: "varchar", length: 100, name: "last_name" })
  lastName!: string; // Прізвище

  @Column({ type: "varchar", length: 100, nullable: true, name: "middle_name" })
  middleName?: string | null; // По-батькові

  @Column({ type: "varchar", length: 255 })
  email!: string; // Email учня

  @Column({ type: "varchar", length: 100, unique: true, name: "generated_username" })
  generatedUsername!: string; // Згенерований нікнейм

  @Column({ name: "generated_password" })
  generatedPassword!: string; // Згенерований пароль (хешований)

  @Column({ type: "text", nullable: true, name: "avatar_url" })
  avatarUrl?: string | null; // Аватарка учня

  // Тимчасове поле для зберігання plain password (для експорту)
  // ВАЖЛИВО: Це поле НЕ мапиться в БД, використовується тільки в runtime
  plainPassword?: string;

  @OneToMany(() => EduGrade, (g) => g.student)
  grades!: EduGrade[];

  @OneToMany(() => SummaryGrade, (sg) => sg.student)
  summaryGrades!: SummaryGrade[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

