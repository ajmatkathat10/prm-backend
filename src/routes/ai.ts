import { Router, Response } from 'express';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js';
import { aiService } from '../services/AiService.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS } from '../constants/index.js';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('MANAGER', 'ADMIN'));

router.post('/skill-match', async (req: AuthRequest, res: Response) => {
  try {
    const { requirement, projectId } = req.body as {
      requirement?: string;
      projectId?: string;
    };

    if (!requirement) {
      throw new AuthError('Requirement text is required', 400);
    }

    const result = await aiService.skillMatch(requirement, projectId, req.user?.id);
    res.json(result);
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/risk-summary', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.body as { projectId?: string };
    if (!projectId) {
      throw new AuthError('Project ID is required', 400);
    }

    const result = await aiService.riskSummary(projectId);
    res.json(result);
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/team-match', async (req: AuthRequest, res: Response) => {
  try {
    const { requirement, projectId } = req.body as {
      requirement?: string;
      projectId?: string;
    };
    if (!requirement) {
      throw new AuthError('Requirement text is required', 400);
    }

    const result = await aiService.teamMatch(requirement, projectId);
    res.json(result);
  } catch (error) {
    handleControllerError(error, res);
  }
});

function handleControllerError(error: unknown, res: Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[AiRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
