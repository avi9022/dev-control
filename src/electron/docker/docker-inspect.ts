/**
 * Docker container/image inspection and stats operations.
 */

import { dockerCli } from './docker-cli.js'
import {
  validateContainerId,
  validateResourceName,
  parseInspectPorts,
  mapStatsEntry,
} from './docker-utils.js'

interface CliOptions {
  context: string
}

export async function getContainer(
  id: string,
  opts: CliOptions
): Promise<DockerContainer> {
  const safeId = validateContainerId(id)
  const output = await dockerCli.execSafe(
    ['inspect', '--format', '{{json .}}', safeId],
    opts
  )
  const raw = JSON.parse(output)

  const labels = raw.Config?.Labels ?? {}
  const ports = parseInspectPorts(raw.NetworkSettings?.Ports ?? {})
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

export async function inspectContainer(
  id: string,
  opts: CliOptions
): Promise<Record<string, unknown>> {
  const safeId = validateContainerId(id)
  const output = await dockerCli.execSafe(['inspect', safeId], opts)
  const parsed = JSON.parse(output)
  return Array.isArray(parsed) ? parsed[0] : parsed
}

export async function getContainerStats(
  id: string,
  opts: CliOptions
): Promise<DockerContainerStats> {
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
    opts
  )

  if (raw.length === 0) {
    throw new Error(`No stats available for container: ${id}`)
  }

  return mapStatsEntry(raw[0])
}

export async function getAllStatsForContext(
  contextName: string
): Promise<Record<string, DockerContainerStats>> {
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
    result[entry.ID.substring(0, 12)] = mapStatsEntry(entry)
  }
  return result
}

export async function inspectImage(
  id: string,
  opts: CliOptions
): Promise<Record<string, unknown>> {
  validateResourceName(id)
  const output = await dockerCli.execSafe(['inspect', id], opts)
  const parsed = JSON.parse(output)
  return Array.isArray(parsed) ? parsed[0] : parsed
}
