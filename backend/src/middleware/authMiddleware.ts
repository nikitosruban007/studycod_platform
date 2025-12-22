import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

export interface AuthRequest extends Request {
  userId?: number;
  studentId?: number;
  userType?: "USER" | "STUDENT";
  lang?: string;
  difus?: number;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;

    if (payload.type === "STUDENT" && payload.studentId) {
      req.studentId = payload.studentId;
      req.userId = payload.studentId;
      req.userType = "STUDENT";
      req.lang = payload.lang;
    } else {
      req.userId = payload.userId;
      req.userType = "USER";
      req.lang = payload.lang;
    }

    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const authRequired = authMiddleware;
export default authMiddleware;
