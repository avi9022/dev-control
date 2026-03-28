import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface ImportantValuesListProps {
  values: ImportantValue[]
  onAdd?: () => void
  onDelete?: (id: string) => void
  onKeyChange?: (id: string, key: string) => void
  onValueChange?: (id: string, value: string) => void
}

export const ImportantValuesList = ({ 
  values, 
  onAdd, 
  onDelete, 
  onKeyChange, 
  onValueChange 
}: ImportantValuesListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'key' | 'value' | null>(null)

  // Auto-edit new entries (empty key)
  useEffect(() => {
    const emptyValue = values.find(v => !v.key)
    if (emptyValue && editingId !== emptyValue.id) {
      setEditingId(emptyValue.id)
      setEditingField('key')
    }
  }, [values, editingId])

  const handleKeyEdit = (value: ImportantValue) => {
    setEditingId(value.id)
    setEditingField('key')
  }

  const handleValueEdit = (value: ImportantValue) => {
    setEditingId(value.id)
    setEditingField('value')
  }

  const handleKeyBlur = (e: React.FocusEvent<HTMLInputElement>, value: ImportantValue) => {
    const newKey = e.target.value.trim()
    if (newKey && newKey !== value.key) {
      // Check for duplicate keys
      const hasDuplicate = values.some(v => v.id !== value.id && v.key === newKey)
      if (!hasDuplicate) {
        onKeyChange?.(value.id, newKey)
      }
    } else if (!newKey && value.key) {
      // If key becomes empty and it wasn't empty before, don't save
      // This allows canceling edits
    }
    setEditingId(null)
    setEditingField(null)
  }

  const handleValueBlur = (e: React.FocusEvent<HTMLInputElement>, value: ImportantValue) => {
    const newValue = e.target.value
    if (newValue !== value.value) {
      onValueChange?.(value.id, newValue)
    }
    setEditingId(null)
    setEditingField(null)
  }

  return (
    <div className="flex flex-col h-full">
      {values.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground text-sm text-center">
            <p className="mb-2">No important values yet.</p>
            <p className="text-xs">Click "Add Value" below to create one.</p>
          </div>
        </div>
      ) : (
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {values.map(value => (
          <li
            key={value.id}
            className="group flex items-center gap-2 py-2 px-2 rounded-md hover:bg-white/5 transition-colors"
          >
            {/* Key */}
            {editingId === value.id && editingField === 'key' ? (
              <input
                type="text"
                defaultValue={value.key}
                placeholder="Enter key..."
                className="flex-1 text-sm bg-neutral-800/50 border border-neutral-600 rounded px-2 py-1 outline-none text-neutral-200 placeholder-neutral-500 focus:ring-2 focus:ring-blue-500/50"
                autoFocus
                onBlur={(e) => handleKeyBlur(e, value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  } else if (e.key === 'Escape') {
                    setEditingId(null)
                    setEditingField(null)
                  }
                }}
              />
            ) : (
              <span
                className={`flex-1 text-sm font-mono cursor-text min-w-[120px] ${
                  value.key 
                    ? 'text-neutral-300' 
                    : 'text-muted-foreground italic'
                }`}
                onDoubleClick={() => onKeyChange && handleKeyEdit(value)}
                onClick={() => onKeyChange && handleKeyEdit(value)}
                title="Click or double-click to edit key"
              >
                {value.key || 'Enter key...'}
              </span>
            )}
            
            {/* Separator */}
            <span className="text-neutral-600">=</span>
            
            {/* Value */}
            {editingId === value.id && editingField === 'value' ? (
              <input
                type="text"
                defaultValue={value.value}
                placeholder="Enter value..."
                className="flex-1 text-sm bg-neutral-800/50 border border-neutral-600 rounded px-2 py-1 outline-none text-neutral-200 placeholder-neutral-500 focus:ring-2 focus:ring-blue-500/50"
                autoFocus
                onBlur={(e) => handleValueBlur(e, value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  } else if (e.key === 'Escape') {
                    setEditingId(null)
                    setEditingField(null)
                  }
                }}
              />
            ) : (
              <span
                className={`flex-1 text-sm cursor-text ${
                  value.value 
                    ? 'text-neutral-200' 
                    : 'text-muted-foreground italic'
                }`}
                onDoubleClick={() => onValueChange && handleValueEdit(value)}
                onClick={() => onValueChange && handleValueEdit(value)}
                title="Click or double-click to edit value"
              >
                {value.value || 'Enter value...'}
              </span>
            )}
            
            {/* Delete button */}
            {onDelete && (
              <button
                onClick={() => onDelete(value.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-status-red-bg text-muted-foreground hover:text-status-red transition-all"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
        </ul>
      )}
      
      {/* Add button */}
      {onAdd && (
        <div className="px-2 py-2 border-t border-white/10">
          <button
            onClick={onAdd}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 transition-colors text-sm"
          >
            <Plus size={16} />
            Add Value
          </button>
        </div>
      )}
    </div>
  )
}

