import { store } from '../storage/store.js'
import { v4 } from 'uuid'
import { DEFAULT_STEP_TIMEOUT_MS } from '../../shared/constants.js'

interface LegacyWorkflow {
  name: string
  id: string
  services: string[]
}

const isLegacyWorkflow = (w: unknown): w is LegacyWorkflow => {
  if (typeof w !== 'object' || w === null) return false
  return 'services' in w && Array.isArray((w as LegacyWorkflow).services) && !('startSteps' in w)
}

const isEnhancedWorkflow = (w: unknown): w is EnhancedWorkflow => {
  if (typeof w !== 'object' || w === null) return false
  return 'startSteps' in w && 'stopSteps' in w && 'id' in w && 'name' in w
}

export const migrateWorkflows = (): void => {
  const workflows = store.get('workflows')
  if (!workflows || workflows.length === 0) return

  const needsMigration = workflows.some(isLegacyWorkflow)
  if (!needsMigration) return

  const migrated: EnhancedWorkflow[] = workflows.map((w) => {
    if (!isLegacyWorkflow(w)) {
      if (isEnhancedWorkflow(w)) return w
      throw new Error(`Unexpected workflow format during migration: ${JSON.stringify(w)}`)
    }

    const now = Date.now()
    const startSteps: WorkflowStep[] = w.services.map((serviceId) => ({
      id: v4(),
      type: 'service' as const,
      label: `Start service`,
      enabled: true,
      timeoutMs: DEFAULT_STEP_TIMEOUT_MS,
      retries: 0,
      continueOnError: false,
      serviceIds: [serviceId],
    }))

    const stopSteps: WorkflowStep[] = [...w.services].reverse().map((serviceId) => ({
      id: v4(),
      type: 'service' as const,
      label: `Stop service`,
      enabled: true,
      timeoutMs: DEFAULT_STEP_TIMEOUT_MS,
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
