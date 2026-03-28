import { store } from "./store.js"

export const getWorkflows = (): EnhancedWorkflow[] => {
  return store.get('workflows') || []
}