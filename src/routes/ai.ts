import { Router, Response } from 'express';
import { authMiddleware, roleMiddleware, AuthRequest } from '../middleware/auth.js';
import { llmService } from '../services/LlmService.js';
import { resourceRepository } from '../repositories/ResourceRepository.js';
import { skillRepository } from '../repositories/SkillRepository.js';
import { allocationRepository } from '../repositories/AllocationRepository.js';
import { systemConfigRepository } from '../repositories/SystemConfigRepository.js';
import { projectRepository } from '../repositories/ProjectRepository.js';
import { Timesheet } from '../models/Timesheet.js';
import { AuthError } from '../services/AuthService.js';
import { COMMON_ERRORS } from '../constants/index.js';
import {
  SKILL_MATCH_EXTRACT_PROMPT,
  TEAM_MATCH_EXTRACT_PROMPT,
  SKILL_MATCH_RANK_PROMPT,
  TEAM_MATCH_ASSIGN_PROMPT,
  RISK_SUMMARY_PROMPT
} from '../constants/prompts.js';

const router = Router();

function getModelUsed(list: string[]): string {
  return Array.from(new Set(list)).join(', ') || 'None';
}

const PROFICIENCY_RANK: Record<string, number> = {
  'BEGINNER': 1,
  'INTERMEDIATE': 2,
  'ADVANCED': 3
};

router.use(authMiddleware);
router.use(roleMiddleware('MANAGER', 'ADMIN'));

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

router.post('/skill-match', async (req: AuthRequest, res: Response) => {
  const modelsUsedList: string[] = [];
  try {
    const { requirement, projectId: _projectId } = req.body as {
      requirement?: string;
      projectId?: string;
    };

    if (!requirement) {
      throw new AuthError('Requirement text is required', 400);
    }

    const config = await systemConfigRepository.getConfig();
    const maxWeeklyHours = config?.maxWeeklyHours || 40;

    const dbSkillsList = await skillRepository.findAll();
    const allowedSkills = dbSkillsList.map(s => s.name);
    const extractPrompt = SKILL_MATCH_EXTRACT_PROMPT(allowedSkills, requirement);

    let extracted: {
      roleName: string | null;
      requiredSkills: string[];
      fromDate: string | null;
      toDate: string | null;
      bandwidth: number | null;
      proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | null;
      validationNotes: string | null;
    } = {
      roleName: null,
      requiredSkills: [],
      fromDate: null,
      toDate: null,
      bandwidth: null,
      proficiency: null,
      validationNotes: null
    };

    try {
      let extractText = await llmService.generate(extractPrompt);
      modelsUsedList.push(llmService.lastModelUsed);
      extractText = extractText.trim();
      if (extractText.startsWith('```')) {
        extractText = extractText.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
      }
      const parsedExtract = JSON.parse(extractText);
      extracted = {
        roleName: parsedExtract.roleName || null,
        requiredSkills: parsedExtract.requiredSkills || [],
        fromDate: parsedExtract.fromDate || null,
        toDate: parsedExtract.toDate || null,
        bandwidth: parsedExtract.bandwidth || null,
        proficiency: parsedExtract.proficiency || null,
        validationNotes: parsedExtract.validationNotes || null
      };
    } catch (err) {
      console.error('[AiRoute] Extraction failed, falling back:', err);
    }

    let validationNotes = extracted.validationNotes || '';
    let fromDateObj = new Date();
    let toDateObj = new Date();
    toDateObj.setMonth(toDateObj.getMonth() + 1);

    if (extracted.fromDate && extracted.toDate) {
      const parsedFrom = new Date(extracted.fromDate);
      const parsedTo = new Date(extracted.toDate);
      if (isNaN(parsedFrom.getTime()) || isNaN(parsedTo.getTime())) {
        validationNotes += (validationNotes ? '; ' : '') + 'Invalid date format provided in requirement';
      } else if (parsedFrom > parsedTo) {
        validationNotes += (validationNotes ? '; ' : '') + 'Extracted start date is after end date';
      } else {
        fromDateObj = parsedFrom;
        toDateObj = parsedTo;
      }
    }

    if (extracted.bandwidth !== null && extracted.bandwidth !== undefined) {
      if (extracted.bandwidth < 0) {
        validationNotes += (validationNotes ? '; ' : '') + 'Negative bandwidth requested';
      } else if (extracted.bandwidth > maxWeeklyHours) {
        validationNotes += (validationNotes ? '; ' : '') + `Requested bandwidth (${extracted.bandwidth} hrs/wk) exceeds company maximum (${maxWeeklyHours} hrs/wk)`;
      }
    }

    if (_projectId) {
      const project = await projectRepository.findById(_projectId);
      if (project) {
        const projStart = new Date(project.startDate);
        const projEnd = new Date(project.endDate);
        if (extracted.fromDate && extracted.toDate) {
          if (fromDateObj < projStart) {
            fromDateObj = projStart;
            validationNotes += (validationNotes ? '; ' : '') + `Adjusted search start date to project timeline start (${projStart.toISOString().split('T')[0]})`;
          }
          if (toDateObj > projEnd) {
            toDateObj = projEnd;
            validationNotes += (validationNotes ? '; ' : '') + `Adjusted search end date to project timeline end (${projEnd.toISOString().split('T')[0]})`;
          }
          if (fromDateObj > projEnd || toDateObj < projStart || fromDateObj > toDateObj) {
            validationNotes += (validationNotes ? '; ' : '') + 'Requested date range is completely outside the project timeline';
          }
        } else {
          fromDateObj = projStart;
          toDateObj = projEnd;
        }
      }
    }

    const resources = await resourceRepository.findAll({ isActive: true });
    const activeAllocations = await allocationRepository.findAll({ status: 'ACTIVE' });

    const minProf = extracted.proficiency || 'BEGINNER';

    const dbSkills = dbSkillsList.filter(s =>
      extracted.requiredSkills.some(rsName => s.name.toLowerCase() === rsName.toLowerCase())
    );

    if (extracted.requiredSkills.length > 0 && dbSkills.length === 0) {
      res.json({
        success: true,
        summary: `AI Analysis: The requested skills (${extracted.requiredSkills.join(', ')}) were parsed but do not match any skills in our catalog.`,
        results: [],
        message: 'Nobody in the organization has this skill (hire or train).',
        modelUsed: getModelUsed(modelsUsedList)
      });
      return;
    }

    let filteredResources = resources;
    if (dbSkills.length > 0) {
      const hasSkill = (r: typeof resources[0], skillIdStr: string): boolean => {
        return r.skills.some(s => {
          const sId = s.skillId && (s.skillId as unknown as { _id?: { toString(): string } })._id?.toString();
          return sId === skillIdStr;
        });
      };

      const matchingResources = resources.filter(r =>
        dbSkills.some(skill => hasSkill(r, skill._id.toString()))
      );

      if (matchingResources.length === 0) {
        res.json({
          success: true,
          summary: `AI Analysis: No resources match the required skills (${dbSkills.map(s => s.name).join(', ')}).`,
          results: [],
          message: 'Nobody in the organization has this skill (hire or train).',
          modelUsed: getModelUsed(modelsUsedList)
        });
        return;
      }

      const availableResources = matchingResources.filter(r => {
        const resId = r._id.toString();
        const overlaps = activeAllocations.filter(a => {
          const aResId = a.resourceId._id ? a.resourceId._id.toString() : a.resourceId.toString();
          if (aResId !== resId) return false;
          const aFrom = new Date(a.fromDate);
          const aTo = new Date(a.toDate);
          return aFrom <= toDateObj && aTo >= fromDateObj;
        });
        const totalUtil = overlaps.reduce((sum, a) => sum + a.utilisationPercent, 0);
        const freeHours = ((100 - totalUtil) / 100) * maxWeeklyHours;
        return freeHours > 0;
      });

      if (availableResources.length === 0) {
        let earliestFreeDate: Date | null = null;
        for (const r of matchingResources) {
          const resId = r._id.toString();
          const overlaps = activeAllocations.filter(a => {
            const aResId = a.resourceId._id ? a.resourceId._id.toString() : a.resourceId.toString();
            if (aResId !== resId) return false;
            const aFrom = new Date(a.fromDate);
            const aTo = new Date(a.toDate);
            return aFrom <= toDateObj && aTo >= fromDateObj;
          });
          if (overlaps.length > 0) {
            const maxToDate = new Date(Math.max(...overlaps.map(a => new Date(a.toDate).getTime())));
            if (!earliestFreeDate || maxToDate < earliestFreeDate) {
              earliestFreeDate = maxToDate;
            }
          }
        }
        const dateStr = earliestFreeDate ? earliestFreeDate.toISOString().split('T')[0] : 'unknown date';
        res.json({
          success: true,
          summary: `AI Analysis: All matching resources are allocated elsewhere until ${dateStr}.`,
          results: [],
          message: `All matching resources are allocated elsewhere until ${dateStr}.`,
          modelUsed: getModelUsed(modelsUsedList)
        });
        return;
      }

      filteredResources = availableResources;
    }

    const requiredHours = extracted.bandwidth;
    if (requiredHours !== null) {
      filteredResources = filteredResources.filter((r) => {
        const resId = r._id.toString();
        const overlaps = activeAllocations.filter(a => {
          const aResId = a.resourceId._id ? a.resourceId._id.toString() : a.resourceId.toString();
          if (aResId !== resId) return false;
          const aFrom = new Date(a.fromDate);
          const aTo = new Date(a.toDate);
          return aFrom <= toDateObj && aTo >= fromDateObj;
        });
        const totalUtil = overlaps.reduce((sum, a) => sum + a.utilisationPercent, 0);
        const freeHours = ((100 - totalUtil) / 100) * maxWeeklyHours;
        return freeHours >= requiredHours!;
      });
    }

    if (filteredResources.length === 0) {
      res.json({
        success: true,
        summary: 'AI Analysis: No resources have enough free capacity to fulfill the weekly bandwidth requirement.',
        results: [],
        message: 'No resources have enough free capacity.',
        modelUsed: getModelUsed(modelsUsedList)
      });
      return;
    }

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const recentTimesheets = await Timesheet.find({
      status: 'SUBMITTED',
      weekStart: { $gte: fourWeeksAgo }
    });

    const resourceTagsMap: Record<string, Set<string>> = {};
    for (const ts of recentTimesheets) {
      const resId = ts.resourceId.toString();
      if (!resourceTagsMap[resId]) {
        resourceTagsMap[resId] = new Set<string>();
      }
      for (const entry of ts.entries) {
        for (const tag of entry.activityTags) {
          if (tag) resourceTagsMap[resId].add(tag);
        }
      }
    }

    const candidates = filteredResources.map((r) => {
      const resId = r._id.toString();
      const overlaps = activeAllocations.filter(a => {
        const aResId = a.resourceId._id ? a.resourceId._id.toString() : a.resourceId.toString();
        if (aResId !== resId) return false;
        const aFrom = new Date(a.fromDate);
        const aTo = new Date(a.toDate);
        return aFrom <= toDateObj && aTo >= fromDateObj;
      });
      const totalUtil = overlaps.reduce((sum, a) => sum + a.utilisationPercent, 0);
      const freeHours = ((100 - totalUtil) / 100) * maxWeeklyHours;
      const skills = r.skills.map((s) => {
        const skillObj = s.skillId as unknown as { name: string; _id?: { toString(): string } };
        const skillName = skillObj?.name || 'Unknown';
        const sId = skillObj?._id?.toString();
        const matchesRequest = sId && dbSkills.some(dbs => dbs._id.toString() === sId);
        if (matchesRequest) {
          const userRank = PROFICIENCY_RANK[s.proficiency] || 1;
          const requiredRank = PROFICIENCY_RANK[minProf] || 1;
          if (userRank < requiredRank) {
            return `${skillName} (${s.proficiency}) [Note: Requested proficiency was ${minProf}]`;
          }
        }
        return `${skillName} (${s.proficiency})`;
      });

      const activeAllocs = overlaps.map((a) => `${(a.projectId as unknown as { name: string }).name} (${a.utilisationPercent}%)`);

      return {
        resourceId: resId,
        name: (r.userId as unknown as { fullName?: string })?.fullName || 'Unknown',
        designation: r.designation,
        skills,
        freeHours,
        currentAllocations: activeAllocs,
        recentActivityTags: Array.from(resourceTagsMap[resId] || [])
      };
    });

    const rankPrompt = SKILL_MATCH_RANK_PROMPT(
      requirement,
      fromDateObj.toISOString().split('T')[0],
      toDateObj.toISOString().split('T')[0],
      requiredHours ? requiredHours.toString() : 'any',
      extracted.roleName || 'any',
      JSON.stringify(extracted.requiredSkills),
      JSON.stringify(candidates, null, 2),
      maxWeeklyHours,
      validationNotes
    );

    try {
      let resultText = await llmService.generate(rankPrompt);
      modelsUsedList.push(llmService.lastModelUsed);
      resultText = resultText.trim();
      if (resultText.startsWith('```')) {
        resultText = resultText.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
      }
      const parsed = JSON.parse(resultText) as {
        summary: string;
        results: Array<{
          resourceId: string;
          name: string;
          reason: string;
          suggestedAllocation?: number;
        }>;
      };
      const augmentedResults = (parsed.results || []).map((resObj) => {
        const foundResource = resources.find(r => r._id.toString() === resObj.resourceId);
        const candDetails = candidates.find(c => c.resourceId === resObj.resourceId);
        const isUnderManager = foundResource && foundResource.managerId && foundResource.managerId.toString() === req.user?.id;
        return {
          ...resObj,
          designation: candDetails?.designation || foundResource?.designation || '',
          skills: candDetails?.skills || [],
          freeHours: candDetails?.freeHours ?? 0,
          currentAllocations: candDetails?.currentAllocations || [],
          recentActivityTags: candDetails?.recentActivityTags || [],
          isUnderManager: !!isUnderManager
        };
      });
      res.json({ success: true, summary: parsed.summary, results: augmentedResults, modelUsed: getModelUsed(modelsUsedList) });
    } catch {
      const results = candidates.slice(0, 5).map((c) => {
        const foundResource = resources.find(r => r._id.toString() === c.resourceId);
        const isUnderManager = foundResource && foundResource.managerId && foundResource.managerId.toString() === req.user?.id;
        return {
          resourceId: c.resourceId,
          name: c.name,
          reason: `Match: Resource designation is ${c.designation} with skills ${c.skills.join(', ')}. Currently has ${c.freeHours} free hours in the requested period.`,
          suggestedAllocation: requiredHours ? Math.min(100, Math.round((requiredHours / maxWeeklyHours) * 100)) : 100,
          designation: c.designation,
          skills: c.skills,
          freeHours: c.freeHours,
          currentAllocations: c.currentAllocations,
          recentActivityTags: c.recentActivityTags,
          isUnderManager: !!isUnderManager
        };
      });
      res.json({
        success: true,
        summary: `AI Match fallback summary. Matching candidates found: ${results.length}. ${validationNotes ? 'Warnings: ' + validationNotes : ''}`,
        results,
        modelUsed: getModelUsed(modelsUsedList)
      });
    }
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/risk-summary', async (req: AuthRequest, res: Response) => {
  const modelsUsedList: string[] = [];
  try {
    const { projectId } = req.body as { projectId?: string };
    if (!projectId) {
      throw new AuthError('Project ID is required', 400);
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new AuthError('Project not found', 404);
    }

    const today = new Date();
    const lastMonday = getLastMonday(today);
    const lastSunday = new Date(lastMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
    lastSunday.setHours(23, 59, 59, 999);

    const activeAllocations = await allocationRepository.findAll({
      projectId,
      status: 'ACTIVE',
      fromDate: { $lte: lastSunday },
      toDate: { $gte: lastMonday }
    });

    const config = await systemConfigRepository.getConfig();
    const maxHours = config?.maxWeeklyHours || 40;

    let expectedHours = 0;
    for (const a of activeAllocations) {
      expectedHours += (a.utilisationPercent / 100) * maxHours;
    }

    const submittedTimesheets = await Timesheet.find({
      weekStart: lastMonday,
      status: 'SUBMITTED'
    });

    let loggedHours = 0;
    for (const ts of submittedTimesheets) {
      for (const entry of ts.entries) {
        const entryProjId = entry.projectId.toString();
        if (entryProjId === projectId) {
          loggedHours += entry.hoursWorked;
        }
      }
    }

    const buildFallbackSummary = (): string => {
      const overdue = project.milestones.filter((m) => m.status !== 'DONE' && m.dueDate < today);
      const milestoneText = overdue.length > 0
        ? `The milestone '${overdue[0].title}' is overdue.`
        : 'All milestones are currently on track.';
      const effortText = expectedHours > 0 && loggedHours < 0.5 * expectedHours
        ? `Last week's logged effort was low at ${loggedHours} hours vs expected ${expectedHours} hours.`
        : 'Logged efforts are meeting target levels.';
      const allocationText = activeAllocations.length === 0
        ? 'No active resource allocations found on this project.'
        : '';
      return `Project Health Summary: ${milestoneText} ${effortText} ${allocationText}`.trim();
    };

    const prompt = RISK_SUMMARY_PROMPT(
      project.name,
      project.description || 'No description provided',
      project.startDate.toISOString().split('T')[0],
      project.endDate.toISOString().split('T')[0],
      project.totalStoryPoints,
      JSON.stringify(project.milestones, null, 2),
      JSON.stringify(activeAllocations.map(a => ({ resourceName: (a.resourceId as unknown as { userId?: { fullName?: string } })?.userId?.fullName || 'Unknown', utilisation: a.utilisationPercent })), null, 2),
      lastMonday.toISOString().split('T')[0],
      expectedHours,
      loggedHours
    );

    try {
      const summary = await llmService.generate(prompt);
      modelsUsedList.push(llmService.lastModelUsed);
      res.json({ success: true, summary: summary.trim(), modelUsed: getModelUsed(modelsUsedList) });
    } catch {
      res.json({ success: true, summary: buildFallbackSummary(), modelUsed: getModelUsed(modelsUsedList) });
    }
  } catch (error) {
    handleControllerError(error, res);
  }
});

router.post('/team-match', async (req: AuthRequest, res: Response) => {
  const modelsUsedList: string[] = [];
  try {
    const { requirement, projectId } = req.body as {
      requirement?: string;
      projectId?: string;
    };
    if (!requirement) {
      throw new AuthError('Requirement text is required', 400);
    }

    const config = await systemConfigRepository.getConfig();
    const maxWeeklyHours = config?.maxWeeklyHours || 40;

    const dbSkillsList = await skillRepository.findAll();
    const allowedSkills = dbSkillsList.map(s => s.name);
    const extractPrompt = TEAM_MATCH_EXTRACT_PROMPT(allowedSkills, requirement);

    let extracted: {
      fromDate: string | null;
      toDate: string | null;
      roles: Array<{
        roleName: string;
        requiredSkills: string[];
        proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
        bandwidth: number | null;
      }>;
      validationNotes: string | null;
    } = {
      fromDate: null,
      toDate: null,
      roles: [],
      validationNotes: null
    };

    try {
      let extractText = await llmService.generate(extractPrompt);
      modelsUsedList.push(llmService.lastModelUsed);
      extractText = extractText.trim();
      if (extractText.startsWith('```')) {
        extractText = extractText.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
      }
      const parsedExtract = JSON.parse(extractText);
      extracted = {
        fromDate: parsedExtract.fromDate || null,
        toDate: parsedExtract.toDate || null,
        roles: parsedExtract.roles || [],
        validationNotes: parsedExtract.validationNotes || null
      };
    } catch (err) {
      console.error('[AiRoute] Team Extraction failed, falling back:', err);
    }

    let validationNotes = extracted.validationNotes || '';
    let fromDateObj = new Date();
    let toDateObj = new Date();
    toDateObj.setMonth(toDateObj.getMonth() + 1);

    if (extracted.fromDate && extracted.toDate) {
      const parsedFrom = new Date(extracted.fromDate);
      const parsedTo = new Date(extracted.toDate);
      if (isNaN(parsedFrom.getTime()) || isNaN(parsedTo.getTime())) {
        validationNotes += (validationNotes ? '; ' : '') + 'Invalid date format provided in requirement';
      } else if (parsedFrom > parsedTo) {
        validationNotes += (validationNotes ? '; ' : '') + 'Extracted team start date is after end date';
      } else {
        fromDateObj = parsedFrom;
        toDateObj = parsedTo;
      }
    }

    if (projectId) {
      const project = await projectRepository.findById(projectId);
      if (project) {
        const projStart = new Date(project.startDate);
        const projEnd = new Date(project.endDate);
        if (extracted.fromDate && extracted.toDate) {
          if (fromDateObj < projStart) {
            fromDateObj = projStart;
            validationNotes += (validationNotes ? '; ' : '') + `Adjusted search start date to project timeline start (${projStart.toISOString().split('T')[0]})`;
          }
          if (toDateObj > projEnd) {
            toDateObj = projEnd;
            validationNotes += (validationNotes ? '; ' : '') + `Adjusted search end date to project timeline end (${projEnd.toISOString().split('T')[0]})`;
          }
          if (fromDateObj > projEnd || toDateObj < projStart || fromDateObj > toDateObj) {
            validationNotes += (validationNotes ? '; ' : '') + 'Requested date range is completely outside the project timeline';
          }
        } else {
          fromDateObj = projStart;
          toDateObj = projEnd;
        }
      }
    }

    for (const r of extracted.roles) {
      if (r.bandwidth !== null && r.bandwidth !== undefined) {
        if (r.bandwidth < 0) {
          validationNotes += (validationNotes ? '; ' : '') + `Negative bandwidth requested for role '${r.roleName}'`;
        } else if (r.bandwidth > maxWeeklyHours) {
          validationNotes += (validationNotes ? '; ' : '') + `Requested bandwidth for role '${r.roleName}' (${r.bandwidth} hrs/wk) exceeds company maximum (${maxWeeklyHours} hrs/wk)`;
        }
      }
    }

    const resources = await resourceRepository.findAll({ isActive: true });
    const activeAllocations = await allocationRepository.findAll({ status: 'ACTIVE' });

    const resourceAllocationsMap: Record<string, typeof activeAllocations> = {};
    for (const alloc of activeAllocations) {
      const resId = alloc.resourceId._id ? alloc.resourceId._id.toString() : alloc.resourceId.toString();
      if (!resourceAllocationsMap[resId]) {
        resourceAllocationsMap[resId] = [];
      }
      resourceAllocationsMap[resId].push(alloc);
    }

    const hasSkill = (r: typeof resources[0], skillName: string): boolean => {
      return r.skills.some(s => {
        const sObj = s.skillId as unknown as { name: string };
        return sObj && sObj.name.toLowerCase() === skillName.toLowerCase();
      });
    };

    const candidatesPerRole: Record<string, unknown[]> = {};
    const unfilledRolesProgrammatic: Record<string, string> = {};

    for (const role of extracted.roles) {
      if (!role.requiredSkills || role.requiredSkills.length === 0) {
        unfilledRolesProgrammatic[role.roleName] = 'No skills found matching this role title.';
        continue;
      }

      const matchingResources = resources.filter(r =>
        role.requiredSkills.some(sName => hasSkill(r, sName))
      );

      if (matchingResources.length === 0) {
        unfilledRolesProgrammatic[role.roleName] = 'Nobody in the organization has this skill at the required level (hire or train).';
        continue;
      }

      const availableResources = matchingResources.filter(r => {
        const resId = r._id.toString();
        const overlaps = (resourceAllocationsMap[resId] || []).filter(a => {
          const aFrom = new Date(a.fromDate);
          const aTo = new Date(a.toDate);
          return aFrom <= toDateObj && aTo >= fromDateObj;
        });
        const totalUtil = overlaps.reduce((sum, a) => sum + a.utilisationPercent, 0);
        const freeHours = ((100 - totalUtil) / 100) * maxWeeklyHours;
        const requiredHours = role.bandwidth || 0;
        if (requiredHours > 0) {
          return freeHours >= requiredHours;
        }
        return freeHours > 0;
      });

      if (availableResources.length === 0) {
        let earliestFreeDate: Date | null = null;
        for (const r of matchingResources) {
          const resId = r._id.toString();
          const overlaps = (resourceAllocationsMap[resId] || []).filter(a => {
            const aFrom = new Date(a.fromDate);
            const aTo = new Date(a.toDate);
            return aFrom <= toDateObj && aTo >= fromDateObj;
          });
          if (overlaps.length > 0) {
            const maxToDate = new Date(Math.max(...overlaps.map(a => new Date(a.toDate).getTime())));
            if (!earliestFreeDate || maxToDate < earliestFreeDate) {
              earliestFreeDate = maxToDate;
            }
          }
        }
        const dateStr = earliestFreeDate ? earliestFreeDate.toISOString().split('T')[0] : 'unknown date';
        unfilledRolesProgrammatic[role.roleName] = `All matching resources are allocated elsewhere until ${dateStr}.`;
        continue;
      }

      candidatesPerRole[role.roleName] = availableResources.map(r => {
        const resId = r._id.toString();
        const overlaps = (resourceAllocationsMap[resId] || []).filter(a => {
          const aFrom = new Date(a.fromDate);
          const aTo = new Date(a.toDate);
          return aFrom <= toDateObj && aTo >= fromDateObj;
        });
        const totalUtil = overlaps.reduce((sum, a) => sum + a.utilisationPercent, 0);
        const freeHours = ((100 - totalUtil) / 100) * maxWeeklyHours;
        const skills = r.skills.map((s) => {
          const skillObj = s.skillId as unknown as { name: string };
          const skillName = skillObj?.name || 'Unknown';
          const isRequested = role.requiredSkills.some(rs => rs.toLowerCase() === skillName.toLowerCase());
          if (isRequested) {
            const userRank = PROFICIENCY_RANK[s.proficiency] || 1;
            const requiredRank = PROFICIENCY_RANK[role.proficiency] || 1;
            if (userRank < requiredRank) {
              return `${skillName} (${s.proficiency}) [Note: Requested proficiency was ${role.proficiency}]`;
            }
          }
          return `${skillName} (${s.proficiency})`;
        });

        const activeAllocs = overlaps.map((a) => `${(a.projectId as unknown as { name: string }).name} (${a.utilisationPercent}%)`);

        return {
          resourceId: resId,
          name: (r.userId as unknown as { fullName?: string })?.fullName || 'Unknown',
          designation: r.designation,
          skills,
          freeHours,
          currentAllocations: activeAllocs
        };
      });
    }

    const assignPrompt = TEAM_MATCH_ASSIGN_PROMPT(
      fromDateObj.toISOString().split('T')[0],
      toDateObj.toISOString().split('T')[0],
      JSON.stringify(extracted.roles, null, 2),
      JSON.stringify(candidatesPerRole, null, 2),
      JSON.stringify(unfilledRolesProgrammatic, null, 2),
      validationNotes
    );

    try {
      let resultText = await llmService.generate(assignPrompt);
      modelsUsedList.push(llmService.lastModelUsed);
      resultText = resultText.trim();
      if (resultText.startsWith('```')) {
        resultText = resultText.replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
      }
      const parsed = JSON.parse(resultText) as {
        summary: string;
        assignments: unknown[];
      };
      const enrichedAssignments = (parsed.assignments || []).map((assignment: unknown) => {
        const asg = assignment as {
          status: string;
          assignedResource?: {
            resourceId: string;
            name: string;
            reason: string;
          };
          roleName: string;
        };
        if (asg.status === 'FILLED' && asg.assignedResource) {
          const resId = asg.assignedResource.resourceId;
          const foundResource = resources.find(r => r._id.toString() === resId);
          let candDetails: {
            skills?: string[];
            freeHours?: number;
            currentAllocations?: string[];
          } | null = null;
          for (const roleName of Object.keys(candidatesPerRole)) {
            const list = candidatesPerRole[roleName] as Array<{
              resourceId: string;
              skills: string[];
              freeHours: number;
              currentAllocations: string[];
            }>;
            const found = list.find(c => c.resourceId === resId);
            if (found) {
              candDetails = found;
              break;
            }
          }
          return {
            ...asg,
            assignedResource: {
              ...asg.assignedResource,
              designation: foundResource?.designation || '',
              skills: candDetails?.skills || foundResource?.skills.map(s => {
                const skillObj = s.skillId as unknown as { name: string };
                return `${skillObj?.name || 'Unknown'} (${s.proficiency})`;
              }) || [],
              freeHours: candDetails?.freeHours ?? 0,
              currentAllocations: candDetails?.currentAllocations || []
            }
          };
        }
        return assignment;
      });
      res.json({ success: true, summary: parsed.summary, assignments: enrichedAssignments, modelUsed: getModelUsed(modelsUsedList) });
    } catch {
      const assignedIds = new Set<string>();
      const assignments = extracted.roles.map(role => {
        if (unfilledRolesProgrammatic[role.roleName]) {
          return {
            roleName: role.roleName,
            status: 'UNFILLED',
            unfilledReason: unfilledRolesProgrammatic[role.roleName]
          };
        }

        const candidates = (candidatesPerRole[role.roleName] || []) as Array<{ resourceId: string; name: string; designation: string; skills: string[]; freeHours: number; currentAllocations: string[] }>;
        const available = candidates.find(c => !assignedIds.has(c.resourceId));

        if (available) {
          assignedIds.add(available.resourceId);
          return {
            roleName: role.roleName,
            status: 'FILLED',
            assignedResource: {
              resourceId: available.resourceId,
              name: available.name,
              reason: `Factual match: designation is ${available.designation}`,
              designation: available.designation,
              skills: available.skills,
              freeHours: available.freeHours,
              currentAllocations: available.currentAllocations
            }
          };
        }

        return {
          roleName: role.roleName,
          status: 'UNFILLED',
          unfilledReason: 'No matching resource is available.'
        };
      });
      res.json({
        success: true,
        summary: `AI Team fallback summary. Assignments evaluated: ${assignments.length}. ${validationNotes ? 'Warnings: ' + validationNotes : ''}`,
        assignments,
        modelUsed: getModelUsed(modelsUsedList)
      });
    }
  } catch (error) {
    handleControllerError(error, res);
  }
});

function handleControllerError(error: unknown, res: Response): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error('[AiRoute] Unexpected error:', error);
  res.status(500).json({ error: COMMON_ERRORS.UNEXPECTED });
}

export default router;
