import { dockerCli } from './docker-cli.js'
import { store } from '../storage/store.js'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import type { BrowserWindow } from 'electron'
import type { ChildProcess } from 'child_process'
import * as crypto from 'crypto'
import * as pty from 'node-pty'

import {
  validateContainerId,
  validateResourceName,
  parsePortMappings,
  parseMounts,
  parseLabels,
  parseReclaimedSpace,
} from './docker-utils.js'
import * as fileOps from './docker-file-manager.js'
import * as imageOps from './docker-images.js'
import * as volumeOps from './docker-volumes.js'
import * as networkOps from './docker-networks.js'
import * as composeOps from './docker-compose.js'
import * as logOps from './docker-logs.js'
import * as inspectOps from './docker-inspect.js'

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
    }>(['context', 'ls', '--format', '{{json .}}'])

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
      const labels = parseLabels(c.Labels)
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
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return inspectOps.getContainer(id, opts)
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
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return fileOps.listDirectory(containerId, dirPath, opts)
  }

  async readFile(containerId: string, filePath: string, maxSize: number = 1024 * 1024, dockerContext?: string): Promise<DockerFileContent> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return fileOps.readFile(containerId, filePath, maxSize, opts)
  }

  async downloadFile(containerId: string, remotePath: string, isDirectory: boolean = false, dockerContext?: string): Promise<string> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return fileOps.downloadFile(containerId, remotePath, isDirectory, opts)
  }

  async uploadFile(containerId: string, localPath: string, remotePath: string, dockerContext?: string): Promise<void> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return fileOps.uploadFile(containerId, localPath, remotePath, opts)
  }

  async uploadFiles(containerId: string, localPaths: string[], remotePath: string, dockerContext?: string): Promise<number> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return fileOps.uploadFiles(containerId, localPaths, remotePath, opts)
  }

  async uploadFileDialog(containerId: string, remotePath: string, dockerContext?: string): Promise<number> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return fileOps.uploadFileDialog(containerId, remotePath, opts)
  }

  async createDirectory(containerId: string, dirPath: string, dockerContext?: string): Promise<void> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return fileOps.createDirectory(containerId, dirPath, opts)
  }

  async deletePath(containerId: string, targetPath: string, recursive: boolean = false, dockerContext?: string): Promise<void> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return fileOps.deletePath(containerId, targetPath, recursive, opts)
  }

  async renamePath(containerId: string, oldPath: string, newPath: string, dockerContext?: string): Promise<void> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return fileOps.renamePath(containerId, oldPath, newPath, opts)
  }

  async startDrag(containerId: string, remotePath: string, dockerContext?: string): Promise<void> {
    if (!this.mainWindow) return
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return fileOps.startDrag(this.mainWindow, containerId, remotePath, opts)
  }

  async inspectContainer(id: string, dockerContext?: string): Promise<Record<string, unknown>> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return inspectOps.inspectContainer(id, opts)
  }

  // ─── Image Operations ───

  async getImages(): Promise<DockerImage[]> {
    if (this.activeContext === '__all__') {
      return this.getImagesAllContexts()
    }
    return imageOps.getImagesForContext(this.activeContext)
  }

  private async getImagesAllContexts(): Promise<DockerImage[]> {
    const contexts = await this.getContexts()
    const results = await Promise.all(
      contexts.map(async (ctx) => {
        try {
          const images = await imageOps.getImagesForContext(ctx.name)
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

  async pullImage(name: string): Promise<void> {
    return imageOps.pullImage(name, this.getCliOptions())
  }

  async removeImage(id: string, force: boolean, dockerContext?: string): Promise<void> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return imageOps.removeImage(id, force, opts)
  }

  async inspectImage(id: string): Promise<Record<string, unknown>> {
    return imageOps.inspectImage(id, this.getCliOptions())
  }

  async getImageHistory(id: string): Promise<DockerImageLayer[]> {
    return imageOps.getImageHistory(id, this.getCliOptions())
  }

  async pruneImages(danglingOnly: boolean): Promise<{ spaceReclaimed: number }> {
    return imageOps.pruneImages(danglingOnly, this.getCliOptions())
  }

  // ─── Volume Operations ───

  async getVolumes(): Promise<DockerVolume[]> {
    if (this.activeContext === '__all__') {
      return this.getVolumesAllContexts()
    }
    return volumeOps.getVolumesForContext(this.activeContext)
  }

  private async getVolumesAllContexts(): Promise<DockerVolume[]> {
    const contexts = await this.getContexts()
    const results = await Promise.all(
      contexts.map(async (ctx) => {
        try {
          const volumes = await volumeOps.getVolumesForContext(ctx.name)
          return volumes.map((v) => ({ ...v, dockerContext: ctx.name }))
        } catch {
          return []
        }
      })
    )
    const seen = new Set<string>()
    return results.flat().filter((vol) => {
      const key = vol.mountpoint
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  async createVolume(name: string, labels?: Record<string, string>): Promise<DockerVolume> {
    return volumeOps.createVolume(name, labels, this.getCliOptions())
  }

  async removeVolume(name: string, dockerContext?: string): Promise<void> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return volumeOps.removeVolume(name, opts)
  }

  async pruneVolumes(): Promise<{ spaceReclaimed: number }> {
    return volumeOps.pruneVolumes(this.getCliOptions())
  }

  // ─── Network Operations ───

  async getNetworks(): Promise<DockerNetwork[]> {
    if (this.activeContext === '__all__') {
      return this.getNetworksAllContexts()
    }
    return networkOps.getNetworksForContext(this.activeContext)
  }

  private async getNetworksAllContexts(): Promise<DockerNetwork[]> {
    const contexts = await this.getContexts()
    const results = await Promise.all(
      contexts.map(async (ctx) => {
        try {
          const networks = await networkOps.getNetworksForContext(ctx.name)
          return networks.map((n) => ({ ...n, dockerContext: ctx.name }))
        } catch {
          return []
        }
      })
    )
    return results.flat()
  }

  async createNetwork(name: string, driver: string): Promise<DockerNetwork> {
    return networkOps.createNetwork(name, driver, this.getCliOptions())
  }

  async removeNetwork(id: string, dockerContext?: string): Promise<void> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return networkOps.removeNetwork(id, opts)
  }

  async inspectNetwork(id: string): Promise<DockerNetwork> {
    return networkOps.inspectNetwork(id, this.getCliOptions())
  }

  // ─── Stats Operations ───

  async getContainerStats(id: string, dockerContext?: string): Promise<DockerContainerStats> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return inspectOps.getContainerStats(id, opts)
  }

  async getAllStats(): Promise<Record<string, DockerContainerStats>> {
    if (this.activeContext === '__all__') {
      return this.getAllStatsAllContexts()
    }
    return inspectOps.getAllStatsForContext(this.activeContext)
  }

  private async getAllStatsAllContexts(): Promise<Record<string, DockerContainerStats>> {
    const contexts = await this.getContexts()
    const results = await Promise.all(
      contexts.map(async (ctx) => {
        try {
          return await inspectOps.getAllStatsForContext(ctx.name)
        } catch {
          return {} as Record<string, DockerContainerStats>
        }
      })
    )
    return results.reduce((acc, stats) => ({ ...acc, ...stats }), {})
  }

  // ─── Compose Operations ───

  async getComposeProjects(): Promise<DockerComposeProject[]> {
    const containers = await this.getContainers()
    return composeOps.buildComposeProjects(containers)
  }

  async composeUp(project: string): Promise<void> {
    return composeOps.composeUp(project, this.getCliOptions())
  }

  async composeDown(project: string): Promise<void> {
    return composeOps.composeDown(project, this.getCliOptions())
  }

  async composeRestart(project: string): Promise<void> {
    return composeOps.composeRestart(project, this.getCliOptions())
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
    return { spaceReclaimed: parseReclaimedSpace(output) }
  }

  // ─── Log Operations ───

  async getContainerLogs(id: string, options: DockerLogOptions, dockerContext?: string): Promise<string[]> {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    return logOps.getContainerLogs(id, options, opts)
  }

  streamContainerLogs(id: string, options: DockerLogOptions, dockerContext?: string): void {
    const opts = dockerContext ? { context: dockerContext } : this.getCliOptions()
    logOps.streamContainerLogs(id, options, opts, this.mainWindow, this.activeLogStreams)
  }

  stopLogStream(id: string): void {
    logOps.stopLogStream(id, this.activeLogStreams)
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
