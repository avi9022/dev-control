import { createContext, useContext, useEffect, useState, useCallback, type FC, type PropsWithChildren } from 'react'

interface AIAutomationContextType {
  tasks: AITask[]
  settings: AIAutomationSettings | null
  createTask: (title: string, description: string, gitStrategy: AIGitStrategy, maxReviewCycles: number) => Promise<AITask>
  updateTask: (id: string, updates: Partial<AITask>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  moveTaskPhase: (id: string, targetPhase: AITaskPhase) => Promise<void>
  stopTask: (id: string) => Promise<void>
  sendTaskInput: (taskId: string, input: string) => Promise<void>
  updateSettings: (updates: Partial<AIAutomationSettings>) => Promise<void>
}

const AIAutomationContext = createContext<AIAutomationContextType | null>(null)

export function useAIAutomation() {
  const ctx = useContext(AIAutomationContext)
  if (!ctx) throw new Error('useAIAutomation must be within AIAutomationProvider')
  return ctx
}

export const AIAutomationProvider: FC<PropsWithChildren> = ({ children }) => {
  const [tasks, setTasks] = useState<AITask[]>([])
  const [settings, setSettings] = useState<AIAutomationSettings | null>(null)

  useEffect(() => {
    window.electron.aiGetTasks().then(setTasks)
    window.electron.aiGetSettings().then(setSettings)
    const unsubscribe = window.electron.subscribeAITasks(setTasks)
    return unsubscribe
  }, [])

  const createTask = useCallback(async (title: string, description: string, gitStrategy: AIGitStrategy, maxReviewCycles: number) => {
    return window.electron.aiCreateTask(title, description, gitStrategy, maxReviewCycles)
  }, [])

  const updateTask = useCallback(async (id: string, updates: Partial<AITask>) => {
    await window.electron.aiUpdateTask(id, updates)
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    await window.electron.aiDeleteTask(id)
  }, [])

  const moveTaskPhase = useCallback(async (id: string, targetPhase: AITaskPhase) => {
    await window.electron.aiMoveTaskPhase(id, targetPhase)
  }, [])

  const stopTask = useCallback(async (id: string) => {
    await window.electron.aiStopTask(id)
  }, [])

  const sendTaskInput = useCallback(async (taskId: string, input: string) => {
    await window.electron.aiSendTaskInput(taskId, input)
  }, [])

  const handleUpdateSettings = useCallback(async (updates: Partial<AIAutomationSettings>) => {
    await window.electron.aiUpdateSettings(updates)
    setSettings(prev => prev ? { ...prev, ...updates } : prev)
  }, [])

  return (
    <AIAutomationContext.Provider value={{
      tasks,
      settings,
      createTask,
      updateTask,
      deleteTask,
      moveTaskPhase,
      stopTask,
      sendTaskInput,
      updateSettings: handleUpdateSettings
    }}>
      {children}
    </AIAutomationContext.Provider>
  )
}
