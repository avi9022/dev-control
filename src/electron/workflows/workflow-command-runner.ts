import { ChildProcess, spawn } from 'child_process'
import treeKill from 'tree-kill'
import os from 'os'

const getUserShell = (): string => {
  return process.env.SHELL || os.userInfo().shell || '/bin/zsh'
}

interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

interface RunCommandOptions {
  cwd?: string
  timeoutMs?: number
  signal?: AbortSignal
  onOutput?: (data: string) => void
}

export const runCommand = (
  command: string,
  options: RunCommandOptions = {}
): Promise<CommandResult> => {
  const { cwd, timeoutMs = 60000, signal, onOutput } = options

  return new Promise((resolve, reject) => {
    const userShell = getUserShell()
    let stdout = ''
    let stderr = ''
    let settled = false

    const child: ChildProcess = spawn(userShell, ['-l', '-c', command], {
      cwd: cwd || process.cwd(),
      env: process.env,
    })

    const settle = (result: CommandResult | Error) => {
      if (settled) return
      settled = true
      if (result instanceof Error) {
        reject(result)
      } else {
        resolve(result)
      }
    }

    const killChild = () => {
      if (child.pid !== undefined) {
        treeKill(child.pid, 'SIGTERM', (err) => {
          if (err && child.pid !== undefined) {
            treeKill(child.pid, 'SIGKILL', () => {})
          }
        })
      }
    }

    // Timeout
    const timer = setTimeout(() => {
      killChild()
      settle(new Error(`Command timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    // Abort signal
    if (signal) {
      if (signal.aborted) {
        killChild()
        clearTimeout(timer)
        settle(new Error('Command aborted'))
        return
      }
      signal.addEventListener('abort', () => {
        killChild()
        clearTimeout(timer)
        settle(new Error('Command aborted'))
      }, { once: true })
    }

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      stdout += text
      onOutput?.(text)
    })

    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      stderr += text
      onOutput?.(text)
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      settle(err)
    })

    child.on('exit', (code) => {
      clearTimeout(timer)
      settle({ exitCode: code ?? 1, stdout, stderr })
    })
  })
}
