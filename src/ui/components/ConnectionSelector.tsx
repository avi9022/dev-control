import { type FC, type ReactNode } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings } from 'lucide-react'

interface ConnectionOption {
  value: string
  label: string
}

interface ConnectionSelectorProps {
  options: ConnectionOption[]
  value: string
  onChange: (value: string) => void
  isConnected: boolean
  onSettingsClick: () => void
  placeholder?: string
  /** Extra content rendered after the settings button (e.g. a dialog) */
  extra?: ReactNode
}

export const ConnectionSelector: FC<ConnectionSelectorProps> = ({
  options,
  value,
  onChange,
  isConnected,
  onSettingsClick,
  placeholder = 'Select...',
  extra,
}) => (
  <div className="flex items-center gap-1.5">
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-success' : 'bg-destructive'}`} />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="h-6 border-none bg-transparent px-1 text-xs font-medium min-w-0"
          style={{ color: 'var(--ai-text-primary)' }}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <button
      onClick={onSettingsClick}
      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors"
      style={{ color: 'var(--ai-text-tertiary)' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--ai-text-primary)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ai-text-tertiary)')}
    >
      <Settings className="size-3" />
    </button>
    {extra}
  </div>
)
