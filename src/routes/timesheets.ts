import { Router } from 'express';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js';
import { timesheetService } from '../services/TimesheetService.js';
import { resourceRepository } from '../repositories/ResourceRepository.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS, AUTH_ERRORS } from '../constants/index.js';

const router = Router();

router.use(authMiddleware);

router.post('/', roleMiddleware('EMPLOYEE'), async (req: AuthRequest, res) => {
  try {
    const resource = await resourceRepository.findByUserId(req.user?.id as string);
    if (!resource) {
      throw new AuthError('Resource profile not found for this account', 404);
    }

    const { weekStart, entries } = req.body;
    const timesheet = await timesheetService.createTimesheet(
      resource._id.toString(),
      new Date(weekStart),
      entries
    );
    res.json({ success: true, timesheet });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.get('/', roleMiddleware('ADMIN', 'MANAGER', 'EMPLOYEE'), async (req: AuthRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const { weekStart, resourceId } = req.query;

    const filters: { resourceId?: string; weekStart?: Date; managerId?: string } = {};

    if (weekStart) {
      filters.weekStart = new Date(String(weekStart));
    }

    if (role === 'EMPLOYEE') {
      const resource = await resourceRepository.findByUserId(userId);
      if (!resource) {
        throw new AuthError('Resource profile not found for this account', 404);
      }
      filters.resourceId = resource._id.toString();
    } else if (role === 'MANAGER') {
      filters.managerId = userId;
      if (resourceId) {
        const targetResource = await resourceRepository.findById(String(resourceId));
        if (!targetResource || targetResource.managerId?.toString() !== userId) {
          throw new AuthError(AUTH_ERRORS.FORBIDDEN, 403);
        }
        filters.resourceId = targetResource._id.toString();
      }
    } else if (role === 'ADMIN') {
      if (resourceId) {
        filters.resourceId = String(resourceId);
      }
    }

    const list = await timesheetService.getTimesheets(filters);
    res.json({ success: true, timesheets: list });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.get('/:id', roleMiddleware('ADMIN', 'MANAGER', 'EMPLOYEE'), async (req: AuthRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const timesheet = await timesheetService.getTimesheetById(req.params.id as string);

    if (!timesheet) {
      throw new AuthError('Timesheet not found', 404);
    }

    const resourceIdVal = timesheet.resourceId as unknown;
    const actualResourceId = (
      resourceIdVal &&
      typeof resourceIdVal === 'object' &&
      '_id' in resourceIdVal &&
      (resourceIdVal as { _id: unknown })._id
    )
      ? String((resourceIdVal as { _id: unknown })._id)
      : String(resourceIdVal);

    if (role === 'EMPLOYEE') {
      const resource = await resourceRepository.findByUserId(userId);
      if (!resource || resource._id.toString() !== actualResourceId) {
        throw new AuthError(AUTH_ERRORS.FORBIDDEN, 403);
      }
    } else if (role === 'MANAGER') {
      const resource = await resourceRepository.findById(actualResourceId);
      if (!resource || resource.managerId?.toString() !== userId) {
        throw new AuthError(AUTH_ERRORS.FORBIDDEN, 403);
      }
    }

    res.json({ success: true, timesheet });
  } catch (error) {
    handleControllerError(error, res);
  }
});

function handleControllerError(error: unknown, res: import('express').Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[TimesheetRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
