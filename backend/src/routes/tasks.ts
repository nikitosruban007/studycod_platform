import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import { AppDataSource } from "../data-source";
import { Task, TaskType } from "../entities/Task";
import { Topic } from "../entities/Topic";
import { Grade } from "../entities/Grade";
import { User } from "../entities/User";
import { TestData } from "../entities/TestData";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";
import {
  generateTaskWithAI,
  generateTheoryWithAI,
  generateQuizWithAI,
} from "../services/openRouterService";
import { safeAICall, sendAIError } from "../services/ai/safeAICall";
import { checkMilestone } from "../utils/milestoneDetector";
import { getStableDifus } from "../utils/adaptiveDifficulty";
import {
  executeCodeWithInput,
} from "../services/codeExecutionService";
import { computeTotalFromParts, evaluateCodeWithAI } from "../ai/evaluator";
import { judgeWithSemaphore } from "../services/judgeWorker";
import { JudgeBusyError } from "../services/judgeWorker/Semaphore";
import type { JudgeRequest as WorkerJudgeRequest, JudgeResponse as WorkerJudgeResponse } from "../services/judgeWorker/types";

const tasksRouter = Router();

const taskRepo = () => AppDataSource.getRepository(Task);
const topicRepo = () => AppDataSource.getRepository(Topic);
const gradeRepo = () => AppDataSource.getRepository(Grade);
const userRepo = () => AppDataSource.getRepository(User);
const testDataRepo = () => AppDataSource.getRepository(TestData);

type TaskStatus = "OPEN" | "SUBMITTED" | "GRADED";

function mapTaskToDto(task: Task) {
  const status: TaskStatus = task.completed
      ? "GRADED"
      : task.finalCode
          ? "SUBMITTED"
          : "OPEN";

  return {
    id: task.id,
    title: task.title,
    descriptionMarkdown: task.descriptionMarkdown || task.description,
    starterCode: task.template,
    userCode: status === "GRADED" ? (task.finalCode || "") : (task.draftCode || ""),
    finalCode: task.finalCode || null,
    status,
    lessonInTopic: task.numInTopic ?? 1,
    repeatAttempt: 0,
    kind: task.type,
    createdAt: task.createdAt,
    language: task.lang,
  };
}

tasksRouter.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "UNAUTHORIZED" });
    }

    const tasks = await taskRepo().find({
      where: {
        user: { id: req.userId },
        ...(req.lang && { lang: req.lang as "JAVA" | "PYTHON" }),
      },
      order: { createdAt: "DESC" },
      relations: ["user", "topic"],
    });

    return res.json(tasks.map(mapTaskToDto));
  } catch (error) {
    console.error("GET /tasks error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

tasksRouter.get(
    "/:id",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
      try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ message: "Invalid id" });

        if (!req.userId) {
          return res.status(401).json({ message: "UNAUTHORIZED" });
        }

        const task = await taskRepo().findOne({
          where: { id, user: { id: req.userId } },
          relations: ["user", "topic", "testData"],
        });

        if (!task) return res.status(404).json({ message: "Task not found" });

        return res.json(mapTaskToDto(task));
      } catch {
        return res.status(500).json({ message: "Internal server error" });
      }
    }
);

tasksRouter.post(
    "/generate",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const lang = (req.lang as "JAVA" | "PYTHON") || "JAVA";

        const user = await userRepo().findOne({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "USER_NOT_FOUND" });

        const tasks = await taskRepo().find({
          where: { user: { id: userId }, lang },
          relations: ["user", "topic"],
        });

        for (const t of tasks) {
          const g = await gradeRepo().findOne({
            where: { user: { id: userId }, task: { id: t.id } },
          });
          if (!g) {
            return res.status(400).json({
              status: "blocked",
              message: "COMPLETE_PREVIOUS_TASK",
              taskId: t.id,
            });
          }
        }

        const topics = await topicRepo().find({
          where: { lang },
          order: { topicIndex: "ASC" },
        });
        if (!topics.length)
          return res.status(404).json({ status: "error", message: "NO_TOPICS" });

        const REQUIRED_TASKS_FOR_INTRO_TOPIC = 1;
        const REQUIRED_TASKS_FOR_REGULAR_TOPIC = 3;

        let topic: Topic | null = null;

        for (const t of topics) {
          const count = await taskRepo().count({
            where: { user: { id: userId }, topic: { id: t.id } },
          });
          const required = t.topicIndex === 0 ? REQUIRED_TASKS_FOR_INTRO_TOPIC : REQUIRED_TASKS_FOR_REGULAR_TOPIC;
          if (count < required) {
            topic = t;
            break;
          }
        }

        if (!topic)
          return res.status(400).json({ status: "blocked", message: "ALL_TOPICS_COMPLETED" });

        const difus = await getStableDifus(
            userId,
            lang,
            topic.topicIndex,
            userRepo,
            gradeRepo
        );

        const numInTopic =
            (await taskRepo().count({
              where: { user: { id: userId }, topic: { id: topic.id } },
            })) + 1;

        let description = topic.theoryMarkdown;
        let template =
            lang === "PYTHON"
                ? "# write code here\n"
                : [
                  "public class Main {",
                  "  public static void main(String[] args) {",
                  "  }",
                  "}",
                ].join("\n");

        // Безпечний виклик AI з валідацією
        const aiTaskResult = await safeAICall('generateTask', {
          topicTitle: topic.title,
          theory: topic.theoryMarkdown,
          lang,
          numInTopic,
          isFirstTask: numInTopic === 1,
          difus,
          userId,
          topicId: topic.id,
        });

        if (!aiTaskResult.success) {
          return sendAIError(res, aiTaskResult.error);
        }

        const aiTask = aiTaskResult.data;
        // Додаємо маркер для розділення теорії та практики
        description = aiTask.theoryMarkdown + "\n\n### Практика\n\n" + aiTask.practicalTask;
        template = aiTask.codeTemplate;

        const task = taskRepo().create({
          user: { id: userId },
          topic,
          title: topic.title,
          subtitle: "",
          description,
          descriptionMarkdown: description,
          template,
          draftCode: "",
          finalCode: "",
          completed: 0,
          lang,
          difus,
          numInTopic,
          topicIndex: topic.topicIndex,
          type: "TOPIC" as TaskType,
        });

        const saved = await taskRepo().save(task);

        const REQUIRED_TEST_COUNT = 12;
        const userLanguage: "uk" | "en" = (req.headers['accept-language']?.includes('en') || req.body?.language === 'en') ? "en" : "uk";
        const testDataResult = await safeAICall('generateTestData', {
          taskDescription: description,
          taskTitle: topic.title,
          lang,
          count: REQUIRED_TEST_COUNT,
          userId,
        }, { expectedCount: REQUIRED_TEST_COUNT, language: userLanguage });

        if (!testDataResult.success) {
          // Якщо генерація тестів не вдалася, видаляємо створене завдання
          await taskRepo().remove(saved);
          return sendAIError(res, testDataResult.error);
        }

        const testExamples = testDataResult.data;

        const POINTS_PER_TEST = 1;
        const newTestData = testExamples.map((ex: { input?: string; output?: string }) => {
          return testDataRepo().create({
            input: ex.input || "",
            expectedOutput: ex.output || "",
            points: POINTS_PER_TEST,
            personalTask: { id: saved.id },
          });
        });

        await testDataRepo().save(newTestData);

        return res.json({ status: "ok", task: mapTaskToDto(saved) });
      } catch (error: any) {
        console.error("[tasks] POST /generate error:", error);
        // Якщо це вже оброблена AI помилка, вона вже відправлена
        if (error.statusCode) {
          return res.status(error.statusCode).json({ message: error.message, error: error.error });
        }
        return res.status(500).json({ message: "Internal server error" });
      }
    }
);

tasksRouter.post(
    "/reset-topic",
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
      try {
        const userId = req.userId!;
        const { topicId } = req.body;

        if (!topicId || typeof topicId !== "number") {
          return res.status(400).json({ message: "topicId is required and must be a number" });
        }

        // Знаходимо всі задачі користувача для цієї теми
        const tasks = await taskRepo().find({
          where: { user: { id: userId }, topic: { id: topicId } },
        });

        // Видаляємо всі оцінки для цих задач
        for (const task of tasks) {
          await gradeRepo().delete({
            user: { id: userId },
            task: { id: task.id },
          });
        }

        // Видаляємо всі задачі (testData видаляться автоматично через CASCADE)
        await taskRepo().delete({
          user: { id: userId },
          topic: { id: topicId },
        });

        return res.json({ message: "Topic reset successfully" });
      } catch (error: any) {
        console.error("[tasks] POST /reset-topic error:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
);

tasksRouter.post(
    "/:id/save-draft",
    authMiddleware,
    [body("code").isString()],
    async (req: AuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const id = Number(req.params.id);
      const { code } = req.body as { code: string };

        if (!req.userId) {
          return res.status(401).json({ message: "UNAUTHORIZED" });
        }

      const task = await taskRepo().findOne({
          where: { id, user: { id: req.userId } },
      });
        
        if (!task) {
          return res.status(404).json({ message: "Task not found" });
        }

      task.draftCode = code;
      await taskRepo().save(task);
      return res.json({ success: true });
    }
);

tasksRouter.post(
    "/:id/submit",
    authMiddleware,
    [
      body("code").isString(),
      body("mode").optional().isIn(["TESTS", "AI"]),
    ],
    async (req: AuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const id = Number(req.params.id);
      const { code, mode } = req.body as { code: string; mode?: "TESTS" | "AI" };
      const submitMode: "TESTS" | "AI" = mode ?? "TESTS";

      if (!req.userId) {
        return res.status(401).json({ message: "UNAUTHORIZED" });
      }

      const task = await taskRepo().findOne({
        where: { id, user: { id: req.userId } },
        relations: ["testData"],
      });
      if (!task) return res.status(404).json({ message: "Task not found" });

      // Personal tasks always have tests generated on create; we keep them required for TESTS mode.
      if (submitMode === "TESTS" && (!task.testData || task.testData.length === 0)) {
        return res.status(400).json({
          message: "Test data is required for personal tasks. Please regenerate the task.",
        });
      }

      const MIN_GRADE = 1;
      const MAX_GRADE = 12;
      const TASK_COMPLETED_FLAG = 1;

      if (submitMode === "AI") {
        // Load previous grade attempt (for comparison, if any)
        const previous = await gradeRepo().findOne({
          where: {
            user: { id: req.userId },
            task: { id: task.id },
          },
          order: { createdAt: "DESC" },
          relations: ["task"],
        });

        const ai = await evaluateCodeWithAI({
          code,
          language: task.lang,
          task,
          previousCode: previous?.codeSnapshot ?? undefined,
          previousGrade: previous?.total ?? undefined,
          previousScores: previous
            ? {
                work: Number(previous.workScore ?? 0),
                optimization: Number(previous.optimizationScore ?? 0),
                integrity: Number(previous.integrityScore ?? 0),
              }
            : undefined,
        });

        const total = computeTotalFromParts({
          work: ai.work,
          optimization: ai.optimization,
          integrity: ai.integrity,
        });

        const comparisonFeedback =
          ai.comparison?.changes?.length
            ? ai.comparison.changes
                .map((c) => {
                  const category =
                    c.category === "work"
                      ? "Працездатність"
                      : c.category === "optimization"
                      ? "Оптимізація"
                      : "Доброчесність";
                  const sign = c.delta >= 0 ? "+" : "";
                  const line = c.codeLine ? ` (рядок ${c.codeLine})` : "";
                  return `${category}: ${sign}${c.delta}${line} — ${c.reason}`;
                })
                .join("\n")
            : null;

        task.finalCode = code;
        task.completed = TASK_COMPLETED_FLAG;
        await taskRepo().save(task);

        const grade = gradeRepo().create({
          user: { id: req.userId },
          task: { id: task.id },
          total: Math.min(MAX_GRADE, Math.max(MIN_GRADE, total)),
          workScore: ai.work,
          optimizationScore: ai.optimization,
          integrityScore: ai.integrity,
          aiFeedback: ai.feedback,
          codeSnapshot: code,
          previousGradeId: previous?.id ?? null,
          comparisonFeedback: comparisonFeedback ?? null,
        });

        const savedGradeResult = await gradeRepo().save(grade);
        const savedGrade = Array.isArray(savedGradeResult) ? savedGradeResult[0] : savedGradeResult;

        return res.json({
          grade: {
            id: savedGrade.id,
            gradingMode: "AI" as const,
            total: savedGrade.total,
            workScore: savedGrade.workScore ?? 0,
            optimizationScore: savedGrade.optimizationScore ?? 0,
            integrityScore: savedGrade.integrityScore ?? 0,
            aiFeedback: savedGrade.aiFeedback,
            comparisonFeedback: savedGrade.comparisonFeedback ?? null,
            previousGrade: previous?.total ?? null,
            createdAt: savedGrade.createdAt,
          },
        });
      }

      // TESTS mode (classic judge-by-tests)
      let total = 0;
      let passedTests = 0;

      const testResults: Array<{
        testId: number;
        input: string;
        actualOutput: string;
        passed: boolean;
        error?: string | null;
      }> = [];

      const sorted = [...(task.testData || [])].sort((a, b) => a.id - b.id);
      const tests = sorted.map((t) => ({
        id: t.id,
        input: t.input || "",
        output: t.expectedOutput || "",
        // Personal mode: keep tests visible (not hidden), unless you later add hidden tests explicitly.
        hidden: false,
      }));

      const judgeLang = task.lang === "JAVA" ? "java" : task.lang === "PYTHON" ? "python" : "cpp";
      const defaultLimitsByLang = {
        java: { time_limit_ms: 1200, memory_limit_mb: 256, output_limit_kb: 64 },
        python: { time_limit_ms: 900, memory_limit_mb: 128, output_limit_kb: 64 },
        cpp: { time_limit_ms: 800, memory_limit_mb: 256, output_limit_kb: 64 },
      } as const;

      const workerReq: WorkerJudgeRequest = {
        submission_id: `personal_${req.userId}_${task.id}_${Date.now()}`,
        language: judgeLang,
        source: code,
        tests,
        limits: defaultLimitsByLang[judgeLang],
        checker: { type: "whitespace" },
        debug: false,
      };

      let workerRes: WorkerJudgeResponse | null = null;

      try {
        workerRes = await judgeWithSemaphore(workerReq);
      } catch (e) {
        if (e instanceof JudgeBusyError) {
          return res.status(429).json({ message: "JUDGE_BUSY" });
        }
        // Fallback to the legacy local executor if judge worker is unavailable (dev on Windows, etc.).
        const { compareOutput, filterStderr } = await import("../services/codeExecutionService");
        const CODE_EXECUTION_TIMEOUT_MS = 8000;

        for (const test of sorted) {
          try {
            const inputValue = test.input || "";
            const result = await executeCodeWithInput(code, task.lang, inputValue, CODE_EXECUTION_TIMEOUT_MS);

            const actual = (result.stdout ?? "").trim();
            const expected = (test.expectedOutput ?? "").trim();
            const passed = !!(result.success && compareOutput(actual, expected));
            if (passed) {
              passedTests++;
              total += test.points;
            }

            const err = filterStderr(result.stderr || "");
            testResults.push({
              testId: test.id,
              input: inputValue,
              actualOutput: actual,
              passed,
              error: err ? err : null,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            testResults.push({
              testId: test.id,
              input: test.input || "",
              actualOutput: "",
              passed: false,
              error: errorMessage,
            });
          }
        }
      }

      if (workerRes) {
        const resultsById = new Map<string, (typeof workerRes.tests)[number]>();
        for (const r of workerRes.tests) {
          resultsById.set(String(r.test_id), r);
        }

        for (const t of sorted) {
          const r = resultsById.get(String(t.id));
          const passed = r?.verdict === "AC";
          if (passed) {
            passedTests++;
            total += t.points;
          }
          testResults.push({
            testId: t.id,
            input: t.input || "",
            actualOutput: r?.actual ?? "",
            passed,
            error: r?.stderr ?? null,
          });
        }
      }

      const feedbackLines: string[] = [];
      feedbackLines.push(`Пройдено тестів: ${passedTests}/${(task.testData || []).length}`);
      feedbackLines.push("");
      for (const r of testResults) {
        if (r.passed) {
          feedbackLines.push(`✓ Тест ${r.testId}: пройдено`);
        } else if (r.error) {
          feedbackLines.push(`✗ Тест ${r.testId}: помилка — ${r.error}`);
        } else {
          feedbackLines.push(`✗ Тест ${r.testId}: не пройдено`);
        }
      }

      const feedback = feedbackLines.join("\n");

      task.finalCode = code;
      task.completed = TASK_COMPLETED_FLAG;
      await taskRepo().save(task);

      const grade = gradeRepo().create({
        user: { id: req.userId },
        task: { id: task.id },
        total: Math.min(MAX_GRADE, Math.max(MIN_GRADE, total)),
        // Not used in TESTS mode, but keep null-ish values.
        workScore: 0,
        optimizationScore: 0,
        integrityScore: 0,
        aiFeedback: feedback,
        codeSnapshot: code,
        comparisonFeedback: null,
        previousGradeId: null,
      });

      const savedGradeResult = await gradeRepo().save(grade);
      const savedGrade = Array.isArray(savedGradeResult) ? savedGradeResult[0] : savedGradeResult;

      return res.json({
        grade: {
          id: savedGrade.id,
          gradingMode: "TESTS" as const,
          total: savedGrade.total,
          aiFeedback: savedGrade.aiFeedback,
          testsPassed: passedTests,
          testsTotal: (task.testData || []).length,
          testResults,
          createdAt: savedGrade.createdAt,
        },
      });
    }
);

tasksRouter.post(
    "/:id/run",
    authMiddleware,
    [body("code").isString()],
    async (req: AuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const id = Number(req.params.id);
      const { code, input } = req.body as { code: string; input?: string };

      if (!req.userId) {
        return res.status(401).json({ message: "UNAUTHORIZED" });
      }

      const task = await taskRepo().findOne({
        where: { id, user: { id: req.userId } },
      });

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      const CODE_RUN_TIMEOUT_MS = 5000;
      try {
        const result = await executeCodeWithInput(
            code,
            task.lang,
            input || "",
            CODE_RUN_TIMEOUT_MS
        );
        return res.json({ 
          output: result.stdout, 
          stderr: result.stderr, 
          success: result.success 
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Execution error";
        return res.status(500).json({ message: errorMessage });
      }
    }
);

export { tasksRouter };
export default tasksRouter;
