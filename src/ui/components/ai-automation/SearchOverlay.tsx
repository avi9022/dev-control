import { useState, useEffect, useRef, useCallback, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'

/**
 * Hook that manages search highlighting with overlay divs.
 * Returns state + refs to wire into a scrollable container.
 */
export function useSearchOverlay(deps: unknown[] = []) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
  const [totalMatches, setTotalMatches] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const matchRangesRef = useRef<Range[]>([])
  const [contentMounted, setContentMounted] = useState(0)

  const setContentRefCallback = useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el
    if (el) setContentMounted(prev => prev + 1)
  }, [])

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, ...deps])

  // Find matching ranges
  useEffect(() => {
    matchRangesRef.current = []
    setTotalMatches(0)
    if (!searchQuery || !contentRef.current) return

    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'gi')
    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT)
    const ranges: Range[] = []

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const text = node.textContent || ''
      let m: RegExpExecArray | null
      regex.lastIndex = 0
      while ((m = regex.exec(text)) !== null) {
        const range = new Range()
        range.setStart(node, m.index)
        range.setEnd(node, m.index + m[0].length)
        ranges.push(range)
      }
    }

    matchRangesRef.current = ranges
    setTotalMatches(ranges.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, contentMounted, ...deps])

  // Render highlight overlays
  const renderOverlays = useCallback(() => {
    if (!overlayRef.current || !contentRef.current) return
    const container = contentRef.current
    const overlay = overlayRef.current
    overlay.innerHTML = ''

    const ranges = matchRangesRef.current
    if (ranges.length === 0) return

    const containerRect = container.getBoundingClientRect()

    for (let i = 0; i < ranges.length; i++) {
      const rects = ranges[i].getClientRects()
      for (const rect of rects) {
        const div = document.createElement('div')
        div.style.position = 'absolute'
        div.style.top = `${rect.top - containerRect.top + container.scrollTop}px`
        div.style.left = `${rect.left - containerRect.left + container.scrollLeft}px`
        div.style.width = `${rect.width}px`
        div.style.height = `${rect.height}px`
        div.style.backgroundColor = i === currentMatchIndex ? 'var(--ai-accent)' : 'var(--ai-warning)'
        div.style.opacity = '0.35'
        div.style.borderRadius = '2px'
        div.style.pointerEvents = 'none'
        overlay.appendChild(div)
      }
    }
  }, [currentMatchIndex])

  useEffect(() => { renderOverlays() }, [totalMatches, currentMatchIndex, renderOverlays])

  useEffect(() => {
    const container = contentRef.current
    if (!container || totalMatches === 0) return
    const onScroll = () => renderOverlays()
    container.addEventListener('scroll', onScroll)
    return () => container.removeEventListener('scroll', onScroll)
  }, [totalMatches, renderOverlays])

  const scrollToMatch = useCallback((index: number) => {
    const ranges = matchRangesRef.current
    if (ranges.length === 0) return
    const wrappedIndex = ((index % ranges.length) + ranges.length) % ranges.length
    setCurrentMatchIndex(wrappedIndex)
    const range = ranges[wrappedIndex]
    const container = contentRef.current
    if (container) {
      const rect = range.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const scrollTop = container.scrollTop + (rect.top - containerRect.top) - containerRect.height / 2
      container.scrollTo({ top: scrollTop, behavior: 'smooth' })
    }
  }, [])

  const openSearch = useCallback(() => setShowSearch(true), [])
  const closeSearch = useCallback(() => { setShowSearch(false); setSearchQuery('') }, [])

  return {
    searchQuery, setSearchQuery,
    showSearch, openSearch, closeSearch,
    currentMatchIndex, totalMatches,
    scrollToMatch,
    setContentRef: setContentRefCallback,
    overlayRef,
  }
}

/**
 * Search bar UI component — renders the input + match count + close button.
 */
export const SearchBar: FC<{
  showSearch: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  totalMatches: number
  currentMatchIndex: number
  scrollToMatch: (index: number) => void
  openSearch: () => void
  closeSearch: () => void
}> = ({ showSearch, searchQuery, setSearchQuery, totalMatches, currentMatchIndex, scrollToMatch, openSearch, closeSearch }) => {
  if (showSearch) {
    return (
      <div className="flex items-center gap-1">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="h-7 text-xs pl-7 w-[200px]"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Escape') closeSearch()
              if (e.key === 'Enter' && totalMatches > 0) {
                e.preventDefault()
                const next = e.shiftKey
                  ? (currentMatchIndex - 1 + totalMatches) % totalMatches
                  : (currentMatchIndex + 1) % totalMatches
                setTimeout(() => scrollToMatch(next), 50)
              }
            }}
          />
        </div>
        {searchQuery && (
          <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: totalMatches > 0 ? 'var(--ai-text-secondary)' : 'var(--ai-text-tertiary)' }}>
            {totalMatches > 0 ? `${currentMatchIndex + 1}/${totalMatches}` : 'No matches'}
          </span>
        )}
        <button
          onClick={closeSearch}
          className="p-1 rounded"
          style={{ color: 'var(--ai-text-tertiary)' }}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={openSearch}>
      <Search className="h-3 w-3 mr-1" />
      Search
    </Button>
  )
}

/**
 * Overlay div — place inside a `position: relative` scrollable container.
 */
export const SearchOverlayLayer: FC<{
  overlayRef: React.RefObject<HTMLDivElement | null>
  active: boolean
}> = ({ overlayRef, active }) => {
  if (!active) return null
  return <div ref={overlayRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />
}
