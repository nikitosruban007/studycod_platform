
export const JWT_SECRET = process.env.JWT_SECRET || "prod-secret-must-be-set-in-env";
export const SESSION_SECRET = process.env.SESSION_SECRET || "prod-secret-must-be-set-in-env";

export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
export const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
export const PORT = Number(process.env.PORT) || 4000;

export const IS_PRODUCTION = process.env.NODE_ENV === "production";
