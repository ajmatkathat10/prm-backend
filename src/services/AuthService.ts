/**
 * AuthService.ts — Authentication business logic layer
 *
 * SOLID (S — Single Responsibility): This service has one job —
 * handle the business rules for authentication. It knows nothing about
 * HTTP (no req/res). Route handlers call it and translate results to HTTP.
 *
 * SOLID (D — Dependency Inversion): AuthService depends on
 * `IReadRepository<IUser>` and `IWriteRepository<IUser>` (abstractions),
 * not on the Mongoose `User` model or `UserRepository` class directly.
 * The concrete repository is injected at construction time.
 *
 * PATTERN (Service Layer): Business logic belongs here, not in route handlers.
 * Routes become thin HTTP adapters — they validate input, call the service,
 * then format the HTTP response.
 *
 * PRINCIPLE (DRY): Cookie configuration and JWT signing options are defined
 * once here and reused by both login and change-password flows.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { IReadRepository, IWriteRepository } from '../repositories/BaseRepository.js';
import { IUser } from '../models/User.js';
import { env } from '../config/env.js';
import { AUTH_ERRORS } from '../constants/index.js';

// Shared Types 

export interface TokenPayload {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  forcePasswordChange: boolean;
}

export interface AuthResult {
  user: TokenPayload;
}

export type AuthRepository = IReadRepository<IUser> & IWriteRepository<IUser> & {
  findByUsernameOrEmail(identifier: string): Promise<IUser | null>;
};

// Password Validation

const PASSWORD_MIN_LENGTH = 8;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return AUTH_ERRORS.PASSWORD_TOO_SHORT(PASSWORD_MIN_LENGTH);
  }
  if (!/[A-Z]/.test(password)) {
    return AUTH_ERRORS.PASSWORD_NO_UPPERCASE;
  }
  if (!/[0-9]/.test(password)) {
    return AUTH_ERRORS.PASSWORD_NO_NUMBER;
  }
  return null; // null means valid
}

// Service Class

export class AuthService {
  constructor(private readonly userRepo: AuthRepository) { }

  async login(identifier: string, password: string): Promise<TokenPayload> {
    const user = await this.userRepo.findByUsernameOrEmail(identifier);
    if (!user) {
      throw new AuthError(AUTH_ERRORS.INVALID_CREDENTIALS, 401);
    }

    if (!user.isActive) {
      throw new AuthError(AUTH_ERRORS.DEACTIVATED, 403);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthError(AUTH_ERRORS.INVALID_CREDENTIALS, 401);
    }

    return buildTokenPayload(user);
  }

  async changePassword(userId: string, newPassword: string): Promise<TokenPayload> {
    const validationError = validatePasswordStrength(newPassword);
    if (validationError) {
      throw new AuthError(validationError, 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const updatedUser = await this.userRepo.updateById(userId, {
      passwordHash,
      forcePasswordChange: false,
    });

    if (!updatedUser) {
      throw new AuthError(AUTH_ERRORS.USER_NOT_FOUND, 404);
    }

    return buildTokenPayload(updatedUser);
  }

  issueSessionCookie(res: Response, payload: TokenPayload): void {
    const token = jwt.sign(payload, env.jwtSecret, {
      expiresIn: env.session.expiresIn,
    });

    res.cookie(env.session.cookieName, token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      maxAge: env.session.maxAgeMs,
      path: '/',
    });
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie(env.session.cookieName, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'strict',
      path: '/',
    });
  }
}

// Error Class

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// Helpers

function buildTokenPayload(user: IUser): TokenPayload {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    forcePasswordChange: user.forcePasswordChange,
  };
}

import { userRepository } from '../repositories/UserRepository.js';
export const authService = new AuthService(userRepository);
