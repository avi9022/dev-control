import { useEffect, useRef, useCallback, type FC } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import { sql, PLSQL } from '@codemirror/lang-sql'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap, type CompletionContext, type Completion } from '@codemirror/autocomplete'
import { bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'

interface SQLEditorProps {
  value: string
  onChange: (value: string) => void
  onExecute: (sql: string) => void
  onExecuteScript: (sql: string) => void
  tables?: string[]
  columnMap?: Record<string, string[]>
  selectedSchema?: string | null
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

function buildSchemaSpec(
  tables: string[],
  columnMap: Record<string, string[]>,
  schemaName?: string | null,
) {
  const tableSpec: Record<string, readonly string[]> = {}
  for (const t of tables) {
    tableSpec[t] = columnMap[t] ?? []
  }

  if (schemaName) {
    return {
      schema: { [schemaName]: tableSpec } as Record<string, Record<string, readonly string[]>>,
      defaultSchema: schemaName,
    }
  }

  return { schema: tableSpec, defaultSchema: undefined }
}

/**
 * Extract table names referenced in the current SQL statement.
 * Matches: FROM table, JOIN table, UPDATE table, INTO table
 * Handles: "SCHEMA"."TABLE", SCHEMA.TABLE, "TABLE", TABLE
 */
function extractReferencedTables(statement: string): Set<string> {
  const tables = new Set<string>()
  const pattern = /\b(?:FROM|JOIN|UPDATE|INTO)\s+(?:"[^"]*"\s*\.\s*)?(?:"([^"]+)"|(\w+))/gi
  let m
  while ((m = pattern.exec(statement)) !== null) {
    const name = (m[1] ?? m[2]).toUpperCase()
    tables.add(name)
  }
  return tables
}

/** Find the current statement boundaries around the cursor */
function getStatementAt(doc: string, cursor: number): string {
  let start = 0
  let end = doc.length
  const lastSemi = doc.lastIndexOf(';', cursor - 1)
  if (lastSemi !== -1) start = lastSemi + 1
  const nextSemi = doc.indexOf(';', cursor)
  if (nextSemi !== -1) end = nextSemi
  return doc.slice(start, end)
}

/** Context-aware completion source: only columns from tables in the current query */
function columnCompletionSource(colMap: Record<string, string[]>) {
  return PLSQL.language.data.of({
    autocomplete: (context: CompletionContext) => {
      if (context.matchBefore(/\.\w*/)) return null
      const word = context.matchBefore(/\w+/)
      if (!word && !context.explicit) return null

      const doc = context.state.doc.toString()
      const stmt = getStatementAt(doc, context.pos)
      const referencedTables = extractReferencedTables(stmt)

      if (referencedTables.size === 0) return null

      const completions: Completion[] = []
      for (const table of referencedTables) {
        const cols = colMap[table]
        if (!cols) continue
        for (const col of cols) {
          completions.push({ label: col, type: 'property', detail: table, boost: -1 })
        }
      }

      if (completions.length === 0) return null
      return { from: word.from, options: completions, validFor: /^\w*$/ }
    },
  })
}

export const SQLEditor: FC<SQLEditorProps> = ({
  value,
  onChange,
  onExecute,
  onExecuteScript,
  tables = [],
  columnMap = {},
  selectedSchema,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const sqlCompartmentRef = useRef(new Compartment())
  const colCompartmentRef = useRef(new Compartment())
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

    const { schema, defaultSchema } = buildSchemaSpec(tables, columnMap, selectedSchema)

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
        sqlCompartmentRef.current.of(sql({ dialect: PLSQL, schema, defaultSchema, upperCaseKeywords: true })),
        colCompartmentRef.current.of(columnCompletionSource(columnMap)),
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

  // Dynamically update SQL schema + column completions without recreating editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const { schema, defaultSchema } = buildSchemaSpec(tables, columnMap, selectedSchema)
    view.dispatch({
      effects: [
        sqlCompartmentRef.current.reconfigure(
          sql({ dialect: PLSQL, schema, defaultSchema, upperCaseKeywords: true })
        ),
        colCompartmentRef.current.reconfigure(
          columnCompletionSource(columnMap)
        ),
      ],
    })
  }, [tables, columnMap, selectedSchema])

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
