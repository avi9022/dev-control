import { runCommand } from './workflow-command-runner.js'
import { runService, stopProcess } from '../functions/run-service.js'
import { getDirectoryById } from '../storage/get-directory-by-id.js'
import { dockerManager } from '../docker/docker-manager.js'
import type { BrowserWindow } from 'electron'

interface StepHandlerOptions {
  signal: AbortSignal
  onOutput?: (data: string) => void
  mainWindow: BrowserWindow
}

export const executeCommandStep = async (
  step: WorkflowCommandStep,
  options: StepHandlerOptions
): Promise<void> => {
  const { signal, onOutput } = options
  const result = await runCommand(step.command, {
    cwd: step.workingDirectory,
    timeoutMs: step.timeoutMs,
    signal,
    onOutput,
  })

  if (result.exitCode !== 0) {
    throw new Error(
      `Command exited with code ${result.exitCode}: ${result.stderr || result.stdout}`.slice(0, 500)
    )
  }
}

export const executeDockerStep = async (
  step: WorkflowDockerStep,
  phase: 'start' | 'stop',
  options: StepHandlerOptions
): Promise<void> => {
  const { signal, onOutput } = options
  const ctx = step.dockerContext

  if (step.composeProject) {
    onOutput?.(`${phase === 'start' ? 'Starting' : 'Stopping'} compose project: ${step.composeProject}${ctx ? ` (context: ${ctx})` : ''}\n`)
  }

  const action = phase === 'start' ? 'start' : 'stop'

  const results = await Promise.allSettled(
    step.containerIds.map(async (containerId, index) => {
      if (signal.aborted) throw new Error('Aborted')
      const name = step.containerNames[index] || containerId
      onOutput?.(`${action === 'start' ? 'Starting' : 'Stopping'} container: ${name}\n`)

      try {
        if (phase === 'start') {
          await dockerManager.startContainer(containerId, ctx)
        } else {
          await dockerManager.stopContainer(containerId, ctx)
        }
        onOutput?.(`Container ${name} ${action}ed successfully\n`)
      } catch {
        // If ID fails (stale), try by name
        try {
          if (phase === 'start') {
            await dockerManager.startContainer(name, ctx)
          } else {
            await dockerManager.stopContainer(name, ctx)
          }
          onOutput?.(`Container ${name} ${action}ed successfully (resolved by name)\n`)
        } catch (nameError) {
          const msg = nameError instanceof Error ? nameError.message : String(nameError)
          throw new Error(`Failed to ${action} container '${name}': ${msg}`.slice(0, 300))
        }
      }
    })
  )

  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (failures.length > 0) {
    throw new Error(failures.map((f) => f.reason?.message || String(f.reason)).join('; '))
  }
}

export const executeServiceStep = async (
  step: WorkflowServiceStep,
  phase: 'start' | 'stop',
  options: StepHandlerOptions
): Promise<void> => {
  const { signal, onOutput, mainWindow } = options

  if (phase === 'start') {
    const results = await Promise.allSettled(
      step.serviceIds.map(async (serviceId) => {
        if (signal.aborted) throw new Error('Aborted')
        const service = getDirectoryById(serviceId)
        if (!service) {
          throw new Error(`Service '${serviceId}' not found`)
        }

        onOutput?.(`Starting service: ${service.name}\n`)

        if (service.port) {
          try {
            const isPortReachable = (await import('is-port-reachable')).default
            const isRunning = await isPortReachable(+service.port, { host: 'localhost' })
            if (isRunning) {
              onOutput?.(`Service ${service.name} is already running on port ${service.port}\n`)
              return
            }
          } catch {
            // Continue with start
          }
        }

        runService(serviceId, mainWindow)
        onOutput?.(`Service ${service.name} start command issued\n`)

        if (service.port) {
          const isPortReachable = (await import('is-port-reachable')).default
          const pollStart = Date.now()
          const pollTimeout = Math.min(step.timeoutMs, 120000)

          while (Date.now() - pollStart < pollTimeout) {
            if (signal.aborted) throw new Error('Aborted')
            const reachable = await isPortReachable(+service.port, { host: 'localhost' })
            if (reachable) {
              onOutput?.(`Service ${service.name} is now running on port ${service.port}\n`)
              return
            }
            await new Promise((r) => setTimeout(r, 1000))
          }
          onOutput?.(`Warning: Service ${service.name} port ${service.port} not reachable within timeout, continuing...\n`)
        }
      })
    )

    const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    if (failures.length > 0) {
      throw new Error(failures.map((f) => f.reason?.message || String(f.reason)).join('; '))
    }
  } else {
    for (const serviceId of step.serviceIds) {
      if (signal.aborted) throw new Error('Aborted')
      const service = getDirectoryById(serviceId)
      onOutput?.(`Stopping service: ${service?.name || serviceId}\n`)
      stopProcess(serviceId)
    }
  }
}
