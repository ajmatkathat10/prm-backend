/**
 * UserRepository.ts — Data access layer for the User entity
 *
 * PATTERN (Repository Pattern): All MongoDB queries for the `users` collection
 * live here. Services never touch the Mongoose model directly — they call this
 * repository. This decouples the business logic from the database driver.
 *
 * SOLID (L — Liskov Substitution): UserRepository extends BaseRepository<IUser>
 * and can be used anywhere a BaseRepository<IUser> is expected.
 *
 * SOLID (O — Open/Closed): The BaseRepository provides common CRUD. Here we
 * ADD domain-specific methods (findByUsernameOrEmail) without modifying the
 * base class.
 */

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
