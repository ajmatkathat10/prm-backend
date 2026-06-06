/**
 * routes/auth.ts — HTTP adapter for authentication endpoints
 *
 * SOLID (S — Single Responsibility): Route handlers have ONE job —
 * translate HTTP request/response. All business logic has been moved
 * to AuthService. These handlers are intentionally thin.
 *
 * PRINCIPLE (Separation of Concerns): HTTP concerns (parsing body,
 * setting status codes, formatting JSON) are separated from business
 * concerns (password validation, JWT creation, DB queries).
 *
 * CLEAN CODE: Each handler is short and readable. Named constants
 * instead of inline magic strings. Error handling is consistent.
 */

import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { authService, AuthError } from '../services/AuthService.js';
import { AUTH_ERRORS, COMMON_ERRORS } from '../constants/index.js';

const router = Router();

// POST /api/auth/login

router.post('/login', async (req, res): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: AUTH_ERRORS.CREDENTIALS_REQUIRED });
    return;
  }

  try {
    const userPayload = await authService.login(username, password);
    authService.issueSessionCookie(res, userPayload);
    res.json({ success: true, user: userPayload });
  } catch (error) {
    handleAuthError(error, res);
  }
});

// POST /api/auth/logout

router.post('/logout', (_req, res) => {
  authService.clearSessionCookie(res);
  res.json({ success: true });
});

// GET /api/auth/current-user

router.get('/current-user', authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user ?? null });
});

// POST /api/auth/change-password

router.post('/change-password', authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  const { newPassword } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: AUTH_ERRORS.NO_SESSION });
    return;
  }

  try {
    const updatedPayload = await authService.changePassword(userId, newPassword);
    authService.issueSessionCookie(res, updatedPayload);
    res.json({ success: true, user: updatedPayload });
  } catch (error) {
    handleAuthError(error, res);
  }
});

// Shared Error Handler

/**
 * Converts AuthError and unexpected errors
 * into consistent HTTP responses. Route handlers never write error
 * logic themselves — they delegate to this function.
 */
function handleAuthError(error: unknown, res: import('express').Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[AuthRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
