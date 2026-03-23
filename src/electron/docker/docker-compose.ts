/**
 * Docker Compose operations: list projects, up, down, restart.
 */

import { dockerCli } from './docker-cli.js'
import { validateResourceName } from './docker-utils.js'

interface CliOptions {
  context: string
}

export function buildComposeProjects(containers: DockerContainer[]): DockerComposeProject[] {
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

export async function composeUp(project: string, opts: CliOptions): Promise<void> {
  validateResourceName(project)
  await dockerCli.execSafe(
    ['compose', '-p', project, 'up', '-d'],
    { ...opts, timeout: 120_000 }
  )
}

export async function composeDown(project: string, opts: CliOptions): Promise<void> {
  validateResourceName(project)
  await dockerCli.execSafe(
    ['compose', '-p', project, 'down'],
    { ...opts, timeout: 60_000 }
  )
}

export async function composeRestart(project: string, opts: CliOptions): Promise<void> {
  validateResourceName(project)
  await dockerCli.execSafe(
    ['compose', '-p', project, 'restart'],
    { ...opts, timeout: 60_000 }
  )
}
