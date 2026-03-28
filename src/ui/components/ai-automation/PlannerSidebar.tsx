import { type FC, type RefObject } from 'react'
import { Wand2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SIDEBAR_WIDTH } from '@/ui/components/ai-automation/planner-constants'
import { PlannerConversationList } from '@/ui/components/ai-automation/PlannerConversationList'
import { PlannerDebugPanel } from '@/ui/components/ai-automation/PlannerDebugPanel'

interface PlannerSidebarProps {
  sidebarTab: PlannerSidebarTab
  onTabChange: (tab: PlannerSidebarTab) => void
  conversations: PlannerConversationListItem[]
  currentSessionId: string
  onLoadConversation: (sessionId: string) => void
  onDeleteConversation: (sessionId: string) => void
  onNewConversation: () => void
  isLoading: boolean
  debugEvents: PlannerDebugEvent[]
  allExpanded: boolean
  onToggleExpanded: () => void
  preserveEvents: boolean
  onPreserveChange: (preserve: boolean) => void
  debugEndRef: RefObject<HTMLDivElement | null>
}

export const PlannerSidebar: FC<PlannerSidebarProps> = ({
  sidebarTab,
  onTabChange,
  conversations,
  currentSessionId,
  onLoadConversation,
  onDeleteConversation,
  onNewConversation,
  isLoading,
  debugEvents,
  allExpanded,
  onToggleExpanded,
  preserveEvents,
  onPreserveChange,
  debugEndRef,
}) => {
  return (
    <div
      className="flex-shrink-0 flex flex-col"
      style={{ width: SIDEBAR_WIDTH, background: 'var(--ai-surface-1)', borderRight: '1px solid var(--ai-border-subtle)' }}
    >
      <div
        className="flex-shrink-0 px-3 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}
      >
        <DialogHeader className="p-0">
          <DialogTitle className="flex items-center gap-2 text-sm" style={{ color: 'var(--ai-text-primary)' }}>
            <Wand2 className="h-3.5 w-3.5" style={{ color: 'var(--ai-accent)' }} />
            Planner
          </DialogTitle>
        </DialogHeader>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={onNewConversation}
          disabled={isLoading}
        >
          <Plus className="h-3 w-3 mr-1" />
          New
        </Button>
      </div>
      <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
        <button
          className="flex-1 px-3 py-2 text-[11px] font-medium transition-colors"
          style={{
            color: sidebarTab === 'conversations' ? 'var(--ai-accent)' : 'var(--ai-text-tertiary)',
            borderBottom: sidebarTab === 'conversations' ? '2px solid var(--ai-accent)' : '2px solid transparent',
          }}
          onClick={() => onTabChange('conversations')}
        >
          Conversations
        </button>
        <button
          className="flex-1 px-3 py-2 text-[11px] font-medium transition-colors"
          style={{
            color: sidebarTab === 'debug' ? 'var(--ai-accent)' : 'var(--ai-text-tertiary)',
            borderBottom: sidebarTab === 'debug' ? '2px solid var(--ai-accent)' : '2px solid transparent',
          }}
          onClick={() => onTabChange('debug')}
        >
          Debug
        </button>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto transition-opacity duration-200"
        style={{ opacity: sidebarTab === 'conversations' ? 1 : 0, display: sidebarTab === 'conversations' ? 'block' : 'none' }}
      >
        <PlannerConversationList
          conversations={conversations}
          currentSessionId={currentSessionId}
          onLoad={onLoadConversation}
          onDelete={onDeleteConversation}
        />
      </div>

      <div
        className="flex-1 min-h-0 flex flex-col transition-opacity duration-200"
        style={{ opacity: sidebarTab === 'debug' ? 1 : 0, display: sidebarTab === 'debug' ? 'flex' : 'none' }}
      >
        <PlannerDebugPanel
          debugEvents={debugEvents}
          allExpanded={allExpanded}
          onToggleExpanded={onToggleExpanded}
          preserveEvents={preserveEvents}
          onPreserveChange={onPreserveChange}
          debugEndRef={debugEndRef}
        />
      </div>
    </div>
  )
}
