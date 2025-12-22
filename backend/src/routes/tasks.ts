import { Router, Response } from "express";
import { body, validationResult } from "express-validator";
import { AppDataSource } from "../data-source";
import { Task, TaskType } from "../entities/Task";
import { Topic } from "../entities/Topic";
import { Grade } from "../entities/Grade";
import { User } from "../entities/User";
import { authMiddleware, AuthRequest } from "../middleware/authMiddleware";
import { evaluateCodeWithAI, computeTotalFromParts } from "../ai/evaluator";
import {
  generateTaskWithAI,
  generateTheoryWithAI,
  generateQuizWithAI,
} from "../services/openRouterService";
import { checkMilestone } from "../utils/milestoneDetector";
import { getStableDifus } from "../utils/adaptiveDifficulty";
import {
  executeCodeWithInput,
} from "../services/codeExecutionService";

const tasksRouter = Router();

const taskRepo = () => AppDataSource.getRepository(Task);
const topicRepo = () => AppDataSource.getRepository(Topic);
const gradeRepo = () => AppDataSource.getRepository(Grade);
const userRepo = () => AppDataSource.getRepository(User);

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
    userCode: status === "GRADED" ? "" : task.draftCode || "",
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
    const where: any = { user: { id: req.userId } };
    if (req.lang) where.lang = req.lang;

    const tasks = await taskRepo().find({
      where,
      order: { createdAt: "DESC" } as any,
    });

    return res.json(tasks.map(mapTaskToDto));
  } catch {
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

        const task = await taskRepo().findOne({
          where: { id, user: { id: req.userId } } as any,
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
          where: { user: { id: userId }, lang } as any,
        });

        for (const t of tasks) {
          const g = await gradeRepo().findOne({
            where: { user: { id: userId }, task: { id: t.id } } as any,
          });
          if (!g) {
            return res.status(400).json({
              message: "COMPLETE_PREVIOUS_TASK",
              taskId: t.id,
            });
          }
        }

        const topics = await topicRepo().find({
          where: { lang } as any,
          order: { topicIndex: "ASC" } as any,
        });
        if (!topics.length)
          return res.status(404).json({ message: "NO_TOPICS" });

        let topic: Topic | null = null;

        for (const t of topics) {
          const count = await taskRepo().count({
            where: { user: { id: userId }, topic: { id: t.id } } as any,
          });
          const required = t.topicIndex === 0 ? 1 : 3;
          if (count < required) {
            topic = t;
            break;
          }
        }

        if (!topic)
          return res.status(400).json({ message: "ALL_TOPICS_COMPLETED" });

        const difus = await getStableDifus(
            userId,
            lang,
            topic.topicIndex,
            userRepo,
            gradeRepo
        );

        const numInTopic =
            (await taskRepo().count({
              where: { user: { id: userId }, topic: { id: topic.id } } as any,
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

        const aiTask = await generateTaskWithAI({
          topicTitle: topic.title,
          theory: topic.theoryMarkdown,
          lang,
          numInTopic,
          isFirstTask: numInTopic === 1,
          difus,
          userId,
          topicId: topic.id,
        });

        description = aiTask.theoryMarkdown + "\n\n" + aiTask.practicalTask;
        template = aiTask.codeTemplate;

        const task = taskRepo().create({
          user: { id: userId } as any,
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
        } as any);

        const saved = await taskRepo().save(task);
        return res.json({ task: mapTaskToDto(saved as any) });
      } catch {
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

      const task = await taskRepo().findOne({
        where: { id, user: { id: req.userId } } as any,
      });
      if (!task) return res.status(404).json({ message: "Task not found" });

      task.draftCode = code;
      await taskRepo().save(task);
      return res.json({ success: true });
    }
);

tasksRouter.post(
    "/:id/submit",
    authMiddleware,
    [body("code").isString()],
    async (req: AuthRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });

      const id = Number(req.params.id);
      const { code } = req.body as { code: string };

      const task = await taskRepo().findOne({
        where: { id, user: { id: req.userId } } as any,
      });
      if (!task) return res.status(404).json({ message: "Task not found" });

      const ai = await evaluateCodeWithAI({
        code,
        language: task.lang,
        task,
      });

      const total = computeTotalFromParts({
        work: ai.work ?? 0,
        optimization: ai.optimization ?? 0,
        integrity: ai.integrity ?? 0,
      });

      task.finalCode = code;
      task.completed = 1;
      await taskRepo().save(task);

      const grade = gradeRepo().create({
        user: { id: req.userId } as any,
        task: { id: task.id } as any,
        total,
        workScore: ai.work ?? 0,
        optimizationScore: ai.optimization ?? 0,
        integrityScore: ai.integrity ?? 0,
        aiFeedback: ai.feedback,
        codeSnapshot: code,
      } as any);

      const savedGrade = await gradeRepo().save(grade);

      return res.json({
        grade: {
          id: savedGrade.id,
          total: savedGrade.total,
          aiFeedback: savedGrade.aiFeedback,
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

      const task = await taskRepo().findOne({
        where: { id, user: { id: req.userId } } as any,
      });
      if (!task) return res.status(404).json({ message: "Task not found" });

      try {
        const result = await executeCodeWithInput(
            code,
            task.lang as any,
            input || "",
            5000
        );
        return res.json({ 
          output: result.stdout, 
          stderr: result.stderr, 
          success: result.success 
        });
      } catch (err: any) {
        return res.status(500).json({ message: err.message || "Execution error" });
      }
    }
);

export { tasksRouter };
export default tasksRouter;
