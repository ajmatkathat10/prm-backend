import mongoose, { Schema, Document, Types } from 'mongoose';

export const DESIGNATIONS = [
  'Junior Software Engineer',
  'Software Engineer',
  'Senior Software Engineer',
  'Devops Engineer',
  'Senior Devops engineer',
  'UI Tester',
  'Senior UI Tester'
] as const;

export type ResourceDesignation = typeof DESIGNATIONS[number];

export interface IResourceSkill {
  skillId: Types.ObjectId;
  proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  addedAt: Date;
}

export interface IResource extends Document {
  userId: Types.ObjectId;
  managerId?: Types.ObjectId | null;
  designation: ResourceDesignation;
  status: 'BENCH' | 'ALLOCATED' | 'INACTIVE';
  isActive: boolean;
  skills: IResourceSkill[];
  createdAt: Date;
  updatedAt: Date;
}

const ResourceSkillSchema = new Schema<IResourceSkill>({
  skillId: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
  proficiency: { type: String, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], required: true },
  addedAt: { type: Date, default: Date.now }
}, { _id: false });

const ResourceSchema = new Schema<IResource>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // nullable
  designation: { type: String, enum: DESIGNATIONS, required: true, trim: true },
  status: { type: String, enum: ['BENCH', 'ALLOCATED', 'INACTIVE'], default: 'BENCH' },
  isActive: { type: Boolean, default: true },
  skills: [ResourceSkillSchema]
}, {
  timestamps: true,
  collection: 'resources'
});

export const Resource = mongoose.model<IResource>('Resource', ResourceSchema);
