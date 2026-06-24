export const COMMON_ERRORS = {
  UNEXPECTED: 'An unexpected error occurred',
} as const;

export const USER_ERRORS = {
  MANDATORY_FIELDS: 'All fields are mandatory',
  DESIGNATION_REQUIRED: 'Designation is required for resource users',
  USERNAME_TAKEN: 'Username is already taken',
  EMAIL_IN_USE: 'Email is already in use',
  NOT_FOUND: 'User not found',
  DEACTIVATE_SELF: 'An administrator cannot deactivate their own account',
  INVALID_EMAIL: 'Invalid email format',
} as const;

export const PROJECT_ERRORS = {
  REQUIRED_FIELDS: 'Project name, start date, end date, and manager are required',
  DATE_ORDER: 'Start date must be before end date',
  MANAGER_NOT_FOUND: 'Assigned manager user not found',
  INVALID_MANAGER_ROLE: 'Assigned user must have the MANAGER role',
  NOT_FOUND: 'Project not found',
  MILESTONE_REQUIRED_FIELDS: 'Milestone title and due date are required',
  MILESTONE_DATE_RANGE: 'Milestone due date must fall within the project duration',
  MILESTONE_STATUS_REQUIRED: 'Milestone status is required',
  MILESTONE_NOT_FOUND: 'Milestone not found',
  MILESTONE_STORY_POINTS_EXCEEDED: 'Total milestone story points cannot exceed the project total story points',
} as const;

export const RESOURCE_ERRORS = {
  NOT_FOUND: 'Resource not found',
  DEACTIVATE_SELF: 'An administrator cannot deactivate their own profile',
  SKILL_REQUIRED_FIELDS: 'Skill name, category, and proficiency are required',
  SKILL_EXISTS: 'Resource already has this skill configured',
  SKILL_NOT_FOUND: 'Skill not found on this resource profile',
  ASSIGN_REQUIRED_FIELDS: 'Resource User ID and Manager User ID are required',
  MANAGER_NOT_FOUND: 'Manager user account not found',
  INVALID_MANAGER_ROLE: 'The assigned manager user must have the MANAGER role',
  PROFILE_NOT_FOUND: 'Resource profile not found',
} as const;

export const CONFIG_ERRORS = {
  NOT_FOUND: 'System configuration not found',
  SCHEDULER_INTERVAL_MIN: 'Scheduler interval must be at least 1 hour',
  MAX_HOURS_MIN: 'Maximum weekly hours must be at least 1 hour',
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

export const PROFICIENCY_RANK: Record<string, number> = {
  'BEGINNER': 1,
  'INTERMEDIATE': 2,
  'ADVANCED': 3
} as const;
