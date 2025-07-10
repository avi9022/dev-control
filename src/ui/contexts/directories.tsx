import { createContext, useContext, useEffect, useState, type FC, type PropsWithChildren } from 'react'

const DirectoriesContext = createContext<{
  directories: DirectorySettings[]
  removeDirectory: (id?: string) => void
  chooseDirectory: (id: string | null) => void
  runService: (id: string) => void
  stopService: (id: string) => void
  directoryToView: DirectorySettings | null
  addFromFolder: () => Promise<void>
  updateDirectory: (data: DataToUpdate) => void
  directoriesStateMap: DirectoryMapByState
}>({
  directories: [],
  removeDirectory: () => { },
  chooseDirectory: () => { },
  runService: () => { },
  stopService: () => { },
  directoryToView: null,
  addFromFolder: async () => { },
  updateDirectory: () => { },
  directoriesStateMap: {}
})

export function useDirectories() {
  return useContext(DirectoriesContext)
}

export const DirectoriesProvider: FC<PropsWithChildren> = ({ children }) => {
  const [directories, setDirectories] = useState<DirectorySettings[]>([])
  const [directoryToView, setDirectoryToView] = useState<DirectorySettings | null>(null)
  const [directoriesStateMap, setDirectoriesStateMap] = useState<DirectoryMapByState>({})

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
    setDirectoryToView(null)
  }
  const chooseDirectory = (id: string | null) => setDirectoryToView(id ? directories.find(({ id: currId }) => currId === id) || null : null)
  const addFromFolder = async () => {
    await window.electron.addDirectoriesFromFolder()
    getDirectories()
  }

  const updateDirectory = (data: DataToUpdate) => {
    if (!directoryToView?.id) return
    window.electron.updateDirectory(directoryToView.id, data)
  }

  const runService = (id: string) => window.electron.runService(id)
  const stopService = (id: string) => window.electron.stopService(id)

  useEffect(() => {
    getDirectories()
    subscribeToDirectories()
    subscribeToDirectoriesState()
  }, [])
  return <DirectoriesContext.Provider value={{
    directories,
    removeDirectory,
    chooseDirectory,
    directoryToView,
    addFromFolder,
    updateDirectory,
    runService,
    directoriesStateMap,
    stopService
  }}>
    {children}
  </DirectoriesContext.Provider>

}