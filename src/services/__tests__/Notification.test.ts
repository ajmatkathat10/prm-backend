import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { emailService } from '../EmailService.js';
import { TimesheetService } from '../TimesheetService.js';
import { ResourceService } from '../ResourceService.js';
import { TimesheetRepository } from '../../repositories/TimesheetRepository.js';
import { allocationRepository } from '../../repositories/AllocationRepository.js';
import { resourceRepository } from '../../repositories/ResourceRepository.js';
import { systemConfigRepository } from '../../repositories/SystemConfigRepository.js';
import { userRepository } from '../../repositories/UserRepository.js';
import { skillRepository } from '../../repositories/SkillRepository.js';
import { Timesheet } from '../../models/Timesheet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('EmailService logs to log file and console', async () => {
  const testEmail = 'test@example.com';
  const testSubject = 'Test Email Subject';
  const testBody = 'Test Email Body Content';

  await emailService.sendEmail(testEmail, testSubject, testBody);

  const logFilePath = path.join(__dirname, '..', '..', '..', 'logs', 'emails.log');
  const content = await fs.readFile(logFilePath, 'utf-8');
  assert.ok(content.includes(testEmail));
  assert.ok(content.includes(testSubject));
  assert.ok(content.includes(testBody));
});

test('TimesheetService block submission when timesheetAccessFrozen is true', async () => {
  const mockResRepo = {
    findById: async (id: string) => {
      assert.strictEqual(id, 'resFrozen');
      return { _id: 'resFrozen', timesheetAccessFrozen: true };
    }
  } as unknown as typeof resourceRepository;

  const service = new TimesheetService(
    {} as unknown as TimesheetRepository,
    {} as unknown as typeof allocationRepository,
    mockResRepo,
    {} as unknown as typeof systemConfigRepository
  );

  await assert.rejects(async () => {
    await service.createTimesheet('resFrozen', new Date(), []);
  }, /Timesheet submission access is frozen/);
});

test('ResourceService restoreTimesheetAccess resets timesheetAccessFrozen and updates MISSED timesheets', async () => {
  const resourceMock = {
    _id: 'res123',
    timesheetAccessFrozen: true
  };

  let updateCalled = false;
  const mockResRepo = {
    findById: async (id: string) => {
      assert.strictEqual(id, 'res123');
      return { ...resourceMock, timesheetAccessFrozen: false };
    },
    updateById: async (id: string, data: { timesheetAccessFrozen: boolean }) => {
      assert.strictEqual(id, 'res123');
      assert.strictEqual(data.timesheetAccessFrozen, false);
      updateCalled = true;
      return { ...resourceMock, timesheetAccessFrozen: false };
    }
  } as unknown as typeof resourceRepository;

  const originalUpdateMany = Timesheet.updateMany;
  let updateManyCalled = false;
  Timesheet.updateMany = (async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
    assert.strictEqual(String(filter.resourceId), 'res123');
    assert.strictEqual(filter.status, 'MISSED');
    const setClause = update.$set as Record<string, unknown>;
    assert.strictEqual(setClause.reminderSentCount, 0);
    assert.strictEqual(setClause.lastReminderSentAt, null);
    updateManyCalled = true;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1, upsertedCount: 0, upsertedId: null };
  }) as unknown as typeof Timesheet.updateMany;

  try {
    const service = new ResourceService(
      mockResRepo,
      {} as unknown as typeof userRepository,
      {} as unknown as typeof skillRepository,
      {} as unknown as typeof allocationRepository
    );

    const result = await service.restoreTimesheetAccess('res123');
    assert.strictEqual(result.timesheetAccessFrozen, false);
    assert.ok(updateCalled);
    assert.ok(updateManyCalled);
  } finally {
    Timesheet.updateMany = originalUpdateMany;
  }
});
