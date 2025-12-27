import dotenv from "dotenv";
import path from "path";

/* =====================
   ENV
   ===================== */
const envPath = path.resolve(process.cwd(), ".env");
const envConfig = dotenv.config({
    path: envPath,
    encoding: "utf8",
    override: true,
});

if (envConfig.error && process.env.NODE_ENV !== "production") {
    console.warn("Failed to load .env file:", envConfig.error.message);
    console.warn("Looking for .env at:", envPath);
}

if (envConfig.parsed) {
    for (const [key, value] of Object.entries(envConfig.parsed)) {
        if (value !== undefined) {
            process.env[key] = value;
        }
    }
}

import "reflect-metadata";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import session from "express-session";
import passport from "passport";

import { AppDataSource } from "./data-source";
import { setupGoogleStrategy } from "./middleware/googleAuth";

import { authRouter } from "./routes/auth";
import { profileRouter } from "./routes/profile";
import { tasksRouter } from "./routes/tasks";
import { gradeRouter } from "./routes/gradeRoutes";
import { streakRouter } from "./routes/streak";
import eduRouter from "./routes/edu";
import topicsRouter from "./routes/topics";
import adminRouter from "./routes/admin";
import { 
    PORT, 
    CORS_ORIGIN, 
    SESSION_SECRET, 
    IS_PRODUCTION 
} from "./config";

/* =====================
   APP
   ===================== */
const app = express();

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

// ВАЖЛИВО: Express.json() за замовчуванням використовує UTF-8 для JSON відповідей
// Але для гарантії коректного відображення кирилиці встановлюємо charset явно у всіх відповідях
app.use((_req, res, next) => {
  // Встановлюємо charset=utf-8 для всіх JSON відповідей
  res.charset = 'utf-8';
  next();
});

app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: false, limit: "512kb" }));

app.use(
    session({
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        name: "__sid",
        cookie: {
            secure: IS_PRODUCTION,
            httpOnly: true,
            sameSite: "lax",
            maxAge: 24 * 60 * 60 * 1000,
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());
setupGoogleStrategy();

if (!IS_PRODUCTION) {
    app.use(morgan("dev"));
}

/* =====================
   ROUTES
   ===================== */
app.get("/", (_req, res) => {
    res.json({
        message: "StudyCod API",
        version: "1.0.0",
        status: "ok",
    });
});

app.use("/auth", authRouter);
app.use("/profile", profileRouter);
app.use("/tasks", tasksRouter);
app.use("/grades", gradeRouter);
app.use("/edu", eduRouter);
app.use("/topics", topicsRouter);
app.use("/streak", streakRouter);
app.use("/admin", adminRouter);

/* =====================
   ERROR HANDLING
   ===================== */
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[Unhandled Error]:", err);
    
    const status = err.status || 500;
    const message = process.env.NODE_ENV === "production" 
        ? "INTERNAL_SERVER_ERROR" 
        : err.message || "INTERNAL_SERVER_ERROR";
        
    res.status(status).json({ 
        message,
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
    });
});

/* =====================
   BOOTSTRAP
   ===================== */
AppDataSource.initialize()
    .then(async () => {
        if (process.env.NODE_ENV !== "production") {
            console.log("Data Source initialized");
        }

        const { seedTopicsIfNeeded } = await import("./utils/seedTopics");
        await seedTopicsIfNeeded();

        app.listen(PORT, () => {
            if (!IS_PRODUCTION) {
                console.log(`Server listening on http://localhost:${PORT}`);
            }
        });
    })
    .catch((err) => {
        console.error("Database initialization error:", err);
        process.exit(1);
    });
