import { BaseRepository } from './BaseRepository.js';
import { SystemConfig, ISystemConfig } from '../models/SystemConfig.js';

export class SystemConfigRepository extends BaseRepository<ISystemConfig> {
  constructor() {
    super(SystemConfig);
  }

  async getConfig(): Promise<ISystemConfig | null> {
    return this.findOne({ id: 1 });
  }
}

export const systemConfigRepository = new SystemConfigRepository();
