import bcrypt from 'bcryptjs';
import { UserRepository, userRepository } from '../repositories/UserRepository.js';
import { EmployeeRepository, employeeRepository } from '../repositories/EmployeeRepository.js';
import { AllocationRepository, allocationRepository } from '../repositories/AllocationRepository.js';
import { IUser } from '../models/User.js';
import { AuthError, validatePasswordStrength } from './AuthService.js';

export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly employeeRepo: EmployeeRepository,
    private readonly allocationRepo: AllocationRepository
  ) { }

  async createUser(
    fullName: string,
    email: string,
    username: string,
    passwordTemp: string,
    role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE'
  ): Promise<IUser> {
    if (!fullName || !email || !username || !passwordTemp || !role) {
      throw new AuthError('All fields are mandatory', 400);
    }

    const passwordError = validatePasswordStrength(passwordTemp);
    if (passwordError) {
      throw new AuthError(passwordError, 400);
    }

    const existingUser = await this.userRepo.findByUsernameOrEmail(username);
    if (existingUser) {
      throw new AuthError('Username is already taken', 400);
    }

    const existingEmail = await this.userRepo.findByUsernameOrEmail(email);
    if (existingEmail) {
      throw new AuthError('Email is already in use', 400);
    }

    const passwordHash = await bcrypt.hash(passwordTemp, 10);
    const user = await this.userRepo.create({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      isActive: true,
      forcePasswordChange: true,
    });

    if (role === 'EMPLOYEE') {
      await this.employeeRepo.create({
        userId: user._id,
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        department: 'Engineering',
        designation: 'Software Engineer',
        status: 'BENCH',
        isActive: true,
        skills: [],
      });
    }

    return user;
  }

  async getAllUsers(): Promise<IUser[]> {
    return this.userRepo.findAll();
  }

  async reactivateUser(userId: string): Promise<IUser> {
    const user = await this.userRepo.reactivate(userId);
    if (!user) {
      throw new AuthError('User not found', 404);
    }

    const employee = await this.employeeRepo.findByUserId(userId);
    if (employee) {
      await this.employeeRepo.updateById(employee._id.toString(), {
        isActive: true,
        status: 'BENCH',
      });
    }

    return user;
  }

  async deactivateUser(userId: string, requestingUserId?: string): Promise<IUser> {
    if (requestingUserId && userId === requestingUserId) {
      throw new AuthError('An administrator cannot deactivate their own account', 400);
    }

    const user = await this.userRepo.deactivate(userId);
    if (!user) {
      throw new AuthError('User not found', 404);
    }

    const employee = await this.employeeRepo.findByUserId(userId);
    if (employee) {
      // 1. Deactivate employee record
      await this.employeeRepo.updateById(employee._id.toString(), {
        isActive: false,
        status: 'INACTIVE',
      });

      // 2. End all active allocations today
      const activeAllocations = await this.allocationRepo.findActiveAllocationsForEmployee(employee._id.toString());
      const today = new Date();
      for (const alloc of activeAllocations) {
        await this.allocationRepo.updateById(alloc._id.toString(), {
          status: 'ENDED',
          toDate: today,
        });
      }
    }

    return user;
  }

  async resetPassword(userId: string, newPasswordTemp: string): Promise<IUser> {
    const passwordError = validatePasswordStrength(newPasswordTemp);
    if (passwordError) {
      throw new AuthError(passwordError, 400);
    }

    const passwordHash = await bcrypt.hash(newPasswordTemp, 10);
    const user = await this.userRepo.updateById(userId, {
      passwordHash,
      forcePasswordChange: true,
    });

    if (!user) {
      throw new AuthError('User not found', 404);
    }

    return user;
  }
}

export const userService = new UserService(userRepository, employeeRepository, allocationRepository);
