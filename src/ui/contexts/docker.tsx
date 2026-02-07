import { createContext, useContext, useState, useEffect, useCallback, type FC, type PropsWithChildren } from 'react'
import { useViews } from '@/ui/contexts/views'

interface DockerContextValue {
  isAvailable: boolean
  contexts: DockerContext[]
  activeContext: string
  containers: DockerContainer[]
  stats: Record<string, DockerContainerStats>
  images: DockerImage[]
  volumes: DockerVolume[]
  networks: DockerNetwork[]
  composeProjects: DockerComposeProject[]
  dashboardStats: DockerDashboardStats | null
  loading: boolean
  selectedContainerId: string | null
  checkAvailability: () => Promise<void>
  loadContexts: () => Promise<void>
  switchContext: (name: string) => Promise<void>
  refreshContainers: () => Promise<void>
  refreshImages: () => Promise<void>
  refreshVolumes: () => Promise<void>
  refreshNetworks: () => Promise<void>
  refreshComposeProjects: () => Promise<void>
  refreshDashboard: () => Promise<void>
  selectContainer: (id: string | null) => void
  startContainer: (id: string, dockerContext?: string) => Promise<void>
  stopContainer: (id: string, dockerContext?: string) => Promise<void>
  restartContainer: (id: string, dockerContext?: string) => Promise<void>
  pauseContainer: (id: string, dockerContext?: string) => Promise<void>
  unpauseContainer: (id: string, dockerContext?: string) => Promise<void>
  removeContainer: (id: string, dockerContext?: string) => Promise<void>
  execInContainer: (id: string, command: string) => Promise<string>
  getContainerLogs: (id: string, options?: DockerLogOptions, dockerContext?: string) => Promise<string>
  pullImage: (name: string) => Promise<void>
  removeImage: (id: string, dockerContext?: string) => Promise<void>
  pruneImages: () => Promise<void>
  createVolume: (name: string) => Promise<void>
  removeVolume: (name: string, dockerContext?: string) => Promise<void>
  pruneVolumes: () => Promise<void>
  createNetwork: (name: string) => Promise<void>
  removeNetwork: (id: string, dockerContext?: string) => Promise<void>
  composeUp: (projectPath: string) => Promise<void>
  composeDown: (projectPath: string) => Promise<void>
  composeRestart: (projectPath: string) => Promise<void>
  systemPrune: (includeVolumes: boolean) => Promise<void>
}

export const DockerContext = createContext<DockerContextValue>({
  isAvailable: false,
  contexts: [],
  activeContext: '',
  containers: [],
  stats: {},
  images: [],
  volumes: [],
  networks: [],
  composeProjects: [],
  dashboardStats: null,
  loading: false,
  selectedContainerId: null,
  checkAvailability: async () => {},
  loadContexts: async () => {},
  switchContext: async () => {},
  refreshContainers: async () => {},
  refreshImages: async () => {},
  refreshVolumes: async () => {},
  refreshNetworks: async () => {},
  refreshComposeProjects: async () => {},
  refreshDashboard: async () => {},
  selectContainer: () => {},
  startContainer: async () => {},
  stopContainer: async () => {},
  restartContainer: async () => {},
  pauseContainer: async () => {},
  unpauseContainer: async () => {},
  removeContainer: async () => {},
  execInContainer: async () => '',
  getContainerLogs: async () => '',
  pullImage: async () => {},
  removeImage: async () => {},
  pruneImages: async () => {},
  createVolume: async () => {},
  removeVolume: async () => {},
  pruneVolumes: async () => {},
  createNetwork: async () => {},
  removeNetwork: async () => {},
  composeUp: async () => {},
  composeDown: async () => {},
  composeRestart: async () => {},
  systemPrune: async () => {},
})

export function useDocker() {
  return useContext(DockerContext)
}

export const DockerProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isAvailable, setIsAvailable] = useState(false)
  const [contexts, setContexts] = useState<DockerContext[]>([])
  const [activeContext, setActiveContext] = useState('__all__')
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [stats, setStats] = useState<Record<string, DockerContainerStats>>({})
  const [images, setImages] = useState<DockerImage[]>([])
  const [volumes, setVolumes] = useState<DockerVolume[]>([])
  const [networks, setNetworks] = useState<DockerNetwork[]>([])
  const [composeProjects, setComposeProjects] = useState<DockerComposeProject[]>([])
  const [dashboardStats, setDashboardStats] = useState<DockerDashboardStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null)
  const { updateView } = useViews()

  const checkAvailability = useCallback(async () => {
    try {
      const available = await window.electron.dockerIsAvailable()
      setIsAvailable(available)
    } catch {
      setIsAvailable(false)
    }
  }, [])

  const loadContexts = useCallback(async () => {
    try {
      const result = await window.electron.dockerGetContexts()
      setContexts(result)
    } catch {
      setContexts([])
    }
  }, [])

  const refreshContainers = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electron.dockerGetContainers()
      setContainers(result)
    } catch {
      setContainers([])
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshImages = useCallback(async () => {
    try {
      const result = await window.electron.dockerGetImages()
      setImages(result)
    } catch {
      setImages([])
    }
  }, [])

  const refreshVolumes = useCallback(async () => {
    try {
      const result = await window.electron.dockerGetVolumes()
      setVolumes(result)
    } catch {
      setVolumes([])
    }
  }, [])

  const refreshNetworks = useCallback(async () => {
    try {
      const result = await window.electron.dockerGetNetworks()
      setNetworks(result)
    } catch {
      setNetworks([])
    }
  }, [])

  const refreshComposeProjects = useCallback(async () => {
    try {
      const result = await window.electron.dockerGetComposeProjects()
      setComposeProjects(result)
    } catch {
      setComposeProjects([])
    }
  }, [])

  const refreshDashboard = useCallback(async () => {
    try {
      const result = await window.electron.dockerGetDashboardStats()
      setDashboardStats(result)
    } catch {
      setDashboardStats(null)
    }
  }, [])

  const switchContext = useCallback(async (name: string) => {
    await window.electron.dockerSwitchContext(name)
    setActiveContext(name)
    await loadContexts()
    await refreshContainers()
    await refreshImages()
    await refreshVolumes()
    await refreshNetworks()
    await refreshComposeProjects()
    await refreshDashboard()
  }, [loadContexts, refreshContainers, refreshImages, refreshVolumes, refreshNetworks, refreshComposeProjects, refreshDashboard])

  const selectContainer = useCallback((id: string | null) => {
    setSelectedContainerId(id)
    updateView('docker', id)
  }, [updateView])

  const startContainer = useCallback(async (id: string, dockerContext?: string) => {
    await window.electron.dockerStartContainer(id, dockerContext)
    await refreshContainers()
  }, [refreshContainers])

  const stopContainer = useCallback(async (id: string, dockerContext?: string) => {
    await window.electron.dockerStopContainer(id, dockerContext)
    await refreshContainers()
  }, [refreshContainers])

  const restartContainer = useCallback(async (id: string, dockerContext?: string) => {
    await window.electron.dockerRestartContainer(id, dockerContext)
    await refreshContainers()
  }, [refreshContainers])

  const pauseContainer = useCallback(async (id: string, dockerContext?: string) => {
    await window.electron.dockerPauseContainer(id, dockerContext)
    await refreshContainers()
  }, [refreshContainers])

  const unpauseContainer = useCallback(async (id: string, dockerContext?: string) => {
    await window.electron.dockerUnpauseContainer(id, dockerContext)
    await refreshContainers()
  }, [refreshContainers])

  const removeContainer = useCallback(async (id: string, dockerContext?: string) => {
    await window.electron.dockerRemoveContainer(id, false, dockerContext)
    await refreshContainers()
  }, [refreshContainers])

  const execInContainer = useCallback(async (id: string, command: string) => {
    const commandArray = command.split(' ').filter(Boolean)
    return await window.electron.dockerExecInContainer(id, commandArray)
  }, [])

  const getContainerLogs = useCallback(async (id: string, options?: DockerLogOptions, dockerContext?: string) => {
    return await window.electron.dockerGetContainerLogs(id, options, dockerContext)
  }, [])

  const pullImage = useCallback(async (name: string) => {
    await window.electron.dockerPullImage(name)
    await refreshImages()
  }, [refreshImages])

  const removeImage = useCallback(async (id: string, dockerContext?: string) => {
    await window.electron.dockerRemoveImage(id, false, dockerContext)
    await refreshImages()
  }, [refreshImages])

  const pruneImages = useCallback(async () => {
    await window.electron.dockerPruneImages()
    await refreshImages()
  }, [refreshImages])

  const createVolume = useCallback(async (name: string) => {
    await window.electron.dockerCreateVolume(name)
    await refreshVolumes()
  }, [refreshVolumes])

  const removeVolume = useCallback(async (name: string, dockerContext?: string) => {
    await window.electron.dockerRemoveVolume(name, dockerContext)
    await refreshVolumes()
  }, [refreshVolumes])

  const pruneVolumes = useCallback(async () => {
    await window.electron.dockerPruneVolumes()
    await refreshVolumes()
  }, [refreshVolumes])

  const createNetwork = useCallback(async (name: string) => {
    await window.electron.dockerCreateNetwork(name)
    await refreshNetworks()
  }, [refreshNetworks])

  const removeNetwork = useCallback(async (id: string, dockerContext?: string) => {
    await window.electron.dockerRemoveNetwork(id, dockerContext)
    await refreshNetworks()
  }, [refreshNetworks])

  const composeUp = useCallback(async (projectPath: string) => {
    await window.electron.dockerComposeUp(projectPath)
    await refreshContainers()
    await refreshComposeProjects()
  }, [refreshContainers, refreshComposeProjects])

  const composeDown = useCallback(async (projectPath: string) => {
    await window.electron.dockerComposeDown(projectPath)
    await refreshContainers()
    await refreshComposeProjects()
  }, [refreshContainers, refreshComposeProjects])

  const composeRestart = useCallback(async (projectPath: string) => {
    await window.electron.dockerComposeRestart(projectPath)
    await refreshContainers()
    await refreshComposeProjects()
  }, [refreshContainers, refreshComposeProjects])

  const systemPrune = useCallback(async (includeVolumes: boolean) => {
    await window.electron.dockerSystemPrune(includeVolumes)
    await refreshContainers()
    await refreshImages()
    await refreshVolumes()
    await refreshNetworks()
    await refreshDashboard()
  }, [refreshContainers, refreshImages, refreshVolumes, refreshNetworks, refreshDashboard])

  // Subscribe to container updates
  useEffect(() => {
    return window.electron.subscribeDockerContainers((updatedContainers) => {
      setContainers(updatedContainers)
    })
  }, [])

  // Subscribe to container stats
  useEffect(() => {
    return window.electron.subscribeDockerStats((updatedStats) => {
      setStats(updatedStats)
    })
  }, [])

  // Check availability and load initial data on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        const available = await window.electron.dockerIsAvailable()
        setIsAvailable(available)
        if (available) {
          await loadContexts()
          await Promise.all([
            refreshContainers(),
            refreshImages(),
            refreshVolumes(),
            refreshNetworks(),
            refreshComposeProjects(),
            refreshDashboard(),
          ])
        }
      } catch {
        setIsAvailable(false)
      }
    }
    initialize()
  }, [loadContexts, refreshContainers, refreshImages, refreshVolumes, refreshNetworks, refreshComposeProjects, refreshDashboard])

  return (
    <DockerContext.Provider
      value={{
        isAvailable,
        contexts,
        activeContext,
        containers,
        stats,
        images,
        volumes,
        networks,
        composeProjects,
        dashboardStats,
        loading,
        selectedContainerId,
        checkAvailability,
        loadContexts,
        switchContext,
        refreshContainers,
        refreshImages,
        refreshVolumes,
        refreshNetworks,
        refreshComposeProjects,
        refreshDashboard,
        selectContainer,
        startContainer,
        stopContainer,
        restartContainer,
        pauseContainer,
        unpauseContainer,
        removeContainer,
        execInContainer,
        getContainerLogs,
        pullImage,
        removeImage,
        pruneImages,
        createVolume,
        removeVolume,
        pruneVolumes,
        createNetwork,
        removeNetwork,
        composeUp,
        composeDown,
        composeRestart,
        systemPrune,
      }}
    >
      {children}
    </DockerContext.Provider>
  )
}
