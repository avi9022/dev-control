import { getWorkflows } from "../storage/get-workflows.js"
import { store } from "../storage/store.js"

export const updateWorkflow = (id: string, data: Omit<EnhancedWorkflow, 'id' | 'createdAt' | 'updatedAt'>): void => {
  const workflows = getWorkflows()
  store.set('workflows', workflows.map((workflow) =>
    workflow.id === id
      ? { ...workflow, ...data, id, updatedAt: Date.now() }
      : workflow
  ))
}
