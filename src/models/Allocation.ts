import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAllocation extends Document {
  resourceId: Types.ObjectId;
  projectId: Types.ObjectId;
  utilisationPercent: number;
  fromDate: Date;
  toDate: Date;
  status: 'ACTIVE' | 'ENDED';
  createdAt: Date;
  updatedAt: Date;
}

const AllocationSchema = new Schema<IAllocation>({
  resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  utilisationPercent: { type: Number, required: true, min: 0, max: 100 },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  status: { type: String, enum: ['ACTIVE', 'ENDED'], default: 'ACTIVE' }
}, {
  timestamps: true,
  collection: 'allocations'
});

export const Allocation = mongoose.model<IAllocation>('Allocation', AllocationSchema);
