import mongoose, { Schema, Document } from 'mongoose';

export interface ISkill extends Document {
  name: string;
  category: 'BACKEND' | 'FRONTEND' | 'DEVOPS' | 'QA' | 'OTHER';
}

const SkillSchema = new Schema<ISkill>({
  name: { type: String, required: true, unique: true, trim: true },
  category: { type: String, enum: ['BACKEND', 'FRONTEND', 'DEVOPS', 'QA', 'OTHER'], required: true }
}, {
  timestamps: true,
  collection: 'skills'
});

export const Skill = mongoose.model<ISkill>('Skill', SkillSchema);
