import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Task } from "./entities/Task";
import { Grade } from "./entities/Grade";
import { Topic } from "./entities/Topic";
import { Class } from "./entities/Class";
import { Student } from "./entities/Student";
import { EduLesson } from "./entities/EduLesson";
import { EduTask } from "./entities/EduTask";
import { TestData } from "./entities/TestData";
import { EduGrade } from "./entities/EduGrade";
import { SummaryGrade } from "./entities/SummaryGrade";
import { LessonAttempt } from "./entities/LessonAttempt";
import { TopicNew } from "./entities/TopicNew";
import { TopicTask } from "./entities/TopicTask";
import { TaskTheory } from "./entities/TaskTheory";
import { ControlWork } from "./entities/ControlWork";
import { TopicProgress } from "./entities/TopicProgress";
import { ClassAnnouncement } from "./entities/ClassAnnouncement";

const dbPort = process.env.DB_PORT != null ? parseInt(process.env.DB_PORT, 10) : 3306;

// Якщо DATABASE_URL встановлений, використовуємо його
// Інакше використовуємо окремі змінні
export const AppDataSource = new DataSource({
  type: "mysql",
  // DATABASE_URL має пріоритет, але якщо його немає - використовуємо окремі змінні
  ...(process.env.DATABASE_URL 
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || "localhost",
        port: dbPort,
        username: process.env.DB_USER || "root",
        password: process.env.DB_PASS || "",
        database: process.env.DB_NAME || "studycod",
      }
  ),
  entities: [
    User, 
    Task, 
    Grade, 
    Topic,
    Class,
    Student,
    EduLesson,
    EduTask,
    TestData,
    EduGrade,
    SummaryGrade,
    LessonAttempt,
    TopicNew,
    TopicTask,
    TaskTheory,
    ControlWork,
    TopicProgress,
    ClassAnnouncement,
  ],
  synchronize: false,
  logging: false,
  migrations: ["dist/migrations/*.js"],
  extra: {
    connectionLimit: parseInt(process.env.DB_POOL_SIZE || "10", 10),
    connectTimeout: 5000,
    queueLimit: 0,
    multipleStatements: false,
    dateStrings: false,
  },
  cache: false,
});

export default AppDataSource;
