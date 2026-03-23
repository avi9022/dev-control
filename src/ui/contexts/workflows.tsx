import { createContext, useContext, useEffect, useState, useCallback, type FC, type PropsWithChildren } from 'react'

interface WorkflowsContextValue {
  workflows: EnhancedWorkflow[]
  workflowStatusMap: Record<string, WorkflowStatus>
  activeProgress: Record<string, WorkflowExecutionProgress>
  getWorkflowById: (id: string) => EnhancedWorkflow | undefined
  startWorkflow: (id: string) => void
  stopWorkflow: (id: string) => void
  cancelWorkflow: (id: string) => void
  clearProgress: (id: string) => void
}

const WorkflowsContext = createContext<WorkflowsContextValue>({
  workflows: [],
  workflowStatusMap: {},
  activeProgress: {},
  getWorkflowById: () => undefined,
  startWorkflow: () => {},
  stopWorkflow: () => {},
  cancelWorkflow: () => {},
  clearProgress: () => {},
})

export function useWorkflows() {
  return useContext(WorkflowsContext)
}

export const WorkflowsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [workflows, setWorkflows] = useState<EnhancedWorkflow[]>([])
  const [workflowStatusMap, setWorkflowStatusMap] = useState<Record<string, WorkflowStatus>>({})
  const [activeProgress, setActiveProgress] = useState<Record<string, WorkflowExecutionProgress>>({})

  useEffect(() => {
    window.electron.getWorkflows().then(setWorkflows)

    const unsubWorkflows = window.electron.subscribeWorkflows((flows = []) => {
      setWorkflows(flows)
    })

    const unsubProgress = window.electron.subscribeWorkflowProgress((progress) => {
      setActiveProgress((prev) => ({ ...prev, [progress.workflowId]: progress }))
    })

    const unsubStatusMap = window.electron.subscribeWorkflowStatusMap((statusMap) => {
      setWorkflowStatusMap(statusMap)
    })

    return () => {
      unsubWorkflows()
      unsubProgress()
      unsubStatusMap()
    }
  }, [])

  const getWorkflowById = useCallback(
    (id: string) => workflows.find((w) => w.id === id),
    [workflows]
  )

  const startWorkflow = useCallback((id: string) => {
    window.electron.startWorkflow(id)
  }, [])

  const stopWorkflow = useCallback((id: string) => {
    window.electron.stopWorkflow(id)
  }, [])

  const cancelWorkflow = useCallback((id: string) => {
    window.electron.cancelWorkflow(id)
  }, [])

  const clearProgress = useCallback((id: string) => {
    setActiveProgress((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id))
    )
  }, [])

  return (
    <WorkflowsContext.Provider
      value={{
        workflows,
        workflowStatusMap,
        activeProgress,
        getWorkflowById,
        startWorkflow,
        stopWorkflow,
        cancelWorkflow,
        clearProgress,
      }}
    >
      {children}
    </WorkflowsContext.Provider>
  )
}
