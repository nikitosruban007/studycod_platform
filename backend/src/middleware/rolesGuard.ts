import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { UserRole } from '../entities/User';

/**
 * Middleware для перевірки ролей користувача
 * Використання: rolesGuard(['SYSTEM_ADMIN', 'TEACHER'])
 */
export const rolesGuard = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userRole = req.userRole;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: 'Forbidden: Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: userRole || null,
      });
    }

    next();
  };
};

/**
 * Guard для перевірки SYSTEM_ADMIN ролі
 */
export const systemAdminGuard = rolesGuard(['SYSTEM_ADMIN']);

/**
 * Guard для перевірки TEACHER або SYSTEM_ADMIN ролі
 */
export const teacherOrAdminGuard = rolesGuard(['TEACHER', 'SYSTEM_ADMIN']);

