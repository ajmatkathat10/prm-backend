import { connectDatabase } from './config/database.js';
import { Resource } from './models/Resource.js';
import { Project, IProject } from './models/Project.js';
import { Allocation } from './models/Allocation.js';
import { Timesheet } from './models/Timesheet.js';
import { SystemConfig } from './models/SystemConfig.js';
import { User } from './models/User.js';
import { emailService } from './services/EmailService.js';
import { llmService } from './services/LlmService.js';

interface IPopulatedUser {
  _id: string;
  fullName: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
}

interface IPopulatedSkill {
  _id: string;
  name: string;
  category: string;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getLastMonday(d: Date): Date {
  const monday = getMonday(d);
  monday.setDate(monday.getDate() - 7);
  return monday;
}

async function sendProjectAtRiskAlert(proj: IProject, reason: string, maxHours: number): Promise<void> {
  try {
    const managerUser = await User.findById(proj.managerId);
    if (!managerUser) {
      return;
    }

    const milestonesText = proj.milestones
      .map((m) => `- ${m.title} (Due: ${m.dueDate.toLocaleDateString()}, Status: ${m.status}, Story Points: ${m.storyPoints})`)
      .join('\n');

    const activeResources = await Resource.find({ isActive: true })
      .populate('userId')
      .populate('skills.skillId');

    const today = new Date();
    const currentMonday = getMonday(today);
    const currentSunday = new Date(currentMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
    currentSunday.setHours(23, 59, 59, 999);

    const availableResourcesData = [];

    for (const res of activeResources) {
      const allocs = await Allocation.find({
        resourceId: res._id,
        status: 'ACTIVE',
        fromDate: { $lte: currentSunday },
        toDate: { $gte: currentMonday }
      });

      let allocatedHours = 0;
      for (const a of allocs) {
        allocatedHours += (a.utilisationPercent / 100) * maxHours;
      }

      const freeHours = Math.max(0, maxHours - allocatedHours);
      if (freeHours > 0) {
        const u = res.userId as unknown as IPopulatedUser;
        if (!u) {
          continue;
        }

        const skillsList = res.skills
          .map((s) => {
            const sk = s.skillId as unknown as IPopulatedSkill;
            return `${sk?.name || 'Unknown'} (${s.proficiency})`;
          })
          .join(', ');

        availableResourcesData.push({
          name: u.fullName,
          designation: res.designation,
          freeHours,
          skills: skillsList
        });
      }
    }

    const resourcesText = availableResourcesData
      .map((r) => `- Name: ${r.name}, Designation: ${r.designation}, Free Hours: ${r.freeHours}h/week, Skills: [${r.skills}]`)
      .join('\n');

    const prompt = `
You are an AI assistant helping a project manager resolve project risks.
Project "${proj.name}" has been marked as AT_RISK.
Description: ${proj.description || 'No description provided.'}
Risk Reason: ${reason}

Here are the key project milestones:
${milestonesText}

Below is the list of active team members who have free capacity this week:
${resourcesText || 'No active team members with free capacity.'}

Please perform two tasks:
1. Provide a professional "AI Risk Summary" (a plain-English explanation of why the project is at risk based on the reason and milestones). Keep it concise (1-2 paragraphs).
2. Recommend the top 2-3 employees from the available list who are best suited to help reduce this project's risk, explaining why their skills match the project needs.

Format your output exactly as follows:
### AI Risk Summary
[Your summary here]

### Suggested Help
[Your recommendations here]
`;

    let llmResponse = '';
    try {
      llmResponse = await llmService.generate(prompt);
    } catch {
      llmResponse = `### AI Risk Summary\nProject "${proj.name}" is marked as AT_RISK because: ${reason}.\n\n### Suggested Help\nUnable to generate suggestions at this time.`;
    }

    const subject = `[PRM ALERT] Project "${proj.name}" is AT_RISK`;
    const emailBody = `Hi ${managerUser.fullName},

The system has marked your project "${proj.name}" as AT_RISK.

--------------------------------------------------
PROJECT DETAILS
--------------------------------------------------
Project Name: ${proj.name}
Project Manager: ${managerUser.fullName}
Health Status: AT_RISK (Red)
Start Date: ${proj.startDate.toLocaleDateString()}
End Date: ${proj.endDate.toLocaleDateString()}

KEY MILESTONES:
${milestonesText}

--------------------------------------------------
AI RISK ANALYSIS & RECOMMENDATIONS
--------------------------------------------------
${llmResponse}

Please take necessary actions to mitigate these risks.

Best regards,
PRM System`;

    await emailService.sendEmail(managerUser.email, subject, emailBody);
  } catch (error) {
    console.error(`[SchedulerWorker] Error sending project at-risk alert for ${proj.name}:`, error);
  }
}

async function runScheduler(): Promise<void> {
  try {
    const today = new Date();
    const resources = await Resource.find();

    for (const res of resources) {
      if (!res.isActive) {
        if (res.status !== 'INACTIVE') {
          res.status = 'INACTIVE';
          await res.save();
        }
        continue;
      }

      const activeAllocations = await Allocation.find({
        resourceId: res._id,
        status: 'ACTIVE',
      });

      const targetStatus = activeAllocations.length > 0 ? 'ALLOCATED' : 'BENCH';

      if (res.status !== targetStatus) {
        res.status = targetStatus;
        await res.save();
      }
    }

    const config = await SystemConfig.findOne();
    const maxHours = config?.maxWeeklyHours || 40;

    const activeResources = await Resource.find({ isActive: true });
    const limitDate = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);

    for (const res of activeResources) {
      const startLimit = new Date(Math.max(res.createdAt.getTime(), limitDate.getTime()));
      let weekStart = getMonday(startLimit);
      const currentMonday = getMonday(new Date());

      while (weekStart < currentMonday) {
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        weekEnd.setHours(23, 59, 59, 999);

        const allocs = await Allocation.find({
          resourceId: res._id,
          status: 'ACTIVE',
          fromDate: { $lte: weekEnd },
          toDate: { $gte: weekStart }
        });

        if (allocs.length > 0) {
          const ts = await Timesheet.findOne({ resourceId: res._id, weekStart });
          if (!ts) {
            await Timesheet.create({
              resourceId: res._id,
              weekStart,
              status: 'MISSED',
              totalHours: 0,
              submittedAt: null,
              entries: []
            });
          }
        }

        weekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      }
    }

    const missedTimesheets = await Timesheet.find({ status: 'MISSED' });
    const todayMs = today.getTime();
    for (const ts of missedTimesheets) {
      const res = await Resource.findById(ts.resourceId);
      if (!res || !res.isActive) {
        continue;
      }

      const daysDiff = Math.floor((todayMs - ts.weekStart.getTime()) / (24 * 60 * 60 * 1000));
      const resUser = await User.findById(res.userId);
      if (!resUser) {
        continue;
      }

      const managerUser = res.managerId ? await User.findById(res.managerId) : null;

      if (daysDiff >= 7 && ts.reminderSentCount === 0) {
        const subject = `Timesheet Submission Reminder - Week of ${ts.weekStart.toLocaleDateString()}`;
        const body = `Hi ${resUser.fullName},\n\nThis is a friendly reminder to submit your timesheet for the week starting ${ts.weekStart.toLocaleDateString()}. Please submit it as soon as possible to avoid account freeze.\n\nBest regards,\nPRM System`;
        await emailService.sendEmail(resUser.email, subject, body);

        ts.reminderSentCount = 1;
        ts.lastReminderSentAt = today;
        await ts.save();
      } else if (daysDiff >= 8 && ts.reminderSentCount === 1) {
        const subject = `Urgent: Timesheet Submission Pending - Week of ${ts.weekStart.toLocaleDateString()}`;
        const body = `Hi ${resUser.fullName},\n\nYour timesheet for the week starting ${ts.weekStart.toLocaleDateString()} is still pending. If not submitted by tomorrow, your timesheet submission access will be frozen.\n\nBest regards,\nPRM System`;
        await emailService.sendEmail(resUser.email, subject, body);

        ts.reminderSentCount = 2;
        ts.lastReminderSentAt = today;
        await ts.save();
      } else if (daysDiff >= 9 && ts.reminderSentCount === 2) {
        res.timesheetAccessFrozen = true;
        await res.save();

        const employeeSubject = `Timesheet Submission Access Frozen`;
        const employeeBody = `Hi ${resUser.fullName},\n\nYour timesheet submission access has been frozen because you did not submit your timesheet for the week starting ${ts.weekStart.toLocaleDateString()}. Please contact your manager ${managerUser ? managerUser.fullName : 'reporting manager'} to restore access.\n\nBest regards,\nPRM System`;
        await emailService.sendEmail(resUser.email, employeeSubject, employeeBody);

        if (managerUser) {
          const managerSubject = `Timesheet Access Frozen - ${resUser.fullName}`;
          const managerBody = `Hi ${managerUser.fullName},\n\n${resUser.fullName}'s timesheet submission access has been frozen due to a missed timesheet for the week starting ${ts.weekStart.toLocaleDateString()}.\n\nYou can restore their access through the Team Resources dashboard.\n\nBest regards,\nPRM System`;
          await emailService.sendEmail(managerUser.email, managerSubject, managerBody);
        }

        ts.reminderSentCount = 3;
        ts.lastReminderSentAt = today;
        await ts.save();
      }
    }

    const projects = await Project.find();
    for (const proj of projects) {
      const incompleteMilestones = proj.milestones.filter((m) => m.status !== 'DONE');
      let maxOverdueDays = 0;

      for (const m of incompleteMilestones) {
        if (m.dueDate < today) {
          const overdueMs = today.getTime() - m.dueDate.getTime();
          const overdueDays = overdueMs / (1000 * 60 * 60 * 24);
          if (overdueDays > maxOverdueDays) {
            maxOverdueDays = overdueDays;
          }
        }
      }

      const lastMonday = getLastMonday(today);
      const lastSunday = new Date(lastMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
      lastSunday.setHours(23, 59, 59, 999);

      const activeAllocs = await Allocation.find({
        projectId: proj._id,
        status: 'ACTIVE',
        fromDate: { $lte: lastSunday },
        toDate: { $gte: lastMonday }
      });

      let expectedHours = 0;
      for (const a of activeAllocs) {
        expectedHours += (a.utilisationPercent / 100) * maxHours;
      }

      const submittedTimesheets = await Timesheet.find({
        weekStart: lastMonday,
        status: 'SUBMITTED'
      });

      let loggedHours = 0;
      for (const ts of submittedTimesheets) {
        for (const entry of ts.entries) {
          if (entry.projectId.toString() === proj._id.toString()) {
            loggedHours += entry.hoursWorked;
          }
        }
      }

      let targetFlag: 'ON_TRACK' | 'ATTENTION' | 'AT_RISK' = 'ON_TRACK';
      let riskReason = '';
      if (maxOverdueDays > 5) {
        targetFlag = 'AT_RISK';
        riskReason = `Milestones are overdue by up to ${Math.round(maxOverdueDays)} days.`;
      } else if (maxOverdueDays > 0) {
        targetFlag = 'ATTENTION';
      } else if (expectedHours > 0) {
        const ratio = loggedHours / expectedHours;
        if (ratio < 0.5) {
          targetFlag = 'AT_RISK';
          riskReason = `Logged hours (${loggedHours}h) are less than 50% of expected allocated hours (${expectedHours}h) for the last week.`;
        } else if (ratio < 0.8) {
          targetFlag = 'ATTENTION';
        }
      }

      if (proj.healthFlag !== targetFlag) {
        proj.healthFlag = targetFlag;
        await proj.save();
        if (targetFlag === 'AT_RISK') {
          await sendProjectAtRiskAlert(proj, riskReason, maxHours);
        }
      }
    }
  } catch (error) {
    console.error('[SchedulerWorker] Error running scheduler:', error);
  }
}

async function scheduleNextRun(): Promise<void> {
  try {
    const config = await SystemConfig.findOne();
    const intervalHours = config?.schedulerIntervalHours || 4;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    setTimeout(async () => {
      await runScheduler();
      await scheduleNextRun();
    }, intervalMs);
  } catch (error) {
    console.error('[SchedulerWorker] Error rescheduling:', error);
    setTimeout(scheduleNextRun, 60000);
  }
}

async function bootstrap(): Promise<void> {
  try {
    await connectDatabase();
    await runScheduler();
    await scheduleNextRun();
  } catch (error) {
    console.error('[SchedulerWorker] Fatal bootstrap error:', error);
    process.exit(1);
  }
}

bootstrap();
