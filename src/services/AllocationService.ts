import { AllocationRepository, allocationRepository } from '../repositories/AllocationRepository.js';
import { IAllocation } from '../models/Allocation.js';

export class AllocationService {
  constructor(private readonly allocationRepo: AllocationRepository) {}

  async getAllAllocations(filters: { employeeId?: string; projectId?: string }): Promise<IAllocation[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};
    if (filters.employeeId) {
      query.employeeId = filters.employeeId;
    }
    if (filters.projectId) {
      query.projectId = filters.projectId;
    }
    return this.allocationRepo.findAllWithDetails(query);
  }
}

export const allocationService = new AllocationService(allocationRepository);
