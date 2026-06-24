import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { IReadRepository, IWriteRepository } from '../repositories/BaseRepository.js';
import { IUser } from '../models/User.js';
import { env } from '../config/env.js';
import { AUTH_ERRORS } from '../constants/index.js';
import { emailService } from './EmailService.js';

export interface TokenPayload {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  forcePasswordChange: boolean;
  emailVerified?: boolean;
}

export interface AuthResult {
  user: TokenPayload;
}

export type AuthRepository = IReadRepository<IUser> & IWriteRepository<IUser> & {
  findByUsernameOrEmail(identifier: string): Promise<IUser | null>;
};

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
  return null;
}

export class OtpRequiredError extends Error {
  constructor(public readonly userId: string) {
    super('OTP_REQUIRED');
    this.name = 'OtpRequiredError';
  }
}

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

    if (user.forcePasswordChange) {
      const otp = String(100000 + Math.floor(Math.random() * 900000));
      await this.userRepo.updateById(user._id.toString(), {
        otpCode: otp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      await emailService.sendEmail(
        user.email,
        'Your OTP Verification Code',
        `Hi ${user.fullName},\n\nYour OTP verification code for PRM first-login is: ${otp}\n\nThis code is valid for 10 minutes.\n\nBest regards,\nPRM System`
      );

      throw new OtpRequiredError(user._id.toString());
    }

    return buildTokenPayload(user);
  }

  async verifyOtp(userId: string, code: string): Promise<TokenPayload> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AuthError(AUTH_ERRORS.USER_NOT_FOUND, 404);
    }

    if (!user.forcePasswordChange) {
      throw new AuthError('OTP verification not required for this user', 400);
    }

    if (!user.otpCode || user.otpCode !== code) {
      throw new AuthError('Invalid verification code', 400);
    }

    if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new AuthError('Verification code has expired', 400);
    }

    await this.userRepo.updateById(userId, {
      otpCode: null,
      otpExpiresAt: null
    });

    const payload = buildTokenPayload(user);
    payload.emailVerified = true;
    return payload;
  }

  async changePassword(userId: string, newPassword: string, emailVerifiedFromToken?: boolean): Promise<TokenPayload> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AuthError(AUTH_ERRORS.USER_NOT_FOUND, 404);
    }

    if (user.forcePasswordChange && !emailVerifiedFromToken) {
      throw new AuthError('Email verification is required before changing password', 400);
    }

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

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

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
