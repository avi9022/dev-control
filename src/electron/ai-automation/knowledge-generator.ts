import { spawn, execFileSync } from 'child_process'

let resolvedClaudePath: string | null = null

function getClaudePath(): string {
  if (resolvedClaudePath) return resolvedClaudePath
  try {
    resolvedClaudePath = execFileSync('which', ['claude'], { encoding: 'utf-8' }).trim()
  } catch {
    resolvedClaudePath = 'claude'
  }
  return resolvedClaudePath
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

export function generateKnowledgeDoc(projectPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claudePath = getClaudePath()

    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions',
      '--allowedTools', 'Read,Glob,Grep,Bash(find:*),Bash(ls:*),Bash(cat:*),Bash(git:*)',
      '--system-prompt', KNOWLEDGE_SYSTEM_PROMPT,
      '--',
      `Explore and document this project at: ${projectPath}`,
    ]

    const child = spawn(claudePath, args, {
      cwd: projectPath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    child.stdin?.end()

    let fullOutput = ''
    let stdoutBuffer = ''

    function extractText(event: Record<string, unknown>) {
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
    }

    child.stdout?.on('data', (data: Buffer) => {
      stdoutBuffer += data.toString()
      const lines = stdoutBuffer.split('\n')
      stdoutBuffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          extractText(JSON.parse(line))
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
          extractText(JSON.parse(stdoutBuffer))
        } catch {
          // ignore
        }
      }

      if (code !== 0 && !fullOutput.trim()) {
        reject(new Error(`Claude exited with code ${code}: ${stderrOutput.slice(0, 500)}`))
      } else {
        resolve(fullOutput.trim())
      }
    })

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`))
    })
  })
}
