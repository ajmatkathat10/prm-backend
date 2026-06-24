import { test } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import dns from 'dns/promises';
import { AuthService, OtpRequiredError } from '../AuthService.js';
import { UserService } from '../UserService.js';
import { IUser } from '../../models/User.js';
import { emailService } from '../EmailService.js';
import { UserRepository } from '../../repositories/UserRepository.js';
import { ResourceRepository } from '../../repositories/ResourceRepository.js';
import { AllocationRepository } from '../../repositories/AllocationRepository.js';

test('UserService createUser validates email deliverability via DNS MX check', async () => {
  const originalResolveMx = dns.resolveMx;
  let dnsCalled = false;

  dns.resolveMx = (async (domain: string) => {
    dnsCalled = true;
    if (domain === 'invalid-domain.xyz') {
      throw new Error('ENOTFOUND');
    }
    return [{ exchange: 'mail.valid.com', priority: 10 }];
  }) as unknown as typeof dns.resolveMx;

  const mockUserRepo = {
    findByUsernameOrEmail: async () => null,
    create: async (data: Partial<IUser>) => data as IUser,
  } as unknown as UserRepository;

  const service = new UserService(
    mockUserRepo,
    {} as unknown as ResourceRepository,
    {} as unknown as AllocationRepository
  );

  try {
    await assert.rejects(async () => {
      await service.createUser(
        'Test User',
        'test@invalid-domain.xyz',
        'testuser',
        'ValidPass123',
        'MANAGER'
      );
    }, /Email address does not exist or is undeliverable/);

    assert.ok(dnsCalled);
  } finally {
    dns.resolveMx = originalResolveMx;
  }
});

test('AuthService login triggers OTP generation, updates user, and throws OtpRequiredError when forcePasswordChange is true', async () => {
  const hash = await bcrypt.hash('Password123', 10);
  const mockUser = {
    _id: 'user123',
    username: 'newuser',
    email: 'new@example.com',
    fullName: 'New User',
    role: 'EMPLOYEE',
    forcePasswordChange: true,
    isActive: true,
    passwordHash: hash,
  };

  let updateData: Record<string, unknown> | null = null;
  const mockRepo = {
    findByUsernameOrEmail: async () => mockUser,
    updateById: async (id: string, data: Record<string, unknown>) => {
      assert.strictEqual(id, 'user123');
      updateData = data;
      return { ...mockUser, ...data };
    },
  } as unknown as UserRepository;

  const originalSendEmail = emailService.sendEmail;
  let emailSent = false;
  emailService.sendEmail = async (to: string, subject: string, body: string) => {
    assert.strictEqual(to, 'new@example.com');
    assert.ok(subject.includes('OTP'));
    assert.ok(body.includes('verification code'));
    emailSent = true;
  };

  try {
    const auth = new AuthService(mockRepo);
    await assert.rejects(async () => {
      await auth.login('newuser', 'Password123');
    }, (err: unknown) => {
      return err instanceof OtpRequiredError && err.userId === 'user123';
    });

    assert.ok(updateData);
    assert.ok((updateData as Record<string, unknown>).otpCode);
    assert.ok((updateData as Record<string, unknown>).otpExpiresAt);
    assert.ok(emailSent);
  } finally {
    emailService.sendEmail = originalSendEmail;
  }
});

test('AuthService verifyOtp verifies valid OTP and changePassword validates verified email token requirement', async () => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 10);

  const mockUser = {
    _id: 'user123',
    username: 'newuser',
    email: 'new@example.com',
    role: 'EMPLOYEE',
    forcePasswordChange: true,
    isActive: true,
    otpCode: '123456',
    otpExpiresAt: expiry,
  };

  let resUpdated = false;
  const mockRepo = {
    findById: async (id: string) => {
      assert.strictEqual(id, 'user123');
      return mockUser;
    },
    updateById: async (id: string, data: Record<string, unknown>) => {
      assert.strictEqual(id, 'user123');
      resUpdated = true;
      return { ...mockUser, ...data };
    },
  } as unknown as UserRepository;

  const auth = new AuthService(mockRepo);

  await assert.rejects(async () => {
    await auth.verifyOtp('user123', 'wrongcode');
  }, /Invalid verification code/);

  const payload = await auth.verifyOtp('user123', '123456');
  assert.strictEqual(payload.emailVerified, true);
  assert.ok(resUpdated);

  await assert.rejects(async () => {
    await auth.changePassword('user123', 'NewValidPass1');
  }, /Email verification is required before changing password/);

  const updatedPayload = await auth.changePassword('user123', 'NewValidPass1', true);
  assert.strictEqual(updatedPayload.forcePasswordChange, false);
});
