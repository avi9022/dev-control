import { type FC } from 'react'
import { Check, AlertTriangle, Loader2, User, Circle, Pause } from 'lucide-react'
import { PhaseType, FIXED_PHASES } from '@/shared/constants'

const TRUNCATE_THRESHOLD = 10
const TRUNCATE_HEAD = 2
const TRUNCATE_TAIL = 3
const STEP_NODE_SIZE = 24
const STEP_NODE_MIN_WIDTH = 56
const CONNECTOR_MARGIN_TOP = 2
const ELLIPSIS = 'ellipsis'

const ERROR_EXIT_EVENTS = new Set(['crashed', 'stalled', 'error'])

interface GroupedPhaseNode {
  entries: AIPhaseHistoryEntry[]
  lastIndex: number
  phase: string
  retryCount: number
}

interface PhaseStepperProps {
  phaseHistory: AIPhaseHistoryEntry[]
  pipeline: AIPipelinePhase[]
  activePhaseIndex: number
  isAgentRunning: boolean
  onSelectPhase: (index: number) => void
}

function groupPhaseHistory(phaseHistory: AIPhaseHistoryEntry[]): GroupedPhaseNode[] {
  const groups: GroupedPhaseNode[] = []

  for (let i = 0; i < phaseHistory.length; i++) {
    const entry = phaseHistory[i]
    const lastGroup = groups.length > 0 ? groups[groups.length - 1] : undefined

    if (lastGroup && entry.sessionId && lastGroup.entries[0].sessionId === entry.sessionId) {
      lastGroup.entries.push(entry)
      lastGroup.lastIndex = i
      lastGroup.retryCount++
    } else {
      groups.push({
        entries: [entry],
        lastIndex: i,
        phase: entry.phase,
        retryCount: 1,
      })
    }
  }

  return groups
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getPhaseConfig(phaseId: string, pipeline: AIPipelinePhase[]): AIPipelinePhase | undefined {
  return pipeline.find(p => p.id === phaseId)
}

function getPhaseName(phaseId: string, pipeline: AIPipelinePhase[]): string {
  const isFixed = phaseId === FIXED_PHASES.BACKLOG || phaseId === FIXED_PHASES.DONE
  if (isFixed) return phaseId.charAt(0) + phaseId.slice(1).toLowerCase()
  const config = getPhaseConfig(phaseId, pipeline)
  return config?.name || phaseId
}

interface StepNodeProps {
  group: GroupedPhaseNode
  isCurrent: boolean
  isAgentRunning: boolean
  isSelected: boolean
  pipeline: AIPipelinePhase[]
  onSelect: () => void
}

const StepNode: FC<StepNodeProps> = ({ group, isCurrent, isAgentRunning, isSelected, pipeline, onSelect }) => {
  const lastEntry = group.entries[group.entries.length - 1]
  const firstEntry = group.entries[0]
  const isFixedPhase = group.phase === FIXED_PHASES.BACKLOG || group.phase === FIXED_PHASES.DONE
  const config = getPhaseConfig(group.phase, pipeline)
  const color = config?.color || 'var(--ai-text-tertiary)'
  const name = getPhaseName(group.phase, pipeline)
  const phaseType = isFixedPhase ? PhaseType.Manual : (config?.type || PhaseType.Agent)
  const isError = lastEntry.exitEvent !== undefined && ERROR_EXIT_EVENTS.has(lastEntry.exitEvent)
  const isCompleted = lastEntry.exitedAt !== undefined && !isError
  const isRunning = isCurrent && isAgentRunning && phaseType === PhaseType.Agent
  const isHumanPhase = phaseType === PhaseType.Manual || isFixedPhase

  const iconColor = isSelected ? 'var(--ai-surface-0)' : color

  function renderIcon(): React.ReactNode {
    if (isError) return <AlertTriangle className="h-3 w-3" style={{ color: iconColor }} />
    if (isRunning) return <Loader2 className="h-3 w-3 animate-spin" style={{ color: iconColor }} />
    if (isHumanPhase) return <User className="h-3 w-3" style={{ color: iconColor }} />
    if (isCompleted) return <Check className="h-3 w-3" style={{ color: iconColor }} />
    if (isCurrent) return <Pause className="h-3 w-3" style={{ color: iconColor }} />
    return <Circle className="h-2.5 w-2.5" style={{ color: iconColor }} />
  }

  return (
    <button
      onClick={onSelect}
      className="flex flex-col items-center gap-0.5 transition-all group"
      style={{ cursor: 'pointer', outline: 'none', minWidth: STEP_NODE_MIN_WIDTH }}
    >
      <div className="relative flex items-center justify-center">
        <div
          className="relative flex items-center justify-center rounded-full transition-all"
          style={{
            width: STEP_NODE_SIZE,
            height: STEP_NODE_SIZE,
            background: isSelected ? color : 'transparent',
            border: `2px solid ${color}`,
          }}
        >
          {isRunning && (
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: color, opacity: 0.3 }}
            />
          )}
          {renderIcon()}
        </div>
        {group.retryCount > 1 && (
          <span
            className="absolute -top-1 -right-2 text-[8px] font-bold leading-none min-w-[14px] h-[14px] flex items-center justify-center rounded-full"
            style={{ background: 'var(--ai-surface-3)', color: 'var(--ai-text-secondary)' }}
          >
            {group.retryCount}
          </span>
        )}
      </div>
      <span
        className="text-[10px] leading-tight font-bold truncate max-w-[72px]"
        style={{ color: isSelected ? 'var(--ai-text-primary)' : 'var(--ai-text-secondary)' }}
      >
        {name}
      </span>
      <span
        className="text-[9px] leading-tight"
        style={{ color: 'var(--ai-text-tertiary)' }}
      >
        {formatTime(firstEntry.enteredAt)}
      </span>
    </button>
  )
}

export const PhaseStepper: FC<PhaseStepperProps> = ({
  phaseHistory,
  pipeline,
  activePhaseIndex,
  isAgentRunning,
  onSelectPhase,
}) => {
  if (phaseHistory.length === 0) return null

  const groups = groupPhaseHistory(phaseHistory)

  const shouldTruncate = groups.length > TRUNCATE_THRESHOLD
  const visibleGroups: Array<GroupedPhaseNode | typeof ELLIPSIS> = []

  if (shouldTruncate) {
    for (let i = 0; i < TRUNCATE_HEAD; i++) {
      visibleGroups.push(groups[i])
    }
    visibleGroups.push(ELLIPSIS)
    for (let i = groups.length - TRUNCATE_TAIL; i < groups.length; i++) {
      visibleGroups.push(groups[i])
    }
  } else {
    visibleGroups.push(...groups)
  }

  return (
    <div
      className="flex items-center gap-0.5 px-3 py-2 overflow-x-auto"
      style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}
    >
      {visibleGroups.map((item, i) => {
        if (item === ELLIPSIS) {
          return (
            <div key={ELLIPSIS} className="flex items-center px-1" style={{ marginTop: CONNECTOR_MARGIN_TOP }}>
              <div className="h-px w-4" style={{ background: 'var(--ai-border)' }} />
              <span className="text-xs px-1" style={{ color: 'var(--ai-text-tertiary)' }}>...</span>
              <div className="h-px w-4" style={{ background: 'var(--ai-border)' }} />
            </div>
          )
        }

        const isLast = i === visibleGroups.length - 1
        const lastEntry = item.entries[item.entries.length - 1]
        const isCurrent = !lastEntry.exitedAt
        const isSelected = item.lastIndex === activePhaseIndex

        return (
          <div key={`${item.lastIndex}-${item.phase}`} className="flex items-center">
            <StepNode
              group={item}
              isCurrent={isCurrent}
              isAgentRunning={isAgentRunning}
              isSelected={isSelected}
              pipeline={pipeline}
              onSelect={() => onSelectPhase(item.lastIndex)}
            />
            {!isLast && (
              <div className="h-px w-3" style={{ background: 'var(--ai-border)', marginTop: CONNECTOR_MARGIN_TOP }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
