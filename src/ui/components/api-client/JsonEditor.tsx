import { useState, useCallback, useMemo, useRef, useEffect, type FC } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { cn } from '@/lib/utils'
import { AlertCircle, Check, Pencil, Eye, WrapText, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { JsonViewer } from './JsonViewer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useVariableMap } from './VariableHighlight'
import { VariableEditPopup } from './VariableEditPopup'

// Configure custom theme matching app colors
loader.init().then((monaco) => {
  monaco.editor.defineTheme('dev-control-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'string.key.json', foreground: '93c5fd' },        // Light blue for keys
      { token: 'string.value.json', foreground: 'fde68a' },      // Yellow for string values
      { token: 'number', foreground: 'a5b4fc' },                 // Indigo for numbers
      { token: 'keyword', foreground: 'f9a8d4' },                // Pink for true/false/null
      { token: 'delimiter', foreground: '9ca3af' },              // Gray for brackets/commas
      { token: 'string', foreground: 'fde68a' },                 // Yellow for strings
    ],
    colors: {
      'editor.background': '#1c1f26',                            // Match card background
      'editor.foreground': '#f9fafb',                            // Light text
      'editor.lineHighlightBackground': '#ffffff08',             // Subtle line highlight
      'editor.selectionBackground': '#3b82f640',                 // Blue selection
      'editorLineNumber.foreground': '#6b7280',                  // Gray line numbers
      'editorLineNumber.activeForeground': '#d1d5db',            // Lighter active line number
      'editorIndentGuide.background': '#374151',                 // Indent guides
      'editorIndentGuide.activeBackground': '#6b7280',           // Active indent guide
      'editorBracketMatch.background': '#3b82f630',              // Bracket match background
      'editorBracketMatch.border': '#3b82f6',                    // Bracket match border
      'editorBracketHighlight.foreground1': '#60a5fa',           // Bracket color 1 (blue)
      'editorBracketHighlight.foreground2': '#f472b6',           // Bracket color 2 (pink)
      'editorBracketHighlight.foreground3': '#a78bfa',           // Bracket color 3 (purple)
      'editorBracketHighlight.foreground4': '#34d399',           // Bracket color 4 (green)
      'editorBracketPairGuide.activeBackground1': '#60a5fa50',   // Active bracket guide 1
      'editorBracketPairGuide.activeBackground2': '#f472b650',   // Active bracket guide 2
      'editorBracketPairGuide.activeBackground3': '#a78bfa50',   // Active bracket guide 3
      'editorBracketPairGuide.background1': '#60a5fa20',         // Bracket guide 1
      'editorBracketPairGuide.background2': '#f472b620',         // Bracket guide 2
      'editorBracketPairGuide.background3': '#a78bfa20',         // Bracket guide 3
      'scrollbar.shadow': '#00000000',                           // No scrollbar shadow
      'scrollbarSlider.background': '#ffffff15',                 // Scrollbar
      'scrollbarSlider.hoverBackground': '#ffffff25',            // Scrollbar hover
      'scrollbarSlider.activeBackground': '#ffffff35',           // Scrollbar active
    }
  })
})

interface JsonEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export const JsonEditor: FC<JsonEditorProps> = ({
  value,
  onChange,
  className,
}) => {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const { vars } = useVariableMap()
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const decorationsRef = useRef<string[]>([])

  // Variable edit popup state
  const [editPopup, setEditPopup] = useState<{
    varName: string
    x: number
    y: number
  } | null>(null)
  const isOverPopup = useRef(false)
  const closeTimeout = useRef<NodeJS.Timeout | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current)
      closeTimeout.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimeout.current = setTimeout(() => {
      if (!isOverPopup.current) {
        setEditPopup(null)
      }
    }, 150)
  }, [cancelClose])

  // Update variable decorations when value changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return

    const model = editorRef.current.getModel()
    if (!model) return

    const decorations: Monaco.editor.IModelDeltaDecoration[] = []
    const varRegex = /\{\{([^}]+)\}\}/g
    const lines = value.split('\n')

    lines.forEach((line, lineIdx) => {
      let match
      while ((match = varRegex.exec(line)) !== null) {
        const varName = match[1]
        const resolved = vars.has(varName)
        decorations.push({
          range: new monacoRef.current!.Range(
            lineIdx + 1,
            match.index + 1,
            lineIdx + 1,
            match.index + match[0].length + 1
          ),
          options: {
            inlineClassName: resolved ? 'variable-resolved' : 'variable-unresolved',
          }
        })
      }
    })

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      decorations
    )
  }, [value, vars])

  const handleEditorMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Add CSS for variable highlighting
    const styleEl = document.getElementById('monaco-variable-styles') || document.createElement('style')
    styleEl.id = 'monaco-variable-styles'
    styleEl.textContent = `
      .variable-resolved {
        color: #38bdf8 !important;
        background-color: rgba(56, 189, 248, 0.15);
        border-radius: 2px;
        font-style: italic;
      }
      .variable-unresolved {
        color: #f87171 !important;
        background-color: rgba(248, 113, 113, 0.15);
        border-radius: 2px;
        font-style: italic;
      }
    `
    if (!document.getElementById('monaco-variable-styles')) {
      document.head.appendChild(styleEl)
    }

    // Track current hovered variable to prevent re-rendering
    let currentHoveredVar: string | null = null

    // Add hover listener for variables
    editor.onMouseMove((e) => {
      if (e.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT) {
        // Not over text, schedule close if not over popup
        if (currentHoveredVar && !isOverPopup.current) {
          currentHoveredVar = null
          scheduleClose()
        }
        return
      }

      const position = e.target.position
      if (!position) return

      const model = editor.getModel()
      if (!model) return

      const line = model.getLineContent(position.lineNumber)
      const varRegex = /\{\{([^}]+)\}\}/g
      let match
      let foundVar: string | null = null

      while ((match = varRegex.exec(line)) !== null) {
        const startCol = match.index + 1
        const endCol = match.index + match[0].length + 1

        if (position.column >= startCol && position.column <= endCol) {
          foundVar = match[1]
          break
        }
      }

      if (foundVar) {
        // Only update if hovering over a different variable
        if (foundVar !== currentHoveredVar) {
          currentHoveredVar = foundVar
          cancelClose()

          // Get screen position for popup - use variable start position, not mouse
          const editorDomNode = editor.getDomNode()
          if (!editorDomNode) return

          const rect = editorDomNode.getBoundingClientRect()
          const scrollTop = editor.getScrollTop()
          const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight)
          const top = rect.top + (position.lineNumber - 1) * lineHeight - scrollTop + lineHeight + 8

          // Calculate x position based on where the variable starts in the line
          const charWidth = 7.2 // Approximate char width for monospace font size 12
          const gutterWidth = 50 // Approximate gutter width (line numbers)
          const varStartInLine = line.indexOf(`{{${foundVar}}}`)
          const x = rect.left + gutterWidth + (varStartInLine * charWidth)

          setEditPopup({
            varName: foundVar,
            x: Math.max(rect.left + 10, x),
            y: top
          })
        }
      } else {
        // Not over a variable
        if (currentHoveredVar && !isOverPopup.current) {
          currentHoveredVar = null
          scheduleClose()
        }
      }
    })

    // Close popup when mouse leaves editor area
    editor.onMouseLeave(() => {
      currentHoveredVar = null
      if (!isOverPopup.current) {
        scheduleClose()
      }
    })
  }, [vars, cancelClose, scheduleClose])

  // Replace {{variables}} with placeholder strings for JSON validation
  // Don't add quotes - variables are usually already inside quoted strings
  const valueForValidation = useMemo(() => {
    return value.replace(/\{\{[^}]+\}\}/g, '__VAR__')
  }, [value])

  const hasVariables = useMemo(() => /\{\{[^}]+\}\}/.test(value), [value])

  const jsonError = useMemo(() => {
    if (!value.trim()) return null
    try {
      JSON.parse(valueForValidation)
      return null
    } catch (e) {
      return (e as Error).message
    }
  }, [value, valueForValidation])

  const isValidJson = !jsonError && value.trim().length > 0

  const handleFormat = useCallback(() => {
    try {
      // Extract variables and their unique IDs
      const variables: string[] = []
      let tempValue = value

      // Replace each variable with a unique placeholder (without extra quotes)
      tempValue = tempValue.replace(/\{\{([^}]+)\}\}/g, (match) => {
        const idx = variables.length
        variables.push(match)
        return `__VAR_PLACEHOLDER_${idx}__`
      })

      // Format the JSON
      let formatted = JSON.stringify(JSON.parse(tempValue), null, 2)

      // Restore variables
      variables.forEach((varMatch, i) => {
        formatted = formatted.replace(`__VAR_PLACEHOLDER_${i}__`, varMatch)
      })

      onChange(formatted)
    } catch {
      // Invalid JSON - can't format
    }
  }, [value, onChange])

  const handleMinify = useCallback(() => {
    try {
      // Extract variables and their unique IDs
      const variables: string[] = []
      let tempValue = value

      // Replace each variable with a unique placeholder (without extra quotes)
      tempValue = tempValue.replace(/\{\{([^}]+)\}\}/g, (match) => {
        const idx = variables.length
        variables.push(match)
        return `__VAR_PLACEHOLDER_${idx}__`
      })

      // Minify the JSON
      let minified = JSON.stringify(JSON.parse(tempValue))

      // Restore variables
      variables.forEach((varMatch, i) => {
        minified = minified.replace(`__VAR_PLACEHOLDER_${i}__`, varMatch)
      })

      onChange(minified)
    } catch {
      // Invalid JSON - can't minify
    }
  }, [value, onChange])

  const handleEditorChange = useCallback((newValue: string | undefined) => {
    onChange(newValue ?? '')
  }, [onChange])

  return (
    <div className={cn("flex flex-col gap-1.5 flex-1 min-h-0", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5">
          <Button
            variant={mode === 'edit' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={() => setMode('edit')}
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
          <Button
            variant={mode === 'preview' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={() => setMode('preview')}
            disabled={!isValidJson}
            title={!isValidJson ? 'Fix JSON errors to preview' : 'Preview with collapse'}
          >
            <Eye className="h-3 w-3" />
            Preview
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={handleMinify}
            disabled={!isValidJson}
            title="Minify JSON"
          >
            <Minimize2 className="h-3 w-3" />
            Minify
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={handleFormat}
            disabled={!isValidJson}
            title="Format JSON"
          >
            <WrapText className="h-3 w-3" />
            Format
          </Button>
        </div>
      </div>

      {/* Editor / Preview */}
      {mode === 'edit' ? (
        <div
          className={cn(
            "rounded-md border overflow-hidden flex-1 min-h-0 relative",
            jsonError && value.trim() && "border-red-500/50"
          )}
        >
          <div className="absolute inset-0">
            <Editor
              height="100%"
              defaultLanguage="json"
              value={value}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              theme="dev-control-dark"
              options={{
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              lineNumbersMinChars: 3,
              folding: true,
              foldingHighlight: true,
              foldingStrategy: 'indentation',
              showFoldingControls: 'always',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              wrappingIndent: 'indent',
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
              formatOnPaste: true,
              // Bracket pair colorization and guides
              bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: true },
              guides: {
                bracketPairs: 'active',       // Show guides for active bracket pair
                bracketPairsHorizontal: true, // Horizontal guides
                highlightActiveBracketPair: true,
                indentation: true,
                highlightActiveIndentation: true,
              },
              matchBrackets: 'always',        // Always highlight matching brackets
              padding: { top: 8, bottom: 8 },
              scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              renderLineHighlight: 'line',
              contextmenu: true,
              quickSuggestions: false,
              suggestOnTriggerCharacters: false,
              acceptSuggestionOnEnter: 'off',
              tabCompletion: 'off',
              parameterHints: { enabled: false },
            }}
          />
          </div>
        </div>
      ) : (
        <div
          className="rounded-md border bg-background overflow-auto flex-1 min-h-0"
        >
          <ScrollArea className="h-full">
            <div className="p-3">
              <JsonViewer data={value} maxInitialDepth={10} />
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between px-0.5 flex-shrink-0">
        {jsonError && value.trim() ? (
          <div className="flex items-center gap-1.5 text-[10px] text-red-400">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{jsonError}</span>
          </div>
        ) : isValidJson ? (
          <div className="flex items-center gap-1.5 text-[10px] text-green-500">
            <Check className="h-3 w-3" />
            <span>{hasVariables ? 'Valid JSON (with variables)' : 'Valid JSON'}</span>
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground">
            Enter JSON...
          </div>
        )}
      </div>

      {/* Variable edit popup */}
      {editPopup && (
        <VariableEditPopup
          varName={editPopup.varName}
          position={{ x: editPopup.x, y: editPopup.y }}
          onClose={() => setEditPopup(null)}
          onMouseEnter={() => {
            cancelClose()
            isOverPopup.current = true
          }}
          onMouseLeave={() => {
            isOverPopup.current = false
            scheduleClose()
          }}
        />
      )}
    </div>
  )
}
