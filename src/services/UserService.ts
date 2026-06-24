import bcrypt from 'bcryptjs';
import dns from 'dns/promises';
import net from 'net';
import { UserRepository, userRepository } from '../repositories/UserRepository.js';
import { ResourceRepository, resourceRepository } from '../repositories/ResourceRepository.js';
import { AllocationRepository, allocationRepository } from '../repositories/AllocationRepository.js';
import { IUser } from '../models/User.js';
import { AuthError, validatePasswordStrength } from './AuthService.js';
import { ResourceDesignation } from '../models/Resource.js';
import { USER_ERRORS } from '../constants/index.js';

async function verifyEmailInboxExists(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0) {
      return false;
    }
    mx.sort((a, b) => a.priority - b.priority);
    const host = mx[0].exchange;

    return new Promise((resolve) => {
      const socket = net.createConnection(25, host);
      socket.setTimeout(4000);
      let step = 0;
      let resolved = false;

      const safeResolve = (val: boolean) => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(val);
        }
      };

      socket.on('connect', () => {});

      socket.on('data', (data) => {
        const response = data.toString();
        if (response.startsWith('220') && step === 0) {
          socket.write(`HELO prm-system.com\r\n`);
          step = 1;
        } else if ((response.startsWith('250') || response.startsWith('220')) && step === 1) {
          socket.write(`MAIL FROM:<noreply@prm-system.com>\r\n`);
          step = 2;
        } else if (response.startsWith('250') && step === 2) {
          socket.write(`RCPT TO:<${email}>\r\n`);
          step = 3;
        } else if (step === 3) {
          if (response.startsWith('250')) {
            safeResolve(true);
          } else if (response.startsWith('550') || response.startsWith('553') || response.startsWith('551')) {
            safeResolve(false);
          } else {
            safeResolve(true);
          }
        }
      });

      socket.on('error', () => {
        safeResolve(true);
      });

      socket.on('timeout', () => {
        safeResolve(true);
      });

      socket.on('close', () => {
        safeResolve(true);
      });
    });
  } catch {
    return false;
  }
}

export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly resourceRepo: ResourceRepository,
    private readonly allocationRepo: AllocationRepository
  ) { }

  async createUser(
    fullName: string,
    email: string,
    username: string,
    passwordTemp: string,
    role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE',
    designation?: ResourceDesignation
  ): Promise<IUser> {
    if (!fullName || !email || !username || !passwordTemp || !role) {
      throw new AuthError(USER_ERRORS.MANDATORY_FIELDS, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AuthError(USER_ERRORS.INVALID_EMAIL, 400);
    }

    if (role !== 'ADMIN') {
      const exists = await verifyEmailInboxExists(email);
      if (!exists) {
        throw new AuthError('Email address does not exist or is undeliverable', 400);
      }
    }

    if (role === 'EMPLOYEE' && !designation) {
      throw new AuthError(USER_ERRORS.DESIGNATION_REQUIRED, 400);
    }

    const passwordError = validatePasswordStrength(passwordTemp);
    if (passwordError) {
      throw new AuthError(passwordError, 400);
    }

    const existingUser = await this.userRepo.findByUsernameOrEmail(username);
    if (existingUser) {
      throw new AuthError(USER_ERRORS.USERNAME_TAKEN, 400);
    }

    const existingEmail = await this.userRepo.findByUsernameOrEmail(email);
    if (existingEmail) {
      throw new AuthError(USER_ERRORS.EMAIL_IN_USE, 400);
    }

    const passwordHash = await bcrypt.hash(passwordTemp, 10);
    const user = await this.userRepo.create({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      fullName: fullName.trim(),
      passwordHash,
      role,
      isActive: true,
      forcePasswordChange: true,
    });

    if (role === 'EMPLOYEE') {
      await this.resourceRepo.create({
        userId: user._id,
        designation: designation!,
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
      throw new AuthError(USER_ERRORS.NOT_FOUND, 404);
    }

    const resource = await this.resourceRepo.findByUserId(userId);
    if (resource) {
      await this.resourceRepo.updateById(resource._id.toString(), {
        isActive: true,
        status: 'BENCH',
      });
    }

    return user;
  }

  async deactivateUser(userId: string, requestingUserId?: string): Promise<IUser> {
    if (requestingUserId && userId === requestingUserId) {
      throw new AuthError(USER_ERRORS.DEACTIVATE_SELF, 400);
    }

    const user = await this.userRepo.deactivate(userId);
    if (!user) {
      throw new AuthError(USER_ERRORS.NOT_FOUND, 404);
    }

    const resource = await this.resourceRepo.findByUserId(userId);
    if (resource) {
      await this.resourceRepo.updateById(resource._id.toString(), {
        isActive: false,
        status: 'INACTIVE',
      });

      const activeAllocations = await this.allocationRepo.findActiveAllocationsForResource(resource._id.toString());
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
      throw new AuthError(USER_ERRORS.NOT_FOUND, 404);
    }

    return user;
  }
}

export const userService = new UserService(userRepository, resourceRepository, allocationRepository);
