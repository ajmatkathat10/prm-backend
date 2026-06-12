import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITimesheetEntry {
  projectId: Types.ObjectId;
  hoursWorked: number;
  activityTags: string[];
}

export interface ITimesheet extends Document {
  resourceId: Types.ObjectId;
  weekStart: Date;
  status: 'SUBMITTED' | 'MISSED';
  totalHours: number;
  submittedAt: Date | null;
  entries: ITimesheetEntry[];
  reminderSentCount: number;
  lastReminderSentAt: Date | null;
  createdAt: Date;
}

const TimesheetEntrySchema = new Schema<ITimesheetEntry>({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  hoursWorked: { type: Number, required: true, min: 0 },
  activityTags: [{ type: String, trim: true }]
}, { _id: false });

const TimesheetSchema = new Schema<ITimesheet>({
  resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
  weekStart: { type: Date, required: true },
  status: { type: String, enum: ['SUBMITTED', 'MISSED'], default: 'SUBMITTED' },
  totalHours: { type: Number, required: true, default: 0 },
  submittedAt: { type: Date, default: null },
  entries: [TimesheetEntrySchema],
  reminderSentCount: { type: Number, default: 0 },
  lastReminderSentAt: { type: Date, default: null }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'timesheets'
});

TimesheetSchema.index({ resourceId: 1, weekStart: 1 }, { unique: true });

export const Timesheet = mongoose.model<ITimesheet>('Timesheet', TimesheetSchema);
