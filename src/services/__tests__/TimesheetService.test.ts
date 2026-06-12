import { test } from 'node:test';
import assert from 'node:assert';
import { TimesheetService } from '../TimesheetService.js';
import { TimesheetRepository } from '../../repositories/TimesheetRepository.js';
import { allocationRepository } from '../../repositories/AllocationRepository.js';
import { resourceRepository } from '../../repositories/ResourceRepository.js';
import { systemConfigRepository } from '../../repositories/SystemConfigRepository.js';
import { ITimesheet } from '../../models/Timesheet.js';

test('TimesheetService createTimesheet validates limits and dates', async () => {
  let savedTimesheet: unknown = null;
  const mockRepo = {
    findOne: async () => null,
    create: async (data: Partial<ITimesheet>) => {
      savedTimesheet = { ...data, _id: 'ts123' };
      return savedTimesheet;
    },
    findById: async () => savedTimesheet
  } as unknown as TimesheetRepository;

  const mockAllocRepo = {
    findOverlappingAllocations: async () => [
      { projectId: { _id: 'proj1' }, utilisationPercent: 50 }
    ]
  } as unknown as typeof allocationRepository;

  const mockResRepo = {
    findById: async (id: string) => ({ _id: id, timesheetAccessFrozen: false })
  } as unknown as typeof resourceRepository;
  const mockConfigRepo = {
    getConfig: async () => ({ maxWeeklyHours: 40 })
  } as unknown as typeof systemConfigRepository;

  const service = new TimesheetService(mockRepo, mockAllocRepo, mockResRepo, mockConfigRepo);

  await assert.rejects(async () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    await service.createTimesheet('res1', nextWeek, []);
  }, /Cannot submit timesheets for future weeks/);

  await assert.rejects(async () => {
    const lastMonday = new Date();
    lastMonday.setDate(lastMonday.getDate() - 7);
    await service.createTimesheet('res1', lastMonday, [
      { projectId: 'proj1' as unknown as import('mongoose').Types.ObjectId, hoursWorked: 30, activityTags: [] }
    ]);
  }, /Hours worked on project exceed the allocated percentage limit/);

  const lastMonday = new Date();
  lastMonday.setDate(lastMonday.getDate() - 7);
  const result = await service.createTimesheet('res1', lastMonday, [
    { projectId: 'proj1' as unknown as import('mongoose').Types.ObjectId, hoursWorked: 15, activityTags: ['Coding'] }
  ]);

  assert.strictEqual(result.totalHours, 15);
});
