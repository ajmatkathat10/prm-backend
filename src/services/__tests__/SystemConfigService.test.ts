import { test } from 'node:test';
import assert from 'node:assert';
import { SystemConfigService } from '../SystemConfigService.js';
import { SystemConfigRepository } from '../../repositories/SystemConfigRepository.js';
import { ISystemConfig } from '../../models/SystemConfig.js';

test('SystemConfigService getConfig returns config if found', async () => {
  const mockConfig = { id: 1, llmProvider: 'Gemini', llmApiKey: 'key1' };
  const mockRepo = {
    getConfig: async () => mockConfig,
    create: async () => null,
    updateById: async () => null
  } as unknown as SystemConfigRepository;

  const service = new SystemConfigService(mockRepo);
  const result = await service.getConfig();
  assert.deepStrictEqual(result, mockConfig);
});

test('SystemConfigService getConfig throws error if not found', async () => {
  const mockRepo = {
    getConfig: async () => null,
    create: async () => null,
    updateById: async () => null
  } as unknown as SystemConfigRepository;

  const service = new SystemConfigService(mockRepo);
  await assert.rejects(async () => {
    await service.getConfig();
  }, /System configuration not found/);
});

test('SystemConfigService updateConfig creates config if none exists', async () => {
  const mockConfig = { id: 1, llmProvider: 'Gemini', llmApiKey: 'newkey' };
  const mockRepo = {
    getConfig: async () => null,
    create: async (data: Partial<ISystemConfig>) => ({ ...mockConfig, ...data }),
    updateById: async () => null
  } as unknown as SystemConfigRepository;

  const service = new SystemConfigService(mockRepo);
  const result = await service.updateConfig({ llmApiKey: 'newkey' } as unknown as Partial<ISystemConfig>);
  assert.strictEqual(result.llmApiKey, 'newkey');
});

test('SystemConfigService updateConfig validates interval and hours', async () => {
  const mockConfig = { _id: 'id123', id: 1, llmProvider: 'Gemini', llmApiKey: 'key' };
  const mockRepo = {
    getConfig: async () => mockConfig,
    create: async () => null,
    updateById: async () => null
  } as unknown as SystemConfigRepository;

  const service = new SystemConfigService(mockRepo);
  await assert.rejects(async () => {
    await service.updateConfig({ schedulerIntervalHours: 0 } as unknown as Partial<ISystemConfig>);
  }, /Scheduler interval must be at least 1 hour/);

  await assert.rejects(async () => {
    await service.updateConfig({ maxWeeklyHours: 0 } as unknown as Partial<ISystemConfig>);
  }, /Maximum weekly hours must be at least 1 hour/);
});
