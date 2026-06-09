import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEmployeeSkill {
  skillId: Types.ObjectId;
  proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  addedAt: Date;
}

export interface IEmployee extends Document {
  userId: Types.ObjectId;
  managerId?: Types.ObjectId;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  status: 'BENCH' | 'ALLOCATED' | 'INACTIVE';
  isActive: boolean;
  skills: IEmployeeSkill[];
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSkillSchema = new Schema<IEmployeeSkill>({
  skillId: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
  proficiency: { type: String, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], required: true },
  addedAt: { type: Date, default: Date.now }
}, { _id: false });

const EmployeeSchema = new Schema<IEmployee>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // nullable
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  department: { type: String, required: true, trim: true },
  designation: { type: String, required: true, trim: true },
  status: { type: String, enum: ['BENCH', 'ALLOCATED', 'INACTIVE'], default: 'BENCH' },
  isActive: { type: Boolean, default: true },
  skills: [EmployeeSkillSchema]
}, {
  timestamps: true,
  collection: 'employees'
});

export const Employee = mongoose.model<IEmployee>('Employee', EmployeeSchema);
