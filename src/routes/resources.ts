import { Router } from 'express';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { resourceService } from '../services/ResourceService.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS } from '../constants/index.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const list = await resourceService.getAllResources({
      status: status ? String(status) : undefined,
    });
    res.json({ success: true, resources: list });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/assign-manager', async (req, res) => {
  try {
    const { employeeUserId, managerUserId } = req.body;
    const resource = await resourceService.assignManager(employeeUserId, managerUserId);
    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/:id/deactivate', async (req: AuthRequest, res) => {
  try {
    const resource = await resourceService.deactivateResource(req.params.id as string, req.user?.id as string);
    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/:id/skills', async (req, res) => {
  try {
    const { name, category, proficiency } = req.body;
    const resource = await resourceService.addResourceSkill(req.params.id, name, category, proficiency);
    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.put('/:id/skills/:skillId', async (req, res) => {
  try {
    const { proficiency } = req.body;
    const resource = await resourceService.updateResourceSkill(req.params.id, req.params.skillId, proficiency);
    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.delete('/:id/skills/:skillId', async (req, res) => {
  try {
    const resource = await resourceService.removeResourceSkill(req.params.id, req.params.skillId);
    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

function handleControllerError(error: unknown, res: import('express').Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[ResourceRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
