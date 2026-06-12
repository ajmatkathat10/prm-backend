import { User, Skill, Resource, Project, SystemConfig, Allocation, Timesheet, ISkill } from './models/index.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { SEED_MESSAGES } from './constants/index.js';

async function main() {
  console.log(SEED_MESSAGES.STARTING);
  await connectDatabase();

  console.log(SEED_MESSAGES.CLEANING);
  await SystemConfig.deleteMany({});
  await Project.deleteMany({});
  await Resource.deleteMany({});
  await Skill.deleteMany({});
  await User.deleteMany({});
  await Allocation.deleteMany({});
  await Timesheet.deleteMany({});

  console.log(SEED_MESSAGES.SEEDING_CONFIG);
  await SystemConfig.create({
    id: 1,
    llmProvider: 'Gemini',
    llmApiKey: 'PLACEHOLDER_API_KEY_GOES_HERE',
    schedulerIntervalHours: 4,
    maxWeeklyHours: 40,
  });

  console.log(SEED_MESSAGES.SEEDING_SKILLS);
  const skillsData: { name: string; category: 'BACKEND' | 'FRONTEND' | 'DEVOPS' | 'QA' | 'OTHER' }[] = [
    { name: 'Java', category: 'BACKEND' },
    { name: 'Node.js', category: 'BACKEND' },
    { name: 'Python', category: 'BACKEND' },
    { name: 'Go', category: 'BACKEND' },
    { name: 'Spring Boot', category: 'BACKEND' },
    { name: 'Express.js', category: 'BACKEND' },
    { name: 'React', category: 'FRONTEND' },
    { name: 'Next.js', category: 'FRONTEND' },
    { name: 'TypeScript', category: 'FRONTEND' },
    { name: 'Vue.js', category: 'FRONTEND' },
    { name: 'Tailwind CSS', category: 'FRONTEND' },
    { name: 'HTML5 & CSS3', category: 'FRONTEND' },
    { name: 'Docker', category: 'DEVOPS' },
    { name: 'Kubernetes', category: 'DEVOPS' },
    { name: 'AWS', category: 'DEVOPS' },
    { name: 'GitHub Actions', category: 'DEVOPS' },
    { name: 'Terraform', category: 'DEVOPS' },
    { name: 'Jest', category: 'QA' },
    { name: 'Cypress', category: 'QA' },
    { name: 'Playwright', category: 'QA' },
    { name: 'Manual Testing', category: 'QA' },
    { name: 'Selenium', category: 'QA' },
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

  console.log(SEED_MESSAGES.SEEDING_USERS);
  const passHash = '$2b$10$3Js0FcwLkjDiedTsqCcIP.kbmBU2puxGUT/W6H4WdiDhZULsJHFTO';

  await User.create({
    username: 'admin',
    email: 'ajmat1130666@gmail.com',
    fullName: 'System Administrator',
    passwordHash: passHash,
    role: 'ADMIN',
    forcePasswordChange: true,
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
