import { useState, useEffect, useRef, type FC } from 'react'
import { createPortal } from 'react-dom'
import { useApiClient } from '@/ui/contexts/api-client'
import { Zap, Plus, Trash2, Info, Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface InsertRule {
  id: string
  variableName: string
  responseKey: string
  enabled: boolean
}

interface InsertVariableEditorProps {
  rules: InsertRule[]
  onChange: (rules: InsertRule[]) => void
}

// Autocomplete dropdown for variable selection
const VariableAutocomplete: FC<{
  value: string
  onChange: (value: string) => void
  onSelect: (value: string) => void
  placeholder?: string
  className?: string
}> = ({ value, onChange, onSelect, placeholder, className }) => {
  const { activeWorkspace } = useApiClient()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeEnv = activeWorkspace?.environments.find(
    (e) => e.id === activeWorkspace.activeEnvironmentId
  )

  const allVariables = activeEnv?.variables
    .filter((v) => v.enabled)
    .map((v) => v.key) ?? []

  const filteredVariables = search
    ? allVariables.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : allVariables

  // Sync search with external value
  useEffect(() => {
    setSearch(value)
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (varName: string) => {
    setSearch(varName)
    onChange(varName)
    onSelect(varName)
    setIsOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearch(newValue)
    onChange(newValue)
    setIsOpen(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'Enter' && filteredVariables.length > 0) {
      e.preventDefault()
      handleSelect(filteredVariables[0])
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen && filteredVariables.length > 0) {
        setIsOpen(true)
      }
    }
  }

  const inputRect = inputRef.current?.getBoundingClientRect()

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          value={search}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-8 text-xs font-mono pr-8"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent transition-colors"
        >
          <ChevronDown className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )} />
        </button>
      </div>

      {isOpen && inputRect && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-popover border rounded-md shadow-lg overflow-hidden"
          style={{
            left: inputRect.left,
            top: inputRect.bottom + 4,
            width: inputRect.width,
            maxHeight: 200,
          }}
        >
          {filteredVariables.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground text-center">
              {allVariables.length === 0 ? (
                <span>No variables in active environment</span>
              ) : (
                <span>No matching variables</span>
              )}
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[200px]">
              {/* Option to create new if typed value doesn't exist */}
              {search && !allVariables.includes(search) && (
                <button
                  type="button"
                  onClick={() => handleSelect(search)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent text-left border-b border-border/50"
                >
                  <Plus className="h-3 w-3 text-emerald-500" />
                  <span className="text-muted-foreground">Create new:</span>
                  <span className="font-mono text-emerald-500 font-medium">{search}</span>
                </button>
              )}
              {filteredVariables.map((varName) => (
                <button
                  key={varName}
                  type="button"
                  onClick={() => handleSelect(varName)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent text-left",
                    search === varName && "bg-accent"
                  )}
                >
                  <span className="h-4 w-4 rounded text-[8px] font-bold bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
                    E
                  </span>
                  <span className="font-mono truncate">{varName}</span>
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

// Single rule row
const InsertRuleRow: FC<{
  rule: InsertRule
  onChange: (rule: InsertRule) => void
  onDelete: () => void
  lastExtracted?: { key: string; success: boolean }
}> = ({ rule, onChange, onDelete, lastExtracted }) => {
  const isRecentlyExtracted = lastExtracted?.key === rule.responseKey && lastExtracted.success

  return (
    <div className={cn(
      "group flex items-center gap-2 p-2 rounded-lg border transition-all",
      rule.enabled
        ? "bg-card border-border hover:border-border/80"
        : "bg-muted/30 border-border/50 opacity-60",
      isRecentlyExtracted && "border-emerald-500/50 bg-emerald-500/5"
    )}>
      {/* Enable/disable checkbox */}
      <button
        type="button"
        onClick={() => onChange({ ...rule, enabled: !rule.enabled })}
        className={cn(
          "flex-shrink-0 w-4 h-4 rounded border transition-all flex items-center justify-center",
          rule.enabled
            ? "bg-primary border-primary"
            : "bg-transparent border-muted-foreground/30 hover:border-muted-foreground/50"
        )}
      >
        {rule.enabled && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
      </button>

      {/* Variable name autocomplete */}
      <div className="flex-1 min-w-0">
        <VariableAutocomplete
          value={rule.variableName}
          onChange={(v) => onChange({ ...rule, variableName: v })}
          onSelect={(v) => onChange({ ...rule, variableName: v })}
          placeholder="Variable name..."
        />
      </div>

      {/* Arrow indicator */}
      <div className="flex-shrink-0 flex items-center justify-center">
        <Zap className={cn(
          "h-3.5 w-3.5 transition-colors",
          isRecentlyExtracted ? "text-emerald-500" : "text-muted-foreground/50"
        )} />
      </div>

      {/* Response key path */}
      <div className="flex-1 min-w-0">
        <Input
          value={rule.responseKey}
          onChange={(e) => onChange({ ...rule, responseKey: e.target.value })}
          placeholder="response.key (e.g., accessToken)"
          className="h-8 text-xs font-mono"
        />
      </div>

      {/* Success indicator */}
      {isRecentlyExtracted && (
        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center animate-in fade-in zoom-in duration-200">
          <Check className="h-3 w-3 text-emerald-500" />
        </div>
      )}

      {/* Delete button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        className="flex-shrink-0 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export const InsertVariableEditor: FC<InsertVariableEditorProps> = ({
  rules,
  onChange,
}) => {
  const addRule = () => {
    const newRule: InsertRule = {
      id: crypto.randomUUID(),
      variableName: '',
      responseKey: '',
      enabled: true,
    }
    onChange([...rules, newRule])
  }

  const updateRule = (index: number, updatedRule: InsertRule) => {
    onChange(rules.map((r, i) => (i === index ? updatedRule : r)))
  }

  const deleteRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-medium text-foreground">Auto-Insert Variables</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[280px] text-xs">
              <p className="font-medium mb-1">Auto-extract values from responses</p>
              <p className="text-muted-foreground">
                When a response contains the specified key, its value will automatically be saved to the selected environment variable.
              </p>
              <div className="mt-2 p-2 bg-muted rounded text-[10px] font-mono">
                <span className="text-sky-400">TOKEN</span>
                <span className="text-muted-foreground mx-2">←</span>
                <span className="text-amber-400">accessToken</span>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={addRule}
          className="h-7 gap-1.5 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add Rule
        </Button>
      </div>

      {/* Rules list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <Zap className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">No insert rules configured</p>
            <p className="text-xs text-muted-foreground/70 max-w-[200px]">
              Add a rule to automatically extract values from responses into environment variables
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={addRule}
              className="mt-4 h-8 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add First Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="flex items-center gap-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              <div className="w-4" />
              <div className="flex-1">Variable</div>
              <div className="w-3.5" />
              <div className="flex-1">Response Key</div>
              <div className="w-7" />
            </div>

            {rules.map((rule, index) => (
              <InsertRuleRow
                key={rule.id}
                rule={rule}
                onChange={(updated) => updateRule(index, updated)}
                onDelete={() => deleteRule(index)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {rules.length > 0 && (
        <div className="pt-3 mt-3 border-t text-[10px] text-muted-foreground/70">
          <span className="font-medium">Tip:</span> Use dot notation for nested keys (e.g., <code className="px-1 py-0.5 bg-muted rounded font-mono">data.token.accessToken</code>)
        </div>
      )}
    </div>
  )
}
