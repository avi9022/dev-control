import { useState, useRef, useCallback, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'

const SEARCH_DEBOUNCE_MS = 300


/**
 * Search bar UI component — manages its own input state for responsiveness.
 * Debounces before pushing to the parent hook so the heavy search doesn't block typing.
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
}> = ({ showSearch, setSearchQuery, totalMatches, currentMatchIndex, scrollToMatch, openSearch, closeSearch }) => {
  const [localValue, setLocalValue] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleChange = useCallback((value: string) => {
    setLocalValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearchQuery(value), SEARCH_DEBOUNCE_MS)
  }, [setSearchQuery])

  const handleClose = useCallback(() => {
    setLocalValue('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    closeSearch()
  }, [closeSearch])

  if (showSearch) {
    return (
      <div className="flex items-center gap-1">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
          <Input
            value={localValue}
            onChange={e => handleChange(e.target.value)}
            placeholder="Search..."
            className="h-7 text-xs pl-7 w-[200px]"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Escape') handleClose()
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
        {localValue && (
          <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: totalMatches > 0 ? 'var(--ai-text-secondary)' : 'var(--ai-text-tertiary)' }}>
            {totalMatches > 0 ? `${currentMatchIndex + 1}/${totalMatches}` : 'No matches'}
          </span>
        )}
        <button
          onClick={handleClose}
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
