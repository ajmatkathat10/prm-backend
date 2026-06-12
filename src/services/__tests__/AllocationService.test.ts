import { test } from 'node:test';
import assert from 'node:assert';
import { AllocationService } from '../AllocationService.js';
import { AllocationRepository } from '../../repositories/AllocationRepository.js';
import { resourceRepository } from '../../repositories/ResourceRepository.js';
import { projectRepository } from '../../repositories/ProjectRepository.js';
import { IAllocation } from '../../models/Allocation.js';
import { IResource } from '../../models/Resource.js';
import { IProject } from '../../models/Project.js';

test('AllocationService createAllocation validates overlap limits and status', async () => {
  const resourceMock = { _id: 'res1', managerId: 'manager1' };
  const projectMock = { _id: 'proj1', managerId: 'manager1', status: 'ACTIVE' };

  const mockRepo = {
    findOverlappingAllocations: async () => [
      { utilisationPercent: 40 },
      { utilisationPercent: 30 }
    ],
    create: async (data: Partial<IAllocation>) => ({ ...data, _id: 'alloc123' }),
    findById: async (id: string) => ({ _id: id, utilisationPercent: 20 }),
    findAll: async () => []
  } as unknown as AllocationRepository;

  const mockResRepo = {
    findById: async () => resourceMock as unknown as IResource,
    updateById: async () => null
  } as unknown as typeof resourceRepository;

  const mockProjRepo = {
    findById: async () => projectMock as unknown as IProject
  } as unknown as typeof projectRepository;

  const service = new AllocationService(mockRepo, mockResRepo, mockProjRepo);

  await assert.rejects(async () => {
    await service.createAllocation(
      {
        resourceId: 'res1',
        projectId: 'proj1',
        utilisationPercent: 40,
        fromDate: '2026-06-01',
        toDate: '2026-06-15'
      },
      'manager1',
      false
    );
  }, /Allocation violates capacity/);

  const valid = await service.createAllocation(
    {
      resourceId: 'res1',
      projectId: 'proj1',
      utilisationPercent: 20,
      fromDate: '2026-06-01',
      toDate: '2026-06-15'
    },
    'manager1',
    false
  );

  assert.strictEqual(valid.utilisationPercent, 20);
});

test('AllocationService endAllocation deactivates allocation successfully', async () => {
  const allocationMock = {
    _id: 'alloc123',
    resourceId: 'res1',
    projectId: 'proj1',
    utilisationPercent: 50,
    status: 'ACTIVE'
  };

  const projectMock = {
    _id: 'proj1',
    managerId: 'manager1'
  };

  const mockRepo = {
    findById: async () => ({ ...allocationMock, status: 'ENDED' } as unknown as IAllocation),
    updateById: async (id: string, data: Partial<IAllocation>) => {
      assert.strictEqual(id, 'alloc123');
      assert.strictEqual(data.status, 'ENDED');
      return { ...allocationMock, ...data };
    },
    findAll: async () => []
  } as unknown as AllocationRepository;

  const mockResRepo = {
    updateById: async () => null
  } as unknown as typeof resourceRepository;

  const mockProjRepo = {
    findById: async () => projectMock as unknown as IProject
  } as unknown as typeof projectRepository;

  const service = new AllocationService(mockRepo, mockResRepo, mockProjRepo);
  const result = await service.endAllocation('alloc123', 'manager1', false);

  assert.strictEqual(result.status, 'ENDED');
});
