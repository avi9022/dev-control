import { createContext, useContext, useEffect, useState, useCallback, type FC, type PropsWithChildren } from 'react'

interface AIAutomationContextType {
  tasks: AITask[]
  settings: AIAutomationSettings | null
  knowledgeGenStatus: string
  createTask: (title: string, description: string, gitStrategy: AIGitStrategy, maxReviewCycles: number, projectPaths?: string[], baseBranch?: string, customBranchName?: string, worktreeDir?: string) => Promise<AITask>
  updateTask: (id: string, updates: Partial<AITask>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  moveTaskPhase: (id: string, targetPhase: string) => Promise<void>
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
  const [knowledgeGenStatus, setKnowledgeGenStatus] = useState('')

  useEffect(() => {
    window.electron.aiGetTasks().then(setTasks)
    window.electron.aiGetSettings().then(setSettings)
    const unsubTasks = window.electron.subscribeAITasks(setTasks)
    const unsubKnowledge = window.electron.subscribeAIKnowledgeGenProgress(setKnowledgeGenStatus)
    return () => { unsubTasks(); unsubKnowledge() }
  }, [])

  const createTask = useCallback(async (title: string, description: string, gitStrategy: AIGitStrategy, maxReviewCycles: number, projectPaths?: string[], baseBranch?: string, customBranchName?: string, worktreeDir?: string) => {
    return window.electron.aiCreateTask(title, description, gitStrategy, maxReviewCycles, projectPaths, baseBranch, customBranchName, worktreeDir)
  }, [])

  const updateTask = useCallback(async (id: string, updates: Partial<AITask>) => {
    await window.electron.aiUpdateTask(id, updates)
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    await window.electron.aiDeleteTask(id)
  }, [])

  const moveTaskPhase = useCallback(async (id: string, targetPhase: string) => {
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
      knowledgeGenStatus,
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
