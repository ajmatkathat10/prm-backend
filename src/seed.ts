import { User, Skill, Employee, Project, SystemConfig, Allocation, Timesheet, ISkill } from './models/index.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { SEED_MESSAGES } from './constants/index.js';

async function main() {
  console.log(SEED_MESSAGES.STARTING);
  await connectDatabase();

  // 1. Clean existing records
  console.log(SEED_MESSAGES.CLEANING);
  await SystemConfig.deleteMany({});
  await Project.deleteMany({});
  await Employee.deleteMany({});
  await Skill.deleteMany({});
  await User.deleteMany({});
  await Allocation.deleteMany({});
  await Timesheet.deleteMany({});

  // 2. Seed System Config
  console.log(SEED_MESSAGES.SEEDING_CONFIG);
  await SystemConfig.create({
    id: 1,
    llmProvider: 'Gemini',
    llmApiKey: 'PLACEHOLDER_API_KEY_GOES_HERE',
    schedulerIntervalHours: 4,
    maxWeeklyHours: 40,
  });

  // 3. Seed Skills Master Catalog
  console.log(SEED_MESSAGES.SEEDING_SKILLS);
  const skillsData: { name: string; category: 'BACKEND' | 'FRONTEND' | 'DEVOPS' | 'QA' | 'OTHER' }[] = [
    // BACKEND
    { name: 'Java', category: 'BACKEND' },
    { name: 'Node.js', category: 'BACKEND' },
    { name: 'Python', category: 'BACKEND' },
    { name: 'Go', category: 'BACKEND' },
    { name: 'Spring Boot', category: 'BACKEND' },
    { name: 'Express.js', category: 'BACKEND' },
    // FRONTEND
    { name: 'React', category: 'FRONTEND' },
    { name: 'Next.js', category: 'FRONTEND' },
    { name: 'TypeScript', category: 'FRONTEND' },
    { name: 'Vue.js', category: 'FRONTEND' },
    { name: 'Tailwind CSS', category: 'FRONTEND' },
    { name: 'HTML5 & CSS3', category: 'FRONTEND' },
    // DEVOPS
    { name: 'Docker', category: 'DEVOPS' },
    { name: 'Kubernetes', category: 'DEVOPS' },
    { name: 'AWS', category: 'DEVOPS' },
    { name: 'GitHub Actions', category: 'DEVOPS' },
    { name: 'Terraform', category: 'DEVOPS' },
    // QA
    { name: 'Jest', category: 'QA' },
    { name: 'Cypress', category: 'QA' },
    { name: 'Playwright', category: 'QA' },
    { name: 'Manual Testing', category: 'QA' },
    { name: 'Selenium', category: 'QA' },
    // OTHER
    { name: 'Project Planning', category: 'OTHER' },
    { name: 'Scrum Master', category: 'OTHER' },
    { name: 'Technical Writing', category: 'OTHER' },
    { name: 'System Architecture', category: 'OTHER' },
  ];

  const skillsMap: Record<string, ISkill> = {};
  for (const currentSkill of skillsData) {
    const createdSkill = await Skill.create(currentSkill);
    skillsMap[createdSkill.name] = createdSkill;
  }

  // 4. Seed Users
  console.log(SEED_MESSAGES.SEEDING_USERS);
  // Password is 'Admin@1234'
  const passHash = '$2b$10$3Js0FcwLkjDiedTsqCcIP.kbmBU2puxGUT/W6H4WdiDhZULsJHFTO';

  await User.create({
    username: 'admin',
    email: 'admin@techserve.com',
    passwordHash: passHash,
    role: 'ADMIN',
    forcePasswordChange: true,
  });

  const userManager = await User.create({
    username: 'manager',
    email: 'manager@techserve.com',
    passwordHash: passHash,
    role: 'MANAGER',
    forcePasswordChange: true,
  });

  const userEmployee = await User.create({
    username: 'anil_mehta',
    email: 'anil.mehta@techserve.com',
    passwordHash: passHash,
    role: 'EMPLOYEE',
    forcePasswordChange: true,
  });

  // 5. Seed Employee Profiles (linked to User Accounts)
  console.log(SEED_MESSAGES.SEEDING_EMPLOYEES);

  await Employee.create({
    userId: userEmployee._id,
    fullName: 'Anil Mehta',
    email: 'anil.mehta@techserve.com',
    department: 'Engineering',
    designation: 'Senior Backend Engineer',
    status: 'BENCH',
    skills: [
      { skillId: skillsMap['Java']._id, proficiency: 'ADVANCED', addedAt: new Date() },
      { skillId: skillsMap['Spring Boot']._id, proficiency: 'ADVANCED', addedAt: new Date() },
      { skillId: skillsMap['AWS']._id, proficiency: 'INTERMEDIATE', addedAt: new Date() }
    ]
  });

  // 6. Seed Projects
  console.log(SEED_MESSAGES.SEEDING_PROJECTS);
  await Project.create({
    name: 'Alpha Portal',
    description: 'Redevelopment of the main customer facing portal using Next.js.',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-12-31'),
    status: 'ACTIVE',
    managerId: userManager._id,
    healthFlag: 'ON_TRACK',
    totalStoryPoints: 120,
    milestones: [
      { title: 'UI Designs & Prototyping', dueDate: new Date('2026-07-15'), status: 'IN_PROGRESS', storyPoints: 30 },
      { title: 'API Integration', dueDate: new Date('2026-09-30'), status: 'NOT_STARTED', storyPoints: 50 },
      { title: 'UAT Sign-off', dueDate: new Date('2026-11-30'), status: 'NOT_STARTED', storyPoints: 40 }
    ]
  });

  await Project.create({
    name: 'Beta CRM',
    description: 'Migration of custom internal CRM databases to cloud-managed servers.',
    startDate: new Date('2026-07-01'),
    endDate: new Date('2027-02-28'),
    status: 'PLANNED',
    managerId: userManager._id,
    healthFlag: 'ON_TRACK',
    totalStoryPoints: 80,
    milestones: [
      { title: 'Schema Finalization', dueDate: new Date('2026-08-15'), status: 'NOT_STARTED', storyPoints: 35 },
      { title: 'Data Extraction', dueDate: new Date('2026-10-31'), status: 'NOT_STARTED', storyPoints: 45 }
    ]
  });

  console.log(SEED_MESSAGES.COMPLETED);
}

main()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(SEED_MESSAGES.FAILED);
    console.error(e);
    await disconnectDatabase();
    process.exit(1);
  });
