import { useState, useCallback, useEffect } from 'react'
import { useLogger } from '../../../contexts/logger'

export interface SearchResult {
  lineNumber: number
  line: string
}

interface UseSearchOptions {
  id: string
  onJumpToLine: (lineNumber: number) => Promise<void>
  setAutoScroll: (value: boolean) => void
}

interface UseSearchResult {
  searchInput: string
  searchTerm: string
  searchResults: SearchResult[]
  currentMatchIndex: number
  setSearchInput: (value: string) => void
  search: () => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
  clear: () => void
  currentLineNumber: number | null
}

export function useSearch({ id, onJumpToLine, setAutoScroll }: UseSearchOptions): UseSearchResult {
  const { searchLogs } = useLogger()

  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)

  // Reset search when id changes
  useEffect(() => {
    setSearchInput('')
    setSearchTerm('')
    setSearchResults([])
    setCurrentMatchIndex(0)
  }, [id])

  const jumpToResult = useCallback(async (index: number) => {
    if (searchResults.length === 0 || index < 0 || index >= searchResults.length) {
      return
    }
    const result = searchResults[index]
    await onJumpToLine(result.lineNumber)
  }, [searchResults, onJumpToLine])

  const search = useCallback(async () => {
    if (!searchInput.trim()) {
      setSearchTerm('')
      setSearchResults([])
      setCurrentMatchIndex(0)
      return
    }

    setAutoScroll(false)
    setSearchTerm(searchInput)

    try {
      const results = await searchLogs(id, searchInput)
      setSearchResults(results)
      setCurrentMatchIndex(0)

      if (results.length > 0) {
        await onJumpToLine(results[0].lineNumber)
      }
    } catch (error) {
      console.error('Failed to search logs:', error)
    }
  }, [id, searchInput, searchLogs, onJumpToLine, setAutoScroll])

  const next = useCallback(async () => {
    if (searchResults.length === 0) return
    setAutoScroll(false)
    const nextIndex = (currentMatchIndex + 1) % searchResults.length
    setCurrentMatchIndex(nextIndex)
    await jumpToResult(nextIndex)
  }, [searchResults.length, currentMatchIndex, jumpToResult, setAutoScroll])

  const prev = useCallback(async () => {
    if (searchResults.length === 0) return
    setAutoScroll(false)
    const prevIndex = (currentMatchIndex - 1 + searchResults.length) % searchResults.length
    setCurrentMatchIndex(prevIndex)
    await jumpToResult(prevIndex)
  }, [searchResults.length, currentMatchIndex, jumpToResult, setAutoScroll])

  const clear = useCallback(() => {
    setSearchTerm('')
    setSearchInput('')
    setSearchResults([])
    setCurrentMatchIndex(0)
  }, [])

  const currentLineNumber = searchResults.length > 0
    ? searchResults[currentMatchIndex]?.lineNumber ?? null
    : null

  return {
    searchInput,
    searchTerm,
    searchResults,
    currentMatchIndex,
    setSearchInput,
    search,
    next,
    prev,
    clear,
    currentLineNumber
  }
}
