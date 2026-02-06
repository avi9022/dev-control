import { useEffect, useRef, useCallback, type FC } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import { sql, MSSQL } from '@codemirror/lang-sql'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'

interface SQLEditorProps {
  value: string
  onChange: (value: string) => void
  onExecute: (sql: string) => void
  onExecuteScript: (sql: string) => void
  tables?: string[]
  columnMap?: Record<string, string[]>
  className?: string
}

const oracleTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
    fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
  },
  '.cm-content': {
    caretColor: '#56d4dd',
  },
  '.cm-cursor': {
    borderLeftColor: '#56d4dd',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#264f78 !important',
  },
  '.cm-gutters': {
    backgroundColor: '#1a1b1e',
    borderRight: '1px solid #2d2d2d',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#252629',
  },
  '.cm-activeLine': {
    backgroundColor: '#1e1f23',
  },
})

function getCurrentStatement(view: EditorView): string {
  const doc = view.state.doc.toString()
  const cursor = view.state.selection.main.head

  const selection = view.state.sliceDoc(
    view.state.selection.main.from,
    view.state.selection.main.to
  )
  if (selection.trim()) return selection.trim()

  let start = 0
  let end = doc.length

  const beforeCursor = doc.slice(0, cursor)
  const lastSemicolon = beforeCursor.lastIndexOf(';')
  if (lastSemicolon !== -1) {
    start = lastSemicolon + 1
  }

  const afterCursor = doc.slice(cursor)
  const nextSemicolon = afterCursor.indexOf(';')
  if (nextSemicolon !== -1) {
    end = cursor + nextSemicolon
  }

  return doc.slice(start, end).trim()
}

function buildSchema(tables: string[], columnMap: Record<string, string[]>): Record<string, string[]> {
  const schema: Record<string, string[]> = {}
  for (const t of tables) {
    schema[t] = columnMap[t] ?? []
  }
  return schema
}

export const SQLEditor: FC<SQLEditorProps> = ({
  value,
  onChange,
  onExecute,
  onExecuteScript,
  tables = [],
  columnMap = {},
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const sqlCompartmentRef = useRef(new Compartment())
  const onExecuteRef = useRef(onExecute)
  const onExecuteScriptRef = useRef(onExecuteScript)
  const onChangeRef = useRef(onChange)

  onExecuteRef.current = onExecute
  onExecuteScriptRef.current = onExecuteScript
  onChangeRef.current = onChange

  const executeKeybinding = useCallback(() => {
    return keymap.of([
      {
        key: 'Ctrl-Enter',
        mac: 'Cmd-Enter',
        run: (view) => {
          const stmt = getCurrentStatement(view)
          if (stmt) onExecuteRef.current(stmt)
          return true
        },
      },
      {
        key: 'F5',
        run: (view) => {
          const fullText = view.state.doc.toString().trim()
          if (fullText) onExecuteScriptRef.current(fullText)
          return true
        },
      },
    ])
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const schema = buildSchema(tables, columnMap)
    const sqlCompartment = sqlCompartmentRef.current

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        foldGutter(),
        highlightSelectionMatches(),
        autocompletion(),
        sqlCompartment.of(sql({ dialect: MSSQL, schema, upperCaseKeywords: true })),
        oneDark,
        oracleTheme,
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        executeKeybinding(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...completionKeymap, ...foldKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dynamically update SQL schema (tables + columns) without recreating editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const schema = buildSchema(tables, columnMap)
    view.dispatch({
      effects: sqlCompartmentRef.current.reconfigure(
        sql({ dialect: MSSQL, schema, upperCaseKeywords: true })
      ),
    })
  }, [tables, columnMap])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const currentContent = view.state.doc.toString()
    if (currentContent !== value) {
      view.dispatch({
        changes: { from: 0, to: currentContent.length, insert: value },
      })
    }
  }, [value])

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto ${className}`}
    />
  )
}
