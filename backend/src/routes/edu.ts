import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { AppDataSource } from "../data-source";
import { User, UserLang } from "../entities/User";
import { Class } from "../entities/Class";
import { Student } from "../entities/Student";
import { authRequired, AuthRequest } from "../middleware/authMiddleware";
import {
  generateUsername,
  generatePassword,
  hashPassword,
} from "../services/studentCredentialsService";
import { emailService } from "../services/emailService";
import { EduLesson, LessonType } from "../entities/EduLesson";
import { EduTask } from "../entities/EduTask";
import { TestData } from "../entities/TestData";
import { EduGrade } from "../entities/EduGrade";
import { SummaryGrade } from "../entities/SummaryGrade";
import {
  executeCodeWithInput,
  compareOutput,
} from "../services/codeExecutionService";
import { JWT_SECRET } from "../config";

const eduRouter = Router();

const userRepo = () => AppDataSource.getRepository(User);
const classRepo = () => AppDataSource.getRepository(Class);
const studentRepo = () => AppDataSource.getRepository(Student);
const lessonRepo = () => AppDataSource.getRepository(EduLesson);
const taskRepo = () => AppDataSource.getRepository(EduTask);
const testDataRepo = () => AppDataSource.getRepository(TestData);
const gradeRepo = () => AppDataSource.getRepository(EduGrade);
const summaryGradeRepo = () => AppDataSource.getRepository(SummaryGrade);

function normalizeLang(input?: string | null): UserLang {
  const raw = (input || "").toUpperCase().trim();
  if (raw.startsWith("PY")) return "PYTHON";
  return "JAVA";
}

const registerTeacherSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
  language: z.string().optional(),
});

/* ========================= TEACHERS & CLASSES ========================= */

eduRouter.post("/register-teacher", async (req: Request, res: Response) => {
  try {
    const validated = registerTeacherSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ 
        message: "INVALID_INPUT", 
        errors: validated.error.errors 
      });
    }

    const { username, email, password, language } = validated.data;

    const existingUser = await userRepo().findOne({
      where: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.username === username ? "USERNAME_ALREADY_EXISTS" : "EMAIL_ALREADY_EXISTS" 
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = userRepo().create({
      username,
      email,
      password: hash,
      lang: normalizeLang(language),
      userMode: "EDUCATIONAL",
      emailVerified: false,
      emailVerificationToken: verificationToken,
    });

    await userRepo().save(user);
    
    // Fix: correct order of arguments (email, token, username)
    emailService.sendVerificationEmail(email, verificationToken, username).catch(err => {
      console.error("[Email Error]:", err);
    });

    res.status(201).json({ requiresEmailVerification: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

eduRouter.post("/classes", authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const user = await userRepo().findOne({ where: { id: req.userId } });
    if (!user || user.userMode !== "EDUCATIONAL") {
      return res.status(403).json({ message: "ONLY_TEACHERS_CAN_CREATE_CLASSES" });
    }

    const schema = z.object({
      name: z.string().min(1).max(100),
      language: z.string().optional(),
    });

    const validated = schema.safeParse(req.body);
    if (!validated.success) return res.status(400).json({ message: "INVALID_INPUT" });

    const { name, language } = validated.data;

    const cls = classRepo().create({
      teacher: user,
      name,
      language: normalizeLang(language || user.lang),
    });
    await classRepo().save(cls);
    res.status(201).json({ class: cls });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

eduRouter.get("/classes", authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const user = await userRepo().findOne({ where: { id: req.userId } });
    if (!user || user.userMode !== "EDUCATIONAL") {
      return res.status(403).json({ message: "ONLY_TEACHERS_CAN_VIEW_CLASSES" });
    }

    const classes = await classRepo().find({
      where: { teacher: { id: user.id } },
      relations: ["students"],
      order: { createdAt: "DESC" },
    });

    res.json({
      classes: classes.map(c => ({
        id: c.id,
        name: c.name,
        language: c.language,
        studentsCount: c.students?.length || 0,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

/* ========================= STUDENTS ========================= */

const studentLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

eduRouter.post("/student-login", async (req: Request, res: Response) => {
  try {
    const validated = studentLoginSchema.safeParse(req.body);
    if (!validated.success) return res.status(400).json({ message: "INVALID_INPUT" });

    const { username, password } = validated.data;

    const student = await studentRepo().findOne({
      where: { generatedUsername: username },
      relations: ["class"],
    });

    if (!student || !(await bcrypt.compare(password, student.generatedPassword))) {
      return res.status(401).json({ message: "INVALID_CREDENTIALS" });
    }

    const token = jwt.sign(
        { studentId: student.id, type: "STUDENT", classId: student.class.id },
        JWT_SECRET,
        { expiresIn: "30d" }
    );

    res.json({ 
        token,
        student: {
            id: student.id,
            username: student.generatedUsername,
            firstName: student.firstName,
            lastName: student.lastName,
            middleName: student.middleName,
            email: student.email,
            classId: student.class.id,
            className: student.class.name,
            language: student.class.language,
        }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

/* ========================= STUDENTS MANAGEMENT ========================= */

eduRouter.get("/classes/:classId/students", authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    const cls = await classRepo().findOne({
      where: { id: classId, teacher: { id: req.userId } }
    });

    if (!cls) return res.status(404).json({ message: "CLASS_NOT_FOUND" });

    const students = await studentRepo().find({
      where: { class: { id: classId } },
      order: { lastName: "ASC", firstName: "ASC" }
    });

    res.json({ students });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

eduRouter.post("/classes/:classId/students", authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    const cls = await classRepo().findOne({
      where: { id: classId, teacher: { id: req.userId } }
    });

    if (!cls) return res.status(404).json({ message: "CLASS_NOT_FOUND" });

    const schema = z.object({
      students: z.array(z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        middleName: z.string().optional(),
        email: z.string().email(),
      }))
    });

    const validated = schema.safeParse(req.body);
    if (!validated.success) return res.status(400).json({ message: "INVALID_INPUT" });

    const results = [];
    const credentials = [];

    for (const s of validated.data.students) {
      const plainPassword = generatePassword();
      const hashedPassword = await hashPassword(plainPassword);
      const username = generateUsername(s.firstName, s.lastName, s.middleName);

      const student = studentRepo().create({
        firstName: s.firstName,
        lastName: s.lastName,
        middleName: s.middleName,
        email: s.email,
        class: cls,
        generatedUsername: username,
        generatedPassword: hashedPassword,
      });

      await studentRepo().save(student);
      results.push(student);
      credentials.push({
        id: student.id,
        fullName: `${s.lastName} ${s.firstName} ${s.middleName || ""}`.trim(),
        username,
        password: plainPassword
      });
    }

    res.status(201).json({ count: results.length, credentials });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

eduRouter.get("/classes/:classId/students/export", authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    const cls = await classRepo().findOne({
      where: { id: classId, teacher: { id: req.userId } }
    });

    if (!cls) return res.status(404).json({ message: "CLASS_NOT_FOUND" });

    const students = await studentRepo().find({
      where: { class: { id: classId } },
      order: { lastName: "ASC", firstName: "ASC" }
    });

    let csv = "lastName,firstName,middleName,email,username\n";
    for (const s of students) {
      csv += `${s.lastName},${s.firstName},${s.middleName || ""},${s.email},${s.generatedUsername}\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=students_class_${classId}.csv`);
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

eduRouter.post("/classes/:classId/students/import", authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    const cls = await classRepo().findOne({
      where: { id: classId, teacher: { id: req.userId } }
    });

    if (!cls) return res.status(404).json({ message: "CLASS_NOT_FOUND" });

    const { csvData } = req.body;
    if (!csvData) return res.status(400).json({ message: "CSV_DATA_REQUIRED" });

    const lines = csvData.split("\n").filter((l: string) => l.trim());
    const credentials = [];

    // Header structure: lastName,firstName,middleName,email
    // Or just check if first line contains "email"
    const hasHeader = lines[0].toLowerCase().includes("email");
    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p: string) => p.trim());
      if (parts.length < 3) continue;

      const lastName = parts[0];
      const firstName = parts[1];
      const middleName = parts.length >= 4 ? parts[2] : "";
      const email = parts.length >= 4 ? parts[3] : parts[2];

      if (!lastName || !firstName || !email) continue;

      const plainPassword = generatePassword();
      const hashedPassword = await hashPassword(plainPassword);
      const username = generateUsername(firstName, lastName, middleName);

      const student = studentRepo().create({
        firstName,
        lastName,
        middleName,
        email,
        class: cls,
        generatedUsername: username,
        generatedPassword: hashedPassword,
      });

      await studentRepo().save(student);
      credentials.push({
        id: student.id,
        fullName: `${lastName} ${firstName} ${middleName || ""}`.trim(),
        username,
        password: plainPassword
      });
    }

    res.status(201).json({ count: credentials.length, credentials });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

eduRouter.post("/students/:studentId/regenerate-password", authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const student = await studentRepo().findOne({
      where: { id: studentId },
      relations: ["class", "class.teacher"]
    });

    if (!student || student.class.teacher.id !== req.userId) {
      return res.status(404).json({ message: "STUDENT_NOT_FOUND" });
    }

    const plainPassword = generatePassword();
    student.generatedPassword = await hashPassword(plainPassword);
    await studentRepo().save(student);

    res.json({ 
      username: student.generatedUsername, 
      password: plainPassword 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

/* ========================= LESSONS & TASKS ========================= */

eduRouter.post(
    "/classes/:classId/lessons",
    authRequired,
    async (req: AuthRequest, res: Response) => {
      const user = await userRepo().findOne({ where: { id: req.userId } });
      if (!user || user.userMode !== "EDUCATIONAL") {
        return res.status(403).json({ message: "ONLY_TEACHERS_CAN_CREATE_LESSONS" });
      }

      const { type, title } = req.body || {};
      if (!type || !title) {
        return res.status(400).json({ message: "TYPE_AND_TITLE_REQUIRED" });
      }

      const cls = await classRepo().findOne({
        where: { id: Number(req.params.classId), teacher: { id: user.id } },
      });
      if (!cls) return res.status(404).json({ message: "CLASS_NOT_FOUND" });

      const lesson = lessonRepo().create({ class: cls, type, title });
      await lessonRepo().save(lesson);
      res.status(201).json({ lesson });
    }
);

eduRouter.post(
    "/lessons/:lessonId/tasks",
    authRequired,
    async (req: AuthRequest, res: Response) => {
      const user = await userRepo().findOne({ where: { id: req.userId } });
      if (!user || user.userMode !== "EDUCATIONAL") {
        return res.status(403).json({ message: "ONLY_TEACHERS_CAN_CREATE_TASKS" });
      }

      const lesson = await lessonRepo().findOne({
        where: { id: Number(req.params.lessonId) },
        relations: ["class", "class.teacher"],
      });
      if (!lesson || lesson.class.teacher.id !== user.id) {
        return res.status(404).json({ message: "LESSON_NOT_FOUND" });
      }

      const { title, description, template } = req.body || {};
      if (!title || !description || !template) {
        return res.status(400).json({ message: "TITLE_DESCRIPTION_AND_TEMPLATE_REQUIRED" });
      }

      const task = taskRepo().create({
        lesson,
        title,
        description,
        template,
        maxAttempts: 1,
        isClosed: false,
      });
      await taskRepo().save(task);
      res.status(201).json({ task });
    }
);

/* ========================= EXECUTION & GRADING ========================= */

eduRouter.post(
    "/tasks/:taskId/run",
    authRequired,
    async (req: AuthRequest, res: Response) => {
      try {
        const studentId = req.studentId || req.userId;
        if (!studentId) return res.status(401).json({ message: "UNAUTHORIZED" });

        const taskId = parseInt(req.params.taskId, 10);
        if (isNaN(taskId)) return res.status(400).json({ message: "INVALID_TASK_ID" });

        const task = await taskRepo().findOne({
          where: { id: taskId },
          relations: ["lesson", "lesson.class"],
        });
        if (!task) return res.status(404).json({ message: "TASK_NOT_FOUND" });

        const { code, input } = req.body || {};
        if (!code) return res.status(400).json({ message: "CODE_REQUIRED" });
        if (code.length > 50000) return res.status(400).json({ message: "CODE_TOO_LARGE" });

        const result = await executeCodeWithInput(
            code,
            task.lesson.class.language,
            input || "",
            5000
        );

        res.json({ output: result.stdout, stderr: result.stderr, success: result.success });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
      }
    }
);

eduRouter.post(
    "/tasks/:taskId/submit",
    authRequired,
    async (req: AuthRequest, res: Response) => {
      try {
        const studentId = req.studentId || req.userId;
        if (!studentId) return res.status(401).json({ message: "UNAUTHORIZED" });

        const taskId = parseInt(req.params.taskId, 10);
        if (isNaN(taskId)) return res.status(400).json({ message: "INVALID_TASK_ID" });

        const task = await taskRepo().findOne({
          where: { id: taskId },
          relations: ["lesson", "lesson.class", "testData"],
        });
        if (!task) return res.status(404).json({ message: "TASK_NOT_FOUND" });

        if (task.isClosed) return res.status(403).json({ message: "TASK_IS_CLOSED" });
        if (task.deadline && new Date() > new Date(task.deadline)) {
          return res.status(403).json({ message: "DEADLINE_PASSED" });
        }

        const existingGradesCount = await gradeRepo().count({
          where: { task: { id: taskId }, student: { id: studentId } as any }
        });

        if (existingGradesCount >= task.maxAttempts) {
          return res.status(403).json({ message: "MAX_ATTEMPTS_REACHED" });
        }

        const { code } = req.body || {};
        if (!code) return res.status(400).json({ message: "CODE_REQUIRED" });

        const tests = task.testData || [];
        if (tests.length === 0) {
            return res.status(400).json({ message: "NO_TESTS_DEFINED_FOR_THIS_TASK" });
        }

        let passed = 0;
        const testResults = [];

        // Run tests in sequence to avoid overloading the server, but could be parallelized with a limit
        for (const t of tests) {
          const r = await executeCodeWithInput(
              code,
              task.lesson.class.language,
              t.input,
              10000
          );
          const isPassed = compareOutput(r.stdout, t.expectedOutput);
          if (isPassed) passed++;
          
          testResults.push({
              input: t.input,
              expected: t.expectedOutput,
              actual: r.stdout,
              stderr: r.stderr,
              passed: isPassed
          });
        }

        const score = Math.round((passed / tests.length) * 12);
        const totalGrade = Math.max(0, Math.min(12, score));

        const grade = gradeRepo().create({
          student: { id: studentId } as any,
          task,
          total: totalGrade,
          testsPassed: passed,
          testsTotal: tests.length,
          submittedCode: code,
          isManuallyGraded: false,
        });

        await gradeRepo().save(grade);
        res.json({ grade, testResults });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
      }
    }
);

/* ========================= GRADEBOOK & SUMMARY GRADES ========================= */

eduRouter.get("/classes/:classId/gradebook", authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    const cls = await classRepo().findOne({
      where: { id: classId, teacher: { id: req.userId } },
      relations: ["students", "lessons", "lessons.tasks"]
    });

    if (!cls) return res.status(404).json({ message: "CLASS_NOT_FOUND" });

    const students = cls.students || [];
    const lessons = cls.lessons || [];

    const gradebookStudents = [];

    for (const student of students) {
      const studentGrades = await gradeRepo().find({
        where: { student: { id: student.id } as any },
        relations: ["task", "task.lesson"]
      });

      const flatGrades = [];
      for (const lesson of lessons) {
        for (const task of (lesson.tasks || [])) {
          const grades = studentGrades.filter(g => g.task.id === task.id);
          const bestGrade = grades.length > 0 ? Math.max(...grades.map(g => g.total || 0)) : null;
          const latestGrade = grades.length > 0 ? [...grades].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime())[0] : null;
          
          flatGrades.push({
            taskId: task.id,
            taskTitle: task.title,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            grade: bestGrade,
            createdAt: latestGrade ? latestGrade.createdAt.toISOString() : null
          });
        }
      }

      gradebookStudents.push({
        studentId: student.id,
        studentName: `${student.lastName} ${student.firstName} ${student.middleName || ""}`.trim(),
        grades: flatGrades
      });
    }

    res.json({
      students: gradebookStudents,
      lessons: lessons.map(l => ({
        id: l.id,
        title: l.title,
        type: l.type,
        tasks: (l.tasks || []).map(t => ({ id: t.id, title: t.title }))
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

eduRouter.get("/classes/:classId/summary-grades", authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    const cls = await classRepo().findOne({
      where: { id: classId, teacher: { id: req.userId } }
    });

    if (!cls) return res.status(404).json({ message: "CLASS_NOT_FOUND" });

    const allSummaryGrades = await summaryGradeRepo().find({
      where: { class: { id: classId } },
      relations: ["student"],
      order: { createdAt: "ASC" }
    });

    const groups: Record<string, any[]> = {};
    allSummaryGrades.forEach(sg => {
      if (!groups[sg.name]) groups[sg.name] = [];
      groups[sg.name].push({
        id: sg.id,
        studentId: sg.student.id,
        studentName: `${sg.student.lastName} ${sg.student.firstName} ${sg.student.middleName || ""}`.trim(),
        grade: sg.grade,
        createdAt: sg.createdAt.toISOString()
      });
    });

    const summaryGrades = Object.keys(groups).map(name => ({
      name,
      grades: groups[name]
    }));

    res.json({ summaryGrades });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

eduRouter.post("/classes/:classId/summary-grades", authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    const cls = await classRepo().findOne({
      where: { id: classId, teacher: { id: req.userId } },
      relations: ["students"]
    });

    if (!cls) return res.status(404).json({ message: "CLASS_NOT_FOUND" });

    const { name, studentGrades } = req.body;
    if (!name) {
      return res.status(400).json({ message: "NAME_REQUIRED" });
    }

    const results = [];
    
    if (studentGrades && Array.isArray(studentGrades) && studentGrades.length > 0) {
      for (const item of studentGrades) {
        const student = cls.students.find(s => s.id === item.studentId);
        if (!student) continue;

        const sg = summaryGradeRepo().create({
          class: cls,
          student,
          name,
          grade: item.grade
        });
        await summaryGradeRepo().save(sg);
        results.push(sg);
      }
    } else {
      // Автоматичний розрахунок: середнє по всіх найкращих оцінках за кожне завдання
      for (const student of cls.students) {
        const grades = await gradeRepo().find({
          where: { student: { id: student.id } as any },
          relations: ["task", "task.lesson", "task.lesson.class"]
        });
        
        const classGrades = grades.filter(g => g.task.lesson.class.id === classId);
        
        if (classGrades.length > 0) {
          // Групуємо за taskId, щоб взяти тільки найкращу оцінку за кожне завдання
          const bestGrades: Record<number, number> = {};
          classGrades.forEach(g => {
            const taskId = g.task.id;
            if (!bestGrades[taskId] || (g.total || 0) > bestGrades[taskId]) {
              bestGrades[taskId] = g.total || 0;
            }
          });

          const scores = Object.values(bestGrades);
          const sum = scores.reduce((s, val) => s + val, 0);
          const avg = Math.round((sum / scores.length) * 100) / 100;
          
          const sg = summaryGradeRepo().create({
            class: cls,
            student,
            name,
            grade: avg
          });
          await summaryGradeRepo().save(sg);
          results.push(sg);
        }
      }
    }

    res.status(201).json({ count: results.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

eduRouter.put("/classes/:classId/summary-grades/:id", authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const classId = parseInt(req.params.classId, 10);
    const summaryGradeId = parseInt(req.params.id, 10);

    const sg = await summaryGradeRepo().findOne({
      where: { id: summaryGradeId, class: { id: classId } },
      relations: ["class", "class.teacher"]
    });

    if (!sg || sg.class.teacher.id !== req.userId) {
      return res.status(404).json({ message: "SUMMARY_GRADE_NOT_FOUND" });
    }

    const { grade } = req.body;
    if (grade === undefined) return res.status(400).json({ message: "GRADE_REQUIRED" });

    sg.grade = grade;
    await summaryGradeRepo().save(sg);

    res.json({ summaryGrade: sg });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

export default eduRouter;