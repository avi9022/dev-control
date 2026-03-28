import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  RefreshCw,
  Database,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Plus,
  Trash2,
  MoreHorizontal,
  Pencil,
  X,
  Loader2,
  PlugZap,
} from "lucide-react"
import { useState, useEffect, type FC } from "react"
import { useMongoDB } from "@/ui/contexts/mongodb"
import { cn } from "@/lib/utils"
import { SearchInput } from "../Inputs/SearchInput"
import { SidebarPanel } from "./SidebarPanel"
import { AddConnectionDialog } from "./AddConnectionDialog"
import { CreateDatabaseDialog } from "./CreateDatabaseDialog"
import { CreateCollectionDialog } from "./CreateCollectionDialog"
import { RenameCollectionDialog } from "./RenameCollectionDialog"

// ─── Main Component ───

export const MongoDBMenu: FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set())
  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(new Set())
  const [addConnectionOpen, setAddConnectionOpen] = useState(false)
  const [createDbOpen, setCreateDbOpen] = useState(false)
  const [createCollDb, setCreateCollDb] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ db: string; collection: string } | null>(null)

  const {
    connections,
    activeConnectionId,
    connectionState,
    isConnected,
    databases,
    selectedDatabase,
    selectedCollection,
    loading,
    saveConnection,
    deleteConnection,
    testConnection,
    setActiveConnection,
    disconnect,
    refreshDatabases,
    selectDatabase,
    selectCollection,
    createDatabase,
    dropDatabase,
    createCollection,
    dropCollection,
    renameCollection,
  } = useMongoDB()

  const status = connectionState?.status ?? null
  const isConnecting = status === 'connecting'

  const toggleConnection = (connId: string) => {
    const next = new Set(expandedConnections)
    if (next.has(connId)) {
      next.delete(connId)
    } else {
      next.add(connId)
    }
    setExpandedConnections(next)
  }

  const handleConnect = async (connId: string) => {
    await setActiveConnection(connId)
    setExpandedConnections((prev) => {
      const next = new Set(prev)
      next.add(connId)
      return next
    })
  }

  const handleDisconnect = async () => {
    await disconnect()
  }

  const toggleDatabase = (dbName: string) => {
    const next = new Set(expandedDatabases)
    if (next.has(dbName)) {
      next.delete(dbName)
    } else {
      next.add(dbName)
    }
    setExpandedDatabases(next)

    if (!expandedDatabases.has(dbName)) {
      selectDatabase(dbName)
    }
  }

  const handleCollectionClick = (dbName: string, collectionName: string) => {
    if (selectedDatabase !== dbName) {
      selectDatabase(dbName)
    }
    selectCollection(collectionName)
  }

  const handleDropDatabase = async (dbName: string) => {
    const confirmed = window.confirm(`Are you sure you want to drop database "${dbName}"? This action cannot be undone.`)
    if (!confirmed) return
    try {
      await dropDatabase(dbName)
    } catch {
      // Error handled by context
    }
  }

  const handleDropCollection = async (dbName: string, collName: string) => {
    const confirmed = window.confirm(`Are you sure you want to drop collection "${collName}"? This action cannot be undone.`)
    if (!confirmed) return
    try {
      await dropCollection(dbName, collName)
    } catch {
      // Error handled by context
    }
  }

  const handleDeleteConnection = async (conn: MongoConnectionConfig) => {
    const confirmed = window.confirm(`Delete connection "${conn.name}"?`)
    if (!confirmed) return
    if (conn.id === activeConnectionId) {
      await disconnect()
    }
    await deleteConnection(conn.id)
  }

  const getFilteredDatabases = () => {
    if (!searchTerm) return databases
    return databases
      .map((db) => ({
        ...db,
        collections: db.collections.filter((col) =>
          col.name.toLowerCase().includes(searchTerm.toLowerCase())
        ),
      }))
      .filter(
        (db) =>
          db.collections.length > 0 ||
          db.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
  }

  const filteredDatabases = getFilteredDatabases()

  // Auto-expand connected connection
  useEffect(() => {
    if (activeConnectionId && isConnected) {
      setExpandedConnections((prev) => {
        const next = new Set(prev)
        next.add(activeConnectionId)
        return next
      })
    }
  }, [activeConnectionId, isConnected])

  return (
    <SidebarPanel
      header={
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase font-medium tracking-wider">
              Connections ({connections.length})
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="More options">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setAddConnectionOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add new connection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <SearchInput
            placeholder="Search connections..."
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
            onClick={refreshDatabases}
            disabled={loading}
            className="h-7 flex items-center gap-2 text-[11px]"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <span className="text-xs text-muted-foreground">
            {databases.length} db, {databases.reduce((sum, db) => sum + db.collections.length, 0)} col
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
                  "group w-full flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md hover:bg-accent",
                  connIsConnected && "text-foreground",
                  !connIsConnected && !connIsConnecting && "text-muted-foreground"
                )}
              >
                <button
                  onClick={() => {
                    if (connIsConnected) {
                      toggleConnection(conn.id)
                    }
                  }}
                  className="flex items-center gap-1.5 flex-1 min-w-0"
                  disabled={!connIsConnected}
                >
                  {connIsConnected && isExpanded
                    ? <ChevronDown className="h-3 w-3 flex-shrink-0" />
                    : <ChevronRight className={cn("h-3 w-3 flex-shrink-0", !connIsConnected && "opacity-40")} />
                  }
                  <PlugZap className={cn(
                    "h-4 w-4 flex-shrink-0",
                    connIsConnected && "text-status-green",
                    connIsError && "text-destructive",
                    connIsConnecting && "text-muted-foreground animate-pulse",
                    !isActive && "text-muted-foreground"
                  )} />
                  <span className="truncate">{conn.name}</span>
                </button>

                {/* Connect button for disconnected connections */}
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

                {/* Connecting spinner */}
                {connIsConnecting && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />
                )}

                {/* Disconnect button for connected */}
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

                {/* 3-dot menu for connection */}
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

              {/* Error message */}
              {connIsError && (
                <div className="pl-9 pr-2 py-1">
                  <p className="text-xs text-destructive truncate">
                    {connectionState?.error ?? 'Connection failed'}
                  </p>
                </div>
              )}

              {/* Databases under connected connection */}
              {connIsConnected && isExpanded && (
                <div className="ml-3">
                  {/* Databases header with actions */}
                  <div className="flex items-center justify-between pl-4 pr-2 py-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Databases
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
                        onClick={() => setCreateDbOpen(true)}
                        title="Create database"
                      >
                        <Plus className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted"
                        onClick={refreshDatabases}
                        title="Refresh databases"
                      >
                        <RefreshCw className={cn("h-3 w-3 text-muted-foreground", loading && "animate-spin")} />
                      </button>
                    </div>
                  </div>

                  {loading && databases.length === 0 && (
                    <div className="flex items-center gap-2 pl-6 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading...
                    </div>
                  )}

                  {!loading && filteredDatabases.length === 0 && (
                    <div className="pl-6 py-2 text-xs text-muted-foreground">
                      {searchTerm ? 'No matches' : 'No databases found'}
                    </div>
                  )}

                  {filteredDatabases.map((db) => {
                    const isDbExpanded = expandedDatabases.has(db.name)
                    const isDbSelected = selectedDatabase === db.name

                    return (
                      <div key={db.name}>
                        {/* Database row */}
                        <div
                          className={cn(
                            "group w-full flex items-center gap-1.5 pl-4 pr-2 py-1.5 text-sm rounded-md hover:bg-accent",
                            isDbSelected && "bg-accent"
                          )}
                        >
                          <button
                            onClick={() => toggleDatabase(db.name)}
                            className="flex items-center gap-1.5 flex-1 min-w-0"
                          >
                            {isDbExpanded
                              ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            }
                            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate text-xs">{db.name}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">
                              {db.collections.length}
                            </span>
                          </button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="h-5 w-5 p-0 flex items-center justify-center rounded hover:bg-muted opacity-0 group-hover:opacity-100 flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => setCreateCollDb(db.name)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create collection
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDropDatabase(db.name)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Drop database
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Collections under database */}
                        {isDbExpanded && db.collections.map((col) => (
                          <div
                            key={`${db.name}-${col.name}`}
                            className={cn(
                              "group w-full flex items-center gap-1.5 pl-12 pr-2 py-1 text-sm rounded-md hover:bg-accent",
                              selectedDatabase === db.name && selectedCollection === col.name && "bg-accent"
                            )}
                          >
                            <button
                              onClick={() => handleCollectionClick(db.name, col.name)}
                              className="flex items-center gap-1.5 flex-1 min-w-0"
                            >
                              <Database className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate text-xs">{col.name}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded flex-shrink-0">
                                {col.documentCount}
                              </span>
                            </button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="h-5 w-5 p-0 flex items-center justify-center rounded hover:bg-muted opacity-0 group-hover:opacity-100 flex-shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => setRenameTarget({ db: db.name, collection: col.name })}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Rename collection
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDropCollection(db.name, col.name)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Drop collection
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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

      {/* Dialogs */}
      <AddConnectionDialog
        open={addConnectionOpen}
        onOpenChange={setAddConnectionOpen}
        onSave={saveConnection}
        onTest={testConnection}
        onActivate={setActiveConnection}
      />

      <CreateDatabaseDialog
        open={createDbOpen}
        onOpenChange={setCreateDbOpen}
        onSubmit={createDatabase}
      />

      {createCollDb && (
        <CreateCollectionDialog
          open={!!createCollDb}
          onOpenChange={(v) => { if (!v) setCreateCollDb(null) }}
          databaseName={createCollDb}
          onSubmit={async (name) => {
            await createCollection(createCollDb, name)
            setCreateCollDb(null)
          }}
        />
      )}

      {renameTarget && (
        <RenameCollectionDialog
          open={!!renameTarget}
          onOpenChange={(v) => { if (!v) setRenameTarget(null) }}
          databaseName={renameTarget.db}
          currentName={renameTarget.collection}
          onSubmit={async (newName) => {
            await renameCollection(renameTarget.db, renameTarget.collection, newName)
            setRenameTarget(null)
          }}
        />
      )}
    </SidebarPanel>
  )
}
