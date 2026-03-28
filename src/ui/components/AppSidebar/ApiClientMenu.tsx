import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Upload, ChevronRight, Settings2, Trash2, MoreVertical, GripVertical } from "lucide-react"
import { useCallback, useRef, useState, type FC, type MouseEvent, type DragEvent } from "react"
import { useApiClient } from "@/ui/contexts/api-client"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EnvironmentManager } from '../api-client/EnvironmentManager'
import { SearchInput } from "../Inputs/SearchInput"
import { SidebarPanel } from "./SidebarPanel"
import { RightClickMenu, type ContextMenuAction, type RightClickMenuState } from "./ApiClientContextMenu"
import { CollapsibleContent, type DragData, type DropTarget } from "./ApiClientDragDrop"
import { CollectionTreeItem, METHOD_COLORS } from "./CollectionTreeItem"

// --- Main Menu Component ---

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
  const [editingCollectionNameId, setEditingCollectionNameId] = useState<string | null>(null)
  const [editingCollectionNameValue, setEditingCollectionNameValue] = useState('')

  // Drag & drop state - use refs to avoid stale closures in event handlers
  const [dragData, setDragData] = useState<DragData | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const dragDataRef = useRef<DragData | null>(null)
  const dropTargetRef = useRef<DropTarget | null>(null)
  const isDroppedRef = useRef(false)

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
    selectedRequestId,
    history,
    createWorkspace,
    deleteWorkspace,
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
    moveItem,
    reorderCollection,
    selectRequest,
    createScratchRequest,
  } = useApiClient()

  // Disable drag during search
  const isDragEnabled = !searchTerm

  // --- Drag & Drop Handlers ---

  const handleDragStart = useCallback((data: DragData) => {
    dragDataRef.current = data
    isDroppedRef.current = false
    setDragData(data)
  }, [])

  const handleDragEnd = useCallback(() => {
    // Only clear if drop didn't happen (e.g., drag cancelled)
    // Use setTimeout to let handleDrop run first if both events fire
    setTimeout(() => {
      if (!isDroppedRef.current) {
        dragDataRef.current = null
        dropTargetRef.current = null
        setDragData(null)
        setDropTarget(null)
      }
    }, 0)
  }, [])

  const handleDragOverItem = useCallback((e: DragEvent, itemId: string, collectionId: string, itemType: 'request' | 'folder') => {
    if (!dragDataRef.current) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height

    let position: 'before' | 'after' | 'inside'

    if (itemType === 'folder') {
      // Folder: 30% top = before, 40% middle = inside, 30% bottom = after
      if (y < height * 0.3) {
        position = 'before'
      } else if (y > height * 0.7) {
        position = 'after'
      } else {
        position = 'inside'
      }
    } else {
      // Request: 50% top = before, 50% bottom = after
      position = y < height * 0.5 ? 'before' : 'after'
    }

    const target = { type: 'item' as const, id: itemId, collectionId, position }
    dropTargetRef.current = target
    setDropTarget(target)
  }, [])

  const handleDragOverCollection = useCallback((e: DragEvent, collectionId: string) => {
    if (!dragDataRef.current) return
    e.preventDefault()
    e.stopPropagation()

    let target: DropTarget
    if (dragDataRef.current.type === 'collection') {
      // Collection being dragged over another collection
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const y = e.clientY - rect.top
      const height = rect.height
      const position = y < height * 0.5 ? 'before' : 'after'
      target = { type: 'collection', id: collectionId, collectionId, position }
    } else {
      // Item being dragged to collection root
      target = { type: 'collection-root', id: collectionId, collectionId, position: 'inside' }
    }
    dropTargetRef.current = target
    setDropTarget(target)
  }, [])

  const handleDrop = useCallback(async () => {
    const currentDragData = dragDataRef.current
    const currentDropTarget = dropTargetRef.current

    if (!currentDragData || !currentDropTarget) {
      dragDataRef.current = null
      dropTargetRef.current = null
      setDragData(null)
      setDropTarget(null)
      return
    }

    // Mark as dropped to prevent handleDragEnd from clearing
    isDroppedRef.current = true

    // Don't drop on self
    if (currentDragData.id === currentDropTarget.id) {
      dragDataRef.current = null
      dropTargetRef.current = null
      setDragData(null)
      setDropTarget(null)
      return
    }

    try {
      if (currentDragData.type === 'collection') {
        // Reorder collection
        if (currentDropTarget.type === 'collection') {
          await reorderCollection(
            currentDragData.id,
            currentDropTarget.id,
            currentDropTarget.position as 'before' | 'after'
          )
        }
      } else {
        // Move item
        if (currentDropTarget.type === 'item') {
          await moveItem(
            currentDragData.collectionId!,
            currentDragData.id,
            currentDropTarget.collectionId,
            currentDropTarget.id,
            currentDropTarget.position
          )
        } else if (currentDropTarget.type === 'collection-root') {
          // Move to collection root (end of collection)
          await moveItem(
            currentDragData.collectionId!,
            currentDragData.id,
            currentDropTarget.collectionId,
            null,
            'inside'
          )
        }
      }
    } catch (error) {
      console.error('Drop failed:', error)
    }

    // Clear state after operation
    dragDataRef.current = null
    dropTargetRef.current = null
    setDragData(null)
    setDropTarget(null)
  }, [moveItem, reorderCollection])

  // --- Other Handlers ---

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
    <SidebarPanel
      header={
        <div className="space-y-2">
          {/* Workspace Selector */}
          {workspaces.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <select
                value={activeWorkspaceId ?? ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setActiveWorkspace(e.target.value)
                  }
                }}
                className="flex-1 h-7 rounded border bg-background px-2 text-xs font-medium"
              >
                <option value="" disabled>Select workspace</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    openInputDialog('Workspace name', (name) => {
                      createWorkspace(name)
                    })
                  }}>
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    New Workspace
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      if (activeWorkspaceId && activeWorkspace) {
                        openConfirmDialog(`Delete workspace "${activeWorkspace.name}"?`, () => {
                          deleteWorkspace(activeWorkspaceId)
                        })
                      }
                    }}
                    disabled={!activeWorkspaceId}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete Workspace
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="New workspace name..."
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateWorkspace()
                }}
                className="h-7 text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                className="size-7 p-0 flex-shrink-0"
                onClick={handleCreateWorkspace}
                disabled={!newWorkspaceName.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {activeWorkspace && (
            <>
              {/* Environment Selector */}
              <div className="flex items-center gap-1.5">
                {environments.length > 0 ? (
                  <select
                    value={activeWorkspace.activeEnvironmentId ?? ''}
                    onChange={(e) => {
                      const envId = e.target.value || null
                      window.electron.apiSetActiveEnvironment(activeWorkspace.id, envId)
                    }}
                    className="flex-1 h-7 rounded border bg-background px-2 text-xs"
                  >
                    <option value="">No environment</option>
                    {environments.map((env) => (
                      <option key={env.id} value={env.id}>{env.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex-1 h-7 rounded border bg-muted px-2 text-xs flex items-center text-muted-foreground">
                    No environments
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 p-0 flex-shrink-0"
                  onClick={() => setEnvManagerOpen(true)}
                  title="Manage environments"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 flex items-center gap-1 text-[11px] px-2">
                      <Upload className="h-3 w-3" />
                      Import
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={importPostmanCollection}>Collection</DropdownMenuItem>
                    <DropdownMenuItem onClick={importPostmanEnvironment}>Environment</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 flex items-center gap-1 text-[11px] px-2"
                  onClick={handleCreateCollection}
                >
                  <Plus className="h-3 w-3" />
                  Collection
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 flex items-center gap-1 text-[11px] px-2"
                  onClick={createScratchRequest}
                >
                  <Plus className="h-3 w-3" />
                  New
                </Button>
              </div>

              {/* Search */}
              <SearchInput
                placeholder="Filter..."
                value={searchTerm}
                onChange={(ev) => setSearchTerm(ev.target.value)}
                onClear={() => setSearchTerm('')}
              />
            </>
          )}
        </div>
      }
    >
      {activeWorkspace && (
        <>
          {/* Collections */}
          <div className="px-1 relative">
            {collections.length === 0 && (
              <div className="px-3 py-6 text-xs text-muted-foreground text-center">
                No collections yet. Import or create one.
              </div>
            )}

            {/* Top drop zone - absolute positioned, doesn't affect layout */}
            {collections.length > 0 && dragData?.type === 'collection' && (
              <div
                className="absolute top-0 left-0 right-0 h-4 z-10"
                onDragOver={(e) => {
                  if (!dragDataRef.current || dragDataRef.current.type !== 'collection') return
                  e.preventDefault()
                  e.stopPropagation()
                  const firstCollection = collections[0]
                  if (firstCollection && dragDataRef.current.id !== firstCollection.id) {
                    const target: DropTarget = { type: 'collection', id: firstCollection.id, collectionId: firstCollection.id, position: 'before' }
                    dropTargetRef.current = target
                    setDropTarget(target)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleDrop()
                }}
              />
            )}

            {collections.map((collection) => {
              const isExpanded = expandedCollections[collection.id] ?? false
              const filteredItems = filterItems(collection.items)
              const isEditingCollection = editingCollectionNameId === collection.id
              const isDraggingCollection = dragData?.type === 'collection' && dragData.id === collection.id
              const isCollectionDropTarget = dropTarget?.type === 'collection' && dropTarget.id === collection.id
              const isRootDropTarget = dropTarget?.type === 'collection-root' && dropTarget.id === collection.id

              if (searchTerm && filteredItems.length === 0) return null

              const collectionActions: ContextMenuAction[] = [
                { label: 'Add Request', onClick: () => handleAddRequest(collection.id, null) },
                { label: 'Add Folder', onClick: () => handleAddFolder(collection.id, null) },
                { label: 'Edit Authorization', onClick: () => selectRequest(`collection-settings:${collection.id}`), separator: true },
                { label: 'Rename', onClick: () => handleStartCollectionRename(collection.id, collection.name) },
                { label: 'Duplicate', onClick: () => createCollection(`Copy of ${collection.name}`) },
                { label: 'Delete Collection', onClick: () => handleDeleteCollection(collection.id), variant: 'destructive', separator: true },
              ]

              return (
                <div key={collection.id} className="mb-0.5 transition-all duration-150">
                  {/* Drop line before collection */}
                  {isCollectionDropTarget && dropTarget?.position === 'before' && (
                    <div className="h-[2px] bg-sky-500 rounded-full mx-2 my-[-1px]" />
                  )}

                  <div
                    draggable={isDragEnabled && !isEditingCollection}
                    onDragStart={(e) => {
                      if (!isDragEnabled || isEditingCollection) {
                        e.preventDefault()
                        return
                      }
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', collection.id)
                      setTimeout(() => {
                        handleDragStart({ type: 'collection', id: collection.id })
                      }, 0)
                    }}
                    onDragOver={(e) => handleDragOverCollection(e, collection.id)}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleDrop()
                    }}
                    onDragEnd={handleDragEnd}
                    onContextMenu={(e) => handleRightClick(e, collectionActions)}
                    className={cn(
                      "group w-full flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-all duration-150",
                      "hover:bg-accent",
                      isDraggingCollection && "opacity-40",
                      isRootDropTarget && "bg-sky-500/20 ring-1 ring-sky-500/50",
                    )}
                  >
                    {isDragEnabled && !isEditingCollection && (
                      <GripVertical className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 flex-shrink-0 cursor-grab transition-colors" />
                    )}
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
                        className="flex-1 bg-transparent border border-ring rounded px-1 py-0 text-xs font-medium outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => handleToggleCollection(collection.id)}
                        className="flex items-center gap-1 flex-1 text-left"
                      >
                        <ChevronRight className={cn(
                          "h-3 w-3 text-muted-foreground flex-shrink-0 transition-transform duration-200",
                          isExpanded && "rotate-90"
                        )} />
                        <span className="truncate">{collection.name}</span>
                        <span className="ml-auto text-[9px] text-muted-foreground">
                          {collection.items.length}
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Collection items */}
                  <CollapsibleContent isOpen={isExpanded || !!searchTerm}>
                    {(searchTerm ? filteredItems : collection.items).map((item) => (
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
                        isDragEnabled={isDragEnabled}
                        dragData={dragData}
                        dropTarget={dropTarget}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragOverItem={handleDragOverItem}
                        onDrop={handleDrop}
                      />
                    ))}
                  </CollapsibleContent>

                  {/* Drop line after collection */}
                  {isCollectionDropTarget && dropTarget?.position === 'after' && (
                    <div className="h-[2px] bg-sky-500 rounded-full mx-2 my-[-1px]" />
                  )}
                </div>
              )
            })}
          </div>

          {/* History */}
          <div className="border-t">
            <button
              onClick={() => setHistoryExpanded((prev) => !prev)}
              className="w-full flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium hover:bg-accent text-left"
            >
              <ChevronRight className={cn(
                "h-3 w-3 text-muted-foreground transition-transform duration-200",
                historyExpanded && "rotate-90"
              )} />
              History
              <span className="ml-auto text-[9px] text-muted-foreground">{history.length}</span>
            </button>
            {historyExpanded && (
              <div className="max-h-[180px] overflow-y-auto">
                <div className="px-1 pb-1">
                  {history.length === 0 && (
                    <div className="px-2 py-3 text-[11px] text-muted-foreground text-center">
                      No history yet
                    </div>
                  )}
                  {history.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => selectRequest(entry.id)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-accent text-left"
                    >
                      <span className={cn("text-[9px] font-bold uppercase flex-shrink-0 w-9", METHOD_COLORS[entry.request.method])}>
                        {entry.request.method}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">{entry.request.url}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <EnvironmentManager open={envManagerOpen} onOpenChange={setEnvManagerOpen} />

      {/* Input Dialog */}
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
            <Button variant="ghost" onClick={() => setInputDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInputDialogConfirm} disabled={!inputDialogValue.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
            <DialogDescription>{confirmDialogMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDialogConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Context Menu */}
      {rightClickMenu && <RightClickMenu menu={rightClickMenu} onClose={closeRightClickMenu} />}
    </SidebarPanel>
  )
}
