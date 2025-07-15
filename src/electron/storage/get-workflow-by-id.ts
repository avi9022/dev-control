import { store } from "./store.js"

export const getWorkflowById = (id: string): Workflow | undefined => {
  const flows = store.get('workflows') || []
  return flows.find(({ id: currId }) => currId === id)
}