import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { systemConfigService } from '../services/SystemConfigService.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS } from '../constants/index.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/settings
router.get('/', async (_req, res) => {
  try {
    const settings = await systemConfigService.getConfig();
    res.json({ success: true, settings });
  } catch (error) {
    handleControllerError(error, res);
  }
});

// PUT /api/settings
router.put('/', async (req, res) => {
  try {
    const settings = await systemConfigService.updateConfig(req.body);
    res.json({ success: true, settings });
  } catch (error) {
    handleControllerError(error, res);
  }
});

function handleControllerError(error: unknown, res: import('express').Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[SettingsRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
