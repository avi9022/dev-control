// ─── Docker Types ───
interface DockerContext {
  name: string
  description: string
  endpoint: string
  isCurrent: boolean
  type: string
}

type DockerContainerState = 'running' | 'paused' | 'restarting' | 'exited' | 'dead' | 'created'

interface DockerPortMapping {
  privatePort: number
  publicPort?: number
  type: 'tcp' | 'udp'
  hostIp?: string
}

interface DockerMount {
  type: 'bind' | 'volume' | 'tmpfs'
  source: string
  destination: string
  readOnly: boolean
  volumeName?: string  // Docker volume name (only for type: 'volume')
}

interface DockerContainerStats {
  cpuPercent: number
  memoryUsage: number
  memoryLimit: number
  memoryPercent: number
  networkRx: number
  networkTx: number
  blockRead: number
  blockWrite: number
  pids: number
}

interface DockerContainer {
  id: string
  fullId: string
  name: string
  image: string
  imageId: string
  state: DockerContainerState
  status: string
  created: number
  ports: DockerPortMapping[]
  labels: Record<string, string>
  networks: string[]
  mounts: DockerMount[]
  stats?: DockerContainerStats
  composeProject?: string
  composeService?: string
  dockerContext?: string
}

interface DockerImage {
  id: string
  repoTags: string[]
  repoDigests: string[]
  created: number
  size: number
  virtualSize: number
  labels: Record<string, string>
  containers: number
  dockerContext?: string
}

interface DockerImageLayer {
  id: string
  createdBy: string
  size: number
  comment: string
}

interface DockerVolumeUsage {
  containerId: string
  containerName: string
  running: boolean
}

interface DockerVolume {
  name: string
  driver: string
  mountpoint: string
  labels: Record<string, string>
  scope: 'local' | 'global'
  createdAt: string
  usedBy: DockerVolumeUsage[]
  size?: number
  dockerContext?: string
  type: 'volume' | 'bind'  // Docker volume or bind mount
}

interface DockerNetwork {
  id: string
  name: string
  driver: string
  scope: string
  internal: boolean
  ipam: {
    subnet: string
    gateway: string
  }
  containers: { id: string; name: string; ipv4: string }[]
  labels: Record<string, string>
  dockerContext?: string
}

interface DockerComposeProject {
  name: string
  status: 'running' | 'partial' | 'stopped'
  configFile: string
  services: DockerComposeService[]
}

interface DockerComposeService {
  name: string
  containerId?: string
  state: DockerContainerState
  image: string
  ports: DockerPortMapping[]
}

interface DockerDashboardStats {
  containersRunning: number
  containersStopped: number
  containersPaused: number
  imagesTotal: number
  imagesDangling: number
  volumesTotal: number
  networksTotal: number
  diskUsage: {
    images: number
    containers: number
    volumes: number
    buildCache: number
    total: number
  }
}

interface DockerContainerFilters {
  state?: DockerContainerState[]
  context?: string
  name?: string
  image?: string
  composeProject?: string
  label?: string
  network?: string
}

interface DockerLogOptions {
  containerId?: string
  tail?: number
  since?: string
  follow?: boolean
  timestamps?: boolean
}

// ─── Docker Interactive Exec Types ───
interface DockerExecSession {
  sessionId: string
  containerId: string
  shell: string
  createdAt: number
}

interface DockerExecSessionOutput {
  sessionId: string
  data: string
}

interface DockerExecSessionClosed {
  sessionId: string
  exitCode?: number
}

// ─── Docker File Manager Types ───
interface DockerFileEntry {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink'
  size: number
  permissions: string
  owner: string
  group: string
  modifiedAt: string
  linkTarget?: string
}

interface DockerFileContent {
  content: string
  truncated: boolean
  mimeType: string
  size: number
  encoding: 'utf8' | 'base64'
}
