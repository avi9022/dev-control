import type { FC, KeyboardEvent } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronLeft, ChevronRight, CircleX, Trash2 } from "lucide-react"
import { Tooltip, TooltipContent } from "@/components/ui/tooltip"
import { TooltipTrigger } from "@radix-ui/react-tooltip"

interface TerminalToolbarProps {
  searchInput: string
  searchTerm: string
  onSearchInputChange: (value: string) => void
  onSearchSubmit: () => void
  onSearchNext: () => void
  onSearchPrev: () => void
  onClearSearch: () => void
  onScrollToBottom: () => void
  onClearTerminal: () => void
  searchResultsCount: number
  currentMatchIndex: number
}

export const TerminalToolbar: FC<TerminalToolbarProps> = ({
  searchInput,
  searchTerm,
  onSearchInputChange,
  onSearchSubmit,
  onSearchNext,
  onSearchPrev,
  onClearSearch,
  onScrollToBottom,
  onClearTerminal,
  searchResultsCount,
  currentMatchIndex,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()

      // Only perform new search if search term changed
      if (searchInput.trim() !== searchTerm) {
        onSearchSubmit()
      } else if (searchResultsCount > 0) {
        // Same search term - navigate to next/prev result
        if (e.shiftKey) {
          onSearchPrev()
        } else {
          onSearchNext()
        }
      }
    }
  }

  return (
    <div className="flex items-center gap-5 px-4 py-2 bg-gray-900 rounded-t-lg border-b border-gray-700">
      <div className="flex items-center flex-1 gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="sm" onClick={onScrollToBottom}>
              <ChevronDown />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Scroll to bottom</p>
          </TooltipContent>
        </Tooltip>
        <Button variant="secondary" size="sm" onClick={onClearTerminal}>
          <Trash2 />
        </Button>
        <Input
          placeholder="Search logs..."
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onClearSearch}>
          <CircleX />
        </Button>
        <Button variant="secondary" size="sm" onClick={onSearchPrev}>
          <ChevronLeft />
        </Button>
        <Button variant="secondary" size="sm" onClick={onSearchNext}>
          <ChevronRight />
        </Button>
        {searchResultsCount > 0 && (
          <div>
            <span className="text-gray-400 text-sm">
              {`${currentMatchIndex + 1}/${searchResultsCount}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
