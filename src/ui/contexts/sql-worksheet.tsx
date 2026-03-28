import { useState, useCallback, useRef } from 'react'

export interface SQLWorksheetState {
  executing: boolean
  lastResult: SQLQueryResult | null
  scriptResult: SQLScriptResult | null
  explainResult: SQLExplainPlan | null
  messages: SQLMessage[]
  dbmsOutput: string[]
}

export function createEmptyWorksheetState(): SQLWorksheetState {
  return {
    executing: false,
    lastResult: null,
    scriptResult: null,
    explainResult: null,
    messages: [],
    dbmsOutput: [],
  }
}

const defaultWorksheet: SQLWorksheet = {
  id: crypto.randomUUID(),
  name: 'Sheet 1',
  sql: '',
  connectionId: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

export { defaultWorksheet }

export function useWorksheetManager(activeConnectionId: string | null) {
  const [worksheets, setWorksheets] = useState<SQLWorksheet[]>([defaultWorksheet])
  const [activeWorksheetId, setActiveWorksheetId] = useState<string | null>(defaultWorksheet.id)
  const [worksheetStates, setWorksheetStates] = useState<Record<string, SQLWorksheetState>>({
    [defaultWorksheet.id]: createEmptyWorksheetState(),
  })

  // Ref to track activeWorksheetId in closures
  const activeWorksheetIdRef = useRef(activeWorksheetId)
  activeWorksheetIdRef.current = activeWorksheetId

  // Derive active worksheet state
  const activeWsState = activeWorksheetId
    ? worksheetStates[activeWorksheetId] ?? createEmptyWorksheetState()
    : createEmptyWorksheetState()

  // Per-worksheet state updater
  const updateWsState = useCallback(
    (wsId: string, updater: (prev: SQLWorksheetState) => SQLWorksheetState) => {
      setWorksheetStates((prev) => ({
        ...prev,
        [wsId]: updater(prev[wsId] ?? createEmptyWorksheetState()),
      }))
    }, [setWorksheetStates]
  )

  const addWorksheet = useCallback(() => {
    const count = worksheets.length + 1
    const ws: SQLWorksheet = {
      id: crypto.randomUUID(),
      name: `Sheet ${count}`,
      sql: '',
      connectionId: activeConnectionId ?? '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setWorksheets((prev) => [...prev, ws])
    setWorksheetStates((prev) => ({
      ...prev,
      [ws.id]: createEmptyWorksheetState(),
    }))
    setActiveWorksheetId(ws.id)
  }, [worksheets.length, activeConnectionId, setWorksheets, setWorksheetStates])

  const removeWorksheet = useCallback((id: string) => {
    setWorksheetStates((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id))
    )
    setWorksheets((prev) => {
      const filtered = prev.filter((w) => w.id !== id)
      if (filtered.length === 0) {
        const ws: SQLWorksheet = {
          id: crypto.randomUUID(),
          name: 'Sheet 1',
          sql: '',
          connectionId: activeConnectionId ?? '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        setWorksheetStates((prevStates) => ({
          ...prevStates,
          [ws.id]: createEmptyWorksheetState(),
        }))
        setActiveWorksheetId(ws.id)
        return [ws]
      }
      if (activeWorksheetIdRef.current === id) {
        setActiveWorksheetId(filtered[0].id)
      }
      return filtered
    })
  }, [activeConnectionId, activeWorksheetIdRef, setWorksheets, setWorksheetStates])

  const removeOtherWorksheets = useCallback((keepId: string) => {
    setWorksheetStates((prev) => {
      const next: typeof prev = {}
      next[keepId] = prev[keepId] ?? createEmptyWorksheetState()
      return next
    })
    setWorksheets((prev) => prev.filter((w) => w.id === keepId))
    setActiveWorksheetId(keepId)
  }, [setWorksheetStates, setWorksheets])

  const removeAllWorksheets = useCallback(() => {
    const ws: SQLWorksheet = {
      id: crypto.randomUUID(),
      name: 'Sheet 1',
      sql: '',
      connectionId: activeConnectionId ?? '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setWorksheetStates({ [ws.id]: createEmptyWorksheetState() })
    setWorksheets([ws])
    setActiveWorksheetId(ws.id)
  }, [activeConnectionId, setWorksheetStates, setWorksheets])

  const setActiveWorksheetFn = useCallback((id: string) => {
    setActiveWorksheetId(id)
  }, [])

  const updateWorksheetSql = useCallback((id: string, sql: string) => {
    setWorksheets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, sql, updatedAt: Date.now() } : w))
    )
  }, [setWorksheets])

  const renameWorksheet = useCallback((id: string, name: string) => {
    setWorksheets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, name, updatedAt: Date.now() } : w))
    )
  }, [setWorksheets])

  const isWorksheetExecuting = useCallback((id: string) => {
    return worksheetStates[id]?.executing ?? false
  }, [worksheetStates])

  return {
    worksheets,
    setWorksheets,
    activeWorksheetId,
    activeWorksheetIdRef,
    activeWsState,
    worksheetStates,
    updateWsState,
    addWorksheet,
    removeWorksheet,
    removeOtherWorksheets,
    removeAllWorksheets,
    setActiveWorksheet: setActiveWorksheetFn,
    updateWorksheetSql,
    renameWorksheet,
    isWorksheetExecuting,
  }
}
