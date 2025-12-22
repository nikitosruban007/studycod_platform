
export type CourseLanguage = "JAVA" | "PYTHON";

export type UserMode = "PERSONAL" | "EDUCATIONAL";

export interface User {
  id: number;
  username: string;
  course: CourseLanguage;
  difus: number;
  avatarUrl: string | null;
  userMode?: UserMode;
  googleId?: string | null;
  // Для учнів
  studentId?: number;
  classId?: number;
  className?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  email?: string;
}

export interface Topic {
  id: number;
  title: string;
  orderIndex: number;
  isIntro: boolean;
}

export interface Task {
  id: number;
  title: string;
  descriptionMarkdown: string;
  starterCode: string;
  userCode: string;
  status: "OPEN" | "SUBMITTED" | "GRADED";
  lessonInTopic: number;
  repeatAttempt: number;
  kind: "INTRO" | "TOPIC" | "CONTROL";
  createdAt: string;
  language?: "JAVA" | "PYTHON";
}

export interface Grade {
  id: number;
  total: number;
  workScore: number;
  optimizationScore: number;
  integrityScore: number;
  aiFeedback: string | null;
  comparisonFeedback?: string | null;
  previousGrade?: number | null;
  createdAt: string;
  task: Task & { topic?: Topic | null };
}
  task: Task & { topic?: Topic | null };
}