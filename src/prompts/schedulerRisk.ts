export const SCHEDULER_RISK_PROMPT = (
  projectName: string,
  description: string,
  reason: string,
  milestonesText: string,
  resourcesText: string
) => `
You are an AI assistant helping a project manager resolve project risks.
Project "${projectName}" has been marked as AT_RISK.
Description: ${description || 'No description provided.'}
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
