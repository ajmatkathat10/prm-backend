import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  isActive: boolean;
  forcePasswordChange: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true, lowercase: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'MANAGER', 'EMPLOYEE'], default: 'EMPLOYEE' },
  isActive: { type: Boolean, default: true },
  forcePasswordChange: { type: Boolean, default: true }
}, {
  timestamps: true,
  collection: 'users'
});

export const User = mongoose.model<IUser>('User', UserSchema);
