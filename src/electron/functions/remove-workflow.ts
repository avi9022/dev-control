import { getWorkflows } from "../storage/get-workflows.js"
import { store } from "../storage/store.js"

export const removeWorkflow = (id: string) => {
  const workflows = getWorkflows()
  store.set('workflows', workflows.filter(({ id: currId }) => currId !== id))
}