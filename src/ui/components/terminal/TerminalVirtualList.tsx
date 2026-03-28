import { useRef, useEffect, useCallback, type FC } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TerminalLine } from './TerminalLine'
import { ESTIMATED_LINE_HEIGHT, PRELOAD_THRESHOLD } from './terminal.constants'
import type { LogData } from './hooks/useLogData'

interface TerminalVirtualListProps {
  data: LogData
  isLoading: boolean
  searchTerm: string
  activeSearchLineNumber: number | null
  autoScroll: boolean
  onAutoScrollChange: (value: boolean) => void
  onExpandUp: () => void
  onExpandDown: () => void
  scrollToLineRef: React.MutableRefObject<((lineNumber: number) => void) | null>
}

export const TerminalVirtualList: FC<TerminalVirtualListProps> = ({
  data,
  isLoading,
  searchTerm,
  activeSearchLineNumber,
  autoScroll,
  onAutoScrollChange,
  onExpandUp,
  onExpandDown,
  scrollToLineRef
}) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

  const { logs, startLine, totalLines } = data

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_LINE_HEIGHT,
    overscan: 20,
    getItemKey: (index) => startLine + index
  })

  // Scroll to a specific line number
  const scrollToLine = useCallback((lineNumber: number) => {
    // Convert absolute line number to index within current window
    const index = lineNumber - startLine
    if (index >= 0 && index < logs.length) {
      isScrollingRef.current = true
      virtualizer.scrollToIndex(index, { align: 'center' })
      // Reset scrolling flag after scroll completes
      setTimeout(() => {
        isScrollingRef.current = false
      }, 100)
    }
  }, [startLine, logs.length, virtualizer])

  // Expose scrollToLine via ref
  useEffect(() => {
    scrollToLineRef.current = scrollToLine
  }, [scrollToLine, scrollToLineRef])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logs.length > 0 && !isScrollingRef.current) {
      virtualizer.scrollToIndex(logs.length - 1, { align: 'end' })
    }
  }, [autoScroll, logs.length, virtualizer])

  // Handle scroll events for auto-scroll detection and preloading
  useEffect(() => {
    const el = parentRef.current
    if (!el) return

    let rafId: number | null = null

    const handleScroll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }

      rafId = requestAnimationFrame(() => {
        if (!el || isScrollingRef.current) return

        const scrollTop = el.scrollTop
        const scrollHeight = el.scrollHeight
        const clientHeight = el.clientHeight

        // Check if at bottom (within 50px)
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
        if (isAtBottom !== autoScroll) {
          onAutoScrollChange(isAtBottom)
        }

        // Check if we need to preload more logs
        const endLine = startLine + logs.length - 1
        const preloadZone = Math.floor(logs.length * PRELOAD_THRESHOLD)

        // Estimate visible range based on scroll position
        const visibleStart = Math.floor(scrollTop / ESTIMATED_LINE_HEIGHT)
        const visibleEnd = Math.ceil((scrollTop + clientHeight) / ESTIMATED_LINE_HEIGHT)

        // Check if we're near the top of our window and there's more above
        if (visibleStart < preloadZone && startLine > 0) {
          onExpandUp()
        }

        // Check if we're near the bottom of our window and there's more below
        if (visibleEnd > logs.length - preloadZone && endLine < totalLines - 1) {
          onExpandDown()
        }
      })
    }

    el.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      el.removeEventListener('scroll', handleScroll)
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [startLine, logs.length, totalLines, autoScroll, onAutoScrollChange, onExpandUp, onExpandDown])

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto px-4 py-3 bg-gray-950 font-mono text-sm rounded-b-lg"
    >
      {isLoading && (
        <div className="text-gray-400 text-center py-4">Loading logs...</div>
      )}
      {!isLoading && totalLines === 0 && (
        <div className="text-gray-400 text-center py-4">No logs yet</div>
      )}
      {!isLoading && totalLines > 0 && logs.length > 0 && (
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualItems.map((virtualItem) => {
            const lineNumber = startLine + virtualItem.index
            const line = logs[virtualItem.index]

            return (
              <TerminalLine
                key={virtualItem.key}
                line={line}
                lineNumber={lineNumber}
                searchTerm={searchTerm}
                isActiveSearchResult={activeSearchLineNumber === lineNumber}
                virtualItem={virtualItem}
                measureElement={virtualizer.measureElement}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
