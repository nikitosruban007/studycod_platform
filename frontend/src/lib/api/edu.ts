// frontend/src/lib/api/edu.ts
import { api } from "./client";

// Student Login
export interface StudentLoginResponse {
  token: string;
  student: {
    id: number;
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    username: string;
    classId: number;
    className: string;
    language: "JAVA" | "PYTHON";
  };
}

export async function studentLogin(
  username: string,
  password: string
): Promise<StudentLoginResponse> {
  const res = await api.post("/edu/student-login", { username, password });
  if (res.data.token) {
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("userType", "STUDENT");
  }
  return res.data;
}

// Types
export interface Class {
  id: number;
  name: string;
  language: "JAVA" | "PYTHON";
  studentsCount: number;
  createdAt: string;
}

export interface Student {
  id: number;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  generatedUsername: string;
  createdAt: string;
}

export interface StudentCredentials {
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  username: string;
  password: string;
}

export interface Lesson {
  id: number;
  type: "LESSON" | "CONTROL";
  title: string;
  hasTheory: boolean;
  theory?: string;
  timeLimitMinutes?: number;
  controlHasTheory: boolean;
  controlHasPractice: boolean;
  quizJson?: string | null;
  tasksCount: number;
  createdAt: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  template: string;
  testDataCount: number;
  createdAt: string;
}

export interface TaskWithGrade {
  id: number;
  title: string;
  description: string;
  template: string;
  language: "JAVA" | "PYTHON";
  testDataCount: number;
  savedCode?: string; // Збережений код учня
  lesson: {
    id: number;
    title: string;
    type: "LESSON" | "CONTROL";
    hasTheory: boolean;
    theory?: string;
    timeLimitMinutes?: number;
    quizJson?: string;
    controlHasTheory?: boolean;
    controlHasPractice?: boolean;
  };
  hasGrade: boolean;
  grade?: {
    id: number;
    total: number;
    testsPassed: number;
    testsTotal: number;
    feedback?: string;
    createdAt: string;
  };
}

export interface Grade {
  id: number;
  total: number;
  testsPassed: number;
  testsTotal: number;
  feedback?: string;
  isManuallyGraded: boolean;
  createdAt: string;
  task: {
    id: number;
    title: string;
    lesson: {
      id: number;
      title: string;
      type: "LESSON" | "CONTROL";
    };
  };
}

export interface TestResult {
  input: string;
  expected: string;
  actual: string;
  stderr?: string;
  passed: boolean;
}

// Teacher Registration
export async function registerTeacher(
  username: string,
  email: string,
  password: string,
  language: "JAVA" | "PYTHON"
): Promise<{ token?: string; user?: any; requiresEmailVerification?: boolean }> {
  const res = await api.post("/edu/register-teacher", {
    username,
    email,
    password,
    language,
  });
  if (res.data.token) {
    localStorage.setItem("token", res.data.token);
  }
  return res.data;
}

// Classes
export async function createClass(name: string, language: "JAVA" | "PYTHON"): Promise<Class> {
  const res = await api.post("/edu/classes", { name, language });
  return res.data.class;
}

export async function getClasses(): Promise<Class[]> {
  const res = await api.get("/edu/classes");
  return res.data.classes;
}

// Students
export interface AddStudentsRequest {
  students: Array<{
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
  }>;
}

export async function addStudents(
  classId: number,
  students: AddStudentsRequest["students"]
): Promise<{ count: number; credentials: StudentCredentials[] }> {
  const res = await api.post(`/edu/classes/${classId}/students`, { students });
  return res.data;
}

export async function getStudents(classId: number): Promise<Student[]> {
  const res = await api.get(`/edu/classes/${classId}/students`);
  return res.data.students;
}

export async function exportStudents(classId: number): Promise<Blob> {
  const res = await api.get(`/edu/classes/${classId}/students/export`, {
    responseType: "blob",
  });
  return res.data;
}

export async function importStudents(
  classId: number,
  csvData: string
): Promise<{ count: number; credentials: StudentCredentials[] }> {
  const res = await api.post(`/edu/classes/${classId}/students/import`, {
    csvData,
  });
  return res.data;
}

export async function regeneratePassword(studentId: number): Promise<{ username: string; password: string }> {
  const res = await api.post(`/edu/students/${studentId}/regenerate-password`);
  return res.data;
}

// Lessons
export interface CreateLessonRequest {
  type: "LESSON" | "CONTROL";
  title: string;
  theory?: string;
  hasTheory: boolean;
  timeLimitMinutes?: number;
  controlHasTheory?: boolean;
  controlHasPractice?: boolean;
}

export async function createLesson(classId: number, lesson: CreateLessonRequest): Promise<Lesson> {
  const res = await api.post(`/edu/classes/${classId}/lessons`, lesson);
  return res.data.lesson;
}

export async function getLessons(classId: number): Promise<Lesson[]> {
  const res = await api.get(`/edu/classes/${classId}/lessons`);
  return res.data.lessons;
}

export async function getStudentLessons(): Promise<Lesson[]> {
  const res = await api.get(`/edu/students/me/lessons`);
  return res.data.lessons;
}

export async function getLesson(lessonId: number): Promise<Lesson & { tasks: Task[] }> {
  const res = await api.get(`/edu/lessons/${lessonId}`);
  return res.data.lesson;
}

export async function generateTheory(lessonId: number, topicTitle: string): Promise<{ theory: string }> {
  const res = await api.post(`/edu/lessons/${lessonId}/generate-theory`, { topicTitle });
  return res.data;
}

export async function generateTheoryPreview(topicTitle: string, language: "JAVA" | "PYTHON"): Promise<{ theory: string }> {
  const res = await api.post(`/edu/generate-theory`, { topicTitle, language });
  return res.data;
}

export async function generateQuiz(lessonId: number, count?: number, topicTitle?: string): Promise<{
  count: number;
  quiz: any[];
  quizJson: string;
}> {
  const res = await api.post(`/edu/lessons/${lessonId}/generate-quiz`, { count, topicTitle });
  return res.data;
}

export async function saveQuiz(lessonId: number, quiz: any[]): Promise<void> {
  await api.put(`/edu/lessons/${lessonId}/quiz`, { quiz });
}

// Tasks
export interface CreateTaskRequest {
  title: string;
  description: string;
  template: string;
}

export async function createTask(lessonId: number, task: CreateTaskRequest): Promise<Task> {
  const res = await api.post(`/edu/lessons/${lessonId}/tasks`, task);
  return res.data.task;
}

export async function getTask(taskId: number): Promise<TaskWithGrade> {
  const res = await api.get(`/edu/tasks/${taskId}`);
  return res.data.task;
}

export async function runCode(taskId: number, code: string, input?: string): Promise<{ output: string; stderr?: string }> {
  const res = await api.post(`/edu/tasks/${taskId}/run`, { code, input });
  return res.data;
}

export async function submitCode(taskId: number, code: string): Promise<{
  message: string;
  grade: {
    id: number;
    total: number;
    testsPassed: number;
    testsTotal: number;
    isManuallyGraded: boolean;
  };
  testResults: TestResult[];
}> {
  const res = await api.post(`/edu/tasks/${taskId}/submit`, { code });
  return res.data;
}

// Test Data
export async function generateTestData(taskId: number, count: number): Promise<{
  count: number;
  testData: Array<{
    id: number;
    input: string;
    expectedOutput: string;
    points: number;
  }>;
}> {
  const res = await api.post(`/edu/tasks/${taskId}/test-data/generate`, { count });
  return res.data;
}

export interface TestDataItem {
  input: string;
  expectedOutput: string;
  points: number;
}

export async function addTestData(taskId: number, testData: TestDataItem[]): Promise<{ count: number }> {
  const res = await api.post(`/edu/tasks/${taskId}/test-data`, { testData });
  return res.data;
}

export interface TestData {
  id: number;
  input: string;
  expectedOutput: string;
  points: number;
}

export async function getTestData(taskId: number): Promise<{ testData: TestData[] }> {
  const res = await api.get(`/edu/tasks/${taskId}/test-data`);
  return res.data;
}

export async function updateTestData(
  taskId: number,
  testDataId: number,
  update: { input?: string; expectedOutput?: string; points?: number }
): Promise<{ message: string; testData: TestData }> {
  const res = await api.put(`/edu/tasks/${taskId}/test-data/${testDataId}`, update);
  return res.data;
}

export async function deleteTestData(taskId: number, testDataId: number): Promise<{ message: string }> {
  const res = await api.delete(`/edu/tasks/${taskId}/test-data/${testDataId}`);
  return res.data;
}

export interface UpdateTaskDetailsRequest {
  maxAttempts?: number;
  deadline?: string | null;
  isClosed?: boolean;
}

export async function updateTaskDetails(
  taskId: number,
  update: UpdateTaskDetailsRequest
): Promise<{ message: string; task: { id: number; maxAttempts: number; deadline: string | null; isClosed: boolean } }> {
  const res = await api.put(`/edu/tasks/${taskId}`, update);
  return res.data;
}

export interface CreateManualGradeRequest {
  total: number;
  feedback?: string;
}

export async function createManualGrade(
  taskId: number,
  studentId: number,
  grade: CreateManualGradeRequest
): Promise<{ message: string; grade: { id: number; total: number; feedback?: string; isManuallyGraded: boolean } }> {
  const res = await api.post(`/edu/tasks/${taskId}/grades/${studentId}`, grade);
  return res.data;
}

// Student Info
export async function getMyStudentInfo(): Promise<{
  student: {
    id: number;
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    class: {
      id: number;
      name: string;
      language: "JAVA" | "PYTHON";
    };
  };
}> {
  const res = await api.get("/edu/students/me");
  return res.data;
}

// Grades (for students)
export interface StudentGradesResponse {
  grades: Grade[];
  summaryGrades: SummaryGrade[];
}

export async function getStudentGrades(studentId: number): Promise<StudentGradesResponse> {
  const res = await api.get(`/edu/students/${studentId}/grades`);
  return res.data;
}

// Grades (for teachers)
export interface TaskGrade {
  student: {
    id: number;
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
  };
  grade: {
    id: number;
    total: number;
    testsPassed: number;
    testsTotal: number;
    feedback?: string;
    isManuallyGraded: boolean;
    createdAt: string;
  } | null;
}

export async function getTaskGrades(taskId: number): Promise<TaskGrade[]> {
  const res = await api.get(`/edu/tasks/${taskId}/grades`);
  return res.data.students;
}

export async function getStudentCode(gradeId: number): Promise<{
  code: string;
  grade: {
    id: number;
    total: number;
    feedback?: string;
    testsPassed: number;
    testsTotal: number;
    isManuallyGraded: boolean;
  };
  student: {
    id: number;
    firstName: string;
    lastName: string;
    middleName?: string;
  };
  task: {
    id: number;
    title: string;
  };
}> {
  const res = await api.get(`/edu/grades/${gradeId}/code`);
  return res.data;
}

export interface UpdateGradeRequest {
  total?: number;
  feedback?: string;
}

export async function updateGrade(gradeId: number, update: UpdateGradeRequest): Promise<{
  message: string;
  grade: {
    id: number;
    total: number;
    feedback?: string;
    isManuallyGraded: boolean;
  };
}> {
  const res = await api.put(`/edu/grades/${gradeId}`, update);
  return res.data;
}

// Summary Grades
export interface CreateSummaryGradeRequest {
  name: string;
  studentGrades: Array<{
    studentId: number;
    grade: number;
  }>;
}

export async function createSummaryGrade(
  classId: number,
  request: CreateSummaryGradeRequest
): Promise<{ count: number }> {
  const res = await api.post(`/edu/classes/${classId}/summary-grades`, request);
  return res.data;
}

export interface SummaryGradeGroup {
  name: string;
  grades: Array<{
    id: number; // ID для редагування
    studentId: number;
    studentName: string;
    grade: number;
    createdAt: string;
  }>;
}

export async function getSummaryGrades(classId: number): Promise<SummaryGradeGroup[]> {
  const res = await api.get(`/edu/classes/${classId}/summary-grades`);
  return res.data.summaryGrades;
}

export async function updateSummaryGrade(
  classId: number,
  summaryGradeId: number,
  grade: number
): Promise<void> {
  await api.put(`/edu/classes/${classId}/summary-grades/${summaryGradeId}`, { grade });
}

// Gradebook
export interface GradebookStudent {
  studentId: number;
  studentName: string;
  grades: Array<{
    taskId: number;
    taskTitle: string;
    lessonId: number;
    lessonTitle: string;
    grade: number | null;
    createdAt: string | null;
  }>;
}

export interface GradebookLesson {
  id: number;
  title: string;
  type: string;
  tasks: Array<{
    id: number;
    title: string;
  }>;
}

export interface GradebookResponse {
  students: GradebookStudent[];
  lessons: GradebookLesson[];
}

export async function getClassGradebook(classId: number): Promise<GradebookResponse> {
  const res = await api.get(`/edu/classes/${classId}/gradebook`);
  return res.data;
}

// Quiz submission
export async function submitQuizAnswers(
  taskId: number,
  answers: Record<number, string>
): Promise<{
  message: string;
  grade: {
    id: number;
    theoryGrade: number;
    correctAnswers: number;
    totalQuestions: number;
  };
}> {
  const res = await api.post(`/edu/tasks/${taskId}/submit-quiz`, { answers });
  return res.data;
}
