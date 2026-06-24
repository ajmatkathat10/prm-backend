export const RISK_SUMMARY_PROMPT = (
  projectName: string,
  description: string,
  startDate: string,
  endDate: string,
  totalStoryPoints: number,
  milestonesStr: string,
  allocationsStr: string,
  lastWeekStart: string,
  expectedHours: number,
  loggedHours: number
) => `
You are an AI assistant analyzing project risks and health.
Analyze the following project facts and write a brief, plain-English summary of risks and concerns (maximum 1 paragraph, about 3-4 sentences). Do not perform a raw data dump; instead, write in clear, everyday language.

Project Name: ${projectName}
Description: ${description}
Start Date: ${startDate}
End Date: ${endDate}
Total Story Points: ${totalStoryPoints}

Milestones:
${milestonesStr}

Allocations:
${allocationsStr}

Last Week's Effort Details (Week starting ${lastWeekStart}):
- Expected Hours: ${expectedHours}
- Logged Hours: ${loggedHours}

Write a readable, plain-English paragraph highlighting overdue milestones, low logged hours compared to expectations, resource allocation gaps, or timeline risks.
`;
