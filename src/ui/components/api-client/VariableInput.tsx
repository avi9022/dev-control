import { useRef, useCallback, useEffect, useState, type FC } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useVariableMap, parseTextSegments, textHasVariables } from './variableUtils'
import { useApiClient } from '@/ui/contexts/api-client'

interface VariableInputProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
}

// Inline tooltip component
const VariableEditTooltip: FC<{
  varName: string
  position: { x: number; y: number }
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClose: () => void
}> = ({ varName, position, onMouseEnter, onMouseLeave, onClose }) => {
  const { vars } = useVariableMap()
  const { activeWorkspace, updateEnvironment, createEnvironment, setActiveEnvironment } = useApiClient()
  const [editValue, setEditValue] = useState(vars.get(varName) ?? '')
  const resolved = vars.has(varName)

  const handleSave = useCallback(async () => {
    if (!activeWorkspace) return

    const activeEnv = activeWorkspace.environments.find(
      (e) => e.id === activeWorkspace.activeEnvironmentId
    )

    if (activeEnv) {
      const existingIdx = activeEnv.variables.findIndex((v) => v.key === varName)
      const updatedVars = existingIdx >= 0
        ? activeEnv.variables.map((v, i) =>
          i === existingIdx ? { ...v, value: editValue } : v
        )
        : [...activeEnv.variables, { key: varName, value: editValue, type: 'default' as const, enabled: true }]

      await updateEnvironment(activeEnv.id, { ...activeEnv, variables: updatedVars })
    } else if (activeWorkspace.environments.length > 0) {
      const env = activeWorkspace.environments[0]
      const updatedVars = [...env.variables, { key: varName, value: editValue, type: 'default' as const, enabled: true }]
      await updateEnvironment(env.id, { ...env, variables: updatedVars })
      await setActiveEnvironment(env.id)
    } else {
      await createEnvironment('Default')
    }

    onClose()
  }, [activeWorkspace, varName, editValue, updateEnvironment, createEnvironment, setActiveEnvironment, onClose])

  return createPortal(
    <div
      className="fixed z-50"
      style={{ left: position.x, top: position.y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Bridge area */}
      <div className="h-1.5" />
      <div className="rounded border bg-popover shadow-md p-2 min-w-[200px]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => {
              if (editValue !== (vars.get(varName) ?? '')) {
                handleSave()
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') onClose()
            }}
            placeholder="value..."
            className="flex-1 rounded bg-muted px-2 py-1 font-mono text-xs border-0 outline-none focus:ring-1 focus:ring-ring"
          />
          {resolved ? (
            <span className="h-4 w-4 rounded text-[8px] font-bold bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
              E
            </span>
          ) : (
            <span className="text-[10px] text-status-red">new</span>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export const VariableInput: FC<VariableInputProps> = ({
  value,
  onChange,
  onKeyDown,
  onPaste: externalOnPaste,
  placeholder,
  className,
}) => {
  const { vars } = useVariableMap()
  const editorRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef(value)
  const isComposingRef = useRef(false)

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ varName: string; x: number; y: number } | null>(null)
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isOverTooltipRef = useRef(false)
  const isOverVarRef = useRef(false)

  const scheduleClose = useCallback(() => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current)
    tooltipTimeoutRef.current = setTimeout(() => {
      if (!isOverTooltipRef.current && !isOverVarRef.current) {
        setTooltip(null)
      }
    }, 100)
  }, [])

  const cancelClose = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
      tooltipTimeoutRef.current = null
    }
  }, [])

  // Helper to set cursor position
  const setCursorPosition = useCallback((editor: HTMLElement, position: number) => {
    const sel = window.getSelection()
    if (!sel) return

    let currentPos = 0
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null)

    let node: Node | null = walker.nextNode()
    while (node) {
      const nodeLength = node.textContent?.length || 0
      if (currentPos + nodeLength >= position) {
        const range = document.createRange()
        range.setStart(node, Math.min(position - currentPos, nodeLength))
        range.collapse(true)
        sel.removeAllRanges()
        sel.addRange(range)
        return
      }
      currentPos += nodeLength
      node = walker.nextNode()
    }
  }, [])

  // Build DOM nodes safely
  const buildContent = useCallback((text: string) => {
    const editor = editorRef.current
    if (!editor) return

    editor.textContent = ''

    if (!textHasVariables(text)) {
      editor.textContent = text
      return
    }

    const segments = parseTextSegments(text, vars)
    segments.forEach(seg => {
      if (seg.type === 'text') {
        // Wrap text in span with explicit color to prevent inheritance
        const textSpan = document.createElement('span')
        textSpan.textContent = seg.text
        textSpan.style.color = 'inherit'
        editor.appendChild(textSpan)
      } else {
        const span = document.createElement('span')
        span.textContent = `{{${seg.varName}}}`
        span.dataset.varName = seg.varName
        span.style.borderRadius = '2px'
        span.style.padding = '0 2px'
        if (seg.resolved) {
          span.style.color = 'rgb(56, 189, 248)'
          span.style.backgroundColor = 'rgba(56, 189, 248, 0.1)'
        } else {
          span.style.color = 'rgb(248, 113, 113)'
          span.style.backgroundColor = 'rgba(248, 113, 113, 0.1)'
        }
        editor.appendChild(span)
      }
    })
  }, [vars])

  // Handle mouse over for tooltip
  const handleMouseOver = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.dataset.varName) {
      cancelClose()
      isOverVarRef.current = true
      const rect = target.getBoundingClientRect()
      setTooltip({
        varName: target.dataset.varName,
        x: rect.left,
        y: rect.bottom,
      })
    }
  }, [cancelClose])

  const handleMouseOut = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.dataset.varName) {
      isOverVarRef.current = false
      scheduleClose()
    }
  }, [scheduleClose])

  // Add mouse event listeners
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    editor.addEventListener('mouseover', handleMouseOver)
    editor.addEventListener('mouseout', handleMouseOut)

    return () => {
      editor.removeEventListener('mouseover', handleMouseOver)
      editor.removeEventListener('mouseout', handleMouseOut)
    }
  }, [handleMouseOver, handleMouseOut])

  // Update DOM only when value changes externally (not while focused)
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    // Skip if we're the source of the change
    if (lastValueRef.current === value) return

    // Skip while composing
    if (isComposingRef.current) return

    // Check if this is a significant change (like cURL import)
    // If the current content is very different, rebuild even if focused
    const currentContent = editor.textContent || ''
    const isSignificantChange = Math.abs(currentContent.length - value.length) > 10 ||
      (value.length > 0 && currentContent.length === 0) ||
      (value.startsWith('http') && !currentContent.startsWith('http'))

    // Skip if focused and not a significant change
    if (document.activeElement === editor && !isSignificantChange) {
      lastValueRef.current = value
      return
    }

    lastValueRef.current = value
    buildContent(value)
  }, [value, buildContent])

  // Initial render
  useEffect(() => {
    if (value) {
      buildContent(value)
    }
  }, [value, buildContent])

  const handleInput = useCallback(() => {
    const editor = editorRef.current
    if (!editor || isComposingRef.current) return

    const text = editor.textContent || ''
    lastValueRef.current = text
    onChange(text)
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
    }
    onKeyDown?.(e as unknown as React.KeyboardEvent)
  }, [onKeyDown])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Call external handler first (for cURL detection etc.)
    if (externalOnPaste) {
      externalOnPaste(e as unknown as React.ClipboardEvent<HTMLInputElement>)
      // If the external handler prevented default, don't do our handling
      if (e.defaultPrevented) return
    }

    e.preventDefault()
    const editor = editorRef.current
    if (!editor) return

    const pastedText = e.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ')

    // Get current text and cursor position
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) {
      // No selection, just append
      const currentText = editor.textContent || ''
      const newText = currentText + pastedText
      lastValueRef.current = newText
      onChange(newText)
      buildContent(newText)
      return
    }

    // Get cursor position
    const range = sel.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(editor)
    preCaretRange.setEnd(range.startContainer, range.startOffset)
    const cursorPos = preCaretRange.toString().length

    // Build new text with paste inserted at cursor
    const currentText = editor.textContent || ''
    const beforeCursor = currentText.substring(0, cursorPos)
    const afterCursor = currentText.substring(range.toString().length > 0 ? cursorPos + range.toString().length : cursorPos)
    const newText = beforeCursor + pastedText + afterCursor

    // Update and rebuild
    lastValueRef.current = newText
    onChange(newText)
    buildContent(newText)

    // Set cursor after pasted text
    requestAnimationFrame(() => {
      const newCursorPos = cursorPos + pastedText.length
      setCursorPosition(editor, newCursorPos)
    })
  }, [onChange, buildContent, externalOnPaste, setCursorPosition])

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false
    handleInput()
  }, [handleInput])

  const handleBlur = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const text = editor.textContent || ''
    if (textHasVariables(text)) {
      buildContent(text)
    }
  }, [buildContent])

  return (
    <div className={cn("relative flex-1 min-w-0", className)}>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={handleBlur}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        data-placeholder={placeholder}
        className={cn(
          "w-full h-7 px-2 rounded-md border border-input bg-transparent",
          "outline-none",
          "font-mono text-sm whitespace-nowrap overflow-x-auto overflow-y-hidden scrollbar-none",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
        )}
        style={{
          lineHeight: '26px',
          minHeight: '28px',
          maxHeight: '28px',
        }}
      />

      {/* Variable edit tooltip */}
      {tooltip && (
        <VariableEditTooltip
          varName={tooltip.varName}
          position={{ x: tooltip.x, y: tooltip.y }}
          onMouseEnter={() => {
            cancelClose()
            isOverTooltipRef.current = true
          }}
          onMouseLeave={() => {
            isOverTooltipRef.current = false
            scheduleClose()
          }}
          onClose={() => setTooltip(null)}
        />
      )}
    </div>
  )
}
