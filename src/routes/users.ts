import { Router } from 'express';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { userService } from '../services/UserService.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS } from '../constants/index.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.post('/', async (req, res) => {
  try {
    const { fullName, email, username, password, role, designation } = req.body;
    const user = await userService.createUser(fullName, email, username, password, role, designation);
    res.json({ success: true, user });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.get('/', async (_req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/:id/reactivate', async (req, res) => {
  try {
    const user = await userService.reactivateUser(req.params.id);
    res.json({ success: true, user });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/:id/deactivate', async (req: AuthRequest, res) => {
  try {
    const user = await userService.deactivateUser(req.params.id as string, req.user?.id as string);
    res.json({ success: true, user });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = await userService.resetPassword(req.params.id, newPassword);
    res.json({ success: true, user });
  } catch (error) {
    handleControllerError(error, res);
  }
});

function handleControllerError(error: unknown, res: import('express').Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[UserRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
