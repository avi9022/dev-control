import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  MoreHorizontal,
  X,
  Loader2,
  PlugZap,
  Table2,
  Eye,
  Hash,
  Zap,
  FunctionSquare,
  Package,
  Timer,
  FileCode,
  Pencil,
  EyeOff,
} from 'lucide-react'
import { useState, useEffect, useCallback, type FC } from 'react'
import { useSQL } from '@/ui/contexts/sql'
import { cn } from '@/lib/utils'
import { AddConnectionDialog } from '../sql/AddConnectionDialog'
import { SchemaObjectContextMenu } from '../sql/SchemaObjectContextMenu'
import { TablesSectionContextMenu } from '../sql/TablesSectionContextMenu'
import { useViews } from '@/ui/contexts/views'
import { SearchInput } from '../Inputs/SearchInput'
import { SidebarPanel } from './SidebarPanel'

type SchemaObjectType = 'tables' | 'views' | 'sequences' | 'procedures' | 'functions' | 'packages' | 'triggers'

const SCHEMA_SECTIONS: { key: SchemaObjectType; label: string; icon: FC<{ className?: string }> }[] = [
  { key: 'tables', label: 'Tables', icon: Table2 },
  { key: 'views', label: 'Views', icon: Eye },
  { key: 'sequences', label: 'Sequences', icon: Hash },
  { key: 'procedures', label: 'Procedures', icon: Zap },
  { key: 'functions', label: 'Functions', icon: FunctionSquare },
  { key: 'packages', label: 'Packages', icon: Package },
  { key: 'triggers', label: 'Triggers', icon: Timer },
]

export const SQLMenu: FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set())
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [addConnectionOpen, setAddConnectionOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SQLConnectionConfig | null>(null)
  const [showSystemSchemas, setShowSystemSchemas] = useState(false)
  const { updateView } = useViews()

  const {
    connections,
    activeConnectionId,
    connectionState,
    isConnected,
    schemas,
    selectedSchema,
    tables,
    views: viewsList,
    sequences,
    procedures,
    functions,
    packages,
    triggers,
    loading,
    saveConnection,
    deleteConnection,
    testConnection,
    setActiveConnection,
    disconnect,
    selectSchema,
    refreshSchema,
    loadSchemas,
  } = useSQL()

  const status = connectionState?.status ?? null
  const isConnecting = status === 'connecting'

  const toggleConnection = (connId: string) => {
    setExpandedConnections((prev) => {
      const next = new Set(prev)
      if (next.has(connId)) next.delete(connId)
      else next.add(connId)
      return next
    })
  }

  const handleConnect = async (connId: string) => {
    await setActiveConnection(connId)
    setExpandedConnections((prev) => {
      const next = new Set(prev)
      next.add(connId)
      return next
    })
    updateView('sql' as never, null)
  }

  const handleDisconnect = async () => {
    await disconnect()
  }

  const toggleSchema = (schema: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev)
      if (next.has(schema)) next.delete(schema)
      else next.add(schema)
      return next
    })
    if (!expandedSchemas.has(schema)) {
      selectSchema(schema)
    }
  }

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleObjectClick = (objectName: string) => {
    updateView('sql' as never, objectName)
  }

  const handleDeleteConnection = async (conn: SQLConnectionConfig) => {
    const confirmed = window.confirm(`Delete connection "${conn.name}"?`)
    if (!confirmed) return
    if (conn.id === activeConnectionId) {
      await disconnect()
    }
    await deleteConnection(conn.id)
  }

  const getSchemaObjects = (section: SchemaObjectType): { name: string; extra?: string }[] => {
    switch (section) {
      case 'tables': return tables.map((t) => ({ name: t.name, extra: t.rowCount !== undefined ? `~${t.rowCount}` : undefined }))
      case 'views': return viewsList.map((v) => ({ name: v.name }))
      case 'sequences': return sequences.map((s) => ({ name: s.name }))
      case 'procedures': return procedures.map((p) => ({ name: p.name, extra: p.status }))
      case 'functions': return functions.map((f) => ({ name: f.name, extra: f.status }))
      case 'packages': return packages.map((p) => ({ name: p.name, extra: p.status }))
      case 'triggers': return triggers.map((t) => ({ name: t.name, extra: t.status }))
    }
  }

  const filteredObjects = (objects: { name: string; extra?: string }[]) => {
    if (!searchTerm) return objects
    return objects.filter((o) => o.name.toLowerCase().includes(searchTerm.toLowerCase()))
  }

  useEffect(() => {
    if (activeConnectionId && isConnected) {
      setExpandedConnections((prev) => {
        const next = new Set(prev)
        next.add(activeConnectionId)
        return next
      })
    }
  }, [activeConnectionId, isConnected])

  useEffect(() => {
    if (selectedSchema) {
      setExpandedSchemas((prev) => {
        const next = new Set(prev)
        next.add(selectedSchema)
        return next
      })
      // Auto-expand Tables section for the selected schema
      setExpandedSections((prev) => {
        const next = new Set(prev)
        next.add(`${selectedSchema}-tables`)
        return next
      })
    }
  }, [selectedSchema])

  const handleToggleSystemSchemas = useCallback(() => {
    const next = !showSystemSchemas
    setShowSystemSchemas(next)
    loadSchemas(next)
  }, [showSystemSchemas, loadSchemas])

  return (
    <SidebarPanel
      header={
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase font-medium tracking-wider">
              SQL Developer ({connections.length})
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setAddConnectionOpen(true)}
                title="Add new connection"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <SearchInput
            placeholder="Search objects..."
            value={searchTerm}
            onChange={(ev) => setSearchTerm(ev.target.value)}
            onClear={() => setSearchTerm('')}
          />
        </div>
      }
      footer={isConnected ? (
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshSchema}
            disabled={loading}
            className="h-7 flex items-center gap-2 text-[11px]"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </Button>
          <span className="text-xs text-muted-foreground">
            {connectionState?.serverVersion ?? ''}
          </span>
        </div>
      ) : undefined}
    >
      <div className="px-2">
        {connections.length === 0 && (
          <div className="px-3 py-8 text-sm text-muted-foreground text-center">
            No connections yet. Click + to add one.
          </div>
        )}

        {connections.map((conn) => {
          const isActive = conn.id === activeConnectionId
          const connIsConnected = isActive && isConnected
          const connIsConnecting = isActive && isConnecting
          const connIsError = isActive && connectionState?.status === 'error'
          const isExpanded = expandedConnections.has(conn.id)

          return (
            <div key={conn.id}>
              {/* Connection Row */}
              <div
                className={cn(
                  'group w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md hover:bg-accent',
                  connIsConnected && 'text-foreground',
                  !connIsConnected && !connIsConnecting && 'text-muted-foreground'
                )}
              >
                <button
                  onClick={() => connIsConnected ? toggleConnection(conn.id) : undefined}
                  className="flex items-center gap-1.5 flex-1 min-w-0"
                  disabled={!connIsConnected}
                >
                  {connIsConnected && isExpanded
                    ? <ChevronDown className="h-3 w-3 flex-shrink-0" />
                    : <ChevronRight className={cn('h-3 w-3 flex-shrink-0', !connIsConnected && 'opacity-40')} />
                  }
                  <div
                    className={cn(
                      'h-2.5 w-2.5 rounded-full flex-shrink-0',
                      connIsConnecting && 'animate-pulse'
                    )}
                    style={{
                      backgroundColor: connIsConnected
                        ? '#22c55e'
                        : connIsError
                          ? '#ef4444'
                          : conn.color ?? '#c74634'
                    }}
                  />
                  <PlugZap className={cn(
                    'h-4 w-4 flex-shrink-0',
                    connIsConnected && 'text-green-500',
                    connIsError && 'text-destructive',
                    connIsConnecting && 'text-muted-foreground animate-pulse',
                    !isActive && 'text-muted-foreground'
                  )} />
                  <span className="truncate">{conn.name}</span>
                </button>

                {!connIsConnected && !connIsConnecting && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs flex-shrink-0"
                    onClick={() => handleConnect(conn.id)}
                  >
                    Connect
                  </Button>
                )}

                {connIsConnecting && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />
                )}

                {connIsConnected && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 flex-shrink-0"
                    onClick={handleDisconnect}
                    title="Disconnect"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="h-6 w-6 p-0 flex items-center justify-center rounded hover:bg-muted opacity-0 group-hover:opacity-100 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {!connIsConnected && (
                      <DropdownMenuItem onClick={() => handleConnect(conn.id)}>
                        <PlugZap className="h-4 w-4 mr-2" />
                        Connect
                      </DropdownMenuItem>
                    )}
                    {connIsConnected && (
                      <DropdownMenuItem onClick={handleDisconnect}>
                        <X className="h-4 w-4 mr-2" />
                        Disconnect
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => { setEditingConnection(conn); setAddConnectionOpen(true) }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Connection
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleDeleteConnection(conn)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove connection
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Error */}
              {connIsError && (
                <div className="pl-9 pr-2 py-1">
                  <p className="text-xs text-destructive truncate">
                    {connectionState?.error ?? 'Connection failed'}
                  </p>
                </div>
              )}

              {/* Schemas tree */}
              {connIsConnected && isExpanded && (
                <div className="ml-3">
                  <div className="flex items-center justify-between pl-4 pr-2 py-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Schemas
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        className={cn('h-5 w-5 flex items-center justify-center rounded hover:bg-muted', showSystemSchemas && 'bg-muted')}
                        onClick={handleToggleSystemSchemas}
                        title={showSystemSchemas ? 'Hide system schemas' : 'Show system schemas'}
                      >
                        {showSystemSchemas
                          ? <Eye className="h-3 w-3 text-muted-foreground" />
                          : <EyeOff className="h-3 w-3 text-muted-foreground" />
                        }
                      </button>
                      <button
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
                        onClick={refreshSchema}
                        title="Refresh"
                      >
                        <RefreshCw className={cn('h-3 w-3 text-muted-foreground', loading && 'animate-spin')} />
                      </button>
                    </div>
                  </div>

                  {loading && schemas.length === 0 && (
                    <div className="flex items-center gap-2 pl-6 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </div>
                  )}

                  {schemas.map((schema) => {
                    const isSchemaExpanded = expandedSchemas.has(schema)
                    const isSelected = selectedSchema === schema

                    return (
                      <div key={schema}>
                        <div
                          className={cn(
                            'group w-full flex items-center gap-1.5 pl-4 pr-2 py-1.5 text-sm rounded-md hover:bg-accent',
                            isSelected && 'bg-accent'
                          )}
                        >
                          <button
                            onClick={() => toggleSchema(schema)}
                            className="flex items-center gap-1.5 flex-1 min-w-0"
                          >
                            {isSchemaExpanded
                              ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            }
                            <FileCode className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate text-xs">{schema}</span>
                          </button>
                        </div>

                        {/* Schema object sections */}
                        {isSchemaExpanded && isSelected && (
                          <div className="ml-4">
                            {SCHEMA_SECTIONS.map(({ key, label, icon: Icon }) => {
                              const objects = getSchemaObjects(key)
                              const filtered = filteredObjects(objects)
                              const sectionKey = `${schema}-${key}`
                              const isSectionExpanded = expandedSections.has(sectionKey)

                              const sectionButton = (
                                <button
                                  className="w-full flex items-center gap-1.5 pl-4 pr-2 py-1 text-xs rounded-md hover:bg-accent"
                                  onClick={() => toggleSection(sectionKey)}
                                >
                                  {isSectionExpanded
                                    ? <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
                                    : <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
                                  }
                                  <Icon className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">{label}</span>
                                  <span className="ml-auto text-[10px] text-muted-foreground">
                                    {objects.length}
                                  </span>
                                </button>
                              )

                              return (
                                <div key={key}>
                                  {key === 'tables' ? (
                                    <TablesSectionContextMenu schema={schema} tables={tables}>
                                      {sectionButton}
                                    </TablesSectionContextMenu>
                                  ) : (
                                    sectionButton
                                  )}

                                  {isSectionExpanded && filtered.map((obj) => (
                                    <SchemaObjectContextMenu
                                      key={obj.name}
                                      objectName={obj.name}
                                      objectType={key}
                                      schema={schema}
                                    >
                                      <button
                                        className="w-full flex items-center gap-1.5 pl-12 pr-2 py-1 text-xs rounded-md hover:bg-accent"
                                        onClick={() => key === 'tables' ? handleObjectClick(`table:${schema}.${obj.name}`) : handleObjectClick(obj.name)}
                                      >
                                        <span className="truncate">{obj.name}</span>
                                        {obj.extra && (
                                          <span className={cn(
                                            'ml-auto text-[10px] flex-shrink-0',
                                            obj.extra === 'INVALID' ? 'text-red-400' :
                                            obj.extra === 'DISABLED' ? 'text-amber-400' : 'text-muted-foreground'
                                          )}>
                                            {obj.extra}
                                          </span>
                                        )}
                                      </button>
                                    </SchemaObjectContextMenu>
                                  ))}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Dialog */}
      <AddConnectionDialog
        open={addConnectionOpen}
        onOpenChange={(v) => { setAddConnectionOpen(v); if (!v) setEditingConnection(null) }}
        onSave={saveConnection}
        onTest={testConnection}
        onActivate={setActiveConnection}
        editConnection={editingConnection}
      />
    </SidebarPanel>
  )
}
