import { employeeRepository as empRepo } from '../repositories/EmployeeRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import { skillRepository } from '../repositories/SkillRepository.js';
import { allocationRepository } from '../repositories/AllocationRepository.js';
import { IEmployee } from '../models/Employee.js';
import { AuthError } from './AuthService.js';
import mongoose from 'mongoose';

export class EmployeeService {
  constructor(
    private readonly employeeRepo: typeof empRepo,
    private readonly userRepo: typeof userRepository,
    private readonly skillRepo: typeof skillRepository,
    private readonly allocationRepo: typeof allocationRepository
  ) { }

  async getAllEmployees(filters: { status?: string; department?: string }): Promise<IEmployee[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.department) {
      query.department = filters.department;
    }
    return this.employeeRepo.findAll(query);
  }

  async getEmployeeById(id: string): Promise<IEmployee | null> {
    return this.employeeRepo.findById(id);
  }

  async deactivateEmployee(employeeId: string, requestingUserId?: string): Promise<IEmployee> {
    const employee = await this.employeeRepo.findById(employeeId);
    if (!employee) {
      throw new AuthError('Employee not found', 404);
    }

    if (requestingUserId && employee.userId && employee.userId.toString() === requestingUserId) {
      throw new AuthError('An administrator cannot deactivate their own profile', 400);
    }

    // 1. Deactivate employee record
    const updatedEmployee = await this.employeeRepo.updateById(employeeId, {
      isActive: false,
      status: 'INACTIVE',
    });

    // 2. Block the linked user account
    if (employee.userId) {
      await this.userRepo.deactivate(employee.userId.toString());
    }

    // 3. End all active allocations today
    const activeAllocations = await this.allocationRepo.findActiveAllocationsForEmployee(employeeId);
    const today = new Date();
    for (const alloc of activeAllocations) {
      await this.allocationRepo.updateById(alloc._id.toString(), {
        status: 'ENDED',
        toDate: today,
      });
    }

    return updatedEmployee!;
  }

  async addEmployeeSkill(
    employeeId: string,
    skillName: string,
    category: 'BACKEND' | 'FRONTEND' | 'DEVOPS' | 'QA' | 'OTHER',
    proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  ): Promise<IEmployee> {
    if (!skillName || !category || !proficiency) {
      throw new AuthError('Skill name, category, and proficiency are required', 400);
    }

    const employee = await this.employeeRepo.findById(employeeId);
    if (!employee) {
      throw new AuthError('Employee not found', 404);
    }

    // Look up or create skill
    let skill = await this.skillRepo.findByName(skillName);
    if (!skill) {
      skill = await this.skillRepo.create({
        name: skillName.trim(),
        category,
      });
    }

    // Check if employee already has the skill
    const skillExists = employee.skills.some(
      (s) => s.skillId.toString() === skill!._id.toString()
    );
    if (skillExists) {
      throw new AuthError('Employee already has this skill configured', 400);
    }

    employee.skills.push({
      skillId: skill._id as mongoose.Types.ObjectId,
      proficiency,
      addedAt: new Date(),
    });

    const updatedEmployee = await this.employeeRepo.updateById(employeeId, {
      skills: employee.skills,
    });

    return updatedEmployee!;
  }

  async updateEmployeeSkill(
    employeeId: string,
    skillId: string,
    proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  ): Promise<IEmployee> {
    const employee = await this.employeeRepo.findById(employeeId);
    if (!employee) {
      throw new AuthError('Employee not found', 404);
    }

    const skillIndex = employee.skills.findIndex(
      (s) => s.skillId.toString() === skillId
    );
    if (skillIndex === -1) {
      throw new AuthError('Skill not found on this employee profile', 404);
    }

    employee.skills[skillIndex].proficiency = proficiency;

    const updatedEmployee = await this.employeeRepo.updateById(employeeId, {
      skills: employee.skills,
    });

    return updatedEmployee!;
  }

  async removeEmployeeSkill(employeeId: string, skillId: string): Promise<IEmployee> {
    const employee = await this.employeeRepo.findById(employeeId);
    if (!employee) {
      throw new AuthError('Employee not found', 404);
    }

    const initialLength = employee.skills.length;
    employee.skills = employee.skills.filter(
      (s) => s.skillId.toString() !== skillId
    );

    if (employee.skills.length === initialLength) {
      throw new AuthError('Skill not found on this employee profile', 404);
    }

    const updatedEmployee = await this.employeeRepo.updateById(employeeId, {
      skills: employee.skills,
    });

    return updatedEmployee!;
  }

  async assignManager(employeeUserId: string, managerUserId: string): Promise<IEmployee> {
    if (!employeeUserId || !managerUserId) {
      throw new AuthError('Employee User ID and Manager User ID are required', 400);
    }

    // Find the manager user record and verify role
    const managerUser = await this.userRepo.findById(managerUserId);
    if (!managerUser) {
      throw new AuthError('Manager user account not found', 404);
    }
    if (managerUser.role !== 'MANAGER') {
      throw new AuthError('The assigned manager user must have the MANAGER role', 400);
    }

    // Find employee by userId or employee record _id
    let employee = await this.employeeRepo.findByUserId(employeeUserId);
    if (!employee) {
      employee = await this.employeeRepo.findById(employeeUserId);
    }

    if (!employee) {
      throw new AuthError('Employee profile not found', 404);
    }

    const updatedEmployee = await this.employeeRepo.updateById(employee._id.toString(), {
      managerId: managerUser._id,
    });

    return updatedEmployee!;
  }
}

export const employeeService = new EmployeeService(
  empRepo,
  userRepository,
  skillRepository,
  allocationRepository
);
