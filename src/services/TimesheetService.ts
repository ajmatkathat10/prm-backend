import { TimesheetRepository, timesheetRepository } from '../repositories/TimesheetRepository.js';
import { allocationRepository } from '../repositories/AllocationRepository.js';
import { resourceRepository } from '../repositories/ResourceRepository.js';
import { systemConfigRepository } from '../repositories/SystemConfigRepository.js';
import { ITimesheet, ITimesheetEntry } from '../models/Timesheet.js';
import { AuthError } from './AuthService.js';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export class TimesheetService {
  constructor(
    private readonly timesheetRepo: TimesheetRepository,
    private readonly allocationRepo: typeof allocationRepository,
    private readonly resourceRepo: typeof resourceRepository,
    private readonly systemConfigRepo: typeof systemConfigRepository
  ) {}

  async createTimesheet(resourceId: string, weekStart: Date, entries: ITimesheetEntry[]): Promise<ITimesheet> {
    const resource = await this.resourceRepo.findById(resourceId);
    if (!resource) {
      throw new AuthError('Resource profile not found', 404);
    }
    if (resource.timesheetAccessFrozen) {
      throw new AuthError('Timesheet submission access is frozen. Please contact your reporting manager.', 400);
    }

    const startOfWeek = new Date(weekStart);
    startOfWeek.setHours(0, 0, 0, 0);

    const now = new Date();
    const currentMonday = getMonday(now);
    if (startOfWeek > currentMonday) {
      throw new AuthError('Cannot submit timesheets for future weeks', 400);
    }

    const existing = await this.timesheetRepo.findOne({ resourceId, weekStart: startOfWeek });
    if (existing && existing.status === 'SUBMITTED') {
      throw new AuthError('Timesheet for this week has already been submitted', 400);
    }

    const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
    endOfWeek.setHours(23, 59, 59, 999);

    const activeAllocations = await this.allocationRepo.findOverlappingAllocations(resourceId, startOfWeek, endOfWeek);
    const config = await this.systemConfigRepo.getConfig();
    const maxWeeklyHours = config?.maxWeeklyHours || 40;

    let totalHours = 0;
    for (const entry of entries) {
      const alloc = activeAllocations.find(
        (a) => a.projectId._id.toString() === entry.projectId.toString() ||
               a.projectId.toString() === entry.projectId.toString()
      );

      if (!alloc) {
        throw new AuthError('You are not allocated to one or more of the specified projects for this week', 400);
      }

      const maxProjectHours = (alloc.utilisationPercent / 100) * maxWeeklyHours;
      if (entry.hoursWorked > maxProjectHours) {
        throw new AuthError(`Hours worked on project exceed the allocated percentage limit (${maxProjectHours} hours max)`, 400);
      }

      totalHours += entry.hoursWorked;
    }

    if (totalHours > maxWeeklyHours) {
      throw new AuthError(`Total weekly hours exceed system limit of ${maxWeeklyHours} hours`, 400);
    }

    if (existing) {
      existing.status = 'SUBMITTED';
      existing.totalHours = totalHours;
      existing.submittedAt = new Date();
      existing.entries = entries;
      const saved = await existing.save();
      return this.timesheetRepo.findById(saved._id.toString()) as Promise<ITimesheet>;
    }

    const newTimesheet = await this.timesheetRepo.create({
      resourceId: resourceId as unknown as import('mongoose').Types.ObjectId,
      weekStart: startOfWeek,
      status: 'SUBMITTED',
      totalHours,
      submittedAt: new Date(),
      entries
    });

    return this.timesheetRepo.findById(newTimesheet._id.toString()) as Promise<ITimesheet>;
  }

  async getTimesheets(filters: { resourceId?: string; weekStart?: Date; managerId?: string }): Promise<ITimesheet[]> {
    const query: Record<string, unknown> = {};

    if (filters.resourceId) {
      query.resourceId = filters.resourceId;
    }

    if (filters.weekStart) {
      const startOfWeek = new Date(filters.weekStart);
      startOfWeek.setHours(0, 0, 0, 0);
      query.weekStart = startOfWeek;
    }

    if (filters.managerId) {
      const resources = await this.resourceRepo.findAll({ managerId: filters.managerId });
      const resourceIds = resources.map((r) => r._id);
      query.resourceId = { $in: resourceIds };
    }

    return this.timesheetRepo.findAll(query);
  }

  async getTimesheetById(id: string): Promise<ITimesheet | null> {
    return this.timesheetRepo.findById(id);
  }
}

export const timesheetService = new TimesheetService(
  timesheetRepository,
  allocationRepository,
  resourceRepository,
  systemConfigRepository
);
