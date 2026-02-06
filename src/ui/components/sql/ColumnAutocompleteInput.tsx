import { useState, useRef, useCallback, useEffect, useMemo, type FC } from 'react'
import { cn } from '@/lib/utils'

interface ColumnAutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  columns: string[]
  placeholder?: string
  className?: string
}

export const ColumnAutocompleteInput: FC<ColumnAutocompleteInputProps> = ({
  value,
  onChange,
  onSubmit,
  columns,
  placeholder,
  className,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [cursorWord, setCursorWord] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Extract the word being typed at cursor position
  const getWordAtCursor = useCallback((text: string, cursorPos: number) => {
    const before = text.slice(0, cursorPos)
    const match = before.match(/(\w+)$/)
    return match ? match[1] : ''
  }, [])

  const suggestions = useMemo(() =>
    cursorWord.length > 0
      ? columns.filter((c) => c.toLowerCase().includes(cursorWord.toLowerCase()))
      : [],
    [cursorWord, columns]
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    const word = getWordAtCursor(newValue, e.target.selectionStart ?? newValue.length)
    setCursorWord(word)
    setShowSuggestions(word.length > 0)
    setSelectedIdx(0)
  }, [onChange, getWordAtCursor])

  const applySuggestion = useCallback((suggestion: string) => {
    const input = inputRef.current
    if (!input) return
    const cursorPos = input.selectionStart ?? value.length
    const before = value.slice(0, cursorPos)
    const after = value.slice(cursorPos)
    const wordMatch = before.match(/(\w+)$/)
    const wordStart = wordMatch ? cursorPos - wordMatch[1].length : cursorPos
    const newValue = value.slice(0, wordStart) + suggestion + after
    onChange(newValue)
    setShowSuggestions(false)
    setCursorWord('')
    // Restore focus and cursor position
    requestAnimationFrame(() => {
      input.focus()
      const newPos = wordStart + suggestion.length
      input.setSelectionRange(newPos, newPos)
    })
  }, [value, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((prev) => Math.min(prev + 1, suggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && suggestions.length > 0)) {
        e.preventDefault()
        applySuggestion(suggestions[selectedIdx])
        return
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false)
        return
      }
    }
    if (e.key === 'Enter') {
      onSubmit()
    }
  }, [showSuggestions, suggestions, selectedIdx, applySuggestion, onSubmit])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.children[selectedIdx] as HTMLElement | undefined
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        className={cn(
          'flex w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          className
        )}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => setShowSuggestions(false), 150)
        }}
        onFocus={() => {
          if (cursorWord.length > 0) setShowSuggestions(true)
        }}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full left-0 z-50 mt-1 max-h-48 w-64 overflow-auto rounded-md border border-border bg-[#1e1f23] shadow-lg"
        >
          {suggestions.map((col, i) => (
            <button
              key={col}
              className={cn(
                'w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-accent',
                i === selectedIdx && 'bg-accent'
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                applySuggestion(col)
              }}
            >
              {col}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
