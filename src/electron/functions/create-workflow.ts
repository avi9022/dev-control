import { v4 } from 'uuid'
import { getWorkflows } from "../storage/get-workflows.js"
import { store } from "../storage/store.js"

export const createWorkflow = (name: string, services: string[]) => {
  const workflows = getWorkflows()
  const newWorkflow: Workflow = {
    name,
    services,
    id: v4(),
  }
  store.set('workflows', [...workflows, newWorkflow])
}