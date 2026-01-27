import { execFile, spawn, type ChildProcess } from 'child_process'

interface DockerCliOptions {
  context?: string
  timeout?: number
}

const DEFAULT_TIMEOUT = 30_000

class DockerCli {
  execSafe(args: string[], options?: DockerCliOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const fullArgs = this.buildArgs(args, options)
      const timeout = options?.timeout ?? DEFAULT_TIMEOUT

      execFile('docker', fullArgs, { timeout }, (error, stdout, stderr) => {
        if (error) {
          const message = stderr?.trim() || error.message
          reject(new Error(`Docker command failed: ${message}`))
          return
        }
        resolve(stdout.trim())
      })
    })
  }

  async execJson<T>(args: string[], options?: DockerCliOptions): Promise<T[]> {
    const output = await this.execSafe(args, options)
    if (!output) return []

    return output
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => JSON.parse(line) as T)
  }

  async execJsonSingle<T>(args: string[], options?: DockerCliOptions): Promise<T> {
    const output = await this.execSafe(args, options)
    return JSON.parse(output) as T
  }

  stream(
    args: string[],
    onData: (line: string) => void,
    options?: DockerCliOptions
  ): ChildProcess {
    const fullArgs = this.buildArgs(args, options)
    const child = spawn('docker', fullArgs)

    let buffer = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim().length > 0) {
          onData(line)
        }
      }
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim()
      if (text.length > 0) {
        onData(`[stderr] ${text}`)
      }
    })

    return child
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.execSafe(['version', '--format', '{{.Client.Version}}'], { timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  private buildArgs(args: string[], options?: DockerCliOptions): string[] {
    if (options?.context) {
      return ['--context', options.context, ...args]
    }
    return args
  }
}

export const dockerCli = new DockerCli()
