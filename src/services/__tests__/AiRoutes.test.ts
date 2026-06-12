import { test } from 'node:test';
import assert from 'node:assert';
import router from '../../routes/ai.js';
import { resourceRepository } from '../../repositories/ResourceRepository.js';
import { allocationRepository } from '../../repositories/AllocationRepository.js';
import { systemConfigRepository } from '../../repositories/SystemConfigRepository.js';
import { projectRepository } from '../../repositories/ProjectRepository.js';
import { llmService } from '../LlmService.js';
import { Timesheet } from '../../models/Timesheet.js';
import { IResource } from '../../models/Resource.js';
import { IAllocation } from '../../models/Allocation.js';
import { IProject } from '../../models/Project.js';
import { ISystemConfig } from '../../models/SystemConfig.js';
import { skillRepository } from '../../repositories/SkillRepository.js';
import { ISkill } from '../../models/Skill.js';

interface FakeResponse {
  success: boolean;
  results?: Array<{ name: string }>;
  assignments?: Array<{ roleName: string; status: string; unfilledReason: string }>;
  summary?: string;
}

test('AI Router - skill-match returns correct suggestions', async () => {
  const route = router.stack.find(l => l.route?.path === '/skill-match')?.route;
  const handler = route?.stack?.[0]?.handle;
  if (!handler) {
    throw new Error('Handler not found');
  }

  const originalGetConfig = systemConfigRepository.getConfig;
  const originalFindAllRes = resourceRepository.findAll;
  const originalFindAllAlloc = allocationRepository.findAll;
  const originalGenerate = llmService.generate;
  const originalTimesheetFind = Timesheet.find;
  const originalSkillFindAll = skillRepository.findAll;

  systemConfigRepository.getConfig = async () => ({ maxWeeklyHours: 40 } as ISystemConfig);
  skillRepository.findAll = async () => [
    { _id: 'ReactId', name: 'React' }
  ] as unknown as ISkill[];
  resourceRepository.findAll = async () => [
    {
      _id: 'res1',
      isActive: true,
      skills: [{ skillId: { _id: 'ReactId', name: 'React' }, proficiency: 'ADVANCED' }],
      userId: { fullName: 'Priya Sharma' }
    }
  ] as unknown as IResource[];

  allocationRepository.findAll = async () => [] as unknown as IAllocation[];
  Timesheet.find = (async () => []) as unknown as typeof Timesheet.find;
  llmService.generate = async (prompt: string) => {
    if (prompt.includes('extract structured search filters')) {
      return JSON.stringify({
        roleName: 'React Developer',
        requiredSkills: ['React'],
        fromDate: '2026-06-10',
        toDate: '2026-07-10',
        bandwidth: 40,
        proficiency: 'ADVANCED',
        validationNotes: null
      });
    }
    return JSON.stringify({
      summary: 'Matches found.',
      results: [
        { resourceId: 'res1', name: 'Priya Sharma', reason: 'Fits React skill', suggestedAllocation: 100 }
      ]
    });
  };

  const req = {
    body: { requirement: 'Need a React developer' }
  };

  const jsonResult = { data: null as FakeResponse | null };
  const res = {
    status: function() {
      return this;
    },
    json: (data: FakeResponse) => {
      jsonResult.data = data;
    }
  };

  try {
    await handler(req as unknown as import('express').Request, res as unknown as import('express').Response, () => {});
    if (!jsonResult.data) {
      throw new Error('No json result');
    }
    assert.ok(jsonResult.data.success);
    assert.strictEqual(jsonResult.data.results?.length, 1);
    assert.strictEqual(jsonResult.data.results?.[0].name, 'Priya Sharma');
  } finally {
    systemConfigRepository.getConfig = originalGetConfig;
    resourceRepository.findAll = originalFindAllRes;
    allocationRepository.findAll = originalFindAllAlloc;
    llmService.generate = originalGenerate;
    Timesheet.find = originalTimesheetFind;
    skillRepository.findAll = originalSkillFindAll;
  }
});

test('AI Router - team-match detects skills gap and availability conflicts', async () => {
  const route = router.stack.find(l => l.route?.path === '/team-match')?.route;
  const handler = route?.stack?.[0]?.handle;
  if (!handler) {
    throw new Error('Handler not found');
  }

  const originalGetConfig = systemConfigRepository.getConfig;
  const originalFindAllRes = resourceRepository.findAll;
  const originalFindAllAlloc = allocationRepository.findAll;
  const originalGenerate = llmService.generate;
  const originalSkillFindAll = skillRepository.findAll;

  systemConfigRepository.getConfig = async () => ({ maxWeeklyHours: 40 } as ISystemConfig);
  skillRepository.findAll = async () => [
    { _id: 'DockerId', name: 'Docker' },
    { _id: 'RustId', name: 'Rust' }
  ] as unknown as ISkill[];
  
  resourceRepository.findAll = async () => [
    {
      _id: 'res_busy',
      isActive: true,
      skills: [{ skillId: { name: 'Docker' }, proficiency: 'INTERMEDIATE' }],
      userId: { fullName: 'Dev Patel' },
      designation: 'Devops Engineer'
    }
  ] as unknown as IResource[];

  allocationRepository.findAll = async () => [
    {
      resourceId: { _id: 'res_busy' },
      utilisationPercent: 100,
      fromDate: new Date('2026-06-01'),
      toDate: new Date('2026-08-31'),
      status: 'ACTIVE'
    }
  ] as unknown as IAllocation[];

  llmService.generate = async (prompt: string) => {
    if (prompt.includes('extract structured role filters and project timelines')) {
      return JSON.stringify({
        fromDate: '2026-06-10',
        toDate: '2026-07-10',
        roles: [
          { roleName: 'Devops Engineer', requiredSkills: ['Docker'], proficiency: 'INTERMEDIATE', bandwidth: 40 },
          { roleName: 'Rust Engineer', requiredSkills: ['Rust'], proficiency: 'ADVANCED', bandwidth: 40 }
        ],
        validationNotes: null
      });
    }
    return JSON.stringify({
      summary: 'Gaps detected.',
      assignments: [
        {
          roleName: 'Devops Engineer',
          status: 'UNFILLED',
          unfilledReason: 'All matching resources are allocated elsewhere until 2026-08-31.'
        },
        {
          roleName: 'Rust Engineer',
          status: 'UNFILLED',
          unfilledReason: 'Nobody in the organization has this skill at the required level (hire or train).'
        }
      ]
    });
  };

  const req = {
    body: {
      requirement: 'Need a DevOps Engineer for 40 hours and a Rust Engineer for 40 hours from 2026-06-10 to 2026-07-10'
    }
  };

  const jsonResult = { data: null as FakeResponse | null };
  const res = {
    status: function() {
      return this;
    },
    json: (data: FakeResponse) => {
      jsonResult.data = data;
    }
  };

  try {
    await handler(req as unknown as import('express').Request, res as unknown as import('express').Response, () => {});
    if (!jsonResult.data || !jsonResult.data.assignments) {
      throw new Error('No json result or assignments');
    }
    assert.ok(jsonResult.data.success);
    
    const dockerResult = jsonResult.data.assignments.find((a) => a.roleName === 'Devops Engineer');
    assert.ok(dockerResult);
    assert.strictEqual(dockerResult.status, 'UNFILLED');
    assert.ok(dockerResult.unfilledReason.includes('allocated elsewhere until 2026-08-31'));

    const rustResult = jsonResult.data.assignments.find((a) => a.roleName === 'Rust Engineer');
    assert.ok(rustResult);
    assert.strictEqual(rustResult.status, 'UNFILLED');
    assert.ok(rustResult.unfilledReason.includes('Nobody in the organization has this skill'));
  } finally {
    systemConfigRepository.getConfig = originalGetConfig;
    resourceRepository.findAll = originalFindAllRes;
    allocationRepository.findAll = originalFindAllAlloc;
    llmService.generate = originalGenerate;
    skillRepository.findAll = originalSkillFindAll;
  }
});

test('AI Router - risk-summary returns health summaries and handles fallback', async () => {
  const route = router.stack.find(l => l.route?.path === '/risk-summary')?.route;
  const handler = route?.stack?.[0]?.handle;
  if (!handler) {
    throw new Error('Handler not found');
  }

  const originalFindById = projectRepository.findById;
  const originalFindAllAlloc = allocationRepository.findAll;
  const originalGetConfig = systemConfigRepository.getConfig;
  const originalGenerate = llmService.generate;
  const originalTimesheetFind = Timesheet.find;

  projectRepository.findById = async () => ({
    _id: 'proj1',
    name: 'Alpha Portal',
    startDate: new Date('2026-05-01'),
    endDate: new Date('2026-12-01'),
    totalStoryPoints: 100,
    milestones: [{ title: 'Backend API', dueDate: new Date('2026-05-10'), status: 'IN_PROGRESS', storyPoints: 20 }]
  } as unknown as IProject);

  allocationRepository.findAll = async () => [] as unknown as IAllocation[];
  systemConfigRepository.getConfig = async () => ({ maxWeeklyHours: 40 } as ISystemConfig);
  Timesheet.find = (async () => []) as unknown as typeof Timesheet.find;

  llmService.generate = async () => {
    throw new Error('LLM connection failed');
  };

  const req = {
    body: { projectId: 'proj1' }
  };

  const jsonResult = { data: null as FakeResponse | null };
  const res = {
    status: function() {
      return this;
    },
    json: (data: FakeResponse) => {
      jsonResult.data = data;
    }
  };

  try {
    await handler(req as unknown as import('express').Request, res as unknown as import('express').Response, () => {});
    if (!jsonResult.data) {
      throw new Error('No json result');
    }
    assert.ok(jsonResult.data.success);
    assert.ok(jsonResult.data.summary?.includes("The milestone 'Backend API' is overdue."));
  } finally {
    projectRepository.findById = originalFindById;
    allocationRepository.findAll = originalFindAllAlloc;
    systemConfigRepository.getConfig = originalGetConfig;
    llmService.generate = originalGenerate;
    Timesheet.find = originalTimesheetFind;
  }
});
