import { Router, Response, Request } from "express";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";
import { emailService } from "../services/emailService";
import { Not } from "typeorm";

const router = Router();
const userRepo = () => AppDataSource.getRepository(User);

router.post("/check", async (req: Request, res: Response) => {
  try {
    const secret = req.headers["x-cron-secret"] || req.body?.secret;
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ message: "UNAUTHORIZED" });
    }

    const users = await userRepo().find({
      where: {
        currentStreak: Not(0),
        lastActivityDate: Not(null as any),
      } as any,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let notified = 0;

    for (const user of users) {
      if (user.currentStreak < 3) continue;
      if (!user.lastActivityDate) continue;
      if (!user.email || !user.emailVerified) continue;

      const lastActivity = new Date(user.lastActivityDate);
      lastActivity.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === 1) {
        try {
          await emailService.sendStreakBreakNotification(user.email, user.username, user.currentStreak);
          notified++;
        } catch (err) {
          console.error(`Failed to send streak break email to ${user.email}:`, err);
        }
      }
    }

    return res.json({ success: true, notified });
  } catch (err) {
    console.error("POST /streak/check error", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export const streakRouter = router;
export default router;