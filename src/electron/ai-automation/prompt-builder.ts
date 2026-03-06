import { getSettings } from './task-manager.js'

const DEFAULT_PLANNER_PROMPT = `You are a planning agent. Your job is to:
1. Understand the task described below
2. Explore the relevant codebases to understand the current state
3. Ask clarifying questions if anything is unclear
4. Produce a detailed implementation plan

Output your plan in markdown format. Be specific about:
- Which files need to be created or modified
- What changes need to be made
- What the expected outcome is
- Any risks or considerations`

const DEFAULT_WORKER_PROMPT = `You are an implementation agent. Your job is to:
1. Follow the plan provided below
2. Implement the changes described in the plan
3. Create commits for your work
4. Ask for help if you get stuck

Work methodically through the plan step by step.`

const DEFAULT_REVIEWER_PROMPT = `You are a code review agent. Your job is to:
1. Review the code changes against the plan and requirements
2. Check for bugs, security issues, and code quality
3. Provide specific, actionable feedback

At the end of your review, you MUST output one of:
- REVIEW_DECISION: APPROVE — if the changes are acceptable
- REVIEW_DECISION: REJECT — if changes need work, followed by your comments`

export function buildPrompt(task: AITask, role: AIAgentRole): string {
  const settings = getSettings()
  const parts: string[] = []

  // 1. Global rules
  if (settings.globalRules.trim()) {
    parts.push(`## Global Rules\n\n${settings.globalRules}`)
  }

  // 2. Phase-specific prompt
  const phasePrompt = role === 'planner'
    ? (settings.phasePrompts.planning || DEFAULT_PLANNER_PROMPT)
    : role === 'worker'
    ? (settings.phasePrompts.working || DEFAULT_WORKER_PROMPT)
    : (settings.phasePrompts.reviewing || DEFAULT_REVIEWER_PROMPT)
  parts.push(`## Agent Instructions\n\n${phasePrompt}`)

  // 3. Knowledge docs
  if (settings.knowledgeDocs.length > 0) {
    const docs = settings.knowledgeDocs.map(d => `### ${d.title}\n\n${d.content}`).join('\n\n')
    parts.push(`## Project Knowledge\n\n${docs}`)
  }

  // 4. Task context
  parts.push(`## Task\n\n**Title:** ${task.title}\n\n**Description:** ${task.description}`)

  if (role === 'worker' && task.plan) {
    parts.push(`## Plan\n\n${task.plan}`)
  }

  if (role === 'worker' && task.reviewComments && task.reviewComments.length > 0) {
    const comments = task.reviewComments.map(c =>
      `- ${c.file}${c.line ? `:${c.line}` : ''} [${c.severity}]: ${c.comment}`
    ).join('\n')
    parts.push(`## Review Comments to Address\n\n${comments}`)
  }

  if (role === 'worker' && task.humanComments && task.humanComments.length > 0) {
    const comments = task.humanComments.map(c =>
      `- ${c.file}:${c.line}: ${c.comment}`
    ).join('\n')
    parts.push(`## Human Review Comments to Address\n\n${comments}`)
  }

  if (role === 'reviewer' && task.plan) {
    parts.push(`## Original Plan\n\n${task.plan}`)
  }

  return parts.join('\n\n---\n\n')
}
