import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMilestone {
  title: string;
  dueDate: Date;
  storyPoints: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IProject extends Document {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
  managerId: Types.ObjectId;
  totalStoryPoints: number;
  healthFlag: 'ON_TRACK' | 'ATTENTION' | 'AT_RISK';
  milestones: IMilestone[];
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>({
  title: { type: String, required: true },
  dueDate: { type: Date, required: true },
  storyPoints: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'DONE'], default: 'NOT_STARTED' }
}, { timestamps: true });

const ProjectSchema = new Schema<IProject>({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED'], default: 'PLANNED' },
  managerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  totalStoryPoints: { type: Number, default: 0, min: 0 },
  healthFlag: { type: String, enum: ['ON_TRACK', 'ATTENTION', 'AT_RISK'], default: 'ON_TRACK' },
  milestones: [MilestoneSchema]
}, {
  timestamps: true,
  collection: 'projects'
});

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
