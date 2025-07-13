import { createContext, useContext, useEffect, useState, type FC, type PropsWithChildren } from 'react'
import { useViews } from './views'

const DirectoriesContext = createContext<{
  directories: DirectorySettings[]
  removeDirectory: (id?: string) => void
  chooseDirectory: (id: string | null) => void
  runService: (id: string) => void
  stopService: (id: string) => void
  stopAllServices: () => void
  addFromFolder: () => Promise<void>
  updateDirectory: (id: string, data: DataToUpdate) => void
  directoriesStateMap: DirectoryMapByState
}>({
  directories: [],
  removeDirectory: () => { },
  chooseDirectory: () => { },
  runService: () => { },
  stopService: () => { },
  addFromFolder: async () => { },
  updateDirectory: () => { },
  stopAllServices: () => { },
  directoriesStateMap: {}
})

export function useDirectories() {
  return useContext(DirectoriesContext)
}

export const DirectoriesProvider: FC<PropsWithChildren> = ({ children }) => {
  const [directories, setDirectories] = useState<DirectorySettings[]>([])
  const [directoriesStateMap, setDirectoriesStateMap] = useState<DirectoryMapByState>({})
  const { updateView } = useViews()

  const getDirectories = async () => {
    const currDirectories = await window.electron.getDirectories()
    setDirectories(currDirectories.sort(({ runCommand }) => runCommand ? -1 : 1))
  }

  const subscribeToDirectories = () => {
    window.electron.subscribeDirectories((updatedDirectories = []) => {
      setDirectories(updatedDirectories?.sort(({ runCommand }) => runCommand ? -1 : 1))
    })
  }

  const subscribeToDirectoriesState = () => {
    window.electron.subscribeDirectoriesState((states = {}) => {
      setDirectoriesStateMap(states)
    })
  }

  const removeDirectory = (id?: string) => {
    window.electron.removeDirectory(id)
  }
  const chooseDirectory = (id: string | null) => {
    updateView('directory', id)
  }
  const addFromFolder = async () => {
    await window.electron.addDirectoriesFromFolder()
    getDirectories()
  }

  const updateDirectory = (id: string, data: DataToUpdate) => {
    window.electron.updateDirectory(id, data)
  }

  const runService = (id: string) => window.electron.runService(id)
  const stopService = (id: string) => window.electron.stopService(id)
  const stopAllServices = () => Object.entries(directoriesStateMap).forEach(([id, state]) => {
    if (state === 'RUNNING' || state === 'INITIALIZING') {
      stopService(id)
    }
  })

  useEffect(() => {
    getDirectories()
    subscribeToDirectories()
    subscribeToDirectoriesState()
  }, [])
  return <DirectoriesContext.Provider value={{
    directories,
    removeDirectory,
    chooseDirectory,
    addFromFolder,
    updateDirectory,
    runService,
    directoriesStateMap,
    stopService,
    stopAllServices
  }}>
    {children}
  </DirectoriesContext.Provider>

}