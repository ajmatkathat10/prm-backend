import { AllocationRepository, allocationRepository } from '../repositories/AllocationRepository.js';
import { IAllocation } from '../models/Allocation.js';

export class AllocationService {
  constructor(private readonly allocationRepo: AllocationRepository) {}

  async getAllAllocations(filters: { resourceId?: string; projectId?: string }): Promise<IAllocation[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};
    if (filters.resourceId) {
      query.resourceId = filters.resourceId;
    }
    if (filters.projectId) {
      query.projectId = filters.projectId;
    }
    return this.allocationRepo.findAllWithDetails(query);
  }
}

export const allocationService = new AllocationService(allocationRepository);
