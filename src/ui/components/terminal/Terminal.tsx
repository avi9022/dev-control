import { useRef, useCallback, useEffect, type FC } from 'react'
import type { TerminalProps } from './terminal.types'
import { TerminalToolbar } from './TerminalToolbar'
import { TerminalVirtualList } from './TerminalVirtualList'
import { useLogData } from './hooks/useLogData'
import { useSearch } from './hooks/useSearch'

export const Terminal: FC<TerminalProps> = ({ id }) => {
  const scrollToLineRef = useRef<((lineNumber: number) => void) | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Cmd+F / Ctrl+F to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const {
    data,
    isLoading,
    autoScroll,
    setAutoScroll,
    loadWindowAroundLine,
    scrollToBottom,
    clear,
    expandUp,
    expandDown
  } = useLogData({ id })

  // Jump to line: load window around the line, then scroll to it
  const jumpToLine = useCallback(async (lineNumber: number) => {
    await loadWindowAroundLine(lineNumber)
    // Wait for render, then scroll
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToLineRef.current?.(lineNumber)
      })
    })
  }, [loadWindowAroundLine])

  const {
    searchInput,
    searchTerm,
    searchResults,
    currentMatchIndex,
    setSearchInput,
    search,
    next,
    prev,
    clear: clearSearch,
    currentLineNumber
  } = useSearch({
    id,
    onJumpToLine: jumpToLine,
    setAutoScroll
  })

  const handleScrollToBottom = useCallback(async () => {
    await scrollToBottom()
    // Wait for render, then scroll to end
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (data.logs.length > 0) {
          scrollToLineRef.current?.(data.startLine + data.logs.length - 1)
        }
      })
    })
  }, [scrollToBottom, data.logs.length, data.startLine])

  return (
    <div className="h-full flex flex-col">
      <TerminalToolbar
        searchInput={searchInput}
        searchTerm={searchTerm}
        onSearchInputChange={setSearchInput}
        onSearchSubmit={search}
        onSearchNext={next}
        onSearchPrev={prev}
        onClearSearch={clearSearch}
        onScrollToBottom={handleScrollToBottom}
        onClearTerminal={clear}
        searchResultsCount={searchResults.length}
        currentMatchIndex={currentMatchIndex}
        searchInputRef={searchInputRef}
      />
      <TerminalVirtualList
        data={data}
        isLoading={isLoading}
        searchTerm={searchTerm}
        activeSearchLineNumber={currentLineNumber}
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
        onExpandUp={expandUp}
        onExpandDown={expandDown}
        scrollToLineRef={scrollToLineRef}
      />
    </div>
  )
}
