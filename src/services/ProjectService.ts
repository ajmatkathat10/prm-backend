import { ProjectRepository, projectRepository } from '../repositories/ProjectRepository.js';
import { userRepository } from '../repositories/UserRepository.js';
import { IProject } from '../models/Project.js';
import { AuthError } from './AuthService.js';

export class ProjectService {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly userRepo: typeof userRepository
  ) {}

  async createProject(data: Partial<IProject>): Promise<IProject> {
    const { name, startDate, endDate, managerId, totalStoryPoints } = data;

    if (!name || !startDate || !endDate || !managerId) {
      throw new AuthError('Project name, start date, end date, and manager are required', 400);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      throw new AuthError('Start date must be before end date', 400);
    }

    const managerUser = await this.userRepo.findById(managerId.toString());
    if (!managerUser) {
      throw new AuthError('Assigned manager user not found', 404);
    }
    if (managerUser.role !== 'MANAGER') {
      throw new AuthError('Assigned user must have the MANAGER role', 400);
    }

    return this.projectRepo.create({
      name: name.trim(),
      description: data.description || '',
      startDate: start,
      endDate: end,
      status: data.status || 'PLANNED',
      managerId: managerUser._id,
      totalStoryPoints: totalStoryPoints || 0,
      healthFlag: 'ON_TRACK',
      milestones: [],
    });
  }

  async getAllProjects(): Promise<IProject[]> {
    return this.projectRepo.findAllWithManager();
  }

  async getProjectById(projectId: string): Promise<IProject | null> {
    return this.projectRepo.findByIdWithManager(projectId);
  }

  async updateProject(projectId: string, data: Partial<IProject>): Promise<IProject> {
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new AuthError('Project not found', 404);
    }

    const updatePayload: Record<string, unknown> = {};

    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.totalStoryPoints !== undefined) updatePayload.totalStoryPoints = data.totalStoryPoints;

    const start = data.startDate ? new Date(data.startDate) : project.startDate;
    const end = data.endDate ? new Date(data.endDate) : project.endDate;
    if (data.startDate || data.endDate) {
      if (start >= end) {
        throw new AuthError('Start date must be before end date', 400);
      }
      if (data.startDate) updatePayload.startDate = start;
      if (data.endDate) updatePayload.endDate = end;
    }

    if (data.managerId) {
      const managerUser = await this.userRepo.findById(data.managerId.toString());
      if (!managerUser) {
        throw new AuthError('Assigned manager user not found', 404);
      }
      if (managerUser.role !== 'MANAGER') {
        throw new AuthError('Assigned user must have the MANAGER role', 400);
      }
      updatePayload.managerId = managerUser._id;
    }

    const updated = await this.projectRepo.updateById(projectId, updatePayload);
    return updated!;
  }

  async addMilestone(
    projectId: string,
    title: string,
    dueDate: Date,
    storyPoints: number
  ): Promise<IProject> {
    if (!title || !dueDate) {
      throw new AuthError('Milestone title and due date are required', 400);
    }

    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new AuthError('Project not found', 404);
    }

    const milestoneDue = new Date(dueDate);
    if (milestoneDue < project.startDate || milestoneDue > project.endDate) {
      throw new AuthError('Milestone due date must fall within the project duration', 400);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newMilestone: any = {
      title: title.trim(),
      dueDate: milestoneDue,
      storyPoints: storyPoints || 0,
      status: 'NOT_STARTED',
    };
    project.milestones.push(newMilestone);

    const updated = await this.projectRepo.updateById(projectId, {
      milestones: project.milestones,
    });

    return updated!;
  }

  async updateMilestoneStatus(
    projectId: string,
    milestoneId: string,
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'
  ): Promise<IProject> {
    if (!status) {
      throw new AuthError('Milestone status is required', 400);
    }

    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new AuthError('Project not found', 404);
    }

    const milestoneIndex = project.milestones.findIndex(
      (m) => (m as unknown as { _id?: { toString: () => string } })._id?.toString() === milestoneId
    );
    if (milestoneIndex === -1) {
      throw new AuthError('Milestone not found', 404);
    }

    project.milestones[milestoneIndex].status = status;

    const updated = await this.projectRepo.updateById(projectId, {
      milestones: project.milestones,
    });

    return updated!;
  }
}

export const projectService = new ProjectService(projectRepository, userRepository);
