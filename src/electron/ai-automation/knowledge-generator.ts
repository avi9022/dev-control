import { spawn, execFileSync } from 'child_process'
import { BrowserWindow } from 'electron'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'

let resolvedClaudePath: string | null = null
let mainWindow: BrowserWindow | null = null

export function setKnowledgeGenMainWindow(window: BrowserWindow) {
  mainWindow = window
}

function getClaudePath(): string {
  if (resolvedClaudePath) return resolvedClaudePath
  try {
    resolvedClaudePath = execFileSync('which', ['claude'], { encoding: 'utf-8' }).trim()
  } catch {
    resolvedClaudePath = 'claude'
  }
  return resolvedClaudePath
}

function emitProgress(status: string) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    ipcWebContentsSend('aiKnowledgeGenProgress', mainWindow.webContents, status)
  }
}

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

function formatToolName(event: Record<string, unknown>): string | null {
  if (event.type === 'assistant') {
    const content = (event.message as Record<string, unknown>)?.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_use') {
          const name = block.name as string
          const input = block.input as Record<string, unknown> | undefined
          if (name === 'Read' && input?.file_path) return `Reading ${(input.file_path as string).split('/').pop()}`
          if (name === 'Glob' && input?.pattern) return `Searching ${input.pattern}`
          if (name === 'Grep' && input?.pattern) return `Grepping "${input.pattern}"`
          if ((name === 'Bash' || name === 'bash') && input?.command) return `Running ${(input.command as string).slice(0, 50)}`
          return `Using ${name}`
        }
      }
    }
  }
  return null
}

export function generateKnowledgeDoc(projectPath: string): Promise<string> {
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

    emitProgress('Starting Claude...')

    const child = spawn(claudePath, args, {
      cwd: projectPath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    child.stdin?.end()

    let fullOutput = ''
    let stdoutBuffer = ''
    let toolCount = 0

    function processEvent(event: Record<string, unknown>) {
      // Extract text output
      if (event.type === 'assistant') {
        const content = (event.message as Record<string, unknown>)?.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              fullOutput += block.text
            }
          }
        }
      } else if (event.type === 'result' && event.result) {
        fullOutput += event.result
      }

      // Emit progress for tool use
      const toolStatus = formatToolName(event)
      if (toolStatus) {
        toolCount++
        emitProgress(`${toolStatus} (${toolCount} operations)`)
      }

      if (event.type === 'system' && (event.subtype as string) === 'init') {
        emitProgress('Agent initialized, exploring codebase...')
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
        emitProgress('')
        reject(new Error(`Claude exited with code ${code}: ${stderrOutput.slice(0, 500)}`))
      } else {
        emitProgress('')
        resolve(fullOutput.trim())
      }
    })

    child.on('error', (err) => {
      emitProgress('')
      reject(new Error(`Failed to spawn claude: ${err.message}`))
    })
  })
}
