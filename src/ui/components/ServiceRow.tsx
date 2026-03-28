import type { FC, ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Play, Square, Loader2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ServiceRowProps {
  dir: DirectorySettings
  state: string
  isSelected?: boolean
  onSelect?: () => void
  onRun: () => void
  onStop: () => void
  /** Small accent dot before name */
  accentDot?: boolean
  /** Extra actions rendered after the run/stop button */
  actions?: ReactNode
}

export const ServiceRow: FC<ServiceRowProps> = ({
  dir,
  state,
  isSelected,
  onSelect,
  onRun,
  onStop,
  accentDot,
  actions,
}) => {
  const isRunning = state === 'RUNNING'
  const isInitializing = state === 'INITIALIZING'
  const isUnknown = state === 'UNKNOWN'

  return (
    <div
      onClick={onSelect}
      className={`px-2.5 py-2 flex justify-between items-center overflow-hidden ${onSelect ? 'cursor-pointer' : ''} transition-colors`}
      style={{
        background: isSelected ? 'var(--ai-surface-3)' : undefined,
        borderBottom: '1px solid var(--ai-border-subtle)',
      }}
    >
      <div className="w-[140px] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          {accentDot && (
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--ai-accent)' }} />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="flex-1 font-medium text-xs truncate capitalize" style={{ color: 'var(--ai-text-primary)' }}>
                {dir.name}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              <p className="capitalize">{dir.name?.replace('-', ' ')}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className={`flex-shrink-0 ${
                isRunning ? 'bg-success' : isInitializing ? 'bg-status-yellow' : 'bg-destructive'
              } h-2 w-2 rounded-full p-0`} />
            </TooltipTrigger>
            <TooltipContent>
              <p className="capitalize font-bold">{state}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--ai-text-tertiary)' }}>{dir.runCommand}</p>
      </div>

      <div className="flex gap-1 items-center flex-shrink-0">
        {dir.isFrontendProj && !isInitializing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 rounded"
                disabled={!isRunning}
                style={!isRunning ? { pointerEvents: 'auto', cursor: 'auto' } : {}}
                onClick={ev => {
                  ev.stopPropagation()
                  window.electron.openProjectInBrowser(dir.id)
                }}
              >
                <ExternalLink className="size-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isUnknown ? 'Update port to use this' : !isRunning ? 'Project is not running' : 'Open in browser'}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              className={`h-6 w-6 p-0 rounded ${isRunning || isInitializing ? 'bg-destructive hover:bg-destructive/80' : 'bg-success hover:bg-success/80'}`}
              disabled={isUnknown && !isRunning && !isInitializing}
              onClick={ev => {
                ev.stopPropagation()
                if (isRunning || isInitializing) onStop()
                else onRun()
              }}
            >
              {isInitializing
                ? <Loader2 className="size-2.5 animate-spin" />
                : isRunning
                  ? <Square className="size-2" fill="currentColor" />
                  : <Play className="size-2.5" fill="currentColor" />
              }
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isInitializing ? 'Force stop' : isRunning ? 'Stop' : 'Start'}</p>
          </TooltipContent>
        </Tooltip>
        {actions}
      </div>
    </div>
  )
}
