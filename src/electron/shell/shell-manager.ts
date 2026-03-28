import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'

const shells = new Map<string, pty.IPty>()
let mainWindow: BrowserWindow | null = null

export function setShellMainWindow(window: BrowserWindow) {
  mainWindow = window
}

export function spawnShell(cwd: string): string {
  const id = randomUUID()
  const shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' },
  })

  shells.set(id, ptyProcess)

  ptyProcess.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      ipcWebContentsSend('shellOutput', mainWindow.webContents, { shellId: id, output: data })
    }
  })

  ptyProcess.onExit(({ exitCode }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      ipcWebContentsSend('shellExit', mainWindow.webContents, { shellId: id, exitCode })
    }
    shells.delete(id)
  })

  return id
}

export function writeShell(id: string, data: string): void {
  shells.get(id)?.write(data)
}

export function resizeShell(id: string, cols: number, rows: number): void {
  shells.get(id)?.resize(cols, rows)
}

export function killShell(id: string): void {
  const proc = shells.get(id)
  if (proc) {
    proc.kill()
    shells.delete(id)
  }
}

export function killAllShells(): void {
  for (const [id, proc] of shells) {
    proc.kill()
    shells.delete(id)
  }
}
