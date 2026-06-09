import { BaseRepository, MongoFilter, MongoUpdate } from './BaseRepository.js';
import { Employee, IEmployee } from '../models/Employee.js';

export class EmployeeRepository extends BaseRepository<IEmployee> {
  constructor() {
    super(Employee);
  }

  override async findById(id: string): Promise<IEmployee | null> {
    return this.model.findById(id).populate('skills.skillId').exec();
  }

  override async findOne(filter: MongoFilter): Promise<IEmployee | null> {
    return this.model.findOne(filter).populate('skills.skillId').exec();
  }

  override async findAll(filter: MongoFilter = {}): Promise<IEmployee[]> {
    return this.model.find(filter).populate('skills.skillId').exec();
  }

  override async updateById(id: string, data: MongoUpdate): Promise<IEmployee | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).populate('skills.skillId').exec();
  }

  async findByUserId(userId: string): Promise<IEmployee | null> {
    return this.findOne({ userId });
  }

  async findByEmail(email: string): Promise<IEmployee | null> {
    return this.findOne({ email: email.toLowerCase() });
  }
}

export const employeeRepository = new EmployeeRepository();
