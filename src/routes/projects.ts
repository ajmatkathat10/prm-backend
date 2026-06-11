import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { projectService } from '../services/ProjectService.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS } from '../constants/index.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.post('/', async (req, res) => {
  try {
    const project = await projectService.createProject(req.body);
    res.json({ success: true, project });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.get('/', async (_req, res) => {
  try {
    const projects = await projectService.getAllProjects();
    res.json({ success: true, projects });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const project = await projectService.updateProject(req.params.id, req.body);
    res.json({ success: true, project });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/:id/milestones', async (req, res) => {
  try {
    const { title, dueDate, storyPoints } = req.body;
    const project = await projectService.addMilestone(req.params.id, title, dueDate, storyPoints);
    res.json({ success: true, project });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.put('/:id/milestones/:milestoneId', async (req, res) => {
  try {
    const { status } = req.body;
    const project = await projectService.updateMilestoneStatus(req.params.id, req.params.milestoneId, status);
    res.json({ success: true, project });
  } catch (error) {
    handleControllerError(error, res);
  }
});

function handleControllerError(error: unknown, res: import('express').Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[ProjectRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
