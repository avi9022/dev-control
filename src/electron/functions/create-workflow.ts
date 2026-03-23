import { v4 } from 'uuid'
import { getWorkflows } from "../storage/get-workflows.js"
import { store } from "../storage/store.js"

export const createWorkflow = (data: Omit<EnhancedWorkflow, 'id' | 'createdAt' | 'updatedAt'>): void => {
  const workflows = getWorkflows()
  const now = Date.now()
  const newWorkflow: EnhancedWorkflow = {
    ...data,
    id: v4(),
    createdAt: now,
    updatedAt: now,
  }
  store.set('workflows', [...workflows, newWorkflow])
}
