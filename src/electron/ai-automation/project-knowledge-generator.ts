import { spawn } from 'child_process'
import { getClaudePath } from './claude-path.js'

const STDERR_TRUNCATE_LENGTH = 500

const PROFILE_REQUIRED_FIELDS: ReadonlyArray<keyof Pick<ProjectProfile, 'name' | 'summary' | 'stack' | 'responsibilities'>> = [
  'name',
  'summary',
  'stack',
  'responsibilities',
]

const GENERATION_SYSTEM_PROMPT = `You are a project analyst. Explore this project thoroughly and produce two outputs.

OUTPUT 1 — PROJECT PROFILE (JSON)
Produce a JSON block with these exact fields:
{
  "name": "human-readable project name",
  "summary": "1-2 sentences describing what this project IS and what it DOES",
  "stack": "comma-separated list of main technologies, frameworks, languages",
  "responsibilities": "2-3 sentences describing what this project OWNS and WHEN to involve it. Start with what it's responsible for, end with 'Touch this project when...'"
}

Wrap the JSON in \`\`\`json ... \`\`\` markers.

OUTPUT 2 — DETAILED KNOWLEDGE (Markdown)
Produce a markdown document with these exact section headers:

## Architecture
How the app/service is structured. Main modules, layers, organization pattern.

## Key Files
Entry points, config files, main modules. Reference actual file paths.

## API / Integrations
External services it talks to, internal APIs it exposes. Endpoints, base URLs.

## Data Flow
How data moves through the app. State management, data persistence.

## Development
How to run locally, environment variables needed, build/test commands.

Wrap the full markdown document in \`\`\`markdown ... \`\`\` markers.

Explore the codebase thoroughly before writing. Read package.json, config files, READMEs, key source files, and directory structure.`

function isValidProfileField(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function validateProfileFields(parsed: Record<string, unknown>): parsed is Record<'name' | 'summary' | 'stack' | 'responsibilities', string> {
  return PROFILE_REQUIRED_FIELDS.every((field) => isValidProfileField(parsed[field]))
}

function extractJsonBlock(output: string): Record<string, unknown> {
  const jsonMatch = output.match(/```json\s*\n([\s\S]*?)\n\s*```/)
  if (!jsonMatch?.[1]) {
    throw new Error('Failed to parse generation output: no ```json``` block found')
  }
  const parsed: unknown = JSON.parse(jsonMatch[1])
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Failed to parse generation output: JSON block is not an object')
  }
  return parsed as Record<string, unknown>
}

function extractMarkdownBlock(output: string): string {
  const mdMatch = output.match(/```markdown\s*\n([\s\S]*?)\n\s*```/)
  if (!mdMatch?.[1]) {
    throw new Error('Failed to parse generation output: no ```markdown``` block found')
  }
  return mdMatch[1].trim()
}

interface ProjectKnowledgeResult {
  profile: ProjectProfile
  knowledgeMarkdown: string
}

export function generateProjectKnowledge(
  projectPath: string,
  onProgress?: (message: string) => void
): Promise<ProjectKnowledgeResult> {
  return new Promise((resolve, reject) => {
    const claudePath = getClaudePath()

    const args = [
      '--print',
      '--dangerously-skip-permissions',
      '-p', `Analyze this project at: ${projectPath}`,
      '--system-prompt', GENERATION_SYSTEM_PROMPT,
    ]

    onProgress?.('Starting Claude...')

    const child = spawn(claudePath, args, {
      cwd: projectPath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    child.stdin?.end()

    let stdoutData = ''
    let stderrData = ''

    child.stdout?.on('data', (data: Buffer) => {
      stdoutData += data.toString()
    })

    child.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString()
      stderrData += chunk
      if (chunk.includes('tool')) {
        onProgress?.('Exploring codebase...')
      }
    })

    child.on('exit', (code) => {
      if (code !== 0 && !stdoutData.trim()) {
        reject(new Error(`Claude exited with code ${code}: ${stderrData.slice(0, STDERR_TRUNCATE_LENGTH)}`))
        return
      }

      onProgress?.('Parsing output...')

      try {
        const rawProfile = extractJsonBlock(stdoutData)

        if (!validateProfileFields(rawProfile)) {
          const missing = PROFILE_REQUIRED_FIELDS.filter((f) => !isValidProfileField(rawProfile[f]))
          throw new Error(`Profile missing required fields: ${missing.join(', ')}`)
        }

        const profile: ProjectProfile = {
          projectPath,
          name: rawProfile.name,
          summary: rawProfile.summary,
          stack: rawProfile.stack,
          responsibilities: rawProfile.responsibilities,
          generatedAt: new Date().toISOString(),
        }

        const knowledgeMarkdown = extractMarkdownBlock(stdoutData)

        onProgress?.('Done')
        resolve({ profile, knowledgeMarkdown })
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to parse generation output'))
      }
    })

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`))
    })
  })
}
