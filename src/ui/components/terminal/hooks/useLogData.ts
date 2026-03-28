import { useEffect, useRef, useState, useCallback } from 'react'
import { WINDOW_SIZE, CHUNK_SIZE } from '../terminal.constants'

export interface LogData {
  logs: string[]
  startLine: number
  totalLines: number
}

interface UseLogDataOptions {
  id: string
}

interface UseLogDataResult {
  data: LogData
  isLoading: boolean
  autoScroll: boolean
  setAutoScroll: (value: boolean) => void
  loadWindowAroundLine: (lineNumber: number) => Promise<void>
  scrollToBottom: () => Promise<void>
  clear: () => Promise<void>
  expandUp: () => Promise<void>
  expandDown: () => Promise<void>
}

export function useLogData({ id }: UseLogDataOptions): UseLogDataResult {
  const [data, setData] = useState<LogData>({ logs: [], startLine: 0, totalLines: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)

  // Refs for latest values to avoid stale closures
  const dataRef = useRef(data)
  const autoScrollRef = useRef(autoScroll)
  const isExpandingRef = useRef(false)

  // Batching for streaming logs
  const pendingLogsRef = useRef<string[]>([])
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Keep refs in sync
  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    autoScrollRef.current = autoScroll
  }, [autoScroll])

  // Flush pending logs to state
  const flushPendingLogs = useCallback(() => {
    const logsToFlush = pendingLogsRef.current
    if (logsToFlush.length === 0) return

    pendingLogsRef.current = []

    setData(prev => {
      const newTotalLines = prev.totalLines + logsToFlush.length

      // If auto-scrolling, append to window
      if (autoScrollRef.current) {
        const newLogs = [...prev.logs, ...logsToFlush]
        // Trim from start if exceeds window size
        const trimmedLogs = newLogs.length > WINDOW_SIZE
          ? newLogs.slice(-WINDOW_SIZE)
          : newLogs
        const newStartLine = newTotalLines - trimmedLogs.length

        return {
          logs: trimmedLogs,
          startLine: newStartLine,
          totalLines: newTotalLines
        }
      } else {
        // Not auto-scrolling, just update totalLines
        return { ...prev, totalLines: newTotalLines }
      }
    })
  }, [])

  // Schedule flush with batching
  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
    }

    const BATCH_SIZE = 10
    const BATCH_INTERVAL_MS = 50

    if (pendingLogsRef.current.length >= BATCH_SIZE) {
      flushPendingLogs()
    } else {
      flushTimeoutRef.current = setTimeout(flushPendingLogs, BATCH_INTERVAL_MS)
    }
  }, [flushPendingLogs])

  // Initial load - only depends on id
  useEffect(() => {
    if (!id) {
      setIsLoading(false)
      setData({ logs: [], startLine: 0, totalLines: 0 })
      return
    }

    let cancelled = false
    setIsLoading(true)

    // Use window.electron directly to avoid any issues with callback references
    const loadInitial = async () => {
      try {
        const [logs, total] = await Promise.all([
          window.electron.getLogsTail(id, WINDOW_SIZE),
          window.electron.getLogFileLineCount(id)
        ])

        if (cancelled) return

        const safeTotal = total ?? 0
        const safeLogs = logs ?? []

        if (safeTotal === 0 || safeLogs.length === 0) {
          setData({ logs: [], startLine: 0, totalLines: safeTotal })
        } else {
          const startLine = Math.max(0, safeTotal - safeLogs.length)
          setData({ logs: safeLogs, startLine, totalLines: safeTotal })
        }
      } catch (error) {
        console.error('Failed to load initial logs:', error)
        if (!cancelled) {
          setData({ logs: [], startLine: 0, totalLines: 0 })
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadInitial()

    return () => {
      cancelled = true
    }
  }, [id])

  // Subscribe to new logs
  useEffect(() => {
    const unsubscribe = globalThis.window.electron.subscribeLogs((log) => {
      if (log.dirId === id) {
        pendingLogsRef.current.push(log.line)
        scheduleFlush()
      }
    }) as (() => void) | undefined

    return () => {
      if (unsubscribe) unsubscribe()
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current)
      }
      // Flush remaining logs on cleanup
      flushPendingLogs()
    }
  }, [id, scheduleFlush, flushPendingLogs])

  // Load window around a specific line (for search)
  const loadWindowAroundLine = useCallback(async (lineNumber: number) => {
    try {
      const contextSize = CHUNK_SIZE
      const contextStart = Math.max(0, lineNumber - contextSize)
      const contextEnd = lineNumber + contextSize
      const lineCount = contextEnd - contextStart + 1

      const logs = await window.electron.getLogsChunk(id, contextStart, lineCount)

      if (logs && logs.length > 0) {
        setData(prev => ({
          logs,
          startLine: contextStart,
          totalLines: prev.totalLines
        }))
      }
    } catch (error) {
      console.error('Failed to load window around line:', error)
    }
  }, [id])

  // Scroll to bottom: reload tail
  const scrollToBottom = useCallback(async () => {
    setAutoScroll(true)
    autoScrollRef.current = true

    try {
      const [logs, total] = await Promise.all([
        window.electron.getLogsTail(id, WINDOW_SIZE),
        window.electron.getLogFileLineCount(id)
      ])

      if (logs && logs.length > 0) {
        const startLine = Math.max(0, total - logs.length)
        setData({ logs, startLine, totalLines: total })
      }
    } catch (error) {
      console.error('Failed to scroll to bottom:', error)
    }
  }, [id])

  // Clear terminal
  const clear = useCallback(async () => {
    await window.electron.clearLogs(id)
    try {
      const [logs, total] = await Promise.all([
        window.electron.getLogsTail(id, WINDOW_SIZE),
        window.electron.getLogFileLineCount(id)
      ])
      setData({
        logs: logs ?? [],
        startLine: Math.max(0, (total ?? 0) - (logs?.length ?? 0)),
        totalLines: total ?? 0
      })
    } catch (error) {
      console.error('Failed to reload after clear:', error)
    }
  }, [id])

  // Expand window upward
  const expandUp = useCallback(async () => {
    if (isExpandingRef.current) return

    const current = dataRef.current
    if (current.startLine === 0) return // Already at top

    isExpandingRef.current = true
    try {
      const loadStart = Math.max(0, current.startLine - CHUNK_SIZE)
      const loadCount = current.startLine - loadStart

      const newLogs = await window.electron.getLogsChunk(id, loadStart, loadCount)

      if (newLogs && newLogs.length > 0) {
        setData(prev => {
          const allLogs = [...newLogs, ...prev.logs]
          // Trim from end if exceeds window size (keep earlier logs when scrolling up)
          const trimmedLogs = allLogs.length > WINDOW_SIZE
            ? allLogs.slice(0, WINDOW_SIZE)
            : allLogs

          return {
            logs: trimmedLogs,
            startLine: loadStart,
            totalLines: prev.totalLines
          }
        })
      }
    } catch (error) {
      console.error('Failed to expand up:', error)
    } finally {
      isExpandingRef.current = false
    }
  }, [id])

  // Expand window downward
  const expandDown = useCallback(async () => {
    if (isExpandingRef.current) return

    const current = dataRef.current
    const endLine = current.startLine + current.logs.length - 1
    if (endLine >= current.totalLines - 1) return // Already at bottom

    isExpandingRef.current = true
    try {
      const loadStart = endLine + 1
      const loadEnd = Math.min(current.totalLines - 1, loadStart + CHUNK_SIZE - 1)
      const loadCount = loadEnd - loadStart + 1

      const newLogs = await window.electron.getLogsChunk(id, loadStart, loadCount)

      if (newLogs && newLogs.length > 0) {
        setData(prev => {
          const allLogs = [...prev.logs, ...newLogs]
          // Trim from start if exceeds window size (keep later logs when scrolling down)
          const trimmedLogs = allLogs.length > WINDOW_SIZE
            ? allLogs.slice(-WINDOW_SIZE)
            : allLogs
          const newStartLine = prev.startLine + (allLogs.length - trimmedLogs.length)

          return {
            logs: trimmedLogs,
            startLine: newStartLine,
            totalLines: prev.totalLines
          }
        })
      }
    } catch (error) {
      console.error('Failed to expand down:', error)
    } finally {
      isExpandingRef.current = false
    }
  }, [id])

  return {
    data,
    isLoading,
    autoScroll,
    setAutoScroll,
    loadWindowAroundLine,
    scrollToBottom,
    clear,
    expandUp,
    expandDown
  }
}
