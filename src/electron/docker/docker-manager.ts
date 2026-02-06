import { dockerCli } from './docker-cli.js'
import { store } from '../storage/store.js'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import type { BrowserWindow } from 'electron'
import { spawn, type ChildProcess } from 'child_process'
import { app, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import * as crypto from 'crypto'
import * as pty from 'node-pty'

const CONTAINER_ID_PATTERN = /^[a-zA-Z0-9]+$/
const SAFE_NAME_PATTERN = /^[a-zA-Z0-9._:/@-]+$/

function validateContainerId(id: string): string {
  if (!CONTAINER_ID_PATTERN.test(id)) {
    throw new Error(`Invalid container ID: ${id}`)
  }
  return id
}

function validateResourceName(name: string): string {
  if (!SAFE_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid resource name: ${name}`)
  }
  return name
}

function parseHumanSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)$/)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = match[2].toLowerCase()

  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 ** 2,
    mib: 1024 ** 2,
    gb: 1024 ** 3,
    gib: 1024 ** 3,
    tb: 1024 ** 4,
    tib: 1024 ** 4,
  }

  return Math.round(value * (multipliers[unit] ?? 0))
}

function parsePercentage(str: string): number {
  const cleaned = str.replace('%', '').trim()
  const val = parseFloat(cleaned)
  return Number.isNaN(val) ? 0 : val
}

function parsePortMappings(portsStr: string): DockerPortMapping[] {
  if (!portsStr || portsStr.trim() === '') return []

  return portsStr.split(',').reduce<DockerPortMapping[]>((acc, segment) => {
    const trimmed = segment.trim()
    if (!trimmed) return acc

    const match = trimmed.match(
      /(?:(\d+\.\d+\.\d+\.\d+):)?(\d+)->(\d+)\/(tcp|udp)/
    )
    if (match) {
      return [
        ...acc,
        {
          hostIp: match[1] || undefined,
          publicPort: parseInt(match[2], 10),
          privatePort: parseInt(match[3], 10),
          type: match[4] as 'tcp' | 'udp',
        },
      ]
    }

    const simpleMatch = trimmed.match(/(\d+)\/(tcp|udp)/)
    if (simpleMatch) {
      return [
        ...acc,
        {
          privatePort: parseInt(simpleMatch[1], 10),
          type: simpleMatch[2] as 'tcp' | 'udp',
        },
      ]
    }

    return acc
  }, [])
}

function parseMounts(mountsStr: string): DockerMount[] {
  // This is a basic parser for the truncated Mounts column from `docker ps`
  // For proper mount info, use docker inspect via getContainerMounts()
  if (!mountsStr || mountsStr.trim() === '') return []

  return mountsStr.split(',').reduce<DockerMount[]>((acc, segment) => {
    const trimmed = segment.trim()
    if (!trimmed) return acc

    return [
      ...acc,
      {
        type: 'volume',  // Default - actual type is determined by docker inspect
        source: trimmed,
        destination: '',
        readOnly: false,
      },
    ]
  }, [])
}

class DockerManager {
  private mainWindow: BrowserWindow | null = null
  private activeContext: string = '__all__'
  private defaultContext: string = 'default'
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private activeLogStreams: Map<string, ChildProcess> = new Map()
  private execSessions: Map<string, { ptyProcess: pty.IPty; containerId: string; shell: string }> = new Map()

  constructor() {
    const defaultContext = store.get('dockerSettings')?.defaultContext
    if (defaultContext) {
      this.defaultContext = defaultContext
    }
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  private getCliOptions(): { context: string } {
    if (this.activeContext === '__all__') {
      return { context: this.defaultContext }
    }
    return { context: this.activeContext }
  }

  // ─── Context Operations ───

  async getContexts(): Promise<DockerContext[]> {
    const raw = await dockerCli.execJson<{
      Name: string
      Description: string
      DockerEndpoint: string
      Current: boolean
      ContextType: string
    }>(['context', 'ls', '--format', '{{json .}}'], { context: this.defaultContext })

    return raw.map(ctx => ({
      name: ctx.Name,
      description: ctx.Description || '',
      endpoint: ctx.DockerEndpoint || '',
      isCurrent: ctx.Current,
      type: ctx.ContextType || 'moby',
    }))
  }

  switchContext(name: string): void {
    if (name !== '__all__') {
      validateResourceName(name)
    }
    this.activeContext = name
  }

  getActiveContext(): string {
    return this.activeContext
  }

  async isAvailable(): Promise<boolean> {
    return dockerCli.isAvailable()
  }

  // ─── Container Operations ───

  async getContainers(filters?: DockerContainerFilters): Promise<DockerContainer[]> {
    if (this.activeContext === '__all__') {
      return this.getContainersAllContexts(filters)
    }

    return this.getContainersForContext(this.activeContext, filters)
  }

  private async getContainersAllContexts(filters?: DockerContainerFilters): Promise<DockerContainer[]> {
    const contexts = await this.getContexts()
    const results = await Promise.all(
      contexts.map(async (ctx) => {
        try {
          const containers = await this.getContainersForContext(ctx.name, filters)
          return containers.map((c) => ({ ...c, dockerContext: ctx.name }))
        } catch {
          return []
        }
      })
    )

    const seen = new Set<string>()
    return results.flat().filter((c) => {
      if (seen.has(c.fullId)) return false
      seen.add(c.fullId)
      return true
    })
  }

  private async getContainersForContext(
    contextName: string,
    filters?: DockerContainerFilters
  ): Promise<DockerContainer[]> {
    const args = ['ps', '-a', '--format', '{{json .}}', '--no-trunc']

    if (filters?.state) {
      for (const state of filters.state) {
        args.push('--filter', `status=${state}`)
      }
    }
    if (filters?.name) {
      args.push('--filter', `name=${filters.name}`)
    }
    if (filters?.label) {
      args.push('--filter', `label=${filters.label}`)
    }
    if (filters?.network) {
      args.push('--filter', `network=${filters.network}`)
    }

    const raw = await dockerCli.execJson<{
      ID: string
      Names: string
      Image: string
      ImageID: string
      State: string
      Status: string
      CreatedAt: string
      Ports: string
      Labels: string
      Networks: string
      Mounts: string
    }>(args, { context: contextName })

    const containers: DockerContainer[] = raw.map(c => {
      const labels = this.parseLabels(c.Labels)
      return {
        id: c.ID.substring(0, 12),
        fullId: c.ID,
        name: c.Names.replace(/^\//, ''),
        image: c.Image,
        imageId: c.ImageID,
        state: c.State as DockerContainerState,
        status: c.Status,
        created: new Date(c.CreatedAt).getTime(),
        ports: parsePortMappings(c.Ports),
        labels,
        networks: c.Networks ? c.Networks.split(',').map(n => n.trim()) : [],
        mounts: parseMounts(c.Mounts),
        composeProject: labels['com.docker.compose.project'] || undefined,
        composeService: labels['com.docker.compose.service'] || undefined,
      }
    })

    return this.applyClientFilters(containers, filters)
  }

  async getContainer(id: string, dockerContext?: string): Promise<DockerContainer> {
    const safeId = validateContainerId(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    const output = await dockerCli.execSafe(
      ['inspect', '--format', '{{json .}}', safeId],
      opts
    )
    const raw = JSON.parse(output)

    const labels = raw.Config?.Labels ?? {}
    const ports = this.parseInspectPorts(raw.NetworkSettings?.Ports ?? {})
    const mounts: DockerMount[] = (raw.Mounts ?? []).map(
      (m: { Type: string; Name?: string; Source: string; Destination: string; RW: boolean }) => ({
        type: m.Type as DockerMount['type'],
        source: m.Source,
        destination: m.Destination,
        readOnly: !m.RW,
        volumeName: m.Type === 'volume' ? m.Name : undefined,
      })
    )
    const networks = Object.keys(raw.NetworkSettings?.Networks ?? {})

    return {
      id: raw.Id.substring(0, 12),
      fullId: raw.Id,
      name: (raw.Name || '').replace(/^\//, ''),
      image: raw.Config?.Image || '',
      imageId: raw.Image || '',
      state: raw.State?.Status as DockerContainerState,
      status: raw.State?.Status || '',
      created: new Date(raw.Created).getTime(),
      ports,
      labels,
      networks,
      mounts,
      composeProject: labels['com.docker.compose.project'] || undefined,
      composeService: labels['com.docker.compose.service'] || undefined,
    }
  }

  async startContainer(id: string, dockerContext?: string): Promise<void> {
    const safeId = validateContainerId(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    await dockerCli.execSafe(['start', safeId], opts)
  }

  async stopContainer(id: string, dockerContext?: string): Promise<void> {
    const safeId = validateContainerId(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    await dockerCli.execSafe(['stop', safeId], opts)
  }

  async restartContainer(id: string, dockerContext?: string): Promise<void> {
    const safeId = validateContainerId(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    await dockerCli.execSafe(['restart', safeId], opts)
  }

  async pauseContainer(id: string, dockerContext?: string): Promise<void> {
    const safeId = validateContainerId(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    await dockerCli.execSafe(['pause', safeId], opts)
  }

  async unpauseContainer(id: string, dockerContext?: string): Promise<void> {
    const safeId = validateContainerId(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    await dockerCli.execSafe(['unpause', safeId], opts)
  }

  async removeContainer(id: string, force: boolean, dockerContext?: string): Promise<void> {
    const safeId = validateContainerId(id)
    const args = force ? ['rm', '-f', safeId] : ['rm', safeId]
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    await dockerCli.execSafe(args, opts)
  }

  async execInContainer(id: string, command: string[], dockerContext?: string): Promise<string> {
    const safeId = validateContainerId(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return dockerCli.execSafe(['exec', safeId, ...command], opts)
  }

  // ─── Interactive Exec Session ───

  startInteractiveExec(containerId: string, shell: string, dockerContext?: string): DockerExecSession {
    const safeId = validateContainerId(containerId)
    const sessionId = crypto.randomUUID()
    const context = dockerContext ?? this.getCliOptions().context

    // Use node-pty for proper PTY support with real terminal behavior
    const ptyProcess = pty.spawn('docker', ['--context', context, 'exec', '-it', safeId, shell], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME,
      env: { ...process.env, TERM: 'xterm-256color' },
    })

    ptyProcess.onData((data: string) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        ipcWebContentsSend('subscribeDockerExecOutput', this.mainWindow.webContents, {
          sessionId,
          data,
        })
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      this.execSessions.delete(sessionId)
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        ipcWebContentsSend('subscribeDockerExecClosed', this.mainWindow.webContents, {
          sessionId,
          exitCode,
        })
      }
    })

    this.execSessions.set(sessionId, { ptyProcess, containerId: safeId, shell })

    return {
      sessionId,
      containerId: safeId,
      shell,
      createdAt: Date.now(),
    }
  }

  writeToExecSession(sessionId: string, data: string): void {
    const session = this.execSessions.get(sessionId)
    if (session?.ptyProcess) {
      session.ptyProcess.write(data)
    }
  }

  resizeExecSession(sessionId: string, cols: number, rows: number): void {
    const session = this.execSessions.get(sessionId)
    if (session?.ptyProcess) {
      session.ptyProcess.resize(cols, rows)
    }
  }

  closeExecSession(sessionId: string): void {
    const session = this.execSessions.get(sessionId)
    if (session) {
      session.ptyProcess.kill()
      this.execSessions.delete(sessionId)
    }
  }

  // ─── File Manager Operations ───

  async listDirectory(containerId: string, dirPath: string, dockerContext?: string): Promise<DockerFileEntry[]> {
    const safeId = validateContainerId(containerId)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()

    try {
      // Try GNU ls first, fallback to BusyBox ls
      // GNU ls: --time-style=full-iso
      // BusyBox ls: --full-time
      let output: string
      let isBusyBox = false

      try {
        const lsCmd = `ls -la --time-style=full-iso "${dirPath}"`
        output = await dockerCli.execSafe(
          ['exec', '-u', 'root', safeId, 'sh', '-c', lsCmd],
          opts
        )
      } catch {
        // Fallback to BusyBox-compatible command
        const lsCmd = `ls -la --full-time "${dirPath}"`
        output = await dockerCli.execSafe(
          ['exec', '-u', 'root', safeId, 'sh', '-c', lsCmd],
          opts
        )
        isBusyBox = true
      }

      return this.parseLsOutput(output, dirPath, isBusyBox)
    } catch (error) {
      throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private parseLsOutput(output: string, basePath: string, isBusyBox: boolean = false): DockerFileEntry[] {
    const lines = output.split('\n').filter((line) => line.trim())
    const entries: DockerFileEntry[] = []

    for (const line of lines) {
      // Skip total line and empty lines
      if (line.startsWith('total ') || !line.trim()) continue

      let match: RegExpMatchArray | null = null
      let permissions: string
      let owner: string
      let group: string
      let sizeStr: string
      let date: string
      let time: string
      let nameWithLink: string

      if (isBusyBox) {
        // BusyBox ls --full-time format: -rw-r--r--    1 root     root          1234 2024-01-15 10:30:45 filename
        match = line.match(
          /^([drwxlst-]{10})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.+)$/
        )
        if (!match) continue
        ;[, permissions, owner, group, sizeStr, date, time, nameWithLink] = match
      } else {
        // GNU ls --time-style=full-iso format: -rw-r--r-- 1 root root 1234 2024-01-15 10:30:45.123 +0000 filename
        match = line.match(
          /^([drwxlst-]{10})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+([+-]\d{4})\s+(.+)$/
        )
        if (!match) continue
        ;[, permissions, owner, group, sizeStr, date, time, , nameWithLink] = match
      }

      const size = parseInt(sizeStr, 10)

      // Handle symlinks: name -> target
      let name = nameWithLink
      let linkTarget: string | undefined
      const symlinkMatch = nameWithLink.match(/^(.+?)\s+->\s+(.+)$/)
      if (symlinkMatch) {
        name = symlinkMatch[1]
        linkTarget = symlinkMatch[2]
      }

      // Skip . and ..
      if (name === '.' || name === '..') continue

      const type: 'file' | 'directory' | 'symlink' =
        permissions.startsWith('d') ? 'directory' :
        permissions.startsWith('l') ? 'symlink' : 'file'

      const entryPath = basePath.endsWith('/') ? `${basePath}${name}` : `${basePath}/${name}`

      entries.push({
        name,
        path: entryPath,
        type,
        size,
        permissions: permissions.slice(1), // Remove first char (d/l/-)
        owner,
        group,
        modifiedAt: `${date}T${time}`,
        linkTarget,
      })
    }

    // Sort: directories first, then alphabetically
    return entries.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1
      return a.name.localeCompare(b.name)
    })
  }

  async readFile(containerId: string, filePath: string, maxSize: number = 1024 * 1024, dockerContext?: string): Promise<DockerFileContent> {
    const safeId = validateContainerId(containerId)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()

    // Get file size - try GNU stat first, fallback to wc -c for BusyBox
    let size: number
    try {
      const statCmd = `stat -c '%s' "${filePath}"`
      const statOutput = await dockerCli.execSafe(
        ['exec', '-u', 'root', safeId, 'sh', '-c', statCmd],
        opts
      )
      size = parseInt(statOutput.trim(), 10)
    } catch {
      // Fallback for BusyBox: use wc -c
      const wcCmd = `wc -c < "${filePath}"`
      const wcOutput = await dockerCli.execSafe(
        ['exec', '-u', 'root', safeId, 'sh', '-c', wcCmd],
        opts
      )
      size = parseInt(wcOutput.trim(), 10)
    }

    const mimeType = this.detectMimeType(filePath)
    const isImage = mimeType.startsWith('image/')
    const isBinary = isImage || this.isBinaryMimeType(mimeType)

    let content: string
    let truncated = false
    let encoding: 'utf8' | 'base64' = 'utf8'

    if (isBinary) {
      // For images/binary, use base64 encoding
      if (size > maxSize * 5) {
        throw new Error(`File too large: ${size} bytes (max ${maxSize * 5} for binary)`)
      }
      const base64Cmd = `base64 "${filePath}"`
      const base64Output = await dockerCli.execSafe(
        ['exec', '-u', 'root', safeId, 'sh', '-c', base64Cmd],
        { ...opts, timeout: 30000 }
      )
      content = base64Output.replace(/\s/g, '')
      encoding = 'base64'
    } else {
      // For text files
      if (size > maxSize) {
        const headCmd = `head -c ${maxSize} "${filePath}"`
        const headOutput = await dockerCli.execSafe(
          ['exec', '-u', 'root', safeId, 'sh', '-c', headCmd],
          opts
        )
        content = headOutput
        truncated = true
      } else {
        const catCmd = `cat "${filePath}"`
        content = await dockerCli.execSafe(
          ['exec', '-u', 'root', safeId, 'sh', '-c', catCmd],
          opts
        )
      }
    }

    return { content, truncated, mimeType, size, encoding }
  }

  private detectMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.jsx': 'text/javascript',
      '.json': 'application/json',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.xml': 'text/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.log': 'text/plain',
      '.sh': 'text/x-sh',
      '.bash': 'text/x-sh',
      '.py': 'text/x-python',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.java': 'text/x-java',
      '.c': 'text/x-c',
      '.cpp': 'text/x-c++',
      '.h': 'text/x-c',
      '.env': 'text/plain',
      '.toml': 'text/toml',
      '.ini': 'text/ini',
      '.conf': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.bmp': 'image/bmp',
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }

  private isBinaryMimeType(mimeType: string): boolean {
    return (
      mimeType.startsWith('image/') ||
      mimeType.startsWith('audio/') ||
      mimeType.startsWith('video/') ||
      mimeType === 'application/octet-stream'
    )
  }

  async downloadFile(containerId: string, remotePath: string, isDirectory: boolean = false, dockerContext?: string): Promise<string> {
    const safeId = validateContainerId(containerId)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    const fileName = path.basename(remotePath)

    if (isDirectory) {
      // For directories, show folder picker
      const result = await dialog.showOpenDialog({
        title: 'Select destination folder',
        properties: ['openDirectory', 'createDirectory'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return ''
      }

      const destPath = path.join(result.filePaths[0], fileName)
      // docker cp supports directories natively
      await dockerCli.execSafe(
        ['cp', `${safeId}:${remotePath}`, destPath],
        { ...opts, timeout: 120000 } // 2 min timeout for large dirs
      )
      return destPath
    }

    // For files, use save dialog
    const result = await dialog.showSaveDialog({
      defaultPath: fileName,
      title: 'Save file from container',
    })

    if (!result.filePath) {
      return ''
    }

    // Copy directly to destination
    await dockerCli.execSafe(
      ['cp', `${safeId}:${remotePath}`, result.filePath],
      opts
    )

    return result.filePath
  }

  async uploadFile(containerId: string, localPath: string, remotePath: string, dockerContext?: string): Promise<void> {
    const safeId = validateContainerId(containerId)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    // docker cp supports both files and directories
    await dockerCli.execSafe(
      ['cp', localPath, `${safeId}:${remotePath}`],
      { ...opts, timeout: 120000 } // 2 min timeout for large uploads
    )
  }

  async uploadFiles(containerId: string, localPaths: string[], remotePath: string, dockerContext?: string): Promise<number> {
    let uploaded = 0
    for (const localPath of localPaths) {
      const fileName = path.basename(localPath)
      const targetPath = remotePath.endsWith('/') ? `${remotePath}${fileName}` : `${remotePath}/${fileName}`
      await this.uploadFile(containerId, localPath, targetPath, dockerContext)
      uploaded++
    }
    return uploaded
  }

  async uploadFileDialog(containerId: string, remotePath: string, dockerContext?: string): Promise<number> {
    const result = await dialog.showOpenDialog({
      title: 'Select files or folders to upload',
      properties: ['openFile', 'openDirectory', 'multiSelections'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return 0
    }

    return this.uploadFiles(containerId, result.filePaths, remotePath, dockerContext)
  }

  async createDirectory(containerId: string, dirPath: string, dockerContext?: string): Promise<void> {
    const safeId = validateContainerId(containerId)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    // Use -u root and sh -c with quoted path for Unicode support
    const mkdirCmd = `mkdir -p "${dirPath}"`
    await dockerCli.execSafe(
      ['exec', '-u', 'root', safeId, 'sh', '-c', mkdirCmd],
      opts
    )
  }

  async deletePath(containerId: string, targetPath: string, recursive: boolean = false, dockerContext?: string): Promise<void> {
    const safeId = validateContainerId(containerId)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    // Use -u root to handle permission issues, and sh -c with quoted path for Unicode support
    const rmCmd = recursive ? `rm -rf "${targetPath}"` : `rm "${targetPath}"`
    await dockerCli.execSafe(
      ['exec', '-u', 'root', safeId, 'sh', '-c', rmCmd],
      opts
    )
  }

  async renamePath(containerId: string, oldPath: string, newPath: string, dockerContext?: string): Promise<void> {
    const safeId = validateContainerId(containerId)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    // Use -u root and sh -c with quoted paths for Unicode support
    const mvCmd = `mv "${oldPath}" "${newPath}"`
    await dockerCli.execSafe(
      ['exec', '-u', 'root', safeId, 'sh', '-c', mvCmd],
      opts
    )
  }

  async startDrag(containerId: string, remotePath: string, dockerContext?: string): Promise<void> {
    if (!this.mainWindow) return

    const safeId = validateContainerId(containerId)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    const fileName = path.basename(remotePath)
    const tempDir = path.join(app.getPath('temp'), `docker-drag-${Date.now()}`)
    const tempPath = path.join(tempDir, fileName)

    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true })

    // Copy from container to temp (supports both files and directories)
    await dockerCli.execSafe(
      ['cp', `${safeId}:${remotePath}`, tempPath],
      { ...opts, timeout: 120000 }
    )

    // Create a simple 1x1 transparent PNG as drag icon (base64)
    const iconPath = path.join(tempDir, 'drag-icon.png')
    const transparentPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
    await fs.writeFile(iconPath, transparentPng)

    // Start native drag operation
    this.mainWindow.webContents.startDrag({
      file: tempPath,
      icon: iconPath,
    })

    // Clean up temp after a delay (give time for drop to complete)
    setTimeout(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }, 60000) // 1 minute delay
  }

  async inspectContainer(id: string, dockerContext?: string): Promise<Record<string, unknown>> {
    const safeId = validateContainerId(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    const output = await dockerCli.execSafe(
      ['inspect', safeId],
      opts
    )
    const parsed = JSON.parse(output)
    return Array.isArray(parsed) ? parsed[0] : parsed
  }

  // ─── Image Operations ───

  async getImages(): Promise<DockerImage[]> {
    if (this.activeContext === '__all__') {
      return this.getImagesAllContexts()
    }
    return this.getImagesForContext(this.activeContext)
  }

  private async getImagesAllContexts(): Promise<DockerImage[]> {
    const contexts = await this.getContexts()
    const results = await Promise.all(
      contexts.map(async (ctx) => {
        try {
          const images = await this.getImagesForContext(ctx.name)
          return images.map((img) => ({ ...img, dockerContext: ctx.name }))
        } catch {
          return []
        }
      })
    )
    const seen = new Set<string>()
    return results.flat().filter((img) => {
      const key = `${img.dockerContext}:${img.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private getImagesForContext(contextName: string): Promise<DockerImage[]> {
    return dockerCli.execJson<{
      ID: string
      Repository: string
      Tag: string
      Digest: string
      CreatedAt: string
      Size: string
      VirtualSize: string
      Labels: string
      Containers: string
    }>(['images', '--format', '{{json .}}', '--no-trunc'], { context: contextName }).then(raw =>
      raw.map(img => {
        const repoTag =
          img.Repository && img.Tag && img.Repository !== '<none>'
            ? `${img.Repository}:${img.Tag}`
            : ''

        return {
          id: img.ID,
          repoTags: repoTag ? [repoTag] : [],
          repoDigests: img.Digest && img.Digest !== '<none>' ? [img.Digest] : [],
          created: new Date(img.CreatedAt).getTime(),
          size: parseHumanSize(img.Size),
          virtualSize: parseHumanSize(img.VirtualSize || img.Size),
          labels: this.parseLabels(img.Labels),
          containers: parseInt(img.Containers, 10) || 0,
        }
      })
    )
  }

  async pullImage(name: string): Promise<void> {
    validateResourceName(name)
    await dockerCli.execSafe(['pull', name], {
      ...this.getCliOptions(),
      timeout: 300_000,
    })
  }

  async removeImage(id: string, force: boolean, dockerContext?: string): Promise<void> {
    validateResourceName(id)
    const args = force ? ['rmi', '-f', id] : ['rmi', id]
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    await dockerCli.execSafe(args, opts)
  }

  async inspectImage(id: string): Promise<Record<string, unknown>> {
    validateResourceName(id)
    const output = await dockerCli.execSafe(
      ['inspect', id],
      this.getCliOptions()
    )
    const parsed = JSON.parse(output)
    return Array.isArray(parsed) ? parsed[0] : parsed
  }

  async getImageHistory(id: string): Promise<DockerImageLayer[]> {
    validateResourceName(id)
    const raw = await dockerCli.execJson<{
      ID: string
      CreatedBy: string
      Size: string
      Comment: string
    }>(['history', '--format', '{{json .}}', '--no-trunc', id], this.getCliOptions())

    return raw.map(layer => ({
      id: layer.ID,
      createdBy: layer.CreatedBy,
      size: parseHumanSize(layer.Size),
      comment: layer.Comment || '',
    }))
  }

  async pruneImages(danglingOnly: boolean): Promise<{ spaceReclaimed: number }> {
    const args = danglingOnly
      ? ['image', 'prune', '-f']
      : ['image', 'prune', '-a', '-f']

    const output = await dockerCli.execSafe(args, this.getCliOptions())
    return { spaceReclaimed: this.parseReclaimedSpace(output) }
  }

  // ─── Volume Operations ───

  async getVolumes(): Promise<DockerVolume[]> {
    if (this.activeContext === '__all__') {
      return this.getVolumesAllContexts()
    }
    return this.getVolumesForContext(this.activeContext)
  }

  private async getVolumesAllContexts(): Promise<DockerVolume[]> {
    const contexts = await this.getContexts()
    const results = await Promise.all(
      contexts.map(async (ctx) => {
        try {
          const volumes = await this.getVolumesForContext(ctx.name)
          return volumes.map((v) => ({ ...v, dockerContext: ctx.name }))
        } catch {
          return []
        }
      })
    )
    // Deduplicate volumes by mountpoint (multiple contexts can share same daemon)
    const seen = new Set<string>()
    return results.flat().filter((vol) => {
      const key = vol.mountpoint  // Use mountpoint as unique key
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private async getVolumesForContext(contextName: string): Promise<DockerVolume[]> {
    // Get Docker volumes
    const raw = await dockerCli.execJson<{
      Name: string
      Driver: string
      Mountpoint: string
      Labels: string
      Scope: string
      CreatedAt: string
    }>(['volume', 'ls', '--format', '{{json .}}'], { context: contextName })

    // Get all container IDs (including stopped)
    const containerIds = await dockerCli.execJson<{ ID: string }>(
      ['ps', '-a', '--format', '{{json .}}', '--no-trunc'],
      { context: contextName }
    ).then(cs => cs.map(c => c.ID))

    // Build maps for volume usage and bind mounts
    const volumeUsageMap = new Map<string, DockerVolumeUsage[]>()
    const bindMounts = new Map<string, { mountpoint: string; usedBy: DockerVolumeUsage[] }>()

    // Get detailed mount info via docker inspect for all containers
    if (containerIds.length > 0) {
      try {
        const inspectOutput = await dockerCli.execSafe(
          ['inspect', ...containerIds],
          { context: contextName }
        )
        const inspected = JSON.parse(inspectOutput) as Array<{
          Id: string
          Name: string
          State: { Status: string }
          Mounts: Array<{
            Type: string
            Name?: string
            Source: string
            Destination: string
          }>
        }>

        for (const c of inspected) {
          const containerId = c.Id.substring(0, 12)
          const containerName = (c.Name || '').replace(/^\//, '')
          const running = c.State?.Status === 'running'

          for (const mount of c.Mounts || []) {
            const usage: DockerVolumeUsage = {
              containerId,
              containerName,
              running,
            }

            if (mount.Type === 'volume' && mount.Name) {
              // Docker volume
              const existing = volumeUsageMap.get(mount.Name) || []
              volumeUsageMap.set(mount.Name, [...existing, usage])
            } else if (mount.Type === 'bind' && mount.Source) {
              // Bind mount - use source path as key
              const existing = bindMounts.get(mount.Source)
              if (existing) {
                bindMounts.set(mount.Source, {
                  ...existing,
                  usedBy: [...existing.usedBy, usage],
                })
              } else {
                bindMounts.set(mount.Source, {
                  mountpoint: mount.Source,
                  usedBy: [usage],
                })
              }
            }
          }
        }
      } catch {
        // If inspect fails, continue without usage info
      }
    }

    // Docker volumes
    const dockerVolumes: DockerVolume[] = raw.map(vol => ({
      name: vol.Name,
      driver: vol.Driver,
      mountpoint: vol.Mountpoint,
      labels: this.parseLabels(vol.Labels),
      scope: vol.Scope as 'local' | 'global',
      createdAt: vol.CreatedAt || '',
      usedBy: volumeUsageMap.get(vol.Name) || [],
      type: 'volume' as const,
    }))

    // Bind mounts (only those used by containers)
    const bindMountVolumes: DockerVolume[] = Array.from(bindMounts.entries()).map(([source, data]) => ({
      name: source.split('/').pop() || source,  // Use folder name as display name
      driver: 'bind',
      mountpoint: data.mountpoint,
      labels: {},
      scope: 'local' as const,
      createdAt: '',
      usedBy: data.usedBy,
      type: 'bind' as const,
    }))

    return [...dockerVolumes, ...bindMountVolumes]
  }

  async createVolume(name: string, labels?: Record<string, string>): Promise<DockerVolume> {
    validateResourceName(name)
    const args = ['volume', 'create', name]

    if (labels) {
      for (const [key, value] of Object.entries(labels)) {
        args.push('--label', `${key}=${value}`)
      }
    }

    await dockerCli.execSafe(args, this.getCliOptions())

    const inspectOutput = await dockerCli.execSafe(
      ['volume', 'inspect', name],
      this.getCliOptions()
    )
    const parsed = JSON.parse(inspectOutput)
    const vol = Array.isArray(parsed) ? parsed[0] : parsed

    return {
      name: vol.Name,
      driver: vol.Driver,
      mountpoint: vol.Mountpoint,
      labels: vol.Labels ?? {},
      scope: vol.Scope as 'local' | 'global',
      createdAt: vol.CreatedAt || '',
      usedBy: [] as DockerVolumeUsage[],
      type: 'volume' as const,
    }
  }

  async removeVolume(name: string, dockerContext?: string): Promise<void> {
    validateResourceName(name)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    await dockerCli.execSafe(['volume', 'rm', name], opts)
  }

  async pruneVolumes(): Promise<{ spaceReclaimed: number }> {
    const output = await dockerCli.execSafe(
      ['volume', 'prune', '-f'],
      this.getCliOptions()
    )
    return { spaceReclaimed: this.parseReclaimedSpace(output) }
  }

  // ─── Network Operations ───

  async getNetworks(): Promise<DockerNetwork[]> {
    if (this.activeContext === '__all__') {
      return this.getNetworksAllContexts()
    }
    return this.getNetworksForContext(this.activeContext)
  }

  private async getNetworksAllContexts(): Promise<DockerNetwork[]> {
    const contexts = await this.getContexts()
    const results = await Promise.all(
      contexts.map(async (ctx) => {
        try {
          const networks = await this.getNetworksForContext(ctx.name)
          return networks.map((n) => ({ ...n, dockerContext: ctx.name }))
        } catch {
          return []
        }
      })
    )
    return results.flat()
  }

  private async getNetworksForContext(contextName: string): Promise<DockerNetwork[]> {
    const raw = await dockerCli.execJson<{
      ID: string
      Name: string
      Driver: string
      Scope: string
      Internal: string
      Labels: string
    }>(['network', 'ls', '--format', '{{json .}}'], { context: contextName })

    return raw.map(net => ({
      id: net.ID,
      name: net.Name,
      driver: net.Driver,
      scope: net.Scope,
      internal: net.Internal === 'true',
      ipam: { subnet: '', gateway: '' },
      containers: [],
      labels: this.parseLabels(net.Labels),
    }))
  }

  async createNetwork(name: string, driver: string): Promise<DockerNetwork> {
    validateResourceName(name)
    validateResourceName(driver)

    await dockerCli.execSafe(
      ['network', 'create', '-d', driver, name],
      this.getCliOptions()
    )

    return this.inspectNetwork(name)
  }

  async removeNetwork(id: string, dockerContext?: string): Promise<void> {
    validateResourceName(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    await dockerCli.execSafe(['network', 'rm', id], opts)
  }

  async inspectNetwork(id: string): Promise<DockerNetwork> {
    validateResourceName(id)
    const output = await dockerCli.execSafe(
      ['network', 'inspect', id],
      this.getCliOptions()
    )
    const parsed = JSON.parse(output)
    const net = Array.isArray(parsed) ? parsed[0] : parsed

    const ipamConfig = net.IPAM?.Config?.[0] ?? {}
    const containersMap: Record<string, { Name: string; IPv4Address: string }> =
      net.Containers ?? {}

    return {
      id: net.Id,
      name: net.Name,
      driver: net.Driver,
      scope: net.Scope,
      internal: net.Internal ?? false,
      ipam: {
        subnet: ipamConfig.Subnet || '',
        gateway: ipamConfig.Gateway || '',
      },
      containers: Object.entries(containersMap).map(([cId, c]) => ({
        id: cId.substring(0, 12),
        name: c.Name,
        ipv4: c.IPv4Address || '',
      })),
      labels: net.Labels ?? {},
    }
  }

  // ─── Stats Operations ───

  async getContainerStats(id: string, dockerContext?: string): Promise<DockerContainerStats> {
    const safeId = validateContainerId(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    const raw = await dockerCli.execJson<{
      CPUPerc: string
      MemUsage: string
      MemPerc: string
      NetIO: string
      BlockIO: string
      PIDs: string
    }>(
      ['stats', '--no-stream', '--format', '{{json .}}', safeId],
      opts
    )

    if (raw.length === 0) {
      throw new Error(`No stats available for container: ${id}`)
    }

    return this.mapStatsEntry(raw[0])
  }

  async getAllStats(): Promise<Record<string, DockerContainerStats>> {
    if (this.activeContext === '__all__') {
      return this.getAllStatsAllContexts()
    }

    return this.getAllStatsForContext(this.activeContext)
  }

  private async getAllStatsAllContexts(): Promise<Record<string, DockerContainerStats>> {
    const contexts = await this.getContexts()
    const results = await Promise.all(
      contexts.map(async (ctx) => {
        try {
          return await this.getAllStatsForContext(ctx.name)
        } catch {
          return {} as Record<string, DockerContainerStats>
        }
      })
    )

    return results.reduce((acc, stats) => ({ ...acc, ...stats }), {})
  }

  private async getAllStatsForContext(contextName: string): Promise<Record<string, DockerContainerStats>> {
    const raw = await dockerCli.execJson<{
      ID: string
      CPUPerc: string
      MemUsage: string
      MemPerc: string
      NetIO: string
      BlockIO: string
      PIDs: string
    }>(
      ['stats', '--no-stream', '--format', '{{json .}}'],
      { context: contextName }
    )

    const result: Record<string, DockerContainerStats> = {}
    for (const entry of raw) {
      result[entry.ID.substring(0, 12)] = this.mapStatsEntry(entry)
    }
    return result
  }

  // ─── Compose Operations ───

  async getComposeProjects(): Promise<DockerComposeProject[]> {
    const containers = await this.getContainers()
    const projectMap = new Map<string, DockerContainer[]>()

    for (const container of containers) {
      const project = container.composeProject
      if (project) {
        const existing = projectMap.get(project) ?? []
        projectMap.set(project, [...existing, container])
      }
    }

    const projects: DockerComposeProject[] = []
    for (const [name, projectContainers] of projectMap) {
      const runningCount = projectContainers.filter(c => c.state === 'running').length
      const totalCount = projectContainers.length

      let status: DockerComposeProject['status']
      if (runningCount === totalCount) {
        status = 'running'
      } else if (runningCount > 0) {
        status = 'partial'
      } else {
        status = 'stopped'
      }

      const configFile =
        projectContainers[0]?.labels['com.docker.compose.project.config_files'] || ''

      const services: DockerComposeService[] = projectContainers.map(c => ({
        name: c.composeService || c.name,
        containerId: c.id,
        state: c.state,
        image: c.image,
        ports: c.ports,
      }))

      projects.push({ name, status, configFile, services })
    }

    return projects
  }

  async composeUp(project: string): Promise<void> {
    validateResourceName(project)
    await dockerCli.execSafe(
      ['compose', '-p', project, 'up', '-d'],
      { ...this.getCliOptions(), timeout: 120_000 }
    )
  }

  async composeDown(project: string): Promise<void> {
    validateResourceName(project)
    await dockerCli.execSafe(
      ['compose', '-p', project, 'down'],
      { ...this.getCliOptions(), timeout: 60_000 }
    )
  }

  async composeRestart(project: string): Promise<void> {
    validateResourceName(project)
    await dockerCli.execSafe(
      ['compose', '-p', project, 'restart'],
      { ...this.getCliOptions(), timeout: 60_000 }
    )
  }

  // ─── Dashboard & System ───

  async getDashboardStats(): Promise<DockerDashboardStats> {
    const [containers, images, volumes, networks] = await Promise.all([
      this.getContainers(),
      this.getImages(),
      this.getVolumes(),
      this.getNetworks(),
    ])

    const containersRunning = containers.filter(c => c.state === 'running').length
    const containersStopped = containers.filter(c => c.state === 'exited').length
    const containersPaused = containers.filter(c => c.state === 'paused').length
    const imagesDangling = images.filter(
      img => img.repoTags.length === 0 || img.repoTags[0] === '<none>:<none>'
    ).length

    return {
      containersRunning,
      containersStopped,
      containersPaused,
      imagesTotal: images.length,
      imagesDangling,
      volumesTotal: volumes.length,
      networksTotal: networks.length,
      diskUsage: {
        images: images.reduce((sum, img) => sum + img.size, 0),
        containers: 0,
        volumes: 0,
        buildCache: 0,
        total: images.reduce((sum, img) => sum + img.size, 0),
      },
    }
  }

  async getSystemInfo(): Promise<Record<string, unknown>> {
    return dockerCli.execJsonSingle<Record<string, unknown>>(
      ['system', 'info', '--format', '{{json .}}'],
      this.getCliOptions()
    )
  }

  async systemPrune(includeVolumes: boolean): Promise<{ spaceReclaimed: number }> {
    const args = includeVolumes
      ? ['system', 'prune', '--volumes', '-f']
      : ['system', 'prune', '-f']

    const output = await dockerCli.execSafe(args, {
      ...this.getCliOptions(),
      timeout: 120_000,
    })
    return { spaceReclaimed: this.parseReclaimedSpace(output) }
  }

  // ─── Log Operations ───

  async getContainerLogs(id: string, options: DockerLogOptions, dockerContext?: string): Promise<string[]> {
    const safeId = validateContainerId(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
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

  streamContainerLogs(id: string, options: DockerLogOptions, dockerContext?: string): void {
    const safeId = validateContainerId(id)
    this.stopLogStream(id)
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()

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
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          ipcWebContentsSend(
            'subscribeDockerLogs',
            this.mainWindow.webContents,
            { containerId: id, log: line }
          )
        }
      },
      opts
    )

    this.activeLogStreams.set(id, child)

    child.on('close', () => {
      this.activeLogStreams.delete(id)
    })
  }

  stopLogStream(id: string): void {
    const existing = this.activeLogStreams.get(id)
    if (existing) {
      existing.kill()
      this.activeLogStreams.delete(id)
    }
  }

  // ─── Polling ───

  startPolling(): void {
    this.stopPolling()

    const settings = store.get('dockerSettings')
    const interval = settings?.refreshInterval ?? 3000

    this.pollingInterval = setInterval(async () => {
      try {
        const containers = await this.getContainers()
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          ipcWebContentsSend(
            'subscribeDockerContainers',
            this.mainWindow.webContents,
            containers
          )
        }

        if (settings?.statsEnabled) {
          const stats = await this.getAllStats()
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            ipcWebContentsSend(
              'subscribeDockerStats',
              this.mainWindow.webContents,
              stats
            )
          }
        }
      } catch {
        // Docker may be unavailable; silently skip this poll cycle
      }
    }, interval)
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  // ─── Private Helpers ───

  private parseLabels(labelsStr: string): Record<string, string> {
    if (!labelsStr || labelsStr.trim() === '') return {}

    return labelsStr.split(',').reduce<Record<string, string>>((acc, pair) => {
      const eqIndex = pair.indexOf('=')
      if (eqIndex === -1) return acc
      const key = pair.substring(0, eqIndex).trim()
      const value = pair.substring(eqIndex + 1).trim()
      return { ...acc, [key]: value }
    }, {})
  }

  private parseInspectPorts(
    portsObj: Record<string, Array<{ HostIp: string; HostPort: string }> | null>
  ): DockerPortMapping[] {
    const mappings: DockerPortMapping[] = []

    for (const [containerPort, hostBindings] of Object.entries(portsObj)) {
      const match = containerPort.match(/(\d+)\/(tcp|udp)/)
      if (!match) continue

      const privatePort = parseInt(match[1], 10)
      const type = match[2] as 'tcp' | 'udp'

      if (hostBindings) {
        for (const binding of hostBindings) {
          mappings.push({
            privatePort,
            publicPort: parseInt(binding.HostPort, 10),
            type,
            hostIp: binding.HostIp || undefined,
          })
        }
      } else {
        mappings.push({ privatePort, type })
      }
    }

    return mappings
  }

  private mapStatsEntry(entry: {
    CPUPerc: string
    MemUsage: string
    MemPerc: string
    NetIO: string
    BlockIO: string
    PIDs: string
  }): DockerContainerStats {
    const [memUsageStr, memLimitStr] = entry.MemUsage.split('/').map(s => s.trim())
    const [netRxStr, netTxStr] = entry.NetIO.split('/').map(s => s.trim())
    const [blockReadStr, blockWriteStr] = entry.BlockIO.split('/').map(s => s.trim())

    return {
      cpuPercent: parsePercentage(entry.CPUPerc),
      memoryUsage: parseHumanSize(memUsageStr),
      memoryLimit: parseHumanSize(memLimitStr),
      memoryPercent: parsePercentage(entry.MemPerc),
      networkRx: parseHumanSize(netRxStr),
      networkTx: parseHumanSize(netTxStr),
      blockRead: parseHumanSize(blockReadStr),
      blockWrite: parseHumanSize(blockWriteStr),
      pids: parseInt(entry.PIDs, 10) || 0,
    }
  }

  private parseReclaimedSpace(output: string): number {
    const match = output.match(/Total reclaimed space:\s*(.+)/i)
    if (!match) return 0
    return parseHumanSize(match[1].trim())
  }

  private applyClientFilters(
    containers: DockerContainer[],
    filters?: DockerContainerFilters
  ): DockerContainer[] {
    if (!filters) return containers

    let result = containers

    if (filters.image) {
      result = result.filter(c => c.image.includes(filters.image!))
    }
    if (filters.composeProject) {
      result = result.filter(c => c.composeProject === filters.composeProject)
    }

    return result
  }
}

export const dockerManager = new DockerManager()
