export const SKILL_MATCH_EXTRACT_PROMPT = (allowedSkills: string[], requirement: string) => `
You are an AI assistant that parses a plain English resource requirement text to extract structured search filters.
Allowed database skills:
${JSON.stringify(allowedSkills, null, 2)}

Requirement:
"${requirement}"

Instructions:
1. Extract the requested role title ("roleName"), e.g. "React Developer".
2. Extract the required skills, mapping them to standard names from the allowed database skills. Correct any typos or abbreviations. If a general role like "QA Tester" or "tester" is requested, map it to relevant testing skills in the list such as "UI Testing" or "Manual Testing" if they exist (rather than listing every QA tool in the catalog unless explicitly asked).
3. Extract "fromDate" and "toDate" in YYYY-MM-DD format if mentioned. If relative timeline is mentioned (e.g., "next month"), estimate the dates relative to today.
4. Extract requested weekly "bandwidth" (hours per week). If not explicitly mentioned, return null.
5. Extract requested minimum "proficiency" level ('BEGINNER', 'INTERMEDIATE', 'ADVANCED'). If not mentioned, return null.
6. Identify any wrong or contradictory information (e.g., start date after end date, negative bandwidth, requested hours > 40, or invalid dates). Explain this in the "validationNotes" field.

Return your response strictly in the following JSON format without markdown blocks:
{
  "roleName": "string or null",
  "requiredSkills": ["string"],
  "fromDate": "string (YYYY-MM-DD) or null",
  "toDate": "string (YYYY-MM-DD) or null",
  "bandwidth": number or null,
  "proficiency": "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null,
  "validationNotes": "string or null"
}
`;

export const TEAM_MATCH_EXTRACT_PROMPT = (allowedSkills: string[], requirement: string) => `
You are an AI assistant that parses a plain English team staffing requirement text to extract structured role filters and project timelines.
Allowed database skills:
${JSON.stringify(allowedSkills, null, 2)}

Team Requirement:
"${requirement}"

Instructions:
1. Extract "fromDate" and "toDate" in YYYY-MM-DD format for the team project. If relative timeline is mentioned, estimate the dates relative to today.
2. Extract the list of requested roles. For each role:
   - Identify "roleName" (e.g. "React Developer").
   - Extract "requiredSkills", mapping them to standard names from the allowed database skills. If a general role like "QA Tester" or "tester" is requested, map it to relevant testing skills in the list such as "UI Testing" or "Manual Testing" if they exist (rather than listing every QA tool in the catalog unless explicitly asked).
   - Extract minimum requested "proficiency" level ('BEGINNER', 'INTERMEDIATE', 'ADVANCED'). Default to 'INTERMEDIATE' if not specified.
   - Extract weekly "bandwidth" (hours per week) for this role.
3. Identify any wrong or contradictory information (e.g., start date after end date, negative hours, or invalid dates). Explain this in the "validationNotes" field.

Return your response strictly in the following JSON format without markdown blocks:
{
  "fromDate": "string (YYYY-MM-DD) or null",
  "toDate": "string (YYYY-MM-DD) or null",
  "roles": [
    {
      "roleName": "string",
      "requiredSkills": ["string"],
      "proficiency": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
      "bandwidth": number or null
    }
  ],
  "validationNotes": "string or null"
}
`;

export const SKILL_MATCH_RANK_PROMPT = (
  requirement: string,
  fromDateStr: string,
  toDateStr: string,
  bandwidth: string,
  roleName: string,
  skillsStr: string,
  candidatesStr: string,
  maxWeeklyHours: number,
  validationNotes?: string | null
) => `
You are an AI assistant designed to match resources to project requirements.
The user requirement:
"${requirement}"
Target Date Range: from ${fromDateStr} to ${toDateStr}
Required Bandwidth: ${bandwidth} hours/week
Normalized Role: ${roleName}
Normalized Skills: ${skillsStr}

Validation / Wrong Information Identified: ${validationNotes || 'None'}

Here is the list of available candidates:
${candidatesStr}

The organization's max weekly hours is ${maxWeeklyHours}.

Instructions:
1. Write a natural English analysis/summary explaining the matching process. Mention if any wrong or contradictory inputs were identified, how dates were adjusted, or if there is a proficiency/capacity mismatch.
2. Rank the top candidates (up to 5) who are the best fit.
3. Note: If a candidate has a skill with '[Note: Requested proficiency was ...]', they have a lower proficiency than requested. You may still include them if available, but you must clearly indicate this proficiency gap in their reason.

Return your response strictly in the following JSON format without markdown blocks:
{
  "summary": "string in natural English summarizing the match results, including notes about corrected wrong inputs or proficiency gaps",
  "results": [
    {
      "resourceId": "string",
      "name": "string",
      "reason": "string",
      "suggestedAllocation": number
    }
  ]
}
`;

export const TEAM_MATCH_ASSIGN_PROMPT = (
  fromDateStr: string,
  toDateStr: string,
  rolesStr: string,
  candidatesStr: string,
  unfilledStr: string,
  validationNotes?: string | null
) => `
You are an AI assistant designed to form a project team.
The team period is from ${fromDateStr} to ${toDateStr}.
Requested Roles:
${rolesStr}

Available candidates per role:
${candidatesStr}

Roles that cannot be filled programmatically:
${unfilledStr}

Validation / Wrong Information Identified: ${validationNotes || 'None'}

Perform a single-pass optimal team assignment.
Constraints:
- Assign at most one candidate to each role.
- A candidate can only be assigned to a single role across the entire team.
- Maximize the total number of filled roles.
- If a role is unfilled because of programmatic gaps, preserve that unfilled status and the exact reason.
- If a role has candidates but they were assigned to other roles, mark it UNFILLED with the reason "Resource already assigned to another role".
Note: If a candidate has a skill with the note '[Note: Requested proficiency was ...]', they have a lower proficiency level than requested. You should still assign them if available, but make sure to include a clear note about this proficiency gap in their assignment reason.

Instructions:
1. Write a natural English analysis/summary explaining the team assignment process. Mention if any wrong or contradictory inputs were identified, how dates were adjusted, or if there is a proficiency/capacity mismatch.

Return your response strictly in the following JSON format without markdown code blocks:
{
  "summary": "string in natural English summarizing the team builder results, including notes about corrected wrong inputs or proficiency gaps",
  "assignments": [
    {
      "roleName": "string",
      "status": "FILLED" | "UNFILLED",
      "assignedResource": {
        "resourceId": "string",
        "name": "string",
        "reason": "string"
      },
      "unfilledReason": "string"
    }
  ]
}
`;

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
