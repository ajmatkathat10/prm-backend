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
