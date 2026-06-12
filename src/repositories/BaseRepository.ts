import { Document, Model } from 'mongoose';

export type MongoFilter = Record<string, unknown>;
export type MongoUpdate = Record<string, unknown>;

export interface IReadRepository<T> {
  findById(id: string): Promise<T | null>;
  findOne(filter: MongoFilter): Promise<T | null>;
  findAll(filter?: MongoFilter): Promise<T[]>;
}

export interface IWriteRepository<T> {
  create(data: Partial<T>): Promise<T>;
  updateById(id: string, data: MongoUpdate): Promise<T | null>;
  deleteById(id: string): Promise<boolean>;
}

export interface IRepository<T> extends IReadRepository<T>, IWriteRepository<T> { }

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
    return this.model.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
