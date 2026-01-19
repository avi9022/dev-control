import { memo, type FC } from 'react'
import type { VirtualItem } from '@tanstack/react-virtual'
import type { HighlightToken } from './terminal.types'
import { LEVEL_PREFIXES, IN_LINE_TOKENS, ESTIMATED_LINE_HEIGHT } from './terminal.constants'
import { highlightTokensInLine } from './highlightLogLine'

interface TerminalLineProps {
  line: string
  lineNumber: number
  searchTerm: string
  isActiveSearchResult: boolean
  virtualItem: VirtualItem
  measureElement: (node: Element | null) => void
}

export const TerminalLine: FC<TerminalLineProps> = memo(({
  line,
  lineNumber,
  searchTerm,
  isActiveSearchResult,
  virtualItem,
  measureElement
}) => {
  const prefixMatch = line.match(/^([A-Za-z]+)([:\s]+)/)
  let prefixNode: React.ReactNode | null = null
  let remainder = line

  if (prefixMatch) {
    const rawPrefix = prefixMatch[1].toUpperCase()
    const spacer = prefixMatch[2]
    const prefixLen = rawPrefix.length + spacer.length

    if (LEVEL_PREFIXES[rawPrefix]) {
      prefixNode = (
        <span className={LEVEL_PREFIXES[rawPrefix]}>
          {`${rawPrefix}${spacer}`}
        </span>
      )
      remainder = line.slice(prefixLen)
    }
  }

  const combinedTokens: HighlightToken[] = [
    ...IN_LINE_TOKENS,
    ...(searchTerm
      ? [{
        regex: new RegExp(
          `(${searchTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`,
          "gi"
        ),
        className: "bg-yellow-600 text-black px-1",
      }]
      : []),
  ]

  const contentNodes = highlightTokensInLine(remainder, combinedTokens, isActiveSearchResult, searchTerm)

  return (
    <div
      data-index={virtualItem.index}
      data-log-line={lineNumber}
      ref={measureElement}
      className="text-gray-200"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        transform: `translateY(${virtualItem.start}px)`,
        minHeight: `${ESTIMATED_LINE_HEIGHT}px`,
        lineHeight: `${ESTIMATED_LINE_HEIGHT}px`,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'break-word'
      }}
    >
      {prefixNode}
      {contentNodes}
    </div>
  )
})

TerminalLine.displayName = 'TerminalLine'
