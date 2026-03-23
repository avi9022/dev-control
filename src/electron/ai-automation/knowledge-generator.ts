import { spawn } from 'child_process'
import { getClaudePath } from './claude-path.js'
import {
  type ClaudeStreamEvent,
  isAssistantEvent,
  isResultEvent,
  isSystemEvent,
  isToolUseBlock,
} from './stream-types.js'

const STDERR_TRUNCATE_LENGTH = 500

const KNOWLEDGE_SYSTEM_PROMPT = `You are a codebase analyst. Your job is to explore this project and produce a comprehensive knowledge document in markdown.

Explore the codebase thoroughly:
- Read package.json, config files, and READMEs
- Browse the directory structure
- Read key source files to understand patterns
- Check git history for recent activity

Produce a markdown document covering:
1. **Project Overview** — What this project does, in 2-3 sentences
2. **Tech Stack** — Languages, frameworks, key dependencies
3. **Architecture** — How the codebase is organized, main modules/layers
4. **File Structure** — Key directories and what they contain
5. **Patterns & Conventions** — Coding patterns, naming conventions, state management approach
6. **Key Configuration** — Important config files and what they control
7. **Development Setup** — How to run, build, test

Be specific and reference actual file paths. Keep it concise — aim for a document that gives a new developer (or AI agent) enough context to work effectively in this codebase.

Output ONLY the markdown document, no preamble or explanation.`

const COMMAND_PREVIEW_LENGTH = 50

function formatToolName(event: ClaudeStreamEvent): string | null {
  if (isAssistantEvent(event)) {
    const content = event.message.content
    if (content) {
      for (const block of content) {
        if (isToolUseBlock(block)) {
          const input = block.input
          if (block.name === 'Read' && input?.file_path) return `Reading ${input.file_path.split('/').pop()}`
          if (block.name === 'Glob' && input?.pattern) return `Searching ${input.pattern}`
          if (block.name === 'Grep' && input?.pattern) return `Grepping "${input.pattern}"`
          if ((block.name === 'Bash' || block.name === 'bash') && input?.command) return `Running ${input.command.slice(0, COMMAND_PREVIEW_LENGTH)}`
          return `Using ${block.name}`
        }
      }
    }
  }
  return null
}

export function generateKnowledgeDoc(projectPath: string, onProgress?: (status: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const claudePath = getClaudePath()

    const args = [
      '--print',
      '--verbose',
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions',
      '--allowedTools', 'Read,Glob,Grep,Bash(find:*),Bash(ls:*),Bash(cat:*),Bash(git:*)',
      '--system-prompt', KNOWLEDGE_SYSTEM_PROMPT,
      '--',
      `Explore and document this project at: ${projectPath}`,
    ]

    onProgress?.('Starting Claude...')

    const child = spawn(claudePath, args, {
      cwd: projectPath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    child.stdin?.end()

    let fullOutput = ''
    let stdoutBuffer = ''
    let toolCount = 0

    function processEvent(event: ClaudeStreamEvent): void {
      if (isAssistantEvent(event)) {
        const content = event.message.content
        if (content) {
          for (const block of content) {
            if (block.type === 'text') {
              fullOutput += block.text
            }
          }
        }
      } else if (isResultEvent(event) && event.result) {
        fullOutput += event.result
      }

      const toolStatus = formatToolName(event)
      if (toolStatus) {
        toolCount++
        onProgress?.(`${toolStatus} (${toolCount} operations)`)
      }

      if (isSystemEvent(event) && event.subtype === 'init') {
        onProgress?.('Exploring codebase...')
      }
    }

    child.stdout?.on('data', (data: Buffer) => {
      stdoutBuffer += data.toString()
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          processEvent(JSON.parse(line))
        } catch {
          // Not JSON, skip
        }
      }
    })

    let stderrOutput = ''
    child.stderr?.on('data', (data: Buffer) => {
      stderrOutput += data.toString()
    })

    child.on('exit', (code) => {
      if (stdoutBuffer.trim()) {
        try {
          processEvent(JSON.parse(stdoutBuffer))
        } catch {
          // ignore
        }
      }

      if (code !== 0 && !fullOutput.trim()) {
        reject(new Error(`Claude exited with code ${code}: ${stderrOutput.slice(0, STDERR_TRUNCATE_LENGTH)}`))
      } else {
        resolve(fullOutput.trim())
      }
    })

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`))
    })
  })
}
