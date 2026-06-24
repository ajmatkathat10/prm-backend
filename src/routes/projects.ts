import { Router } from 'express';
import { authMiddleware, roleMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { projectService } from '../services/ProjectService.js';
import { resourceRepository } from '../repositories/ResourceRepository.js';
import { allocationRepository } from '../repositories/AllocationRepository.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS, AUTH_ERRORS } from '../constants/index.js';

const router = Router();

router.use(authMiddleware);

router.post('/', adminMiddleware, async (req, res) => {
  try {
    const project = await projectService.createProject(req.body);
    res.json({ success: true, project });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.get('/', roleMiddleware('ADMIN', 'MANAGER', 'EMPLOYEE'), async (req: AuthRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const filters: { managerId?: string; projectIds?: string[] } = {};

    if (role === 'MANAGER') {
      filters.managerId = userId;
    } else if (role === 'EMPLOYEE') {
      const resource = await resourceRepository.findByUserId(userId);
      if (!resource) {
        throw new AuthError('Resource profile not found', 404);
      }
      const activeAllocations = await allocationRepository.findActiveAllocationsForResource(resource._id.toString());
      filters.projectIds = activeAllocations.map((a) => a.projectId._id ? a.projectId._id.toString() : a.projectId.toString());
    }

    const projects = await projectService.getAllProjects(filters);
    res.json({ success: true, projects });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.get('/:id', roleMiddleware('ADMIN', 'MANAGER', 'EMPLOYEE'), async (req: AuthRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const project = await projectService.getProjectById(req.params.id as string);

    if (!project) {
      throw new AuthError('Project not found', 404);
    }

    if (role === 'MANAGER' && project.managerId._id.toString() !== userId && project.managerId.toString() !== userId) {
      throw new AuthError(AUTH_ERRORS.FORBIDDEN, 403);
    }

    if (role === 'EMPLOYEE') {
      const resource = await resourceRepository.findByUserId(userId);
      if (!resource) {
        throw new AuthError('Resource profile not found', 404);
      }
      const activeAllocations = await allocationRepository.findActiveAllocationsForResource(resource._id.toString());
      const isAllocated = activeAllocations.some(
        (a) => a.projectId._id.toString() === (req.params.id as string) || a.projectId.toString() === (req.params.id as string)
      );
      if (!isAllocated) {
        throw new AuthError(AUTH_ERRORS.FORBIDDEN, 403);
      }
    }

    res.json({ success: true, project });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const project = await projectService.updateProject(req.params.id as string, req.body);
    res.json({ success: true, project });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/:id/milestones', adminMiddleware, async (req, res) => {
  try {
    const { title, dueDate, storyPoints } = req.body;
    const project = await projectService.addMilestone(req.params.id as string, title, dueDate, storyPoints);
    res.json({ success: true, project });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.put('/:id/milestones/:milestoneId', adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const project = await projectService.updateMilestoneStatus(req.params.id as string, req.params.milestoneId as string, status);
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
