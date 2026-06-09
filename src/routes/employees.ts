import { Router } from 'express';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { employeeService } from '../services/EmployeeService.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS } from '../constants/index.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/employees
router.get('/', async (req, res) => {
  try {
    const { status, department } = req.query;
    const list = await employeeService.getAllEmployees({
      status: status ? String(status) : undefined,
      department: department ? String(department) : undefined,
    });
    res.json({ success: true, employees: list });
  } catch (error) {
    handleControllerError(error, res);
  }
});

// POST /api/employees/assign-manager
router.post('/assign-manager', async (req, res) => {
  try {
    const { employeeUserId, managerUserId } = req.body;
    const employee = await employeeService.assignManager(employeeUserId, managerUserId);
    res.json({ success: true, employee });
  } catch (error) {
    handleControllerError(error, res);
  }
});

// POST /api/employees/:id/deactivate
router.post('/:id/deactivate', async (req: AuthRequest, res) => {
  try {
    const employee = await employeeService.deactivateEmployee(req.params.id as string, req.user?.id as string);
    res.json({ success: true, employee });
  } catch (error) {
    handleControllerError(error, res);
  }
});

// POST /api/employees/:id/skills
router.post('/:id/skills', async (req, res) => {
  try {
    const { name, category, proficiency } = req.body;
    const employee = await employeeService.addEmployeeSkill(req.params.id, name, category, proficiency);
    res.json({ success: true, employee });
  } catch (error) {
    handleControllerError(error, res);
  }
});

// PUT /api/employees/:id/skills/:skillId
router.put('/:id/skills/:skillId', async (req, res) => {
  try {
    const { proficiency } = req.body;
    const employee = await employeeService.updateEmployeeSkill(req.params.id, req.params.skillId, proficiency);
    res.json({ success: true, employee });
  } catch (error) {
    handleControllerError(error, res);
  }
});

// DELETE /api/employees/:id/skills/:skillId
router.delete('/:id/skills/:skillId', async (req, res) => {
  try {
    const employee = await employeeService.removeEmployeeSkill(req.params.id, req.params.skillId);
    res.json({ success: true, employee });
  } catch (error) {
    handleControllerError(error, res);
  }
});

function handleControllerError(error: unknown, res: import('express').Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[EmployeeRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
