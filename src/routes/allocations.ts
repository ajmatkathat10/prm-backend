import { Router } from 'express';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js';
import { allocationService } from '../services/AllocationService.js';
import { resourceRepository } from '../repositories/ResourceRepository.js';
import { IAllocation } from '../models/Allocation.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS } from '../constants/index.js';

const router = Router();

router.use(authMiddleware);

router.get('/', roleMiddleware('ADMIN', 'MANAGER', 'EMPLOYEE'), async (req: AuthRequest, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id as string;
    const { resourceId, projectId } = req.query;

    const filters: { resourceId?: string; projectId?: string; managerId?: string } = {
      resourceId: resourceId ? String(resourceId) : undefined,
      projectId: projectId ? String(projectId) : undefined
    };

    if (role === 'EMPLOYEE') {
      const resource = await resourceRepository.findByUserId(userId);
      if (!resource) {
        throw new AuthError('Resource profile not found', 404);
      }
      filters.resourceId = resource._id.toString();
    } else if (role === 'MANAGER') {
      filters.managerId = userId;
    }

    const allocations = await allocationService.getAllAllocations(filters);
    const flattenedAllocations = flattenAllocationResourceNames(allocations);
    res.json({ success: true, allocations: flattenedAllocations });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/', roleMiddleware('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const managerUserId = req.user?.id as string;
    const isManager = req.user?.role === 'MANAGER';

    const allocation = await allocationService.createAllocation(
      req.body,
      managerUserId,
      isManager
    );
    res.json({ success: true, allocation });
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.put('/:id/end', roleMiddleware('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const managerUserId = req.user?.id as string;
    const isManager = req.user?.role === 'MANAGER';

    const allocation = await allocationService.endAllocation(
      req.params.id as string,
      managerUserId,
      isManager
    );
    res.json({ success: true, allocation });
  } catch (error) {
    handleControllerError(error, res);
  }
});

function flattenAllocationResourceNames(allocations: IAllocation[]) {
  return allocations.map((alloc) => {
    const raw = alloc.toObject ? alloc.toObject() : alloc;
    const resourceRaw = raw.resourceId as Record<string, unknown>;
    if (resourceRaw && typeof resourceRaw === 'object' && !Array.isArray(resourceRaw)) {
      const userRaw = resourceRaw.userId as Record<string, unknown> | undefined;
      if (userRaw && typeof userRaw === 'object') {
        resourceRaw.fullName = userRaw.fullName ?? '';
        resourceRaw.email = userRaw.email ?? '';
      }
    }
    return raw;
  });
}

function handleControllerError(error: unknown, res: import('express').Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[AllocationRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
