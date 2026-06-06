/**
 * database.ts — Database connection module
 *
 * PRINCIPLE (Separation of Concerns): MongoDB connection logic is extracted
 * from server.ts. The server file should only be responsible for bootstrapping
 * the HTTP layer — not for managing database connectivity.
 *
 * SOLID (S — Single Responsibility): This module has exactly one job:
 * connect to and disconnect from the database.
 */

import mongoose from 'mongoose';
import { env } from './env.js';
import { DATABASE_MESSAGES } from '../constants/index.js';

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(env.mongodbUri);
  console.log(DATABASE_MESSAGES.CONNECTED);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log(DATABASE_MESSAGES.DISCONNECTED);
}
