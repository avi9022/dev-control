import { getWorkflows } from "../storage/get-workflows.js"
import { store } from "../storage/store.js"

export const updateWorkflow = (id: string, data: Omit<Workflow, 'id'>) => {
  const workflows = getWorkflows()
  store.set('workflows', workflows.map((workflow) => workflow.id === id ? { id, ...data } : workflow))
}