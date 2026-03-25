import { useState, useEffect, type FC, type RefObject } from 'react'
import { ChevronRight, ChevronDown, ChevronsUpDown, Circle, FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MarkdownViewer } from './MarkdownViewer'
import { SUMMARY_TRUNCATE_LENGTH, DEBUG_JSON_MAX_HEIGHT, DEBUG_EVENT_COLORS } from '@/ui/components/ai-automation/planner-constants'

interface DebugEventRowProps {
  event: PlannerDebugEvent
  defaultExpanded: boolean
  onViewSystemPrompt?: (content: string) => void
}

const DebugEventRow: FC<DebugEventRowProps> = ({ event, defaultExpanded, onViewSystemPrompt }) => {
  const [expanded, setExpanded] = useState(defaultExpanded)

  useEffect(() => {
    setExpanded(defaultExpanded)
  }, [defaultExpanded])

  if (event.type === 'system_prompt' && 'content' in event) {
    return (
      <div className="text-[10px] font-mono" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
        <div
          className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors duration-150 hover:bg-[var(--ai-surface-2)]"
          onClick={() => onViewSystemPrompt?.(event.content)}
        >
          <FileText className="h-2.5 w-2.5 flex-shrink-0" style={{ color: DEBUG_EVENT_COLORS.system_prompt }} />
          <Circle className="h-2 w-2 flex-shrink-0" style={{ color: DEBUG_EVENT_COLORS.system_prompt, fill: DEBUG_EVENT_COLORS.system_prompt }} />
          <span className="font-medium" style={{ color: 'var(--ai-text-secondary)' }}>system_prompt</span>
          <span className="truncate" style={{ color: 'var(--ai-text-tertiary)' }}>Click to view</span>
        </div>
      </div>
    )
  }

  const getLabel = (): { label: string; color: string; summary: string } => {
    switch (event.type) {
      case 'system':
        return { label: 'system', color: DEBUG_EVENT_COLORS.system, summary: 'subtype' in event ? String(event.subtype || '') : '' }
      case 'assistant': {
        const msg = 'message' in event ? event.message : undefined
        const content = msg?.content
        const textBlock = content?.find(b => b.type === 'text')
        const toolBlock = content?.find(b => b.type === 'tool_use')
        if (toolBlock) return { label: 'tool_call', color: DEBUG_EVENT_COLORS.tool_call, summary: String(toolBlock.name || '') }
        return { label: 'response', color: DEBUG_EVENT_COLORS.response, summary: textBlock?.text?.slice(0, SUMMARY_TRUNCATE_LENGTH) || '' }
      }
      case 'user':
        return { label: 'user', color: DEBUG_EVENT_COLORS.user, summary: '' }
      case 'result':
        return { label: 'result', color: DEBUG_EVENT_COLORS.result, summary: '' }
      case 'rate_limit_event':
        return { label: 'rate_limit', color: DEBUG_EVENT_COLORS.rate_limit, summary: '' }
      default:
        return { label: event.type, color: DEBUG_EVENT_COLORS.system, summary: '' }
    }
  }

  const { label, color, summary } = getLabel()

  return (
    <div className="text-[10px] font-mono" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors duration-150 hover:bg-[var(--ai-surface-2)]"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown className="h-2.5 w-2.5 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
          : <ChevronRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
        }
        <Circle className="h-2 w-2 flex-shrink-0" style={{ color, fill: color }} />
        <span className="font-medium" style={{ color: 'var(--ai-text-secondary)' }}>{label}</span>
        {summary && (
          <span className="truncate" style={{ color: 'var(--ai-text-tertiary)' }}>{summary}</span>
        )}
      </div>
      {expanded && (
        <pre
          className="px-4 py-2.5 text-[9px] overflow-x-auto whitespace-pre-wrap break-all"
          style={{ color: 'var(--ai-text-secondary)', background: 'var(--ai-surface-2)', maxHeight: DEBUG_JSON_MAX_HEIGHT, overflowY: 'auto' }}
        >
          {JSON.stringify(event, null, 2)}
        </pre>
      )}
    </div>
  )
}

interface PlannerDebugPanelProps {
  debugEvents: PlannerDebugEvent[]
  allExpanded: boolean
  onToggleExpanded: () => void
  preserveEvents: boolean
  onPreserveChange: (preserve: boolean) => void
  debugEndRef: RefObject<HTMLDivElement | null>
}

export const PlannerDebugPanel: FC<PlannerDebugPanelProps> = ({
  debugEvents,
  allExpanded,
  onToggleExpanded,
  preserveEvents,
  onPreserveChange,
  debugEndRef,
}) => {
  const [systemPromptContent, setSystemPromptContent] = useState<string | null>(null)

  return (
    <>
      <div className="px-3 py-2.5 flex-shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
        <span className="text-[11px] font-mono" style={{ color: 'var(--ai-text-tertiary)' }}>
          Events ({debugEvents.length})
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={preserveEvents}
              onChange={e => onPreserveChange(e.target.checked)}
              className="w-3 h-3"
            />
            <span className="text-[10px]" style={{ color: 'var(--ai-text-tertiary)' }}>Preserve</span>
          </label>
          <button
            onClick={onToggleExpanded}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] transition-colors hover:bg-[var(--ai-surface-2)]"
            style={{ color: 'var(--ai-text-tertiary)' }}
          >
            <ChevronsUpDown className="h-2.5 w-2.5" />
            {allExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {debugEvents.map((event, i) => (
          <DebugEventRow
            key={i}
            event={event}
            defaultExpanded={allExpanded}
            onViewSystemPrompt={setSystemPromptContent}
          />
        ))}
        <div ref={debugEndRef} />
      </div>

      <Dialog open={systemPromptContent !== null} onOpenChange={(open) => { if (!open) setSystemPromptContent(null) }}>
        <DialogContent
          className="!max-w-[800px] h-[80vh] flex flex-col !p-0"
          style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}
        >
          <DialogHeader className="px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
            <DialogTitle style={{ color: 'var(--ai-text-primary)' }}>System Prompt</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            {systemPromptContent && (
              <MarkdownViewer content={systemPromptContent} className="text-sm" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
