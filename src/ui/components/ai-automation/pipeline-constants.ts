export const ROLE_DEFINITIONS: { id: AIPipelineRole; label: string; tools: string }[] = [
  { id: 'worker',   label: 'Worker',   tools: 'Bash, Edit, Write, Read, Grep, Glob' },
  { id: 'planner',  label: 'Planner',  tools: 'Read, Grep, Glob, Write' },
  { id: 'reviewer', label: 'Reviewer', tools: 'Read, Grep, Glob' },
  { id: 'git',      label: 'Git',      tools: 'Bash(git *)' },
]

export const PHASE_TEMPLATES: { id: string; label: string; roles: AIPipelineRole[]; prompt: string; color: string }[] = [
  {
    id: 'implementation',
    label: 'Implementation',
    roles: ['worker', 'git'],
    prompt: 'You are an implementation agent. Follow the plan and implement the changes. Create commits for your work.',
    color: '#4DA870',
  },
  {
    id: 'planning',
    label: 'Planning',
    roles: ['planner', 'git'],
    prompt: 'You are a planning agent. Explore the codebase and produce a detailed implementation plan. Do NOT implement any changes.',
    color: '#6B7FD7',
  },
  {
    id: 'review',
    label: 'Code Review',
    roles: ['reviewer', 'git'],
    prompt: 'You are a code review agent. Review the changes for bugs, security issues, and code quality. Provide actionable feedback.',
    color: '#D4A843',
  },
  {
    id: 'custom',
    label: 'Custom',
    roles: [],
    prompt: '',
    color: '#7C8894',
  },
]
