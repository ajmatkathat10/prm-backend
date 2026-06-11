import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { authService, AuthError } from '../services/AuthService.js';
import { AUTH_ERRORS, COMMON_ERRORS } from '../constants/index.js';

const router = Router();

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

router.post('/logout', (_req, res) => {
  authService.clearSessionCookie(res);
  res.json({ success: true });
});

router.get('/current-user', authMiddleware, (req: AuthRequest, res) => {
  res.json({ user: req.user ?? null });
});

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

function handleAuthError(error: unknown, res: import('express').Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[AuthRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
