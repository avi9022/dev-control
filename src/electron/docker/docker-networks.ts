/**
 * Docker network operations: list, create, remove, inspect.
 */

import { dockerCli } from './docker-cli.js'
import { validateResourceName, parseLabels } from './docker-utils.js'

interface CliOptions {
  context: string
}

export async function getNetworksForContext(contextName: string): Promise<DockerNetwork[]> {
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
    labels: parseLabels(net.Labels),
  }))
}

export async function createNetwork(
  name: string,
  driver: string,
  opts: CliOptions
): Promise<DockerNetwork> {
  validateResourceName(name)
  validateResourceName(driver)

  await dockerCli.execSafe(
    ['network', 'create', '-d', driver, name],
    opts
  )

  return inspectNetwork(name, opts)
}

export async function removeNetwork(id: string, opts: CliOptions): Promise<void> {
  validateResourceName(id)
  await dockerCli.execSafe(['network', 'rm', id], opts)
}

export async function inspectNetwork(id: string, opts: CliOptions): Promise<DockerNetwork> {
  validateResourceName(id)
  const output = await dockerCli.execSafe(['network', 'inspect', id], opts)
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
