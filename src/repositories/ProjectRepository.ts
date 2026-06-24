import { BaseRepository } from './BaseRepository.js';
import { Project, IProject } from '../models/Project.js';

export class ProjectRepository extends BaseRepository<IProject> {
  constructor() {
    super(Project);
  }

  async findAllWithManager(filter: Record<string, unknown> = {}): Promise<IProject[]> {
    return this.model.find(filter).populate('managerId', 'username email').exec();
  }

  async findByIdWithManager(id: string): Promise<IProject | null> {
    return this.model.findById(id).populate('managerId', 'username email').exec();
  }
}

export const projectRepository = new ProjectRepository();
