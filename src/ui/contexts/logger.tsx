import { createContext, useContext, useEffect, useState, useCallback, type FC, type PropsWithChildren } from 'react'

const MAX_CACHE_SIZE = 1000

interface LogCacheEntry {
  logs: string[]
  startLine: number
  endLine: number
  totalLines: number
}

const loggerContext = createContext<{
  getLogsByDirId: (id: string, offset?: number, limit?: number) => Promise<string[]>
  getLogsTail: (id: string, limit: number) => Promise<string[]>
  getTotalLineCount: (id: string) => Promise<number>
  searchLogs: (id: string, searchTerm: string) => Promise<Array<{ lineNumber: number, line: string }>>
  loadLogsChunk: (id: string, offset: number, limit: number) => Promise<string[]>
  clearTerminal: (id?: string) => Promise<void>
}>({
  getLogsByDirId: async () => [],
  getLogsTail: async () => [],
  getTotalLineCount: async () => 0,
  searchLogs: async () => [],
  loadLogsChunk: async () => [],
  clearTerminal: async () => { }
})

export function useLogger() {
  return useContext(loggerContext)
}

/**
 * Truncates cache to maximum size, keeping the most recent logs (FIFO)
 */
function truncateCache(logs: string[], maxSize: number): string[] {
  if (logs.length <= maxSize) {
    return logs
  }
  // Keep the most recent logs (remove oldest from beginning)
  return logs.slice(-maxSize)
}

export const LoggerProvider: FC<PropsWithChildren> = ({ children }) => {
  // Cache with metadata for each directory
  const [logsCacheByDirId, setLogsCacheByDirId] = useState<Record<string, LogCacheEntry>>({})

  const subscribeToLogs = () => {
    window.electron.subscribeLogs((log) => {
      setLogsCacheByDirId((prev) => {
        const existing = prev[log.dirId]

        if (existing) {
          // Append new log and truncate if needed
          const newLogs = truncateCache([...existing.logs, log.line], MAX_CACHE_SIZE)
          return {
            ...prev,
            [log.dirId]: {
              logs: newLogs,
              startLine: existing.startLine,
              endLine: existing.endLine + 1,
              totalLines: existing.totalLines + 1
            }
          }
        } else {
          // New directory, initialize cache
          return {
            ...prev,
            [log.dirId]: {
              logs: [log.line],
              startLine: 0,
              endLine: 0,
              totalLines: 1
            }
          }
        }
      })
    })
  }

  const getLogsTail = useCallback(async (id: string, limit: number): Promise<string[]> => {
    try {
      const logs = await window.electron.getLogsTail(id, limit)
      const totalLines = await window.electron.getLogFileLineCount(id)

      // Update cache
      const startLine = Math.max(0, totalLines - logs.length)
      setLogsCacheByDirId((prev) => ({
        ...prev,
        [id]: {
          logs: truncateCache(logs, MAX_CACHE_SIZE),
          startLine,
          endLine: totalLines - 1,
          totalLines
        }
      }))

      return logs
    } catch (error) {
      console.error(`Failed to load logs tail for ${id}:`, error)
      return logsCacheByDirId[id]?.logs || []
    }
  }, [logsCacheByDirId])

  const getTotalLineCount = useCallback(async (id: string): Promise<number> => {
    try {
      const count = await window.electron.getLogFileLineCount(id)

      // Update cache metadata
      setLogsCacheByDirId((prev) => {
        const existing = prev[id]
        if (existing) {
          return {
            ...prev,
            [id]: {
              ...existing,
              totalLines: count
            }
          }
        }
        return prev
      })

      return count
    } catch (error) {
      console.error(`Failed to get line count for ${id}:`, error)
      return logsCacheByDirId[id]?.totalLines || 0
    }
  }, [logsCacheByDirId])

  const loadLogsChunk = useCallback(async (id: string, offset: number, limit: number): Promise<string[]> => {
    try {
      const logs = await window.electron.getLogsChunk(id, offset, limit)

      // Update cache
      const existing = logsCacheByDirId[id]
      if (existing) {
        // Merge with existing cache, truncate if needed
        const mergedLogs = [...existing.logs, ...logs]
        const truncated = truncateCache(mergedLogs, MAX_CACHE_SIZE)

        setLogsCacheByDirId((prev) => ({
          ...prev,
          [id]: {
            logs: truncated,
            startLine: Math.min(existing.startLine, offset),
            endLine: Math.max(existing.endLine, offset + logs.length - 1),
            totalLines: existing.totalLines
          }
        }))
      } else {
        // New cache entry
        const totalLines = await window.electron.getLogFileLineCount(id)
        setLogsCacheByDirId((prev) => ({
          ...prev,
          [id]: {
            logs: truncateCache(logs, MAX_CACHE_SIZE),
            startLine: offset,
            endLine: offset + logs.length - 1,
            totalLines
          }
        }))
      }

      return logs
    } catch (error) {
      console.error(`Failed to load logs chunk for ${id}:`, error)
      return []
    }
  }, [logsCacheByDirId])

  const getLogsByDirId = useCallback(async (id: string, offset?: number, limit?: number): Promise<string[]> => {
    // If no offset/limit specified, use default behavior (get tail)
    if (offset === undefined || limit === undefined) {
      return getLogsTail(id, 1000)
    }

    // Check if requested range is in cache
    const cached = logsCacheByDirId[id]
    if (cached && offset >= cached.startLine && offset + limit <= cached.endLine + 1) {
      const cacheStart = offset - cached.startLine
      const cacheEnd = cacheStart + limit
      return cached.logs.slice(cacheStart, cacheEnd)
    }

    // Load from file
    return loadLogsChunk(id, offset, limit)
  }, [logsCacheByDirId, getLogsTail, loadLogsChunk])

  const searchLogs = useCallback(async (id: string, searchTerm: string): Promise<Array<{ lineNumber: number, line: string }>> => {
    try {
      return await window.electron.searchLogs(id, searchTerm)
    } catch (error) {
      console.error(`Failed to search logs for ${id}:`, error)
      return []
    }
  }, [])

  const clearTerminal = useCallback(async (id?: string) => {
    if (!id) {
      // Clear all logs
      setLogsCacheByDirId({})
      return
    }

    try {
      const success = await window.electron.clearLogs(id)
      if (success) {
        // Clear cache for this directory
        setLogsCacheByDirId((prev) => {
          const newCache = { ...prev }
          delete newCache[id]
          return newCache
        })
      }
    } catch (error) {
      console.error(`Failed to clear logs for ${id}:`, error)
    }
  }, [])

  useEffect(() => {
    subscribeToLogs()
  }, [])

  return <loggerContext.Provider value={{
    getLogsByDirId,
    getLogsTail,
    getTotalLineCount,
    searchLogs,
    loadLogsChunk,
    clearTerminal
  }}>
    {children}
  </loggerContext.Provider>

}