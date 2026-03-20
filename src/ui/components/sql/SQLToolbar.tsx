import { type FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Play,
  PlayCircle,
  Square,
  GitCommitHorizontal,
  RotateCcw,
  AlignLeft,
  History,
  Loader2,
  Network,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SQLToolbarProps {
  schemas: string[]
  selectedSchema: string | null
  onSchemaChange: (schema: string) => void
  onExecute: () => void
  onExecuteScript: () => void
  onExplainPlan: () => void
  onStop: () => void
  onCommit: () => void
  onRollback: () => void
  onFormat: () => void
  onHistory: () => void
  executing: boolean
  isConnected: boolean
}

interface ToolbarButtonProps {
  icon: FC<{ className?: string }>
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'ghost' | 'outline' | 'destructive'
}

const ToolbarButton: FC<ToolbarButtonProps> = ({ icon: Icon, label, shortcut, onClick, disabled, variant = 'ghost' }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant={variant}
        size="sm"
        className="h-7 w-7 p-0"
        onClick={onClick}
        disabled={disabled}
      >
        <Icon className="h-3.5 w-3.5" />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="text-xs">
      {label}{shortcut ? ` (${shortcut})` : ''}
    </TooltipContent>
  </Tooltip>
)

export const SQLToolbar: FC<SQLToolbarProps> = ({
  schemas,
  selectedSchema,
  onSchemaChange,
  onExecute,
  onExecuteScript,
  onExplainPlan,
  onStop,
  onCommit,
  onRollback,
  onFormat,
  onHistory,
  executing,
  isConnected,
}) => {
  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-[#1a1b1e]">
      {/* Schema selector */}
      <Select value={selectedSchema ?? ''} onValueChange={onSchemaChange} disabled={!isConnected}>
        <SelectTrigger className="h-7 w-[160px] text-xs">
          <SelectValue placeholder="Schema..." />
        </SelectTrigger>
        <SelectContent>
          {schemas.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Execute */}
      {executing ? (
        <ToolbarButton
          icon={Square}
          label="Stop"
          shortcut="Esc"
          onClick={onStop}
          variant="destructive"
        />
      ) : (
        <ToolbarButton
          icon={Play}
          label="Execute Statement"
          shortcut="Ctrl+Enter"
          onClick={onExecute}
          disabled={!isConnected}
        />
      )}

      <ToolbarButton
        icon={PlayCircle}
        label="Execute Script"
        shortcut="F5"
        onClick={onExecuteScript}
        disabled={!isConnected || executing}
      />

      <ToolbarButton
        icon={Network}
        label="Explain Plan"
        shortcut="Ctrl+Shift+E"
        onClick={onExplainPlan}
        disabled={!isConnected || executing}
      />

      <div className="w-px h-5 bg-border mx-1" />

      {/* Transaction */}
      <ToolbarButton
        icon={GitCommitHorizontal}
        label="Commit"
        onClick={onCommit}
        disabled={!isConnected}
      />

      <ToolbarButton
        icon={RotateCcw}
        label="Rollback"
        onClick={onRollback}
        disabled={!isConnected}
      />

      <div className="w-px h-5 bg-border mx-1" />

      {/* Utilities */}
      <ToolbarButton
        icon={AlignLeft}
        label="Format SQL"
        shortcut="Ctrl+Shift+F"
        onClick={onFormat}
        disabled={!isConnected}
      />

      <ToolbarButton
        icon={History}
        label="Query History"
        shortcut="Ctrl+Shift+H"
        onClick={onHistory}
      />

      {/* Execution status */}
      {executing && (
        <div className="flex items-center gap-1.5 ml-auto text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Executing...</span>
        </div>
      )}
    </div>
  )
}
