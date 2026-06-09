import { BaseRepository } from './BaseRepository.js';
import { Allocation, IAllocation } from '../models/Allocation.js';

export class AllocationRepository extends BaseRepository<IAllocation> {
  constructor() {
    super(Allocation);
  }

  async findActiveAllocationsForEmployee(employeeId: string): Promise<IAllocation[]> {
    return this.findAll({ employeeId, status: 'ACTIVE' });
  }

  async findOverlappingAllocations(employeeId: string, fromDate: Date, toDate: Date): Promise<IAllocation[]> {
    return this.findAll({
      employeeId,
      status: 'ACTIVE',
      fromDate: { $lte: toDate },
      toDate: { $gte: fromDate }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async findAllWithDetails(filter: Record<string, any> = {}): Promise<IAllocation[]> {
    return this.model
      .find(filter)
      .populate('employeeId', 'fullName department')
      .populate('projectId', 'name')
      .exec();
  }
}

export const allocationRepository = new AllocationRepository();
