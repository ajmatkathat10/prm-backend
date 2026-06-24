import { test } from 'node:test';
import assert from 'node:assert';
import { ProjectService } from '../ProjectService.js';
import { ProjectRepository } from '../../repositories/ProjectRepository.js';
import { userRepository } from '../../repositories/UserRepository.js';
import { IProject } from '../../models/Project.js';
import { IUser } from '../../models/User.js';

test('ProjectService createProject checks mandatory fields and validation', async () => {
  const mockRepo = {
    create: async (data: Partial<IProject>) => data
  } as unknown as ProjectRepository;
  const mockUserRepo = {
    findById: async (id: string) => {
      if (id === 'manager1') return { _id: 'manager1', role: 'MANAGER' } as unknown as IUser;
      if (id === 'employee1') return { _id: 'employee1', role: 'EMPLOYEE' } as unknown as IUser;
      return null;
    }
  } as unknown as typeof userRepository;

  const service = new ProjectService(mockRepo, mockUserRepo);

  await assert.rejects(async () => {
    await service.createProject({ name: 'Proj' });
  }, /Project name, start date, end date, and manager are required/);

  await assert.rejects(async () => {
    await service.createProject({
      name: 'Proj',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-05-01'),
      managerId: 'manager1' as unknown as import('mongoose').Types.ObjectId
    });
  }, /Start date must be before end date/);

  await assert.rejects(async () => {
    await service.createProject({
      name: 'Proj',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-07-01'),
      managerId: 'employee1' as unknown as import('mongoose').Types.ObjectId
    });
  }, /Assigned user must have the MANAGER role/);

  const valid = await service.createProject({
    name: 'Proj',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-07-01'),
    managerId: 'manager1' as unknown as import('mongoose').Types.ObjectId,
    totalStoryPoints: 100
  });

  assert.strictEqual(valid.name, 'Proj');
  assert.strictEqual(valid.totalStoryPoints, 100);
});

test('ProjectService addMilestone validates timeline and story points limits', async () => {
  const projectMock = {
    _id: 'proj1',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-07-01'),
    totalStoryPoints: 100,
    milestones: [] as import('../../models/Project.js').IMilestone[]
  };

  const mockRepo = {
    findById: async () => projectMock,
    updateById: async (_id: string, data: Partial<IProject>) => ({ ...projectMock, ...data })
  } as unknown as ProjectRepository;

  const service = new ProjectService(mockRepo, {} as unknown as typeof userRepository);

  await assert.rejects(async () => {
    await service.addMilestone('proj1', 'Milestone 1', new Date('2026-08-01'), 20);
  }, /Milestone due date must fall within the project duration/);

  await assert.rejects(async () => {
    await service.addMilestone('proj1', 'Milestone 1', new Date('2026-06-15'), 120);
  }, /Total milestone story points cannot exceed the project total story points/);

  const updated = await service.addMilestone('proj1', 'Milestone 1', new Date('2026-06-15'), 50);
  assert.strictEqual(updated.milestones.length, 1);
  assert.strictEqual(updated.milestones[0].title, 'Milestone 1');
  assert.strictEqual(updated.milestones[0].storyPoints, 50);
});
