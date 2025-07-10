import { createContext, useContext, useEffect, useState, type FC, type PropsWithChildren } from 'react'

const loggerContext = createContext<{
  getLogsByDirId: (id: string) => string[]
  clearTerminal: (id?: string) => void
}>({
  getLogsByDirId: () => [],
  clearTerminal: () => { }
})

export function useLogger() {
  return useContext(loggerContext)
}

export const LoggerProvider: FC<PropsWithChildren> = ({ children }) => {
  const [logsMapByDirId, setLogsMapByDirId] = useState<Record<string, string[]>>({})

  const subscribeToLogs = () => {
    window.electron.subscribeLogs((log) => {
      setLogsMapByDirId((prev) => {
        if (prev[log.dirId]) {
          prev[log.dirId] = [...prev[log.dirId], log.line]
        } else {
          prev[log.dirId] = [log.line]
        }
        return prev
      })
    })
  }

  const getLogsByDirId = (id: string) => {
    return logsMapByDirId[id] || []
  }

  const clearTerminal = (id?: string) => {
    setLogsMapByDirId((prev) => {

      if (!id) {
        return {}
      }

      prev[id] = []
      return prev
    })
  }

  useEffect(() => {
    subscribeToLogs()
  }, [])

  return <loggerContext.Provider value={{
    getLogsByDirId,
    clearTerminal
  }}>
    {children}
  </loggerContext.Provider>

}