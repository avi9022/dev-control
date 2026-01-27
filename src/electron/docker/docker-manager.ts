import { dockerCli } from './docker-cli.js'
import { store } from '../storage/store.js'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import type { BrowserWindow } from 'electron'
import type { ChildProcess } from 'child_process'

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
  if (!mountsStr || mountsStr.trim() === '') return []

  return mountsStr.split(',').reduce<DockerMount[]>((acc, segment) => {
    const trimmed = segment.trim()
    if (!trimmed) return acc

    return [
      ...acc,
      {
        type: 'volume',
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

  async getContainer(id: string): Promise<DockerContainer> {
    const safeId = validateContainerId(id)
    const output = await dockerCli.execSafe(
      ['inspect', '--format', '{{json .}}', safeId],
      this.getCliOptions()
    )
    const raw = JSON.parse(output)

    const labels = raw.Config?.Labels ?? {}
    const ports = this.parseInspectPorts(raw.NetworkSettings?.Ports ?? {})
    const mounts: DockerMount[] = (raw.Mounts ?? []).map(
      (m: { Type: string; Source: string; Destination: string; RW: boolean }) => ({
        type: m.Type as DockerMount['type'],
        source: m.Source,
        destination: m.Destination,
        readOnly: !m.RW,
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

  async execInContainer(id: string, command: string[]): Promise<string> {
    const safeId = validateContainerId(id)
    return dockerCli.execSafe(['exec', safeId, ...command], this.getCliOptions())
  }

  async inspectContainer(id: string): Promise<Record<string, unknown>> {
    const safeId = validateContainerId(id)
    const output = await dockerCli.execSafe(
      ['inspect', safeId],
      this.getCliOptions()
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
    return results.flat()
  }

  private async getVolumesForContext(contextName: string): Promise<DockerVolume[]> {
    const raw = await dockerCli.execJson<{
      Name: string
      Driver: string
      Mountpoint: string
      Labels: string
      Scope: string
      CreatedAt: string
    }>(['volume', 'ls', '--format', '{{json .}}'], { context: contextName })

    return raw.map(vol => ({
      name: vol.Name,
      driver: vol.Driver,
      mountpoint: vol.Mountpoint,
      labels: this.parseLabels(vol.Labels),
      scope: vol.Scope as 'local' | 'global',
      createdAt: vol.CreatedAt || '',
      usedBy: [],
    }))
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
      usedBy: [],
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

  async getContainerStats(id: string): Promise<DockerContainerStats> {
    const safeId = validateContainerId(id)
    const raw = await dockerCli.execJson<{
      CPUPerc: string
      MemUsage: string
      MemPerc: string
      NetIO: string
      BlockIO: string
      PIDs: string
    }>(
      ['stats', '--no-stream', '--format', '{{json .}}', safeId],
      this.getCliOptions()
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

  async getContainerLogs(id: string, options: DockerLogOptions): Promise<string[]> {
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

    const output = await dockerCli.execSafe(args, this.getCliOptions())
    if (!output) return []

    return output.split('\n').filter(line => line.length > 0)
  }

  streamContainerLogs(id: string, options: DockerLogOptions): void {
    const safeId = validateContainerId(id)
    this.stopLogStream(id)

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
      this.getCliOptions()
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
