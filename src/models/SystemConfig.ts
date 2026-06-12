import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemConfig extends Document {
  id: number;
  llmProvider: string;
  llmApiKey: string;
  schedulerIntervalHours: number;
  maxWeeklyHours: number;
  updatedAt: Date;
}

const SystemConfigSchema = new Schema<ISystemConfig>({
  id: { type: Number, default: 1, unique: true },
  llmProvider: { type: String, default: 'Gemini' },
  llmApiKey: { type: String, required: true },
  schedulerIntervalHours: { type: Number, default: 4, min: 1 },
  maxWeeklyHours: { type: Number, default: 40, min: 1 }
}, {
  timestamps: { createdAt: false, updatedAt: true },
  collection: 'system_config'
});

export const SystemConfig = mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);
