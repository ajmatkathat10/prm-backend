import { BaseRepository } from './BaseRepository.js';
import { User, IUser } from '../models/User.js';

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  async findByUsernameOrEmail(identifier: string): Promise<IUser | null> {
    const lowered = identifier.toLowerCase();
    return this.findOne({ $or: [{ username: lowered }, { email: lowered }] });
  }

  async deactivate(userId: string): Promise<IUser | null> {
    return this.updateById(userId, { isActive: false });
  }

  async reactivate(userId: string): Promise<IUser | null> {
    return this.updateById(userId, { isActive: true });
  }
}

export const userRepository = new UserRepository();
