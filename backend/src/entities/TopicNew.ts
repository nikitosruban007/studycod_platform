// src/entities/TopicNew.ts
// Нова канонічна модель ТЕМИ
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
import { TopicTask } from "./TopicTask";
import { ControlWork } from "./ControlWork";
import { TopicProgress } from "./TopicProgress";
import { Class } from "./Class";

export type TopicLanguage = "JAVA" | "PYTHON";

@Entity("topics_new")
export class TopicNew {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string; // Назва теми

  @Column({ type: "text", nullable: true })
  description?: string | null; // Опис теми

  @Column({ type: "int", default: 0 })
  order!: number; // Порядок теми в курсі

  @Column({ type: "enum", enum: ["JAVA", "PYTHON"] })
  language!: TopicLanguage; // Мова програмування

  @ManyToOne(() => Class, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "class_id" })
  class?: Class | null; // Клас, до якого належить тема

  @OneToMany(() => TopicTask, (task) => task.topic)
  tasks!: TopicTask[];

  @OneToMany(() => ControlWork, (cw) => cw.topic)
  controlWorks!: ControlWork[];

  @OneToMany(() => TopicProgress, (progress) => progress.topic)
  progresses!: TopicProgress[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

