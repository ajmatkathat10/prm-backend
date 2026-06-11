import { SystemConfigRepository, systemConfigRepository } from '../repositories/SystemConfigRepository.js';
import { ISystemConfig } from '../models/SystemConfig.js';
import { AuthError } from './AuthService.js';
import { CONFIG_ERRORS } from '../constants/index.js';

export class SystemConfigService {
  constructor(private readonly systemConfigRepo: SystemConfigRepository) { }

  async getConfig(): Promise<ISystemConfig> {
    const config = await this.systemConfigRepo.getConfig();
    if (!config) {
      throw new AuthError(CONFIG_ERRORS.NOT_FOUND, 404);
    }
    return config;
  }

  async updateConfig(data: Partial<ISystemConfig>): Promise<ISystemConfig> {
    let config = await this.systemConfigRepo.getConfig();
    if (!config) {
      config = await this.systemConfigRepo.create({
        id: 1,
        llmProvider: data.llmProvider || 'Gemini',
        llmApiKey: data.llmApiKey || 'PLACEHOLDER',
        schedulerIntervalHours: data.schedulerIntervalHours || 4,
        maxWeeklyHours: data.maxWeeklyHours || 40,
      });
      return config;
    }

    const updatePayload: Record<string, unknown> = {};
    if (data.llmProvider !== undefined) updatePayload.llmProvider = data.llmProvider;
    if (data.llmApiKey !== undefined) updatePayload.llmApiKey = data.llmApiKey;
    if (data.schedulerIntervalHours !== undefined) {
      if (data.schedulerIntervalHours < 1) throw new AuthError(CONFIG_ERRORS.SCHEDULER_INTERVAL_MIN, 400);
      updatePayload.schedulerIntervalHours = data.schedulerIntervalHours;
    }
    if (data.maxWeeklyHours !== undefined) {
      if (data.maxWeeklyHours < 1) throw new AuthError(CONFIG_ERRORS.MAX_HOURS_MIN, 400);
      updatePayload.maxWeeklyHours = data.maxWeeklyHours;
    }

    const updated = await this.systemConfigRepo.updateById(config._id.toString(), updatePayload);
    return updated!;
  }
}

export const systemConfigService = new SystemConfigService(systemConfigRepository);
