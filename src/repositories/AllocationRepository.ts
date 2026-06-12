import { BaseRepository } from './BaseRepository.js';
import { Allocation, IAllocation } from '../models/Allocation.js';

export class AllocationRepository extends BaseRepository<IAllocation> {
  constructor() {
    super(Allocation);
  }

  async findActiveAllocationsForResource(resourceId: string): Promise<IAllocation[]> {
    return this.findAll({ resourceId, status: 'ACTIVE' });
  }

  async findOverlappingAllocations(resourceId: string, fromDate: Date, toDate: Date): Promise<IAllocation[]> {
    return this.findAll({
      resourceId,
      status: 'ACTIVE',
      fromDate: { $lte: toDate },
      toDate: { $gte: fromDate }
    });
  }

  async findAllWithDetails(filter: Record<string, unknown> = {}): Promise<IAllocation[]> {
    return this.model
      .find(filter)
      .populate({
        path: 'resourceId',
        populate: {
          path: 'userId',
          select: 'fullName email'
        }
      })
      .populate('projectId', 'name')
      .exec();
  }
}

export const allocationRepository = new AllocationRepository();
