import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { allocationService } from '../services/AllocationService.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS } from '../constants/index.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/allocations
router.get('/', async (req, res) => {
  try {
    const { employeeId, projectId } = req.query;
    const allocations = await allocationService.getAllAllocations({
      employeeId: employeeId ? String(employeeId) : undefined,
      projectId: projectId ? String(projectId) : undefined,
    });
    res.json({ success: true, allocations });
  } catch (error) {
    handleControllerError(error, res);
  }
});

function handleControllerError(error: unknown, res: import('express').Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[AllocationRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
