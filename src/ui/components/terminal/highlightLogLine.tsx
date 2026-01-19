import type { HighlightToken } from './terminal.types'

export function highlightTokensInLine(
  text: string,
  tokens: HighlightToken[],
  isActiveLine: boolean,
  activeSearchTerm: string
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const searchRegex = activeSearchTerm
    ? new RegExp(`(${activeSearchTerm.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "gi")
    : null

  const combined = new RegExp(
    tokens.map((t) => t.regex.source).join("|") +
    (searchRegex ? "|" + searchRegex.source : ""),
    "gi"
  )

  while ((match = combined.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index)
    if (before) parts.push(<span key={lastIndex}>{before}</span>)

    const matchedText = match[0]
    const tokenDef = tokens.find((t) => t.regex.test(matchedText))

    if (searchRegex?.test(matchedText)) {
      parts.push(
        <span
          key={match.index}
          className={
            isActiveLine
              ? "bg-yellow-700 text-white px-1"
              : "bg-yellow-600 text-black px-1"
          }
        >
          {matchedText}
        </span>
      )
    } else if (tokenDef) {
      parts.push(
        <span key={match.index} className={tokenDef.className}>
          {matchedText}
        </span>
      )
    } else {
      parts.push(<span key={match.index}>{matchedText}</span>)
    }

    lastIndex = combined.lastIndex
  }

  const tail = text.slice(lastIndex)
  if (tail) parts.push(<span key={lastIndex}>{tail}</span>)

  return parts
}
