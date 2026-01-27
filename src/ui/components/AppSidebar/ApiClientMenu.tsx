import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, CircleX, RefreshCw, Plus, Upload, FolderOpen, Globe, ChevronRight, ChevronDown } from "lucide-react"
import { useState, type FC } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useApiClient } from "@/ui/contexts/api-client"
import { cn } from "@/lib/utils"

const METHOD_COLORS: Record<ApiHttpMethod, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-gray-400',
  OPTIONS: 'text-gray-400',
}

interface CollectionTreeItemProps {
  item: ApiCollectionItem
  expandedFolders: Record<string, boolean>
  selectedRequestId: string | null
  onToggleFolder: (folderId: string) => void
  onSelectRequest: (requestId: string) => void
  depth: number
}

const CollectionTreeItem: FC<CollectionTreeItemProps> = ({
  item,
  expandedFolders,
  selectedRequestId,
  onToggleFolder,
  onSelectRequest,
  depth,
}) => {
  const isExpanded = expandedFolders[item.id] ?? false

  if (item.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => onToggleFolder(item.id)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-accent text-left",
          )}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}
          <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate">{item.name}</span>
        </button>
        {isExpanded && item.items?.map((child) => (
          <CollectionTreeItem
            key={child.id}
            item={child}
            expandedFolders={expandedFolders}
            selectedRequestId={selectedRequestId}
            onToggleFolder={onToggleFolder}
            onSelectRequest={onSelectRequest}
            depth={depth + 1}
          />
        ))}
      </div>
    )
  }

  const method = item.request?.method ?? 'GET'

  return (
    <button
      onClick={() => onSelectRequest(item.id)}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-accent text-left",
        selectedRequestId === item.id && "bg-accent",
      )}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      <span className={cn("text-[10px] font-bold uppercase flex-shrink-0 w-10", METHOD_COLORS[method])}>
        {method}
      </span>
      <span className="truncate">{item.name}</span>
    </button>
  )
}

export const ApiClientMenu: FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({})
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')

  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    loading,
    selectedRequestId,
    history,
    createWorkspace,
    setActiveWorkspace,
    importPostmanCollection,
    createCollection,
    selectRequest,
  } = useApiClient()

  const handleToggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }))
  }

  const handleToggleCollection = (collectionId: string) => {
    setExpandedCollections((prev) => ({
      ...prev,
      [collectionId]: !prev[collectionId],
    }))
  }

  const handleCreateWorkspace = async () => {
    const trimmed = newWorkspaceName.trim()
    if (!trimmed) return
    await createWorkspace(trimmed)
    setNewWorkspaceName('')
  }

  const handleCreateCollection = async () => {
    const name = prompt('Collection name:')
    if (!name?.trim()) return
    await createCollection(name.trim())
  }

  const collections = activeWorkspace?.collections ?? []
  const environments = activeWorkspace?.environments ?? []
  const activeEnvironment = environments.find((e) => e.id === activeWorkspace?.activeEnvironmentId)

  const filterItems = (items: ApiCollectionItem[]): ApiCollectionItem[] => {
    if (!searchTerm) return items
    const lowerSearch = searchTerm.toLowerCase()

    return items.reduce<ApiCollectionItem[]>((acc, item) => {
      if (item.type === 'request' && item.name.toLowerCase().includes(lowerSearch)) {
        return [...acc, item]
      }
      if (item.type === 'folder') {
        const filteredChildren = filterItems(item.items ?? [])
        if (filteredChildren.length > 0) {
          return [...acc, { ...item, items: filteredChildren }]
        }
        if (item.name.toLowerCase().includes(lowerSearch)) {
          return [...acc, item]
        }
      }
      return acc
    }, [])
  }

  return (
    <div>
      {/* Workspace Selector */}
      <div className="mb-3 px-5">
        {workspaces.length > 0 ? (
          <div className="flex items-center gap-2">
            <select
              value={activeWorkspaceId ?? ''}
              onChange={(e) => {
                if (e.target.value) {
                  setActiveWorkspace(e.target.value)
                }
              }}
              className="flex-1 h-8 rounded-md border bg-background px-2 text-sm"
            >
              <option value="" disabled>Select workspace</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={() => {
                const name = prompt('Workspace name:')
                if (name?.trim()) {
                  createWorkspace(name.trim())
                }
              }}
              title="New workspace"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              placeholder="New workspace name..."
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateWorkspace()
                }
              }}
              className="h-8 text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={handleCreateWorkspace}
              disabled={!newWorkspaceName.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {activeWorkspace && (
        <>
          {/* Environment Selector */}
          {environments.length > 0 && (
            <div className="mb-3 px-5">
              <select
                value={activeWorkspace.activeEnvironmentId ?? ''}
                onChange={(e) => {
                  const envId = e.target.value || null
                  window.electron.apiSetActiveEnvironment(activeWorkspace.id, envId)
                }}
                className="w-full h-8 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">No environment</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    <Globe className="h-3 w-3" /> {env.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-3 px-5">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs"
              onClick={importPostmanCollection}
            >
              <Upload className="h-3.5 w-3.5" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs"
              onClick={handleCreateCollection}
            >
              <Plus className="h-3.5 w-3.5" />
              Collection
            </Button>
          </div>

          {/* Search Input */}
          <div className="relative h-[35px] mb-4 px-5">
            <Search className="absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              className="pl-9"
              value={searchTerm}
              onChange={(ev) => setSearchTerm(ev.target.value)}
            />
            <Button
              onClick={() => setSearchTerm('')}
              className="absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 bg-transparent hover:bg-transparent text-muted-foreground"
            >
              <CircleX />
            </Button>
          </div>

          {/* Collection Tree */}
          <ScrollArea className="h-[calc(100vh-80px-40px-80px-35px-20px-160px)]">
            <div className="px-2">
              {loading && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </div>
              )}

              {!loading && collections.length === 0 && (
                <div className="px-3 py-8 text-sm text-muted-foreground text-center">
                  No collections yet. Import from Postman or create a new collection.
                </div>
              )}

              {!loading && collections.map((collection) => {
                const isExpanded = expandedCollections[collection.id] ?? true
                const filteredItems = filterItems(collection.items)

                if (searchTerm && filteredItems.length === 0) return null

                return (
                  <div key={collection.id} className="mb-1">
                    <button
                      onClick={() => handleToggleCollection(collection.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-accent text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="truncate">{collection.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {collection.items.length}
                      </span>
                    </button>
                    {isExpanded && (searchTerm ? filteredItems : collection.items).map((item) => (
                      <CollectionTreeItem
                        key={item.id}
                        item={item}
                        expandedFolders={expandedFolders}
                        selectedRequestId={selectedRequestId}
                        onToggleFolder={handleToggleFolder}
                        onSelectRequest={selectRequest}
                        depth={1}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </ScrollArea>

          {/* History Section */}
          <div className="border-t">
            <button
              onClick={() => setHistoryExpanded((prev) => !prev)}
              className="w-full flex items-center gap-2 px-5 py-2 text-sm font-medium hover:bg-accent text-left"
            >
              {historyExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              History
              <span className="ml-auto text-[10px] text-muted-foreground">
                {history.length}
              </span>
            </button>
            {historyExpanded && (
              <ScrollArea className="max-h-[200px]">
                <div className="px-2 pb-2">
                  {history.length === 0 && (
                    <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                      No history yet
                    </div>
                  )}
                  {history.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => selectRequest(entry.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-accent text-left"
                    >
                      <span className={cn(
                        "text-[10px] font-bold uppercase flex-shrink-0 w-10",
                        METHOD_COLORS[entry.request.method],
                      )}>
                        {entry.request.method}
                      </span>
                      <span className="truncate text-xs">{entry.request.url}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </>
      )}
    </div>
  )
}
