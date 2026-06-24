import { test } from 'node:test';
import assert from 'node:assert';
import { ResourceService } from '../ResourceService.js';
import { resourceRepository } from '../../repositories/ResourceRepository.js';
import { userRepository } from '../../repositories/UserRepository.js';
import { skillRepository } from '../../repositories/SkillRepository.js';
import { allocationRepository } from '../../repositories/AllocationRepository.js';
import { IResource } from '../../models/Resource.js';
import { IUser } from '../../models/User.js';

test('ResourceService addResourceSkill adds skill successfully', async () => {
  const resourceMock = {
    _id: 'res1',
    skills: [] as import('../../models/Resource.js').IResourceSkill[]
  };

  const mockRepo = {
    findById: async () => resourceMock,
    updateById: async (_id: string, data: Partial<IResource>) => ({ ...resourceMock, ...data })
  } as unknown as typeof resourceRepository;

  const mockSkillRepo = {
    findByName: async () => ({ _id: 'skill123', name: 'TypeScript' })
  } as unknown as typeof skillRepository;

  const service = new ResourceService(mockRepo, {} as unknown as typeof userRepository, mockSkillRepo, {} as unknown as typeof allocationRepository);
  const result = await service.addResourceSkill('res1', 'TypeScript', 'FRONTEND', 'ADVANCED');

  assert.strictEqual((result.skills as unknown[]).length, 1);
  assert.strictEqual((result.skills as unknown as import('../../models/Resource.js').IResourceSkill[])[0].proficiency, 'ADVANCED');
});

test('ResourceService deactivateResource deactivates resource and user profile', async () => {
  const resourceMock = {
    _id: 'res1',
    userId: 'user123',
    isActive: true,
    status: 'BENCH'
  };

  let userDeactivated = false;
  let allocsEnded = false;

  const mockRepo = {
    findById: async () => resourceMock,
    updateById: async (_id: string, data: Partial<IResource>) => {
      assert.strictEqual(_id, 'res1');
      assert.strictEqual(data.isActive, false);
      assert.strictEqual(data.status, 'INACTIVE');
      return { ...resourceMock, ...data };
    }
  } as unknown as typeof resourceRepository;

  const mockUserRepo = {
    deactivate: async (id: string) => {
      assert.strictEqual(id, 'user123');
      userDeactivated = true;
      return null;
    }
  } as unknown as typeof userRepository;

  const mockAllocRepo = {
    findActiveAllocationsForResource: async () => [
      { _id: 'alloc1' },
      { _id: 'alloc2' }
    ],
    updateById: async (_id: string, data: Partial<import('../../models/Allocation.js').IAllocation>) => {
      assert.strictEqual(data.status, 'ENDED');
      allocsEnded = true;
      return null;
    }
  } as unknown as typeof allocationRepository;

  const service = new ResourceService(mockRepo, mockUserRepo, {} as unknown as typeof skillRepository, mockAllocRepo);
  const result = await service.deactivateResource('res1', 'requestor123');

  assert.strictEqual(result.status, 'INACTIVE');
  assert.strictEqual(result.isActive, false);
  assert.ok(userDeactivated);
  assert.ok(allocsEnded);
});

test('ResourceService assignManager maps resource to a manager', async () => {
  const resourceMock = {
    _id: 'res1',
    managerId: null
  };

  const mockUserRepo = {
    findById: async (id: string) => {
      if (id === 'manager123') return { _id: 'manager123', role: 'MANAGER' } as unknown as IUser;
      return null;
    }
  } as unknown as typeof userRepository;

  const mockRepo = {
    findByUserId: async () => resourceMock,
    updateById: async (_id: string, data: Partial<IResource>) => {
      assert.strictEqual(_id, 'res1');
      assert.strictEqual(data.managerId!.toString(), 'manager123');
      return { ...resourceMock, ...data };
    }
  } as unknown as typeof resourceRepository;

  const service = new ResourceService(mockRepo, mockUserRepo, {} as unknown as typeof skillRepository, {} as unknown as typeof allocationRepository);
  const result = await service.assignManager('res1', 'manager123');

  assert.strictEqual(result.managerId!.toString(), 'manager123');
});
