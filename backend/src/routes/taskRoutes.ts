import { Router, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Task } from '../entities/Task';
import { Grade } from '../entities/Grade';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

const taskRepo = () => AppDataSource.getRepository(Task);
const gradeRepo = () => AppDataSource.getRepository(Grade);

/**
 * POST /api/tasks/save-draft
 * body: { taskId, code }
 */
router.post(
    '/save-draft',
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
      try {
        const { taskId, code } = req.body as {
          taskId?: number;
          code?: string;
        };

        if (!taskId || typeof code !== 'string') {
          return res
              .status(400)
              .json({ message: 'taskId and code are required' });
        }

        const repo = taskRepo();
        const task = (await repo.findOne({
          where: { id: taskId, user: { id: req.userId } } as any,
        })) as any;

        if (!task) {
          return res.status(404).json({ message: 'Task not found' });
        }

        task.draftCode = code;
        await repo.save(task);

        return res.json({ success: true });
      } catch (err) {
        console.error('POST /api/tasks/save-draft error', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
    }
);

/**
 * POST /api/tasks/submit
 * body: { taskId, code, scores: { work, opt, honesty }, comment }
 */
router.post(
    '/submit',
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
      try {
        const { taskId, code, scores, comment } = req.body as {
          taskId?: number;
          code?: string;
          scores?: { work: number; opt: number; honesty: number };
          comment?: string;
        };

        if (!taskId || typeof code !== 'string' || !scores) {
          return res
            .status(400)
            .json({ message: 'Invalid body: taskId, code and scores are required' });
        }

        const repo = taskRepo();
        const task = await repo.findOne({
          where: { id: taskId, user: { id: req.userId } } as any,
          relations: ['user', 'topic'],
        });

        if (!task) {
          return res.status(404).json({ message: 'Task not found' });
        }

        task.finalCode = code;
        task.completed = 1;
        await repo.save(task);

        // Жорстке правило: якщо work==0 або honesty==0 -> 1 бал
        const total =
          scores.work === 0 || scores.honesty === 0
            ? 1
            : Math.max(
                1,
                Math.min(12, scores.work + scores.opt + scores.honesty)
              );

        const grade = gradeRepo().create({
          user: { id: req.userId } as any,
          task: { id: task.id } as any,
          taskName: task.title ?? `Task #${task.id}`,
          total,
          workScore: scores.work,
          optimizationScore: scores.opt,
          integrityScore: scores.honesty,
          aiFeedback: comment ?? null,
        }) as any;

        await gradeRepo().save(grade);

        return res.json({
          success: true,
          grade: {
            id: grade.id,
            taskName: grade.taskName,
            grade: grade.total,
            lang: task.lang,
            comment: grade.aiFeedback,
            createdAt: grade.createdAt,
          },
        });
      } catch (err) {
        console.error('POST /api/tasks/submit error', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
    }
);

/**
 * GET /api/tasks/history
/**
 * GET /api/tasks/history
 */
router.get(
    '/history',
    authMiddleware,
    async (req: AuthRequest, res: Response) => {
      try {
        const tasks = (await taskRepo().find({
          where: { user: { id: req.userId } } as any,
          order: { createdAt: 'DESC' } as any,
        })) as any[];

        return res.json(
            tasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              lang: t.lang,
              type: t.type,
              topicId: t.topicId,
              createdAt: t.createdAt,
              completed: !!t.completed,
            }))
        );
      } catch (err) {
        console.error('GET /api/tasks/history error', err);
        return res.status(500).json({ message: 'Internal server error' });
      }
    }
);

export default router;
