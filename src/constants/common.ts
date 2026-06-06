export const COMMON_ERRORS = {
  UNEXPECTED: 'An unexpected error occurred',
} as const;

export const SERVER_MESSAGES = {
  ACTIVE: 'PRM Backend Server is active',
  STATUS_OK: 'ok',
  RUNNING: (port: number | string) => `Server is running on http://localhost:${port}`,
  START_FAILED: 'Failed to start server:',
} as const;

export const DATABASE_MESSAGES = {
  CONNECTED: 'Connected to MongoDB database successfully.',
  DISCONNECTED: 'Disconnected from MongoDB database.',
} as const;

export const SEED_MESSAGES = {
  STARTING: 'Starting MongoDB database seeding...',
  CLEANING: 'Cleaning existing records...',
  SEEDING_CONFIG: 'Seeding system config...',
  SEEDING_SKILLS: 'Seeding skills catalog...',
  SEEDING_USERS: 'Seeding users...',
  SEEDING_EMPLOYEES: 'Seeding employee profiles...',
  SEEDING_PROJECTS: 'Seeding projects...',
  COMPLETED: 'Seeding completed successfully!',
  FAILED: 'Seeding failed with error:',
} as const;
