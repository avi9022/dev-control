/**
 * Docker image operations: list, pull, remove, inspect, history, prune.
 */

import { dockerCli } from './docker-cli.js'
import {
  validateResourceName,
  parseHumanSize,
  parseLabels,
  parseReclaimedSpace,
} from './docker-utils.js'

interface CliOptions {
  context: string
}

export async function getImagesForContext(contextName: string): Promise<DockerImage[]> {
  const raw = await dockerCli.execJson<{
    ID: string
    Repository: string
    Tag: string
    Digest: string
    CreatedAt: string
    Size: string
    VirtualSize: string
    Labels: string
    Containers: string
  }>(['images', '--format', '{{json .}}', '--no-trunc'], { context: contextName })

  return raw.map(img => {
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
      labels: parseLabels(img.Labels),
      containers: parseInt(img.Containers, 10) || 0,
    }
  })
}

export async function pullImage(name: string, opts: CliOptions): Promise<void> {
  validateResourceName(name)
  await dockerCli.execSafe(['pull', name], {
    ...opts,
    timeout: 300_000,
  })
}

export async function removeImage(
  id: string,
  force: boolean,
  opts: CliOptions
): Promise<void> {
  validateResourceName(id)
  const args = force ? ['rmi', '-f', id] : ['rmi', id]
  await dockerCli.execSafe(args, opts)
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

export async function getImageHistory(
  id: string,
  opts: CliOptions
): Promise<DockerImageLayer[]> {
  validateResourceName(id)
  const raw = await dockerCli.execJson<{
    ID: string
    CreatedBy: string
    Size: string
    Comment: string
  }>(['history', '--format', '{{json .}}', '--no-trunc', id], opts)

  return raw.map(layer => ({
    id: layer.ID,
    createdBy: layer.CreatedBy,
    size: parseHumanSize(layer.Size),
    comment: layer.Comment || '',
  }))
}

export async function pruneImages(
  danglingOnly: boolean,
  opts: CliOptions
): Promise<{ spaceReclaimed: number }> {
  const args = danglingOnly
    ? ['image', 'prune', '-f']
    : ['image', 'prune', '-a', '-f']

  const output = await dockerCli.execSafe(args, opts)
  return { spaceReclaimed: parseReclaimedSpace(output) }
}
