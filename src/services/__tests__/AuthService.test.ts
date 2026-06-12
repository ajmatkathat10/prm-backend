import { test } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import { AuthService, validatePasswordStrength, AuthRepository } from '../AuthService.js';
import { IUser } from '../../models/User.js';

test('validatePasswordStrength checks length, uppercase, and numbers', () => {
  assert.strictEqual(validatePasswordStrength('Short1'), 'Password must be at least 8 characters long');
  assert.strictEqual(validatePasswordStrength('nouppercase1'), 'Password must contain at least one uppercase letter');
  assert.strictEqual(validatePasswordStrength('NoNumberPass'), 'Password must contain at least one number');
  assert.strictEqual(validatePasswordStrength('ValidPass1'), null);
});

test('AuthService login successfully authenticates', async () => {
  const hash = await bcrypt.hash('ValidPass1', 10);
  const mockUser = {
    _id: 'userid123',
    username: 'testuser',
    email: 'test@example.com',
    role: 'EMPLOYEE',
    forcePasswordChange: false,
    isActive: true,
    passwordHash: hash
  };

  const mockRepo = {
    findByUsernameOrEmail: async () => mockUser
  } as unknown as AuthRepository;

  const auth = new AuthService(mockRepo);
  const payload = await auth.login('testuser', 'ValidPass1');

  assert.strictEqual(payload.id, 'userid123');
  assert.strictEqual(payload.username, 'testuser');
});

test('AuthService login throws for invalid password', async () => {
  const hash = await bcrypt.hash('ValidPass1', 10);
  const mockUser = {
    _id: 'userid123',
    username: 'testuser',
    passwordHash: hash,
    isActive: true
  };

  const mockRepo = {
    findByUsernameOrEmail: async () => mockUser
  } as unknown as AuthRepository;

  const auth = new AuthService(mockRepo);
  await assert.rejects(async () => {
    await auth.login('testuser', 'WrongPass1');
  }, /Invalid username or password/);
});

test('AuthService login throws for inactive user', async () => {
  const mockUser = {
    _id: 'userid123',
    username: 'testuser',
    isActive: false
  };

  const mockRepo = {
    findByUsernameOrEmail: async () => mockUser
  } as unknown as AuthRepository;

  const auth = new AuthService(mockRepo);
  await assert.rejects(async () => {
    await auth.login('testuser', 'Password123');
  }, /deactivated/);
});

test('AuthService changePassword hashes password and updates user', async () => {
  const mockUser = {
    _id: 'userid123',
    username: 'testuser',
    email: 'test@example.com',
    role: 'EMPLOYEE',
    forcePasswordChange: false
  };

  const mockRepo = {
    findById: async (id: string) => {
      assert.strictEqual(id, 'userid123');
      return mockUser as unknown as IUser;
    },
    updateById: async (id: string, data: Partial<IUser>) => {
      assert.strictEqual(id, 'userid123');
      assert.ok(data.passwordHash);
      assert.strictEqual(data.forcePasswordChange, false);
      return mockUser;
    }
  } as unknown as AuthRepository;

  const auth = new AuthService(mockRepo);
  const payload = await auth.changePassword('userid123', 'NewValidPass1');

  assert.strictEqual(payload.id, 'userid123');
});
