import { BaseRepository } from './BaseRepository.js';
import { Project, IProject } from '../models/Project.js';

export class ProjectRepository extends BaseRepository<IProject> {
  constructor() {
    super(Project);
  }

  async findAllWithManager(): Promise<IProject[]> {
    return this.model.find().populate('managerId', 'username email').exec();
  }

  async findByIdWithManager(id: string): Promise<IProject | null> {
    return this.model.findById(id).populate('managerId', 'username email').exec();
  }
}

export const projectRepository = new ProjectRepository();
