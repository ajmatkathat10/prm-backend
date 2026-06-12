import { AllocationRepository, allocationRepository } from '../repositories/AllocationRepository.js';
import { resourceRepository } from '../repositories/ResourceRepository.js';
import { projectRepository } from '../repositories/ProjectRepository.js';
import { IAllocation } from '../models/Allocation.js';
import { AuthError } from './AuthService.js';

export class AllocationService {
  constructor(
    private readonly allocationRepo: AllocationRepository,
    private readonly resourceRepo: typeof resourceRepository,
    private readonly projectRepo: typeof projectRepository
  ) {}

  async getAllAllocations(filters: { resourceId?: string; projectId?: string; managerId?: string }): Promise<IAllocation[]> {
    const query: Record<string, unknown> = {};

    if (filters.resourceId) {
      query.resourceId = filters.resourceId;
    }

    if (filters.projectId) {
      query.projectId = filters.projectId;
    }

    if (filters.managerId) {
      const managedResources = await this.resourceRepo.findAll({ managerId: filters.managerId });
      const managedResourceIds = managedResources.map((r) => r._id);

      const managedProjects = await this.projectRepo.findAll({ managerId: filters.managerId });
      const managedProjectIds = managedProjects.map((p) => p._id);

      query.$or = [
        { resourceId: { $in: managedResourceIds } },
        { projectId: { $in: managedProjectIds } }
      ];
    }

    return this.allocationRepo.findAllWithDetails(query);
  }

  async createAllocation(
    data: { resourceId: string; projectId: string; utilisationPercent: number; fromDate: string; toDate: string },
    managerUserId: string,
    isManager: boolean
  ): Promise<IAllocation> {
    const resource = await this.resourceRepo.findById(data.resourceId);
    if (!resource) {
      throw new AuthError('Resource profile not found', 404);
    }

    const project = await this.projectRepo.findById(data.projectId);
    if (!project) {
      throw new AuthError('Project not found', 404);
    }

    if (isManager) {
      const pmId = project.managerId as unknown as { _id?: import('mongoose').Types.ObjectId };
      const pmIdStr = pmId && typeof pmId === 'object' && '_id' in pmId ? pmId._id?.toString() : project.managerId.toString();
      if (project.managerId.toString() !== managerUserId && pmIdStr !== managerUserId) {
        throw new AuthError('You can only allocate resources to projects assigned to you', 403);
      }
      if (resource.managerId?.toString() !== managerUserId) {
        throw new AuthError('You can only allocate resources belonging to your team', 403);
      }
    }

    const from = new Date(data.fromDate);
    const to = new Date(data.toDate);
    if (from >= to) {
      throw new AuthError('Allocation start date must be before end date', 400);
    }

    if (project.status !== 'ACTIVE' && project.status !== 'PLANNED') {
      throw new AuthError('Resource allocations are only allowed on ACTIVE or PLANNED projects', 400);
    }

    const overlaps = await this.allocationRepo.findOverlappingAllocations(data.resourceId, from, to);
    const totalUtil = overlaps.reduce((sum, a) => sum + a.utilisationPercent, 0);

    if (totalUtil + data.utilisationPercent > 100) {
      throw new AuthError(`Allocation violates capacity: Resource total allocation in this period would be ${totalUtil + data.utilisationPercent}% (max 100%)`, 400);
    }

    const newAllocation = await this.allocationRepo.create({
      resourceId: data.resourceId as unknown as import('mongoose').Types.ObjectId,
      projectId: data.projectId as unknown as import('mongoose').Types.ObjectId,
      utilisationPercent: data.utilisationPercent,
      fromDate: from,
      toDate: to,
      status: 'ACTIVE'
    });

    await this.recomputeResourceStatus(data.resourceId);

    return this.allocationRepo.findById(newAllocation._id.toString()) as Promise<IAllocation>;
  }

  async endAllocation(id: string, managerUserId: string, isManager: boolean): Promise<IAllocation> {
    const allocation = await this.allocationRepo.findById(id);
    if (!allocation) {
      throw new AuthError('Allocation record not found', 404);
    }

    const projectIdStr = allocation.projectId._id
      ? allocation.projectId._id.toString()
      : allocation.projectId.toString();

    const project = await this.projectRepo.findById(projectIdStr);
    if (!project) {
      throw new AuthError('Project associated with this allocation not found', 404);
    }

    if (isManager) {
      const pManagerId = project.managerId._id
        ? project.managerId._id.toString()
        : project.managerId.toString();

      if (pManagerId !== managerUserId) {
        throw new AuthError('Only the manager owning the project is authorized to end allocations on it', 403);
      }
    }

    const updated = await this.allocationRepo.updateById(id, {
      status: 'ENDED',
      toDate: new Date()
    });

    const resourceIdStr = allocation.resourceId._id
      ? allocation.resourceId._id.toString()
      : allocation.resourceId.toString();

    await this.recomputeResourceStatus(resourceIdStr);

    return this.allocationRepo.findById(updated!._id.toString()) as Promise<IAllocation>;
  }

  private async recomputeResourceStatus(resourceId: string): Promise<void> {
    const activeAllocations = await this.allocationRepo.findAll({
      resourceId,
      status: 'ACTIVE',
    });

    const newStatus = activeAllocations.length > 0 ? 'ALLOCATED' : 'BENCH';

    await this.resourceRepo.updateById(resourceId, { status: newStatus });
  }
}

export const allocationService = new AllocationService(
  allocationRepository,
  resourceRepository,
  projectRepository
);
