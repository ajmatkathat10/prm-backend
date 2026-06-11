import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { TokenPayload } from '../services/AuthService.js';
import { AUTH_ERRORS } from '../constants/index.js';
import { userRepository } from '../repositories/UserRepository.js';

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[env.session.cookieName];

  if (!token) {
    res.status(401).json({ error: AUTH_ERRORS.NO_SESSION });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;

    const user = await userRepository.findById(decoded.id);
    if (!user || !user.isActive) {
      res.clearCookie(env.session.cookieName, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: 'strict',
        path: '/',
      });
      res.status(401).json({ error: AUTH_ERRORS.DEACTIVATED });
      return;
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: AUTH_ERRORS.INVALID_SESSION });
  }
}

export function roleMiddleware(...allowedRoles: ('ADMIN' | 'MANAGER' | 'EMPLOYEE')[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: AUTH_ERRORS.FORBIDDEN });
      return;
    }
    next();
  };
}

export const adminMiddleware = roleMiddleware('ADMIN');

