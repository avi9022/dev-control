import { store } from "./store.js"

export const getWorkflows = (): Workflow[] => {
  return store.get('workflows') || []
}