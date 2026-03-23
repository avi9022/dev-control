import { useState, useEffect, type FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Activity, Cpu, DollarSign, Clock, Wrench } from 'lucide-react'

const CONTEXT_HIGH_PCT = 80
const CONTEXT_WARN_PCT = 60

interface AgentStatsModalProps {
  taskId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatDuration(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export const AgentStatsModal: FC<AgentStatsModalProps> = ({ taskId, open, onOpenChange }) => {
  const [stats, setStats] = useState<AIAgentStats | null>(null)

  // Fetch initial stats on open
  useEffect(() => {
    if (!open) return
    window.electron.aiGetAgentStats(taskId).then(s => {
      if (s) setStats(s)
    })
  }, [open, taskId])

  // Subscribe to live updates
  useEffect(() => {
    if (!open) return
    const unsub = window.electron.subscribeAIAgentStats((data) => {
      if (data.taskId === taskId) setStats(data)
    })
    return () => { unsub?.() }
  }, [open, taskId])

  // inputTokens now stores total context (input + cache read + cache creation)
  const totalContext = stats ? stats.inputTokens : 0
  const contextPercent = stats ? Math.min(100, Math.round((totalContext / stats.contextWindowMax) * 100)) : 0
  const barColor = contextPercent > CONTEXT_HIGH_PCT ? 'var(--ai-pink)' : contextPercent > CONTEXT_WARN_PCT ? 'var(--ai-warning)' : 'var(--ai-success)'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[480px]" style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: 'var(--ai-accent)' }} />
            Agent Stats
          </DialogTitle>
        </DialogHeader>

        {!stats ? (
          <div className="py-8 text-center text-sm" style={{ color: 'var(--ai-text-tertiary)' }}>
            No stats available
          </div>
        ) : (
          <div className="space-y-4">
            {/* Context usage */}
            <div
              className="rounded-lg p-3"
              style={{ border: '1px solid var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 50%, transparent)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" style={{ color: barColor }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--ai-text-primary)' }}>Context Usage</span>
                </div>
                <span className="text-xs font-mono font-medium" style={{ color: barColor }}>
                  {contextPercent}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--ai-surface-3)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${contextPercent}%`, backgroundColor: barColor }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px] font-mono" style={{ color: 'var(--ai-text-tertiary)' }}>
                  {formatTokens(totalContext)} tokens
                  {stats.peakContext > totalContext && (
                    <span style={{ color: 'var(--ai-text-tertiary)', opacity: 0.6 }}> (peak: {formatTokens(stats.peakContext)})</span>
                  )}
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--ai-text-tertiary)' }}>
                  {formatTokens(stats.contextWindowMax)} max
                </span>
              </div>
            </div>

            {/* Token breakdown */}
            <div
              className="rounded-lg p-3"
              style={{ border: '1px solid var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 50%, transparent)' }}
            >
              <span className="text-xs font-medium block mb-2" style={{ color: 'var(--ai-text-primary)' }}>Tokens</span>
              <div className="grid grid-cols-2 gap-2">
                <TokenStat label="Context (total)" value={stats.inputTokens} />
                <TokenStat label="Output (total)" value={stats.outputTokens} />
                <TokenStat label="Cache Read" value={stats.cacheReadTokens} />
                <TokenStat label="Cache Created" value={stats.cacheCreationTokens} />
              </div>
            </div>

            {/* Activity */}
            <div
              className="rounded-lg p-3"
              style={{ border: '1px solid var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 50%, transparent)' }}
            >
              <span className="text-xs font-medium block mb-2" style={{ color: 'var(--ai-text-primary)' }}>Activity</span>
              <div className="flex items-center gap-4 mb-2">
                <div>
                  <span className="text-lg font-semibold font-mono" style={{ color: 'var(--ai-text-primary)' }}>{stats.turns}</span>
                  <span className="text-[10px] ml-1" style={{ color: 'var(--ai-text-tertiary)' }}>turns</span>
                </div>
                <div>
                  <span className="text-lg font-semibold font-mono" style={{ color: 'var(--ai-text-primary)' }}>{stats.toolCalls}</span>
                  <span className="text-[10px] ml-1" style={{ color: 'var(--ai-text-tertiary)' }}>tool calls</span>
                </div>
              </div>
              {stats.toolNames.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {stats.toolNames.map(name => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-mono"
                      style={{ backgroundColor: 'var(--ai-surface-3)', color: 'var(--ai-text-secondary)' }}
                    >
                      <Wrench className="h-2.5 w-2.5" />
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Cost & Duration */}
            <div className="flex gap-3">
              <div
                className="flex-1 rounded-lg p-3"
                style={{ border: '1px solid var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 50%, transparent)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
                  <span className="text-[10px]" style={{ color: 'var(--ai-text-tertiary)' }}>Cost</span>
                </div>
                <span className="text-sm font-mono font-medium" style={{ color: 'var(--ai-text-primary)' }}>
                  ${stats.costUsd.toFixed(4)}
                </span>
              </div>
              <div
                className="flex-1 rounded-lg p-3"
                style={{ border: '1px solid var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 50%, transparent)' }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
                  <span className="text-[10px]" style={{ color: 'var(--ai-text-tertiary)' }}>Duration</span>
                </div>
                <span className="text-sm font-mono font-medium" style={{ color: 'var(--ai-text-primary)' }}>
                  {formatDuration(stats.startedAt)}
                </span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

const TokenStat: FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex items-center justify-between">
    <span className="text-[11px]" style={{ color: 'var(--ai-text-tertiary)' }}>{label}</span>
    <span className="text-[11px] font-mono font-medium" style={{ color: 'var(--ai-text-secondary)' }}>
      {formatTokens(value)}
    </span>
  </div>
)
