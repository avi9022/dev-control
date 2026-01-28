import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, CircleX, RefreshCw, Plus, Upload, FolderOpen, Globe, ChevronRight, ChevronDown, Settings2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type FC, type MouseEvent } from "react"
import { createPortal } from "react-dom"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useApiClient } from "@/ui/contexts/api-client"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EnvironmentManager } from '../api-client/EnvironmentManager'

const METHOD_COLORS: Record<ApiHttpMethod, string> = {
  GET: 'text-green-400',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-gray-400',
  OPTIONS: 'text-gray-400',
}

// --- Custom right-click context menu (non-modal, Electron-safe) ---

interface ContextMenuAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
  separator?: boolean
}

interface RightClickMenuState {
  x: number
  y: number
  actions: ContextMenuAction[]
}

const RightClickMenu: FC<{
  menu: RightClickMenuState
  onClose: () => void
}> = ({ menu, onClose }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    document.addEventListener('contextmenu', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('contextmenu', handleClick)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.actions.map((action, i) => (
        <div key={i}>
          {action.separator && <div className="bg-border -mx-1 my-1 h-px" />}
          <button
            className={cn(
              "relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground",
              action.variant === 'destructive' && "text-destructive hover:bg-destructive/10 hover:text-destructive",
              action.disabled && "pointer-events-none opacity-50",
            )}
            onClick={() => {
              if (!action.disabled) {
                onClose()
                action.onClick()
              }
            }}
          >
            {action.label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}

// --- Collection tree item ---

interface CollectionTreeItemProps {
  item: ApiCollectionItem
  collectionId: string
  expandedFolders: Record<string, boolean>
  selectedRequestId: string | null
  editingItemId: string | null
  editingValue: string
  onEditingValueChange: (value: string) => void
  onToggleFolder: (folderId: string) => void
  onSelectRequest: (requestId: string) => void
  onAddRequest: (collectionId: string, parentFolderId: string | null) => void
  onAddFolder: (collectionId: string, parentFolderId: string | null) => void
  onDeleteItem: (collectionId: string, itemId: string) => void
  onDuplicateItem: (collectionId: string, itemId: string) => void
  onStartRename: (itemId: string, currentName: string) => void
  onCommitRename: (collectionId: string, itemId: string) => void
  onCancelRename: () => void
  onContextMenu: (e: MouseEvent, actions: ContextMenuAction[]) => void
  depth: number
}

const CollectionTreeItem: FC<CollectionTreeItemProps> = ({
  item,
  collectionId,
  expandedFolders,
  selectedRequestId,
  editingItemId,
  editingValue,
  onEditingValueChange,
  onToggleFolder,
  onSelectRequest,
  onAddRequest,
  onAddFolder,
  onDeleteItem,
  onDuplicateItem,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onContextMenu,
  depth,
}) => {
  const isExpanded = expandedFolders[item.id] ?? false
  const isEditing = editingItemId === item.id

  if (item.type === 'folder') {
    const folderActions: ContextMenuAction[] = [
      { label: 'Add Request', onClick: () => onAddRequest(collectionId, item.id) },
      { label: 'Add Folder', onClick: () => onAddFolder(collectionId, item.id) },
      { label: 'Rename', onClick: () => onStartRename(item.id, item.name), separator: true },
      { label: 'Duplicate', onClick: () => onDuplicateItem(collectionId, item.id) },
      { label: 'Delete', onClick: () => onDeleteItem(collectionId, item.id), variant: 'destructive', separator: true },
    ]

    return (
      <div>
        <div
          onContextMenu={(e) => onContextMenu(e, folderActions)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-accent"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {isEditing ? (
            <>
              <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                autoFocus
                value={editingValue}
                onChange={(e) => onEditingValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCommitRename(collectionId, item.id)
                  if (e.key === 'Escape') onCancelRename()
                }}
                onBlur={() => onCommitRename(collectionId, item.id)}
                className="flex-1 bg-transparent border border-ring rounded px-1 py-0 text-sm outline-none"
              />
            </>
          ) : (
            <button
              onClick={() => onToggleFolder(item.id)}
              className="flex items-center gap-2 flex-1 text-left"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </button>
          )}
        </div>
        {isExpanded && item.items?.map((child) => (
          <CollectionTreeItem
            key={child.id}
            item={child}
            collectionId={collectionId}
            expandedFolders={expandedFolders}
            selectedRequestId={selectedRequestId}
            editingItemId={editingItemId}
            editingValue={editingValue}
            onEditingValueChange={onEditingValueChange}
            onToggleFolder={onToggleFolder}
            onSelectRequest={onSelectRequest}
            onAddRequest={onAddRequest}
            onAddFolder={onAddFolder}
            onDeleteItem={onDeleteItem}
            onDuplicateItem={onDuplicateItem}
            onStartRename={onStartRename}
            onCommitRename={onCommitRename}
            onCancelRename={onCancelRename}
            onContextMenu={onContextMenu}
            depth={depth + 1}
          />
        ))}
      </div>
    )
  }

  const method = item.request?.method ?? 'GET'

  const requestActions: ContextMenuAction[] = [
    { label: 'Rename', onClick: () => onStartRename(item.id, item.name) },
    { label: 'Duplicate', onClick: () => onDuplicateItem(collectionId, item.id) },
    { label: 'Delete', onClick: () => onDeleteItem(collectionId, item.id), variant: 'destructive', separator: true },
  ]

  return (
    <div
      onClick={() => { if (!isEditing) onSelectRequest(item.id) }}
      onContextMenu={(e) => onContextMenu(e, requestActions)}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md hover:bg-accent cursor-default",
        selectedRequestId === item.id && "bg-accent",
      )}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
    >
      <span className={cn("text-[10px] font-bold uppercase flex-shrink-0 w-10", METHOD_COLORS[method])}>
        {method}
      </span>
      {isEditing ? (
        <input
          autoFocus
          value={editingValue}
          onChange={(e) => onEditingValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitRename(collectionId, item.id)
            if (e.key === 'Escape') onCancelRename()
          }}
          onBlur={() => onCommitRename(collectionId, item.id)}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent border border-ring rounded px-1 py-0 text-sm outline-none min-w-0"
        />
      ) : (
        <span className="truncate">{item.name}</span>
      )}
    </div>
  )
}

// --- Main menu component ---

export const ApiClientMenu: FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({})
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [envManagerOpen, setEnvManagerOpen] = useState(false)

  const [inputDialogOpen, setInputDialogOpen] = useState(false)
  const [inputDialogLabel, setInputDialogLabel] = useState('')
  const [inputDialogValue, setInputDialogValue] = useState('')
  const inputDialogCallbackRef = useRef<((value: string) => void) | null>(null)

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogMessage, setConfirmDialogMessage] = useState('')
  const confirmDialogCallbackRef = useRef<(() => void) | null>(null)

  const [rightClickMenu, setRightClickMenu] = useState<RightClickMenuState | null>(null)

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editingCollectionIdRef = useRef<string | null>(null)
  const [editingCollectionNameId, setEditingCollectionNameId] = useState<string | null>(null)
  const [editingCollectionNameValue, setEditingCollectionNameValue] = useState('')

  const openInputDialog = useCallback((label: string, callback: (value: string) => void, defaultValue = '') => {
    setInputDialogLabel(label)
    setInputDialogValue(defaultValue)
    inputDialogCallbackRef.current = callback
    setInputDialogOpen(true)
  }, [])

  const handleInputDialogConfirm = useCallback(() => {
    const trimmed = inputDialogValue.trim()
    if (!trimmed) return
    inputDialogCallbackRef.current?.(trimmed)
    setInputDialogOpen(false)
  }, [inputDialogValue])

  const openConfirmDialog = useCallback((message: string, callback: () => void) => {
    setConfirmDialogMessage(message)
    confirmDialogCallbackRef.current = callback
    setConfirmDialogOpen(true)
  }, [])

  const handleConfirmDialogConfirm = useCallback(() => {
    confirmDialogCallbackRef.current?.()
    setConfirmDialogOpen(false)
  }, [])

  const handleRightClick = useCallback((e: MouseEvent, actions: ContextMenuAction[]) => {
    e.preventDefault()
    e.stopPropagation()
    setRightClickMenu({ x: e.clientX, y: e.clientY, actions })
  }, [])

  const closeRightClickMenu = useCallback(() => {
    setRightClickMenu(null)
  }, [])

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
    importPostmanEnvironment,
    createCollection,
    deleteCollection,
    addRequest,
    addFolder,
    renameItem,
    duplicateItem,
    deleteItem,
    selectRequest,
    createScratchRequest,
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

  const handleCreateCollection = () => {
    openInputDialog('Collection name', (name) => {
      createCollection(name)
    })
  }

  const handleAddRequest = (collectionId: string, parentFolderId: string | null) => {
    addRequest(collectionId, parentFolderId, {
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      body: { type: 'none', content: '' },
      auth: { type: 'none' },
    })
  }

  const handleAddFolder = (collectionId: string, parentFolderId: string | null) => {
    openInputDialog('Folder name', (name) => {
      addFolder(collectionId, parentFolderId, name)
    })
  }

  const handleDeleteItem = (collectionId: string, itemId: string) => {
    openConfirmDialog('Are you sure you want to delete this item?', () => {
      deleteItem(collectionId, itemId)
    })
  }

  const handleDeleteCollection = (collectionId: string) => {
    openConfirmDialog('Are you sure you want to delete this collection?', () => {
      deleteCollection(collectionId)
    })
  }

  const handleDuplicateItem = (collectionId: string, itemId: string) => {
    duplicateItem(collectionId, itemId)
  }

  const handleStartRename = (itemId: string, currentName: string) => {
    setEditingItemId(itemId)
    setEditingValue(currentName)
  }

  const handleCommitRename = (collectionId: string, itemId: string) => {
    const trimmed = editingValue.trim()
    if (trimmed && trimmed !== '') {
      renameItem(collectionId, itemId, trimmed)
    }
    setEditingItemId(null)
  }

  const handleCancelRename = () => {
    setEditingItemId(null)
  }

  const handleStartCollectionRename = (collectionId: string, currentName: string) => {
    setEditingCollectionNameId(collectionId)
    setEditingCollectionNameValue(currentName)
  }

  const handleCommitCollectionRename = (collectionId: string) => {
    const trimmed = editingCollectionNameValue.trim()
    if (trimmed && activeWorkspaceId) {
      window.electron.apiUpdateCollection(activeWorkspaceId, collectionId, { name: trimmed })
    }
    setEditingCollectionNameId(null)
  }

  const handleCancelCollectionRename = () => {
    setEditingCollectionNameId(null)
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
                openInputDialog('Workspace name', (name) => {
                  createWorkspace(name)
                })
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
          <div className="flex items-center gap-2 mb-3 px-5">
            {environments.length > 0 ? (
              <select
                value={activeWorkspace.activeEnvironmentId ?? ''}
                onChange={(e) => {
                  const envId = e.target.value || null
                  window.electron.apiSetActiveEnvironment(activeWorkspace.id, envId)
                }}
                className="flex-1 h-8 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">No environment</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    <Globe className="h-3 w-3" /> {env.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex-1 h-8 rounded-md border bg-muted px-2 text-sm flex items-center text-muted-foreground">
                No environments
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={() => setEnvManagerOpen(true)}
              title="Manage environments"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mb-3 px-5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={importPostmanCollection}>
                  Collection
                </DropdownMenuItem>
                <DropdownMenuItem onClick={importPostmanEnvironment}>
                  Environment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs"
              onClick={handleCreateCollection}
            >
              <Plus className="h-3.5 w-3.5" />
              Collection
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs"
              onClick={createScratchRequest}
            >
              <Plus className="h-3.5 w-3.5" />
              Request
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

                const isEditingCollection = editingCollectionNameId === collection.id
                const collectionActions: ContextMenuAction[] = [
                  { label: 'Add Request', onClick: () => handleAddRequest(collection.id, null) },
                  { label: 'Add Folder', onClick: () => handleAddFolder(collection.id, null) },
                  { label: 'Rename', onClick: () => handleStartCollectionRename(collection.id, collection.name), separator: true },
                  { label: 'Duplicate', onClick: () => {
                    createCollection(`Copy of ${collection.name}`)
                  } },
                  { label: 'Export', onClick: () => {}, disabled: true, separator: true },
                  { label: 'Delete Collection', onClick: () => handleDeleteCollection(collection.id), variant: 'destructive', separator: true },
                ]

                return (
                  <div key={collection.id} className="mb-1">
                    <div
                      onContextMenu={(e) => handleRightClick(e, collectionActions)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-accent"
                    >
                      {isEditingCollection ? (
                        <input
                          autoFocus
                          value={editingCollectionNameValue}
                          onChange={(e) => setEditingCollectionNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitCollectionRename(collection.id)
                            if (e.key === 'Escape') handleCancelCollectionRename()
                          }}
                          onBlur={() => handleCommitCollectionRename(collection.id)}
                          className="flex-1 bg-transparent border border-ring rounded px-1 py-0 text-sm font-medium outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => handleToggleCollection(collection.id)}
                          className="flex items-center gap-2 flex-1 text-left"
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
                      )}
                    </div>
                    {isExpanded && (searchTerm ? filteredItems : collection.items).map((item) => (
                      <CollectionTreeItem
                        key={item.id}
                        item={item}
                        collectionId={collection.id}
                        expandedFolders={expandedFolders}
                        selectedRequestId={selectedRequestId}
                        editingItemId={editingItemId}
                        editingValue={editingValue}
                        onEditingValueChange={setEditingValue}
                        onToggleFolder={handleToggleFolder}
                        onSelectRequest={selectRequest}
                        onAddRequest={handleAddRequest}
                        onAddFolder={handleAddFolder}
                        onDeleteItem={handleDeleteItem}
                        onDuplicateItem={handleDuplicateItem}
                        onStartRename={handleStartRename}
                        onCommitRename={handleCommitRename}
                        onCancelRename={handleCancelRename}
                        onContextMenu={handleRightClick}
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

      <EnvironmentManager open={envManagerOpen} onOpenChange={setEnvManagerOpen} />

      {/* Input Dialog (for creating collections, requests, folders, workspaces) */}
      <Dialog open={inputDialogOpen} onOpenChange={setInputDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inputDialogLabel}</DialogTitle>
            <DialogDescription>Enter a name below.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Name..."
            value={inputDialogValue}
            onChange={(e) => setInputDialogValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInputDialogConfirm()
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInputDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInputDialogConfirm} disabled={!inputDialogValue.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog (for delete operations) */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
            <DialogDescription>{confirmDialogMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDialogConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Right-click context menu (non-modal, rendered via portal) */}
      {rightClickMenu && (
        <RightClickMenu menu={rightClickMenu} onClose={closeRightClickMenu} />
      )}
    </div>
  )
}
