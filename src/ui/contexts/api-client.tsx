import { createContext, useContext, useState, useEffect, useCallback, type FC, type PropsWithChildren } from 'react'
import { useViews } from '@/ui/contexts/views'

interface ApiClientContextValue {
  workspaces: ApiWorkspace[]
  activeWorkspace: ApiWorkspace | null
  activeWorkspaceId: string | null
  loading: boolean
  selectedRequestId: string | null
  history: ApiHistoryEntry[]
  scratchRequest: ApiRequestConfig | null
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
  renameItem: (collectionId: string, itemId: string, name: string) => Promise<void>
  duplicateItem: (collectionId: string, itemId: string) => Promise<void>
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
  createScratchRequest: () => void
  setScratchRequest: (config: ApiRequestConfig | null) => void
  saveRequestToCollection: (collectionId: string, parentFolderId: string | null, name: string, config: ApiRequestConfig) => Promise<void>
}

export const ApiClientContext = createContext<ApiClientContextValue>({
  workspaces: [],
  activeWorkspace: null,
  activeWorkspaceId: null,
  loading: false,
  selectedRequestId: null,
  history: [],
  scratchRequest: null,
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
  renameItem: async () => {},
  duplicateItem: async () => {},
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
  createScratchRequest: () => {},
  setScratchRequest: () => {},
  saveRequestToCollection: async () => {},
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
  const [scratchRequest, setScratchRequest] = useState<ApiRequestConfig | null>(null)
  const { updateView } = useViews()

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null

  const loadWorkspaces = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electron.apiGetWorkspaces()
      setWorkspaces(result)

      let storedActiveId: string | null = null
      try {
        storedActiveId = await window.electron.apiGetActiveWorkspaceId()
      } catch {
        // Handler may not be registered yet
      }

      if (storedActiveId && result.some((w) => w.id === storedActiveId)) {
        setActiveWorkspaceId(storedActiveId)
      } else if (result.length > 0) {
        setActiveWorkspaceId(result[0].id)
      }
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
    if (!activeWorkspaceId) {
      console.error('Cannot import: no active workspace')
      return
    }
    try {
      await window.electron.apiImportPostmanCollection(activeWorkspaceId)
      await loadWorkspaces()
    } catch (error) {
      // Ignore "cancelled" errors from dialog dismissal
      const msg = error instanceof Error ? error.message : String(error)
      if (!msg.includes('cancelled') && !msg.includes('canceled')) {
        console.error('Failed to import collection:', error)
      }
    }
  }, [activeWorkspaceId, loadWorkspaces])

  const importPostmanEnvironment = useCallback(async () => {
    if (!activeWorkspaceId) return
    try {
      await window.electron.apiImportPostmanEnvironment(activeWorkspaceId)
      await loadWorkspaces()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      if (!msg.includes('cancelled') && !msg.includes('canceled')) {
        console.error('Failed to import environment:', error)
      }
    }
  }, [activeWorkspaceId, loadWorkspaces])

  const createCollection = useCallback(async (name: string) => {
    if (!activeWorkspaceId) return
    await window.electron.apiCreateCollection(activeWorkspaceId, name)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const deleteCollection = useCallback(async (collectionId: string) => {
    if (!activeWorkspaceId) return
    await window.electron.apiDeleteCollection(activeWorkspaceId, collectionId)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const addRequest = useCallback(async (collectionId: string, parentFolderId: string | null, config: ApiRequestConfig) => {
    if (!activeWorkspaceId) return
    await window.electron.apiAddRequest(activeWorkspaceId, collectionId, parentFolderId, config)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const addFolder = useCallback(async (collectionId: string, parentFolderId: string | null, name: string) => {
    if (!activeWorkspaceId) return
    await window.electron.apiAddFolder(activeWorkspaceId, collectionId, parentFolderId, name)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const updateRequest = useCallback(async (collectionId: string, itemId: string, config: ApiRequestConfig) => {
    if (!activeWorkspaceId) return
    await window.electron.apiUpdateRequest(activeWorkspaceId, collectionId, itemId, config)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const renameItem = useCallback(async (collectionId: string, itemId: string, name: string) => {
    if (!activeWorkspaceId) return
    await window.electron.apiRenameItem(activeWorkspaceId, collectionId, itemId, name)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const duplicateItem = useCallback(async (collectionId: string, itemId: string) => {
    if (!activeWorkspaceId) return
    await window.electron.apiDuplicateItem(activeWorkspaceId, collectionId, itemId)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const deleteItem = useCallback(async (collectionId: string, itemId: string) => {
    if (!activeWorkspaceId) return
    await window.electron.apiDeleteItem(activeWorkspaceId, collectionId, itemId)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const selectRequest = useCallback((requestId: string | null) => {
    setSelectedRequestId(requestId)
    setScratchRequest(null)
    updateView('api-client', requestId)
  }, [updateView])

  const createEnvironment = useCallback(async (name: string) => {
    if (!activeWorkspaceId) return
    await window.electron.apiCreateEnvironment(activeWorkspaceId, name)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const updateEnvironment = useCallback(async (envId: string, env: ApiEnvironment) => {
    if (!activeWorkspaceId) return
    await window.electron.apiUpdateEnvironment(activeWorkspaceId, envId, env)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const deleteEnvironment = useCallback(async (envId: string) => {
    if (!activeWorkspaceId) return
    await window.electron.apiDeleteEnvironment(activeWorkspaceId, envId)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const setActiveEnvironment = useCallback(async (envId: string | null) => {
    if (!activeWorkspaceId) return
    await window.electron.apiSetActiveEnvironment(activeWorkspaceId, envId)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces])

  const loadHistory = useCallback(async () => {
    if (!activeWorkspaceId) return
    try {
      const result = await window.electron.apiGetHistory(activeWorkspaceId)
      setHistory(result)
    } catch (error) {
      console.error('Failed to load history:', error)
    }
  }, [activeWorkspaceId])

  const sendRequest = useCallback(async (config: ApiRequestConfig) => {
    if (!activeWorkspaceId) throw new Error('No active workspace')
    const response = await window.electron.apiSendRequest(activeWorkspaceId, config)
    await loadHistory()
    return response
  }, [activeWorkspaceId, loadHistory])

  const cancelRequest = useCallback(async () => {
    await window.electron.apiCancelRequest()
  }, [])

  const clearHistory = useCallback(async () => {
    if (!activeWorkspaceId) return
    await window.electron.apiClearHistory(activeWorkspaceId)
    setHistory([])
  }, [activeWorkspaceId])

  const createScratchRequest = useCallback(() => {
    const config: ApiRequestConfig = {
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      body: { type: 'none', content: '' },
      auth: { type: 'none' },
    }
    setScratchRequest(config)
    setSelectedRequestId(null)
    updateView('api-client', 'scratch')
  }, [updateView])

  const saveRequestToCollection = useCallback(async (
    collectionId: string,
    parentFolderId: string | null,
    name: string,
    config: ApiRequestConfig
  ) => {
    if (!activeWorkspaceId) return
    const item = await window.electron.apiAddRequest(activeWorkspaceId, collectionId, parentFolderId, config)
    setScratchRequest(null)
    setSelectedRequestId(item.id)
    updateView('api-client', item.id)
    await loadWorkspaces()
  }, [activeWorkspaceId, loadWorkspaces, updateView])

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
        scratchRequest,
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
        renameItem,
        duplicateItem,
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
        createScratchRequest,
        setScratchRequest,
        saveRequestToCollection,
      }}
    >
      {children}
    </ApiClientContext.Provider>
  )
}
