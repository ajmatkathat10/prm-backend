/**
 * BaseRepository.ts — Generic repository interfaces and abstract base class
 *
 * PATTERN (Repository Pattern): This file defines the contracts that every
 * domain repository must fulfill. Separates data access logic from business
 * logic in services.
 *
 * SOLID (I — Interface Segregation): Split into `IReadRepository` and
 * `IWriteRepository` so that read-only use cases can depend only on
 * IReadRepository without being forced to implement write methods.
 *
 * SOLID (D — Dependency Inversion): Services depend on these INTERFACES
 * (abstractions), not on Mongoose model implementations (concrete details).
 * This means you could swap out MongoDB for another store without touching
 * service code.
 *
 * SOLID (O — Open/Closed): New repositories extend BaseRepository without
 * modifying it. Adding a new entity means adding a new subclass, not editing
 * existing code.
 */

import { Document, Model } from 'mongoose';

// Generic filter type — Mongoose accepts a plain object for queries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MongoFilter = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MongoUpdate = Record<string, any>;

// Read Interface

export interface IReadRepository<T> {
  findById(id: string): Promise<T | null>;
  findOne(filter: MongoFilter): Promise<T | null>;
  findAll(filter?: MongoFilter): Promise<T[]>;
}

// Write Interface 

export interface IWriteRepository<T> {
  create(data: Partial<T>): Promise<T>;
  updateById(id: string, data: MongoUpdate): Promise<T | null>;
  deleteById(id: string): Promise<boolean>;
}

// Combined Repository Interface 

export interface IRepository<T> extends IReadRepository<T>, IWriteRepository<T> { }

// Abstract Base Implementation 

export abstract class BaseRepository<T extends Document> implements IRepository<T> {
  constructor(protected readonly model: Model<T>) { }

  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  async findOne(filter: MongoFilter): Promise<T | null> {
    return this.model.findOne(filter).exec();
  }

  async findAll(filter: MongoFilter = {}): Promise<T[]> {
    return this.model.find(filter).exec();
  }

  async create(data: Partial<T>): Promise<T> {
    return this.model.create(data);
  }

  async updateById(id: string, data: MongoUpdate): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
