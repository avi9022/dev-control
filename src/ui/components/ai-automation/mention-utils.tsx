import type { ReactNode } from 'react'
import { FolderOpen } from 'lucide-react'

/** Renders description text with @mentions as styled chips.
 *  Matches @label by checking known project labels after each @ character. */
export function renderMentions(text: string, projectLabels: Set<string>): ReactNode[] {
  if (projectLabels.size === 0) return [text]

  // Sort labels longest-first so we match the most specific label
  const sorted = [...projectLabels].sort((a, b) => b.length - a.length)
  const parts: ReactNode[] = []
  let remaining = text
  let keyIdx = 0

  while (remaining.length > 0) {
    const atIdx = remaining.indexOf('@')
    if (atIdx === -1) {
      parts.push(remaining)
      break
    }

    // Try to match a known label right after @
    const afterAt = remaining.slice(atIdx + 1)
    const matched = sorted.find(label => afterAt.startsWith(label))

    if (matched) {
      // Push text before the @
      if (atIdx > 0) {
        parts.push(remaining.slice(0, atIdx))
      }
      parts.push(
        <span
          key={keyIdx++}
          className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded bg-blue-900/40 border border-blue-700/50 text-xs text-blue-300 mx-0.5 align-baseline"
        >
          <FolderOpen className="h-3 w-3" />
          {matched}
        </span>
      )
      remaining = remaining.slice(atIdx + 1 + matched.length)
    } else {
      // No match — include the @ and continue
      parts.push(remaining.slice(0, atIdx + 1))
      remaining = remaining.slice(atIdx + 1)
    }
  }

  return parts.length > 0 ? parts : [text]
}
