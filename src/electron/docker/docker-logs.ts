/**
 * Docker container log operations: fetch and stream logs.
 */

import { dockerCli } from './docker-cli.js'
import { validateContainerId } from './docker-utils.js'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import type { BrowserWindow } from 'electron'
import type { ChildProcess } from 'child_process'

interface CliOptions {
  context: string
}

export async function getContainerLogs(
  id: string,
  options: DockerLogOptions,
  opts: CliOptions
): Promise<string[]> {
  const safeId = validateContainerId(id)
  const args = ['logs']

  if (options.tail !== undefined) {
    args.push('--tail', String(options.tail))
  }
  if (options.since) {
    args.push('--since', options.since)
  }
  if (options.timestamps) {
    args.push('--timestamps')
  }

  args.push(safeId)

  const output = await dockerCli.execSafe(args, opts)
  if (!output) return []

  return output.split('\n').filter(line => line.length > 0)
}

export function streamContainerLogs(
  id: string,
  options: DockerLogOptions,
  opts: CliOptions,
  mainWindow: BrowserWindow | null,
  activeLogStreams: Map<string, ChildProcess>
): void {
  const safeId = validateContainerId(id)
  stopLogStream(id, activeLogStreams)

  const args = ['logs', '--follow']

  if (options.tail !== undefined) {
    args.push('--tail', String(options.tail))
  }
  if (options.since) {
    args.push('--since', options.since)
  }
  if (options.timestamps) {
    args.push('--timestamps')
  }

  args.push(safeId)

  const child = dockerCli.stream(
    args,
    (line) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        ipcWebContentsSend(
          'subscribeDockerLogs',
          mainWindow.webContents,
          { containerId: id, log: line }
        )
      }
    },
    opts
  )

  activeLogStreams.set(id, child)

  child.on('close', () => {
    activeLogStreams.delete(id)
  })
}

export function stopLogStream(
  id: string,
  activeLogStreams: Map<string, ChildProcess>
): void {
  const existing = activeLogStreams.get(id)
  if (existing) {
    existing.kill()
    activeLogStreams.delete(id)
  }
}
