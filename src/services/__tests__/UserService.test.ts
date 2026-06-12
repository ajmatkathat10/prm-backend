import { test } from 'node:test';
import assert from 'node:assert';
import { UserService } from '../UserService.js';
import { UserRepository } from '../../repositories/UserRepository.js';
import { ResourceRepository } from '../../repositories/ResourceRepository.js';
import { AllocationRepository } from '../../repositories/AllocationRepository.js';
import { IUser } from '../../models/User.js';
import { IResource } from '../../models/Resource.js';

import dns from 'dns/promises';

test('UserService createUser validates role and parameters', async () => {
  const originalResolveMx = dns.resolveMx;
  dns.resolveMx = (async () => [{ exchange: 'mail.example.com', priority: 10 }]) as unknown as typeof dns.resolveMx;

  const mockRepo = {
    findByUsernameOrEmail: async () => null,
    create: async (data: Partial<IUser>) => ({ ...data, _id: 'user123' })
  } as unknown as UserRepository;

  const mockResRepo = {
    create: async (data: Partial<IResource>) => ({ ...data, _id: 'res123' })
  } as unknown as ResourceRepository;

  const service = new UserService(mockRepo, mockResRepo, {} as unknown as AllocationRepository);

  try {
    await assert.rejects(async () => {
      await service.createUser('John Doe', 'john@example.com', 'john', 'SecretPass1', 'EMPLOYEE');
    }, /Designation is required for resource users/);

    await assert.rejects(async () => {
      await service.createUser('John Admin', 'invalid-email', 'admin', 'SecretPass1', 'ADMIN');
    }, /Invalid email format/);

    const admin = await service.createUser('John Admin', 'admin@example.com', 'admin', 'SecretPass1', 'ADMIN');
    assert.strictEqual(admin.role, 'ADMIN');
    assert.strictEqual(admin.forcePasswordChange, true);
  } finally {
    dns.resolveMx = originalResolveMx;
  }
});

test('UserService deactivateUser deactivates resource and associated allocations', async () => {
  const mockUser = { _id: 'user123', isActive: false };
  const mockResource = { _id: 'res123', userId: 'user123' };

  let userDeactivated = false;
  let resourceDeactivated = false;
  let allocationsEnded = false;

  const mockRepo = {
    deactivate: async (id: string) => {
      assert.strictEqual(id, 'user123');
      userDeactivated = true;
      return mockUser as unknown as IUser;
    }
  } as unknown as UserRepository;

  const mockResRepo = {
    findByUserId: async (id: string) => {
      assert.strictEqual(id, 'user123');
      return mockResource as unknown as IResource;
    },
    updateById: async (id: string, data: Partial<IResource>) => {
      assert.strictEqual(id, 'res123');
      assert.strictEqual(data.isActive, false);
      assert.strictEqual(data.status, 'INACTIVE');
      resourceDeactivated = true;
      return { ...mockResource, ...data } as unknown as IResource;
    }
  } as unknown as ResourceRepository;

  const mockAllocRepo = {
    findActiveAllocationsForResource: async (id: string) => {
      assert.strictEqual(id, 'res123');
      return [{ _id: 'alloc1' }];
    },
    updateById: async (id: string, data: Partial<import('../../models/Allocation.js').IAllocation>) => {
      assert.strictEqual(id, 'alloc1');
      assert.strictEqual(data.status, 'ENDED');
      allocationsEnded = true;
      return null;
    }
  } as unknown as AllocationRepository;

  const service = new UserService(mockRepo, mockResRepo, mockAllocRepo);
  const result = await service.deactivateUser('user123', 'admin999');

  assert.strictEqual(result.isActive, false);
  assert.ok(userDeactivated);
  assert.ok(resourceDeactivated);
  assert.ok(allocationsEnded);
});
