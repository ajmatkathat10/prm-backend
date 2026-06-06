import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITimesheetEntry {
  projectId: Types.ObjectId;
  hoursWorked: number;
  activityTags: string[];
}

export interface ITimesheet extends Document {
  employeeId: Types.ObjectId;
  weekStart: Date;
  status: 'SUBMITTED' | 'MISSED';
  totalHours: number;
  submittedAt: Date | null;
  entries: ITimesheetEntry[];
  createdAt: Date;
}

const TimesheetEntrySchema = new Schema<ITimesheetEntry>({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  hoursWorked: { type: Number, required: true, min: 0 },
  activityTags: [{ type: String, trim: true }]
}, { _id: false });

const TimesheetSchema = new Schema<ITimesheet>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  weekStart: { type: Date, required: true },
  status: { type: String, enum: ['SUBMITTED', 'MISSED'], default: 'SUBMITTED' },
  totalHours: { type: Number, required: true, default: 0 },
  submittedAt: { type: Date, default: null },
  entries: [TimesheetEntrySchema]
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'timesheets'
});

// Compound unique index for employee and weekStart
TimesheetSchema.index({ employeeId: 1, weekStart: 1 }, { unique: true });

export const Timesheet = mongoose.model<ITimesheet>('Timesheet', TimesheetSchema);
