/**
 * Shared utility functions and validation helpers for Docker operations.
 */

export const CONTAINER_ID_PATTERN = /^[a-zA-Z0-9]+$/
export const SAFE_NAME_PATTERN = /^[a-zA-Z0-9._:/@-]+$/

export function validateContainerId(id: string): string {
  if (!CONTAINER_ID_PATTERN.test(id)) {
    throw new Error(`Invalid container ID: ${id}`)
  }
  return id
}

export function validateResourceName(name: string): string {
  if (!SAFE_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid resource name: ${name}`)
  }
  return name
}

export function parseHumanSize(sizeStr: string): number {
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

export function parsePercentage(str: string): number {
  const cleaned = str.replace('%', '').trim()
  const val = parseFloat(cleaned)
  return Number.isNaN(val) ? 0 : val
}

export function parsePortMappings(portsStr: string): DockerPortMapping[] {
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

export function parseMounts(mountsStr: string): DockerMount[] {
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

export function parseLabels(labelsStr: string): Record<string, string> {
  if (!labelsStr || labelsStr.trim() === '') return {}

  return labelsStr.split(',').reduce<Record<string, string>>((acc, pair) => {
    const eqIndex = pair.indexOf('=')
    if (eqIndex === -1) return acc
    const key = pair.substring(0, eqIndex).trim()
    const value = pair.substring(eqIndex + 1).trim()
    return { ...acc, [key]: value }
  }, {})
}

export function parseInspectPorts(
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

export function mapStatsEntry(entry: {
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

export function parseReclaimedSpace(output: string): number {
  const match = output.match(/Total reclaimed space:\s*(.+)/i)
  if (!match) return 0
  return parseHumanSize(match[1].trim())
}
