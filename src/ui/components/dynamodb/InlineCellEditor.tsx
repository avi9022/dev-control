import { useState, useEffect, useRef, type FC } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type AttributeType = 'S' | 'N' | 'BOOL' | 'NULL' | 'L' | 'M' | 'B' | 'SS' | 'NS'

const TYPE_LABELS: Record<AttributeType, string> = {
  S: 'String',
  N: 'Number',
  BOOL: 'Boolean',
  NULL: 'Null',
  L: 'List',
  M: 'Map',
  B: 'Binary',
  SS: 'String Set',
  NS: 'Number Set',
}

interface InlineCellEditorProps {
  value: unknown
  attributeName: string
  isKey: boolean
  onSave: (newValue: unknown) => Promise<void>
  onCancel: () => void
}

function detectType(value: unknown): AttributeType {
  if (value === null) return 'NULL'
  if (typeof value === 'boolean') return 'BOOL'
  if (typeof value === 'number') return 'N'
  if (typeof value === 'string') return 'S'
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(v => typeof v === 'string')) return 'SS'
    if (value.length > 0 && value.every(v => typeof v === 'number')) return 'NS'
    return 'L'
  }
  if (typeof value === 'object') return 'M'
  return 'S'
}

function valueToString(value: unknown, type: AttributeType): string {
  if (value === null || value === undefined) return ''
  if (type === 'BOOL') return String(value)
  if (type === 'NULL') return ''
  if (type === 'L' || type === 'M') return JSON.stringify(value, null, 2)
  if (type === 'SS' || type === 'NS') {
    return Array.isArray(value) ? value.join(', ') : ''
  }
  return String(value)
}

function parseValue(str: string, type: AttributeType): unknown {
  const trimmed = str.trim()

  switch (type) {
    case 'S':
      return trimmed
    case 'N': {
      const num = Number(trimmed)
      if (isNaN(num)) throw new Error('Invalid number')
      return num
    }
    case 'BOOL':
      return trimmed.toLowerCase() === 'true'
    case 'NULL':
      return null
    case 'L':
    case 'M':
      if (!trimmed) return type === 'L' ? [] : {}
      return JSON.parse(trimmed)
    case 'SS':
      if (!trimmed) return []
      return trimmed.split(',').map(s => s.trim()).filter(Boolean)
    case 'NS':
      if (!trimmed) return []
      return trimmed.split(',').map(s => {
        const n = Number(s.trim())
        if (isNaN(n)) throw new Error('Invalid number in set')
        return n
      })
    case 'B':
      return trimmed // Base64 string
    default:
      return trimmed
  }
}

export const InlineCellEditor: FC<InlineCellEditorProps> = ({
  value,
  attributeName,
  isKey,
  onSave,
  onCancel,
}) => {
  const [open, setOpen] = useState(true)
  const [attrType, setAttrType] = useState<AttributeType>(() => detectType(value))
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditValue(valueToString(value, attrType))
  }, [value, attrType])

  useEffect(() => {
    // Focus appropriate input
    setTimeout(() => {
      if (attrType === 'L' || attrType === 'M') {
        textareaRef.current?.focus()
      } else {
        inputRef.current?.focus()
      }
    }, 0)
  }, [attrType])

  const handleTypeChange = (newType: AttributeType) => {
    setAttrType(newType)
    setError(null)
    // Reset value for certain type changes
    if (newType === 'NULL') {
      setEditValue('')
    } else if (newType === 'BOOL') {
      setEditValue('true')
    } else if (newType === 'L') {
      setEditValue('[]')
    } else if (newType === 'M') {
      setEditValue('{}')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const parsedValue = parseValue(editValue, attrType)
      await onSave(parsedValue)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setOpen(false)
    onCancel()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && attrType !== 'L' && attrType !== 'M') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const needsTextarea = attrType === 'L' || attrType === 'M'

  return (
    <Popover open={open} onOpenChange={(o) => !o && handleCancel()}>
      <PopoverTrigger asChild>
        <span className="cursor-pointer">{valueToString(value, detectType(value)) || '(empty)'}</span>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate max-w-[150px]" title={attributeName}>
              {attributeName}
            </span>
            {isKey && (
              <span className="text-xs bg-status-yellow-bg text-yellow-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Key
              </span>
            )}
          </div>

          {isKey && (
            <p className="text-xs text-muted-foreground">
              Changing key value will create a new item
            </p>
          )}

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Type</label>
            <Select value={attrType} onValueChange={(v) => { const valid = Object.keys(TYPE_LABELS); if (valid.includes(v)) handleTypeChange(v as AttributeType) }}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([type, label]) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {attrType !== 'NULL' && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Value</label>
              {attrType === 'BOOL' ? (
                <Select value={editValue} onValueChange={setEditValue}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true" className="text-xs">true</SelectItem>
                    <SelectItem value="false" className="text-xs">false</SelectItem>
                  </SelectContent>
                </Select>
              ) : needsTextarea ? (
                <Textarea
                  ref={textareaRef}
                  className={cn(
                    "text-xs font-mono min-h-[80px] resize-y",
                    error && "border-destructive"
                  )}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={saving}
                  placeholder={attrType === 'L' ? '["item1", "item2"]' : '{"key": "value"}'}
                />
              ) : (
                <Input
                  ref={inputRef}
                  className={cn(
                    "h-8 text-xs font-mono",
                    error && "border-destructive"
                  )}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={saving}
                  placeholder={
                    attrType === 'N' ? 'Enter number...' :
                    attrType === 'SS' ? 'value1, value2, value3' :
                    attrType === 'NS' ? '1, 2, 3' :
                    'Enter value...'
                  }
                />
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={handleCancel}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7"
              onClick={handleSave}
              disabled={saving}
            >
              <Check className="h-3 w-3 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
