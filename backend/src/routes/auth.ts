// backend/src/routes/auth.ts
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import passport from "passport";
import { z } from "zod";
import { AppDataSource } from "../data-source";
import { User, UserLang } from "../entities/User";
import { authRequired, AuthRequest } from "../middleware/authMiddleware";
import { emailService } from "../services/emailService";
import { JWT_SECRET, FRONTEND_URL } from "../config";

export const authRouter = Router();

const userRepo = () => AppDataSource.getRepository(User);

/* =====================
   HELPERS
   ===================== */
function normalizeLang(input?: string | null): UserLang {
  const raw = (input || "").toUpperCase().trim();
  if (raw.startsWith("PY")) return "PYTHON";
  return "JAVA";
}

function buildUserDto(user: User) {
  const difusValue = user.lang === "JAVA" ? user.difusJava : user.difusPython;
  return {
    id: user.id,
    username: user.username,
    course: user.lang,
    lang: user.lang,
    difus: difusValue ?? 0,
    avatarUrl: user.avatarUrl ?? null,
    userMode: user.userMode,
    role: user.role || null,
    googleId: user.googleId ?? null,
  };
}

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  course: z.string().optional(),
  lang: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDay: z.number().int().min(1).max(31),
  birthMonth: z.number().int().min(1).max(12),
});

const googleCompleteSchema = z.object({
  token: z.string().min(1),
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  course: z.string().optional(),
  lang: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDay: z.number().int().min(1).max(31),
  birthMonth: z.number().int().min(1).max(12),
});

/* =====================
   REGISTER
   ===================== */
authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const validated = registerSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ message: "INVALID_INPUT", errors: validated.error.errors });
    }

    const {
      username,
      email,
      password,
      course,
      lang,
      firstName,
      lastName,
      birthDay,
      birthMonth,
    } = validated.data;

    const existingUser = await userRepo().findOne({
      where: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.username === username ? "USERNAME_ALREADY_EXISTS" : "EMAIL_ALREADY_EXISTS" 
      });
    }

    const normalizedLang = normalizeLang(course || lang || "JAVA");
    const hash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = userRepo().create({
      username,
      email,
      password: hash,
      lang: normalizedLang,
      difusJava: 0,
      difusPython: 0,
      emailVerified: false,
      emailVerificationToken: verificationToken,
      firstName,
      lastName,
      birthDay,
      birthMonth,
      role: "USER", // За замовчуванням USER для нових користувачів
      userMode: "PERSONAL", // Явно встановлюємо, хоча це і так default
    });

    await userRepo().save(user);

    emailService.sendVerificationEmail(email, verificationToken, username).catch((err) => {
      console.error("[Email Error]:", err);
    });

    return res.status(201).json({
      message: "REGISTRATION_SUCCESSFUL_EMAIL_SENT",
      requiresEmailVerification: true,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

/* =====================
   LOGIN
   ===================== */
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      return res.status(400).json({ message: "USERNAME_AND_PASSWORD_REQUIRED" });
    }

    const user = await userRepo().findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: "INVALID_CREDENTIALS" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: "EMAIL_NOT_VERIFIED",
        requiresEmailVerification: true,
      });
    }

    const token = jwt.sign(
        { userId: user.id, lang: user.lang, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
    );

    return res.json({ token, user: buildUserDto(user) });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "INTERNAL_ERROR" });
  }
});

/* =====================
   GOOGLE ROUTES
   ===================== */
authRouter.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

authRouter.get(
    "/google/callback",
    passport.authenticate("google", {
      failureRedirect: `${FRONTEND_URL}/auth/google/error`,
    }),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as User & { isNewUser?: boolean };

        if (user.isNewUser) {
          const tempToken = jwt.sign({ ...user, temp: true }, JWT_SECRET, { expiresIn: "10m" });
          return res.redirect(
              `${FRONTEND_URL}/auth/google/complete?token=${tempToken}`
          );
        }

        const token = jwt.sign(
            { userId: user.id, lang: user.lang, role: user.role },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return res.redirect(
            `${FRONTEND_URL}/auth/google/success?token=${token}`
        );
      } catch (err) {
        console.error("Google callback error:", err);
        return res.redirect(
            `${FRONTEND_URL}/auth/google/error`
        );
      }
    }
);

authRouter.post("/google/complete", async (req: Request, res: Response) => {
  try {
    const validated = googleCompleteSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ message: "INVALID_INPUT", errors: validated.error.errors });
    }

    const {
      token,
      username,
      password,
      course,
      lang,
      firstName,
      lastName,
      birthDay,
      birthMonth,
    } = validated.data;

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "INVALID_TOKEN" });
    }

    if (!payload || payload.temp !== true) {
      return res.status(400).json({ message: "INVALID_TOKEN" });
    }

    const googleId: string | null = payload.googleId || null;
    const email: string | null = payload.email || null;
    const avatarUrl: string | null = payload.avatarUrl || null;

    if (!googleId) {
      return res.status(400).json({ message: "GOOGLE_ID_REQUIRED" });
    }
    if (!email) {
      return res.status(400).json({ message: "EMAIL_REQUIRED" });
    }

    // If user already exists for this googleId/email — treat as login
    const existingByGoogle = await userRepo().findOne({ where: { googleId } });
    if (existingByGoogle) {
      const jwtToken = jwt.sign(
        { userId: existingByGoogle.id, lang: existingByGoogle.lang, role: existingByGoogle.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      return res.json({ token: jwtToken, user: buildUserDto(existingByGoogle) });
    }

    const existingByEmail = await userRepo().findOne({ where: { email } });
    if (existingByEmail) {
      // Account already exists (should have been linked during Google login)
      // Return a safe error so user doesn't accidentally create duplicates.
      return res.status(400).json({ message: "EMAIL_ALREADY_EXISTS" });
    }

    const existingByUsername = await userRepo().findOne({ where: { username } });
    if (existingByUsername) {
      return res.status(400).json({ message: "USERNAME_ALREADY_EXISTS" });
    }

    const normalizedLang = normalizeLang(course || lang || "JAVA");
    const hash = await bcrypt.hash(password, 10);

    const user = userRepo().create({
      username,
      email,
      password: hash,
      lang: normalizedLang,
      difusJava: 0,
      difusPython: 0,
      emailVerified: true, // Google email is already verified
      emailVerificationToken: null,
      googleId,
      avatarUrl,
      firstName,
      lastName,
      birthDay,
      birthMonth,
      role: "USER",
      userMode: "PERSONAL",
    });

    await userRepo().save(user);

    const jwtToken = jwt.sign(
      { userId: user.id, lang: user.lang, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({ token: jwtToken, user: buildUserDto(user) });
  } catch (err) {
    console.error("Google complete error:", err);
    return res.status(500).json({ message: "INTERNAL_SERVER_ERROR" });
  }
});

/* =====================
   VERIFY EMAIL
   ===================== */
authRouter.get("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "TOKEN_REQUIRED" });
    }

    const user = await userRepo().findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ message: "INVALID_TOKEN" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "EMAIL_ALREADY_VERIFIED" });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    await userRepo().save(user);

    const jwtToken = jwt.sign(
        { userId: user.id, lang: user.lang, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
    );

    return res.json({ token: jwtToken, user: buildUserDto(user) });
  } catch (err) {
    console.error("Verify email error:", err);
    return res.status(500).json({ message: "INTERNAL_ERROR" });
  }
});

/* =====================
   RESEND VERIFICATION EMAIL
   ===================== */
authRouter.post("/resend-verification", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "EMAIL_REQUIRED" });
    }

    const user = await userRepo().findOne({ where: { email } });

    if (!user) {
      // Не розкриваємо, чи існує користувач з таким email
      return res.json({ message: "EMAIL_SENT" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "EMAIL_ALREADY_VERIFIED" });
    }

    // Генеруємо новий токен
    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.emailVerificationToken = verificationToken;
    await userRepo().save(user);

    // Відправляємо email
    emailService.sendVerificationEmail(user.email!, verificationToken, user.username).catch((err) => {
      console.error("[Email Error]:", err);
    });

    return res.json({ message: "EMAIL_SENT" });
  } catch (err) {
    console.error("Resend verification error:", err);
    return res.status(500).json({ message: "INTERNAL_ERROR" });
  }
});

