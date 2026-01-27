import { createContext, useContext, useState, useEffect, useCallback, type FC, type PropsWithChildren } from 'react'
import { useViews } from '@/ui/contexts/views'

interface ApiClientContextValue {
  workspaces: ApiWorkspace[]
  activeWorkspace: ApiWorkspace | null
  activeWorkspaceId: string | null
  loading: boolean
  selectedRequestId: string | null
  history: ApiHistoryEntry[]
  loadWorkspaces: () => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>
  setActiveWorkspace: (id: string) => Promise<void>
  importPostmanCollection: () => Promise<void>
  importPostmanEnvironment: () => Promise<void>
  createCollection: (name: string) => Promise<void>
  deleteCollection: (collectionId: string) => Promise<void>
  addRequest: (collectionId: string, parentFolderId: string | null, config: ApiRequestConfig) => Promise<void>
  addFolder: (collectionId: string, parentFolderId: string | null, name: string) => Promise<void>
  updateRequest: (collectionId: string, itemId: string, config: ApiRequestConfig) => Promise<void>
  deleteItem: (collectionId: string, itemId: string) => Promise<void>
  selectRequest: (requestId: string | null) => void
  createEnvironment: (name: string) => Promise<void>
  updateEnvironment: (envId: string, env: ApiEnvironment) => Promise<void>
  deleteEnvironment: (envId: string) => Promise<void>
  setActiveEnvironment: (envId: string | null) => Promise<void>
  sendRequest: (config: ApiRequestConfig) => Promise<ApiResponse>
  cancelRequest: () => Promise<void>
  loadHistory: () => Promise<void>
  clearHistory: () => Promise<void>
}

export const ApiClientContext = createContext<ApiClientContextValue>({
  workspaces: [],
  activeWorkspace: null,
  activeWorkspaceId: null,
  loading: false,
  selectedRequestId: null,
  history: [],
  loadWorkspaces: async () => {},
  createWorkspace: async () => {},
  deleteWorkspace: async () => {},
  setActiveWorkspace: async () => {},
  importPostmanCollection: async () => {},
  importPostmanEnvironment: async () => {},
  createCollection: async () => {},
  deleteCollection: async () => {},
  addRequest: async () => {},
  addFolder: async () => {},
  updateRequest: async () => {},
  deleteItem: async () => {},
  selectRequest: () => {},
  createEnvironment: async () => {},
  updateEnvironment: async () => {},
  deleteEnvironment: async () => {},
  setActiveEnvironment: async () => {},
  sendRequest: async () => ({} as ApiResponse),
  cancelRequest: async () => {},
  loadHistory: async () => {},
  clearHistory: async () => {},
})

export function useApiClient() {
  return useContext(ApiClientContext)
}

export const ApiClientProvider: FC<PropsWithChildren> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<ApiWorkspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [history, setHistory] = useState<ApiHistoryEntry[]>([])
  const { updateView } = useViews()

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null

  const loadWorkspaces = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electron.apiGetWorkspaces()
      setWorkspaces(result)
    } catch (error) {
      console.error('Failed to load workspaces:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const createWorkspace = useCallback(async (name: string) => {
    await window.electron.apiCreateWorkspace(name)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const deleteWorkspace = useCallback(async (id: string) => {
    await window.electron.apiDeleteWorkspace(id)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const setActiveWorkspace = useCallback(async (id: string) => {
    await window.electron.apiSetActiveWorkspace(id)
    setActiveWorkspaceId(id)
  }, [])

  const importPostmanCollection = useCallback(async () => {
    if (!activeWorkspaceId) return
    await window.electron.apiImportPostmanCollection(activeWorkspaceId)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const importPostmanEnvironment = useCallback(async () => {
    await window.electron.apiImportPostmanEnvironment()
    await loadWorkspaces()
  }, [loadWorkspaces])

  const createCollection = useCallback(async (name: string) => {
    await window.electron.apiCreateCollection(name)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const deleteCollection = useCallback(async (collectionId: string) => {
    await window.electron.apiDeleteCollection(collectionId)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const addRequest = useCallback(async (collectionId: string, parentFolderId: string | null, config: ApiRequestConfig) => {
    await window.electron.apiAddRequest(collectionId, parentFolderId, config)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const addFolder = useCallback(async (collectionId: string, parentFolderId: string | null, name: string) => {
    await window.electron.apiAddFolder(collectionId, parentFolderId, name)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const updateRequest = useCallback(async (collectionId: string, itemId: string, config: ApiRequestConfig) => {
    await window.electron.apiUpdateRequest(collectionId, itemId, config)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const deleteItem = useCallback(async (collectionId: string, itemId: string) => {
    await window.electron.apiDeleteItem(collectionId, itemId)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const selectRequest = useCallback((requestId: string | null) => {
    setSelectedRequestId(requestId)
    updateView('api-client', requestId)
  }, [updateView])

  const createEnvironment = useCallback(async (name: string) => {
    await window.electron.apiCreateEnvironment(name)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const updateEnvironment = useCallback(async (envId: string, env: ApiEnvironment) => {
    await window.electron.apiUpdateEnvironment(envId, env)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const deleteEnvironment = useCallback(async (envId: string) => {
    await window.electron.apiDeleteEnvironment(envId)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const setActiveEnvironment = useCallback(async (envId: string | null) => {
    await window.electron.apiSetActiveEnvironment(envId)
    await loadWorkspaces()
  }, [loadWorkspaces])

  const loadHistory = useCallback(async () => {
    try {
      const result = await window.electron.apiGetHistory()
      setHistory(result)
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }, [])

  const sendRequest = useCallback(async (config: ApiRequestConfig) => {
    const response = await window.electron.apiSendRequest(config)
    await loadHistory()
    return response
  }, [loadHistory])

  const cancelRequest = useCallback(async () => {
    await window.electron.apiCancelRequest()
  }, [])

  const clearHistory = useCallback(async () => {
    await window.electron.apiClearHistory()
    setHistory([])
  }, [])

  // Subscribe to workspace changes
  useEffect(() => {
    return window.electron.subscribeApiWorkspaces((updatedWorkspaces) => {
      setWorkspaces(updatedWorkspaces)
    })
  }, [])

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  // Derive activeWorkspace and load history when activeWorkspaceId changes
  useEffect(() => {
    if (activeWorkspaceId) {
      loadHistory()
    } else {
      setHistory([])
    }
  }, [activeWorkspaceId, loadHistory])

  return (
    <ApiClientContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        activeWorkspaceId,
        loading,
        selectedRequestId,
        history,
        loadWorkspaces,
        createWorkspace,
        deleteWorkspace,
        setActiveWorkspace,
        importPostmanCollection,
        importPostmanEnvironment,
        createCollection,
        deleteCollection,
        addRequest,
        addFolder,
        updateRequest,
        deleteItem,
        selectRequest,
        createEnvironment,
        updateEnvironment,
        deleteEnvironment,
        setActiveEnvironment,
        sendRequest,
        cancelRequest,
        loadHistory,
        clearHistory,
      }}
    >
      {children}
    </ApiClientContext.Provider>
  )
}
