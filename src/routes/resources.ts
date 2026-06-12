import { Router } from 'express';
import { authMiddleware, roleMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { resourceService } from '../services/ResourceService.js';
import { resourceRepository } from '../repositories/ResourceRepository.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS, AUTH_ERRORS } from '../constants/index.js';

const router = Router();

router.use(authMiddleware);

router.get('/', roleMiddleware('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const { status } = req.query;

    const filters: { status?: string; managerId?: string } = {
      status: status ? String(status) : undefined
    };

    if (role === 'MANAGER') {
      filters.managerId = userId;
    }

    const list = await resourceService.getAllResources(filters);
    res.json({ success: true, resources: list });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/assign-manager', adminMiddleware, async (req, res) => {
  try {
    const { employeeUserId, managerUserId } = req.body;
    const resource = await resourceService.assignManager(employeeUserId, managerUserId);
    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.get('/me', roleMiddleware('ADMIN', 'MANAGER', 'EMPLOYEE'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id as string;
    const resource = await resourceService.getResourceByUserId(userId);
    if (!resource) {
      throw new AuthError('Resource profile not found', 404);
    }
    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.get('/:id', roleMiddleware('ADMIN', 'MANAGER', 'EMPLOYEE'), async (req: AuthRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const id = req.params.id as string;

    const resource = await resourceService.getResourceById(id);
    if (!resource) {
      throw new AuthError('Resource not found', 404);
    }

    if (role === 'EMPLOYEE') {
      const selfResource = await resourceRepository.findByUserId(userId);
      if (!selfResource || selfResource._id.toString() !== id) {
        throw new AuthError(AUTH_ERRORS.FORBIDDEN, 403);
      }
    } else if (role === 'MANAGER') {
      if (resource.managerId?.toString() !== userId) {
        throw new AuthError(AUTH_ERRORS.FORBIDDEN, 403);
      }
    }

    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/:id/deactivate', adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const resource = await resourceService.deactivateResource(req.params.id as string, req.user?.id as string);
    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/:id/skills', roleMiddleware('ADMIN', 'EMPLOYEE'), async (req: AuthRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const id = req.params.id as string;

    if (role === 'EMPLOYEE') {
      const selfResource = await resourceRepository.findByUserId(userId);
      if (!selfResource || selfResource._id.toString() !== id) {
        throw new AuthError(AUTH_ERRORS.FORBIDDEN, 403);
      }
    }

    const { name, category, proficiency } = req.body;
    const resource = await resourceService.addResourceSkill(id, name, category, proficiency);
    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.put('/:id/skills/:skillId', roleMiddleware('ADMIN', 'EMPLOYEE'), async (req: AuthRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const id = req.params.id as string;
    const skillId = req.params.skillId as string;

    if (role === 'EMPLOYEE') {
      const selfResource = await resourceRepository.findByUserId(userId);
      if (!selfResource || selfResource._id.toString() !== id) {
        throw new AuthError(AUTH_ERRORS.FORBIDDEN, 403);
      }
    }

    const { proficiency } = req.body;
    const resource = await resourceService.updateResourceSkill(id, skillId, proficiency);
    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.delete('/:id/skills/:skillId', roleMiddleware('ADMIN', 'EMPLOYEE'), async (req: AuthRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const id = req.params.id as string;
    const skillId = req.params.skillId as string;

    if (role === 'EMPLOYEE') {
      const selfResource = await resourceRepository.findByUserId(userId);
      if (!selfResource || selfResource._id.toString() !== id) {
        throw new AuthError(AUTH_ERRORS.FORBIDDEN, 403);
      }
    }

    const resource = await resourceService.removeResourceSkill(id, skillId);
    res.json({ success: true, resource });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/:id/restore-timesheet-access', roleMiddleware('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const id = req.params.id as string;

    const resource = await resourceService.getResourceById(id);
    if (!resource) {
      throw new AuthError('Resource not found', 404);
    }

    if (role === 'MANAGER') {
      const managerIdStr = resource.managerId ? String(resource.managerId) : '';
      if (managerIdStr !== userId) {
        throw new AuthError(AUTH_ERRORS.FORBIDDEN, 403);
      }
    }

    const updated = await resourceService.restoreTimesheetAccess(id);
    res.json({ success: true, resource: updated });
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
