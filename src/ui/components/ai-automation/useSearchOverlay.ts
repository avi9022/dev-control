import { useState, useEffect, useRef, useCallback } from 'react'

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
  const depsKey = JSON.stringify(deps)
  useEffect(() => {
    setCurrentMatchIndex(0)
  }, [searchQuery, depsKey])

  // Find matching ranges in chunks to avoid blocking the UI
  useEffect(() => {
    matchRangesRef.current = []
    setTotalMatches(0)
    if (!searchQuery || !contentRef.current) return

    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'gi')
    const container = contentRef.current

    // Collect all text nodes first, then process in chunks via requestIdleCallback
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

    const ranges: Range[] = []
    let nodeIndex = 0
    const CHUNK_SIZE = 200

    function processChunk() {
      const end = Math.min(nodeIndex + CHUNK_SIZE, textNodes.length)
      for (; nodeIndex < end; nodeIndex++) {
        const node = textNodes[nodeIndex]
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
      if (nodeIndex < textNodes.length) {
        requestAnimationFrame(processChunk)
      }
    }
    processChunk()
  }, [searchQuery, contentMounted, depsKey])

  // Render highlight overlays — only for visible matches
  const renderOverlays = useCallback(() => {
    if (!overlayRef.current || !contentRef.current) return
    const container = contentRef.current
    const overlay = overlayRef.current
    overlay.innerHTML = ''

    const ranges = matchRangesRef.current
    if (ranges.length === 0) return

    const containerRect = container.getBoundingClientRect()
    const viewTop = container.scrollTop
    const viewBottom = viewTop + containerRect.height
    const BUFFER = 200 // render matches slightly outside viewport for smooth scrolling

    for (let i = 0; i < ranges.length; i++) {
      const rects = ranges[i].getClientRects()
      for (const rect of rects) {
        const top = rect.top - containerRect.top + container.scrollTop
        // Skip matches outside visible area (with buffer)
        if (top < viewTop - BUFFER || top > viewBottom + BUFFER) continue

        const div = document.createElement('div')
        div.style.position = 'absolute'
        div.style.top = `${top}px`
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
