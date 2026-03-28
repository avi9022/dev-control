/**
 * Docker volume operations: list, create, remove, prune.
 */

import { dockerCli } from './docker-cli.js'
import {
  validateResourceName,
  parseLabels,
  parseReclaimedSpace,
} from './docker-utils.js'

interface CliOptions {
  context: string
}

export async function getVolumesForContext(contextName: string): Promise<DockerVolume[]> {
  const raw = await dockerCli.execJson<{
    Name: string
    Driver: string
    Mountpoint: string
    Labels: string
    Scope: string
    CreatedAt: string
  }>(['volume', 'ls', '--format', '{{json .}}'], { context: contextName })

  const containerIds = await dockerCli.execJson<{ ID: string }>(
    ['ps', '-a', '--format', '{{json .}}', '--no-trunc'],
    { context: contextName }
  ).then(cs => cs.map(c => c.ID))

  const volumeUsageMap = new Map<string, DockerVolumeUsage[]>()
  const bindMounts = new Map<string, { mountpoint: string; usedBy: DockerVolumeUsage[] }>()

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
            const existing = volumeUsageMap.get(mount.Name) || []
            volumeUsageMap.set(mount.Name, [...existing, usage])
          } else if (mount.Type === 'bind' && mount.Source) {
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

  const dockerVolumes: DockerVolume[] = raw.map(vol => ({
    name: vol.Name,
    driver: vol.Driver,
    mountpoint: vol.Mountpoint,
    labels: parseLabels(vol.Labels),
    scope: vol.Scope as 'local' | 'global',
    createdAt: vol.CreatedAt || '',
    usedBy: volumeUsageMap.get(vol.Name) || [],
    type: 'volume' as const,
  }))

  const bindMountVolumes: DockerVolume[] = Array.from(bindMounts.entries()).map(([source, data]) => ({
    name: source.split('/').pop() || source,
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

export async function createVolume(
  name: string,
  labels: Record<string, string> | undefined,
  opts: CliOptions
): Promise<DockerVolume> {
  validateResourceName(name)
  const args = ['volume', 'create', name]

  if (labels) {
    for (const [key, value] of Object.entries(labels)) {
      args.push('--label', `${key}=${value}`)
    }
  }

  await dockerCli.execSafe(args, opts)

  const inspectOutput = await dockerCli.execSafe(
    ['volume', 'inspect', name],
    opts
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

export async function removeVolume(name: string, opts: CliOptions): Promise<void> {
  validateResourceName(name)
  await dockerCli.execSafe(['volume', 'rm', name], opts)
}

export async function pruneVolumes(opts: CliOptions): Promise<{ spaceReclaimed: number }> {
  const output = await dockerCli.execSafe(['volume', 'prune', '-f'], opts)
  return { spaceReclaimed: parseReclaimedSpace(output) }
}
