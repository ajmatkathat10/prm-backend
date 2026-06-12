import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import authRoutes from './routes/auth.js';
import resourceRoutes from './routes/resources.js';
import projectRoutes from './routes/projects.js';
import allocationRoutes from './routes/allocations.js';
import userRoutes from './routes/users.js';
import settingsRoutes from './routes/settings.js';
import timesheetRoutes from './routes/timesheets.js';
import aiRoutes from './routes/ai.js';
import { SERVER_MESSAGES } from './constants/index.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerDocument = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'swagger.json'), 'utf8')
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api/auth', authRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/ai', aiRoutes);

import { Worker } from 'worker_threads';

app.get('/', (_req, res) => {
  res.json({ message: SERVER_MESSAGES.ACTIVE, status: SERVER_MESSAGES.STATUS_OK });
});

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
    app.listen(env.port, () => {
      console.log(SERVER_MESSAGES.RUNNING(env.port));
    });

    const workerPath = __filename.endsWith('.ts')
      ? path.join(__dirname, 'schedulerWorker.ts')
      : path.join(__dirname, 'schedulerWorker.js');

    const worker = new Worker(workerPath);
    worker.on('error', (err) => {
      console.error('[SchedulerWorker] Error:', err);
    });
    worker.on('exit', (code) => {
      console.log(`[SchedulerWorker] Exit code: ${code}`);
    });
  } catch (error) {
    console.error(SERVER_MESSAGES.START_FAILED, error);
    process.exit(1);
  }
}

bootstrap();
