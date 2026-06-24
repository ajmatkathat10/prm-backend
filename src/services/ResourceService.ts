import { resourceRepository as resRepo } from '../repositories/ResourceRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import { skillRepository } from '../repositories/SkillRepository.js';
import { allocationRepository } from '../repositories/AllocationRepository.js';
import { IResource } from '../models/Resource.js';
import { Timesheet } from '../models/Timesheet.js';
import { AuthError } from './AuthService.js';
import mongoose from 'mongoose';
import { RESOURCE_ERRORS } from '../constants/index.js';

export function serializeResource(resource: IResource): Record<string, unknown> {
  const user = resource.userId as unknown as { _id?: string; fullName?: string; email?: string };
  return {
    _id: resource._id,
    userId: user?._id || resource.userId,
    fullName: user?.fullName || '',
    email: user?.email || '',
    designation: resource.designation,
    status: resource.status,
    isActive: resource.isActive,
    timesheetAccessFrozen: resource.timesheetAccessFrozen,
    skills: resource.skills,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
    managerId: resource.managerId
  };
}

export class ResourceService {
  constructor(
    private readonly resourceRepo: typeof resRepo,
    private readonly userRepo: typeof userRepository,
    private readonly skillRepo: typeof skillRepository,
    private readonly allocationRepo: typeof allocationRepository
  ) { }

  async getAllResources(filters: { status?: string; managerId?: string }): Promise<Record<string, unknown>[]> {
    const query: Record<string, unknown> = {};
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.managerId) {
      query.managerId = filters.managerId;
    }
    const list = await this.resourceRepo.findAll(query);
    return list.map(serializeResource);
  }
  async getResourceById(id: string): Promise<Record<string, unknown> | null> {
    const resource = await this.resourceRepo.findById(id);
    return resource ? serializeResource(resource) : null;
  }

  async getResourceByUserId(userId: string): Promise<Record<string, unknown> | null> {
    const resource = await this.resourceRepo.findByUserId(userId);
    return resource ? serializeResource(resource) : null;
  }

  async deactivateResource(resourceId: string, requestingUserId?: string): Promise<Record<string, unknown>> {
    const resource = await this.resourceRepo.findById(resourceId);
    if (!resource) {
      throw new AuthError(RESOURCE_ERRORS.NOT_FOUND, 404);
    }

    const linkedUserId = (resource.userId as unknown as { _id?: mongoose.Types.ObjectId })._id?.toString() || resource.userId.toString();
    if (requestingUserId && linkedUserId === requestingUserId) {
      throw new AuthError(RESOURCE_ERRORS.DEACTIVATE_SELF, 400);
    }

    const updatedResource = await this.resourceRepo.updateById(resourceId, {
      isActive: false,
      status: 'INACTIVE',
    });

    if (resource.userId) {
      await this.userRepo.deactivate(linkedUserId);
    }

    const activeAllocations = await this.allocationRepo.findActiveAllocationsForResource(resourceId);
    const today = new Date();
    for (const alloc of activeAllocations) {
      await this.allocationRepo.updateById(alloc._id.toString(), {
        status: 'ENDED',
        toDate: today,
      });
    }

    return serializeResource(updatedResource!);
  }

  async addResourceSkill(
    resourceId: string,
    skillName: string,
    category: 'BACKEND' | 'FRONTEND' | 'DEVOPS' | 'QA' | 'OTHER',
    proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  ): Promise<Record<string, unknown>> {
    if (!skillName || !category || !proficiency) {
      throw new AuthError(RESOURCE_ERRORS.SKILL_REQUIRED_FIELDS, 400);
    }

    const resource = await this.resourceRepo.findById(resourceId);
    if (!resource) {
      throw new AuthError(RESOURCE_ERRORS.NOT_FOUND, 404);
    }

    let skill = await this.skillRepo.findByName(skillName);
    if (!skill) {
      skill = await this.skillRepo.create({
        name: skillName.trim(),
        category,
      });
    }

    const skillExists = resource.skills.some(
      (s) => {
        const sId = (s.skillId as unknown as { _id?: mongoose.Types.ObjectId })._id?.toString() || s.skillId.toString();
        return sId === skill!._id.toString();
      }
    );
    if (skillExists) {
      throw new AuthError(RESOURCE_ERRORS.SKILL_EXISTS, 400);
    }

    resource.skills.push({
      skillId: skill._id as mongoose.Types.ObjectId,
      proficiency,
      addedAt: new Date(),
    });

    const updatedResource = await this.resourceRepo.updateById(resourceId, {
      skills: resource.skills,
    });

    return serializeResource(updatedResource!);
  }

  async updateResourceSkill(
    resourceId: string,
    skillId: string,
    proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  ): Promise<Record<string, unknown>> {
    const resource = await this.resourceRepo.findById(resourceId);
    if (!resource) {
      throw new AuthError(RESOURCE_ERRORS.NOT_FOUND, 404);
    }

    const skillIndex = resource.skills.findIndex(
      (s) => {
        const sId = (s.skillId as unknown as { _id?: mongoose.Types.ObjectId })._id?.toString() || s.skillId.toString();
        return sId === skillId;
      }
    );
    if (skillIndex === -1) {
      throw new AuthError(RESOURCE_ERRORS.SKILL_NOT_FOUND, 404);
    }

    resource.skills[skillIndex].proficiency = proficiency;

    const updatedResource = await this.resourceRepo.updateById(resourceId, {
      skills: resource.skills,
    });

    return serializeResource(updatedResource!);
  }

  async removeResourceSkill(resourceId: string, skillId: string): Promise<Record<string, unknown>> {
    const resource = await this.resourceRepo.findById(resourceId);
    if (!resource) {
      throw new AuthError(RESOURCE_ERRORS.NOT_FOUND, 404);
    }

    const initialLength = resource.skills.length;
    resource.skills = resource.skills.filter((s) => {
      const sId = (s.skillId as unknown as { _id?: mongoose.Types.ObjectId })._id?.toString() || s.skillId.toString();
      return sId !== skillId;
    });

    if (resource.skills.length === initialLength) {
      throw new AuthError(RESOURCE_ERRORS.SKILL_NOT_FOUND, 404);
    }

    const updatedResource = await this.resourceRepo.updateById(resourceId, {
      skills: resource.skills,
    });

    return serializeResource(updatedResource!);
  }

  async assignManager(resourceUserId: string, managerUserId: string): Promise<Record<string, unknown>> {
    if (!resourceUserId || !managerUserId) {
      throw new AuthError(RESOURCE_ERRORS.ASSIGN_REQUIRED_FIELDS, 400);
    }

    const managerUser = await this.userRepo.findById(managerUserId);
    if (!managerUser) {
      throw new AuthError(RESOURCE_ERRORS.MANAGER_NOT_FOUND, 404);
    }
    if (managerUser.role !== 'MANAGER') {
      throw new AuthError(RESOURCE_ERRORS.INVALID_MANAGER_ROLE, 400);
    }

    let resource = await this.resourceRepo.findByUserId(resourceUserId);
    if (!resource) {
      resource = await this.resourceRepo.findById(resourceUserId);
    }

    if (!resource) {
      throw new AuthError(RESOURCE_ERRORS.PROFILE_NOT_FOUND, 404);
    }

    const updatedResource = await this.resourceRepo.updateById(resource._id.toString(), {
      managerId: managerUser._id,
    });

    return serializeResource(updatedResource!);
  }

  async restoreTimesheetAccess(resourceId: string): Promise<Record<string, unknown>> {
    const resource = await this.resourceRepo.findById(resourceId);
    if (!resource) {
      throw new AuthError(RESOURCE_ERRORS.NOT_FOUND, 404);
    }

    await this.resourceRepo.updateById(resourceId, {
      timesheetAccessFrozen: false
    });

    await Timesheet.updateMany(
      { resourceId: resource._id, status: 'MISSED' },
      { $set: { reminderSentCount: 0, lastReminderSentAt: null } }
    );

    const updated = await this.resourceRepo.findById(resourceId);
    return serializeResource(updated!);
  }
}

export const resourceService = new ResourceService(
  resRepo,
  userRepository,
  skillRepository,
  allocationRepository
);
