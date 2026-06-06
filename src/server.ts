/**
 * server.ts — Application bootstrap entry point
 *
 * SOLID (S — Single Responsibility): This file's only job is to
 * compose the application — register middleware, mount routes, and start
 * the HTTP server. Database connection is handled by `config/database.ts`.
 *
 * PRINCIPLE (Separation of Concerns): Server setup (HTTP) is separated
 * from database management, configuration reading, and business logic.
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import { SERVER_MESSAGES } from './constants/index.js';

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);

app.get('/', (_req, res) => {
  res.json({ message: SERVER_MESSAGES.ACTIVE, status: SERVER_MESSAGES.STATUS_OK });
});

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
    app.listen(env.port, () => {
      console.log(SERVER_MESSAGES.RUNNING(env.port));
    });
  } catch (error) {
    console.error(SERVER_MESSAGES.START_FAILED, error);
    process.exit(1);
  }
}

bootstrap();
