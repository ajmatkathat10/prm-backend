import { BaseRepository, MongoFilter, MongoUpdate } from './BaseRepository.js';
import { Timesheet, ITimesheet } from '../models/Timesheet.js';

export class TimesheetRepository extends BaseRepository<ITimesheet> {
  constructor() {
    super(Timesheet);
  }

  override async findById(id: string): Promise<ITimesheet | null> {
    return this.model.findById(id)
      .populate({
        path: 'resourceId',
        populate: { path: 'userId', select: 'fullName email' }
      })
      .populate('entries.projectId', 'name')
      .exec();
  }

  override async findOne(filter: MongoFilter): Promise<ITimesheet | null> {
    return this.model.findOne(filter)
      .populate({
        path: 'resourceId',
        populate: { path: 'userId', select: 'fullName email' }
      })
      .populate('entries.projectId', 'name')
      .exec();
  }

  override async findAll(filter: MongoFilter = {}): Promise<ITimesheet[]> {
    return this.model.find(filter)
      .populate({
        path: 'resourceId',
        populate: { path: 'userId', select: 'fullName email' }
      })
      .populate('entries.projectId', 'name')
      .exec();
  }

  override async updateById(id: string, data: MongoUpdate): Promise<ITimesheet | null> {
    return this.model.findByIdAndUpdate(id, data, { returnDocument: 'after' })
      .populate({
        path: 'resourceId',
        populate: { path: 'userId', select: 'fullName email' }
      })
      .populate('entries.projectId', 'name')
      .exec();
  }
}

export const timesheetRepository = new TimesheetRepository();
