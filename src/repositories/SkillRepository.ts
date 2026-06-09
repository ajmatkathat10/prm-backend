import { BaseRepository } from './BaseRepository.js';
import { Skill, ISkill } from '../models/Skill.js';

export class SkillRepository extends BaseRepository<ISkill> {
  constructor() {
    super(Skill);
  }

  async findByName(name: string): Promise<ISkill | null> {
    return this.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
  }
}

export const skillRepository = new SkillRepository();
