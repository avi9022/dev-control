import { store } from '../storage/store.js'
import { v4 } from 'uuid'

interface LegacyWorkflow {
  name: string
  id: string
  services: string[]
}

const isLegacyWorkflow = (w: unknown): w is LegacyWorkflow => {
  const obj = w as Record<string, unknown>
  return typeof obj === 'object' && obj !== null && 'services' in obj && Array.isArray(obj.services) && !('startSteps' in obj)
}

export const migrateWorkflows = (): void => {
  const workflows = store.get('workflows') as unknown[]
  if (!workflows || workflows.length === 0) return

  const needsMigration = workflows.some(isLegacyWorkflow)
  if (!needsMigration) return

  const migrated: EnhancedWorkflow[] = workflows.map((w) => {
    if (!isLegacyWorkflow(w)) return w as EnhancedWorkflow

    const now = Date.now()
    const startSteps: WorkflowStep[] = w.services.map((serviceId) => ({
      id: v4(),
      type: 'service' as const,
      label: `Start service`,
      enabled: true,
      timeoutMs: 120000,
      retries: 0,
      continueOnError: false,
      serviceIds: [serviceId],
    }))

    const stopSteps: WorkflowStep[] = [...w.services].reverse().map((serviceId) => ({
      id: v4(),
      type: 'service' as const,
      label: `Stop service`,
      enabled: true,
      timeoutMs: 120000,
      retries: 0,
      continueOnError: false,
      serviceIds: [serviceId],
    }))

    return {
      id: w.id,
      name: w.name,
      startSteps,
      stopSteps,
      createdAt: now,
      updatedAt: now,
    }
  })

  store.set('workflows', migrated)
}
