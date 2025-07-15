import { createContext, useContext, useEffect, useState, type FC, type PropsWithChildren } from 'react'

const WorkflowsContext = createContext<{
  workflows: Workflow[]
  getWorkflowById: (id: string) => Workflow | undefined
}>({
  workflows: [],
  getWorkflowById: () => undefined
})

export function useWorkflows() {
  return useContext(WorkflowsContext)
}

export const WorkflowsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([])

  const getWorkflows = async () => {
    const currWorkflows = await window.electron.getWorkflows()
    setWorkflows(currWorkflows)
  }

  const subscribeToWorkflows = () => {
    window.electron.subscribeWorkflows((updatedWorkflows = []) => {
      setWorkflows(updatedWorkflows)
    })
  }

  const getWorkflowById = (id: string): Workflow | undefined => {
    return workflows.find(({ id: currId }) => currId === id)
  }

  useEffect(() => {
    getWorkflows()
    subscribeToWorkflows()
  }, [])


  return <WorkflowsContext.Provider value={{
    workflows,
    getWorkflowById
  }}>
    {children}
  </WorkflowsContext.Provider>

}