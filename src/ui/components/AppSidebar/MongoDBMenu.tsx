import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import {
  Search,
  CircleX,
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { useMongoDB } from "@/ui/contexts/mongodb"
import { cn } from "@/lib/utils"

// ─── Add Connection Dialog ───

interface AddConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (config: MongoConnectionConfig) => Promise<void>
  onTest: (id: string) => Promise<MongoConnectionState>
  onActivate: (id: string) => Promise<void>
}

function AddConnectionDialog({ open, onOpenChange, onSave, onTest, onActivate }: AddConnectionDialogProps) {
  const [configId, setConfigId] = useState(() => crypto.randomUUID())
  const [name, setName] = useState('')
  const [connectionString, setConnectionString] = useState('mongodb://localhost:27017')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const resetForm = () => {
    setConfigId(crypto.randomUUID())
    setName('')
    setConnectionString('mongodb://localhost:27017')
    setTestResult(null)
    setTestError(null)
    setSaved(false)
  }

  const getConfig = (): MongoConnectionConfig => {
    const now = Date.now()
    return {
      id: configId,
      name: name.trim(),
      connectionString: connectionString.trim(),
      createdAt: now,
      updatedAt: now,
    }
  }

  const ensureSaved = async () => {
    const config = getConfig()
    await onSave(config)
    setSaved(true)
    return config
  }

  const handleTest = async () => {
    if (!name.trim() || !connectionString.trim()) return
    setTesting(true)
    setTestResult(null)
    setTestError(null)
    try {
      const config = await ensureSaved()
      const result = await onTest(config.id)
      if (result.status === 'connected') {
        setTestResult('success')
      } else {
        setTestResult('error')
        setTestError(result.error ?? 'Connection failed')
      }
    } catch (err) {
      setTestResult('error')
      setTestError(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSaveAndConnect = async () => {
    if (!name.trim() || !connectionString.trim()) return
    setSaving(true)
    try {
      const config = await ensureSaved()
      await onActivate(config.id)
      resetForm()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New MongoDB Connection</DialogTitle>
          <DialogDescription>Add a connection to a MongoDB instance.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="conn-name">Name</Label>
            <Input
              id="conn-name"
              placeholder="My MongoDB"
              value={name}
              onChange={(e) => { setName(e.target.value); setTestResult(null) }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conn-string">Connection String</Label>
            <Input
              id="conn-string"
              placeholder="mongodb://localhost:27017"
              value={connectionString}
              onChange={(e) => { setConnectionString(e.target.value); setTestResult(null) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAndConnect()
              }}
            />
          </div>
          {testResult && (
            <p className={cn("text-xs", testResult === 'success' ? 'text-green-500' : 'text-red-500')}>
              {testResult === 'success' ? 'Connection successful' : testError}
            </p>
          )}
        </div>
        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || saving || !name.trim() || !connectionString.trim()}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleSaveAndConnect} disabled={saving || testing || !name.trim() || !connectionString.trim()}>
              {saving ? 'Connecting...' : 'Save & Connect'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create Database Dialog ───

interface CreateDatabaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (dbName: string, collectionName: string) => Promise<void>
}

function CreateDatabaseDialog({ open, onOpenChange, onSubmit }: CreateDatabaseDialogProps) {
  const [dbName, setDbName] = useState('')
  const [collectionName, setCollectionName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setDbName('')
    setCollectionName('')
    setError(null)
  }

  const handleSubmit = async () => {
    if (!dbName.trim() || !collectionName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(dbName.trim(), collectionName.trim())
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create database')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Database</DialogTitle>
          <DialogDescription>A new database requires an initial collection.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="db-name">Database Name</Label>
            <Input id="db-name" placeholder="my_database" value={dbName} onChange={(e) => setDbName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="initial-collection">Initial Collection Name</Label>
            <Input
              id="initial-collection"
              placeholder="my_collection"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !dbName.trim() || !collectionName.trim()}>
            {submitting ? 'Creating...' : 'Create Database'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create Collection Dialog ───

interface CreateCollectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName: string
  onSubmit: (name: string) => Promise<void>
}

function CreateCollectionDialog({ open, onOpenChange, databaseName, onSubmit }: CreateCollectionDialogProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => { setName(''); setError(null) }

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(name.trim())
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
          <DialogDescription>Create a new collection in {databaseName}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="coll-name">Collection Name</Label>
            <Input
              id="coll-name"
              placeholder="my_collection"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting ? 'Creating...' : 'Create Collection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Rename Collection Dialog ───

interface RenameCollectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName: string
  currentName: string
  onSubmit: (newName: string) => Promise<void>
}

function RenameCollectionDialog({ open, onOpenChange, databaseName, currentName, onSubmit }: RenameCollectionDialogProps) {
  const [newName, setNewName] = useState(currentName)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => { setNewName(currentName); setError(null) }

  const handleSubmit = async () => {
    if (!newName.trim() || newName.trim() === currentName) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(newName.trim())
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename collection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Collection</DialogTitle>
          <DialogDescription>Rename "{currentName}" in {databaseName}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-coll-name">New Name</Label>
            <Input
              id="new-coll-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !newName.trim() || newName.trim() === currentName}>
            {submitting ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
    <div className="flex flex-col h-full">
      {/* ─── Header: CONNECTIONS (count) with action buttons ─── */}
      <div className="flex items-center justify-between px-5 mb-2">
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

      {/* ─── Search ─── */}
      <div className="relative h-[35px] mb-2 px-5">
        <Search className="absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search connections..."
          className="pl-9"
          value={searchTerm}
          onChange={(ev) => setSearchTerm(ev.target.value)}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <CircleX className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ─── Connection Tree ─── */}
      <ScrollArea className="flex-1">
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
                {/* ─── Connection Row ─── */}
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
                      connIsConnected && "text-green-500",
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

                {/* ─── Error message ─── */}
                {connIsError && (
                  <div className="pl-9 pr-2 py-1">
                    <p className="text-xs text-destructive truncate">
                      {connectionState?.error ?? 'Connection failed'}
                    </p>
                  </div>
                )}

                {/* ─── Databases under connected connection ─── */}
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
      </ScrollArea>

      {/* ─── Footer ─── */}
      {isConnected && (
        <div className="flex justify-between items-center px-4 gap-4 py-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshDatabases}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <span className="text-xs text-muted-foreground">
            {databases.length} db, {databases.reduce((sum, db) => sum + db.collections.length, 0)} col
          </span>
        </div>
      )}

      {/* ─── Dialogs ─── */}
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
    </div>
  )
}
