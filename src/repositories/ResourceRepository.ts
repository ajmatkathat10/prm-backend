import { BaseRepository, MongoFilter, MongoUpdate } from './BaseRepository.js';
import { Resource, IResource } from '../models/Resource.js';

export class ResourceRepository extends BaseRepository<IResource> {
  constructor() {
    super(Resource);
  }

  override async findById(id: string): Promise<IResource | null> {
    return this.model.findById(id)
      .populate('skills.skillId')
      .populate('userId', 'fullName email username role')
      .exec();
  }

  override async findOne(filter: MongoFilter): Promise<IResource | null> {
    return this.model.findOne(filter)
      .populate('skills.skillId')
      .populate('userId', 'fullName email username role')
      .exec();
  }

  override async findAll(filter: MongoFilter = {}): Promise<IResource[]> {
    return this.model.find(filter)
      .populate('skills.skillId')
      .populate('userId', 'fullName email username role')
      .exec();
  }

  override async updateById(id: string, data: MongoUpdate): Promise<IResource | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true })
      .populate('skills.skillId')
      .populate('userId', 'fullName email username role')
      .exec();
  }

  async findByUserId(userId: string): Promise<IResource | null> {
    return this.findOne({ userId });
  }
}

export const resourceRepository = new ResourceRepository();
