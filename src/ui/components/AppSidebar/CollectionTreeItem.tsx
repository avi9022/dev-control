import { ChevronRight, FolderOpen, GripVertical } from "lucide-react"
import type { FC, MouseEvent, DragEvent } from "react"
import { cn } from "@/lib/utils"
import type { ContextMenuAction } from "./ApiClientContextMenu"
import { DropLine, CollapsibleContent, type DragData, type DropTarget } from "./ApiClientDragDrop"

const METHOD_COLORS: Record<ApiHttpMethod, string> = {
  GET: 'text-status-green',
  POST: 'text-yellow-400',
  PUT: 'text-blue-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-status-red',
  HEAD: 'text-gray-400',
  OPTIONS: 'text-gray-400',
}

export { METHOD_COLORS }

export interface CollectionTreeItemProps {
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
  // Drag & drop
  isDragEnabled: boolean
  dragData: DragData | null
  dropTarget: DropTarget | null
  onDragStart: (data: DragData) => void
  onDragEnd: () => void
  onDragOverItem: (e: DragEvent, itemId: string, collectionId: string, itemType: 'request' | 'folder') => void
  onDrop: () => void
}

export const CollectionTreeItem: FC<CollectionTreeItemProps> = ({
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
  isDragEnabled,
  dragData,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOverItem,
  onDrop,
}) => {
  const isExpanded = expandedFolders[item.id] ?? false
  const isEditing = editingItemId === item.id
  const isDragging = dragData?.type === 'item' && dragData.id === item.id

  // Check if this item is a drop target
  const isDropTarget = dropTarget?.type === 'item' && dropTarget.id === item.id
  const showLineBefore = isDropTarget && dropTarget?.position === 'before'
  const showLineAfter = isDropTarget && dropTarget?.position === 'after'
  const showInside = isDropTarget && dropTarget?.position === 'inside'

  const canDrag = isDragEnabled && !isEditing

  const handleDragStart = (e: DragEvent) => {
    if (!canDrag) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
    // Small delay to show the drag effect
    setTimeout(() => {
      onDragStart({ type: 'item', id: item.id, collectionId, itemType: item.type })
    }, 0)
  }

  const handleDragOver = (e: DragEvent) => {
    if (!isDragEnabled || !dragData || dragData.id === item.id) return
    // Don't allow dropping item on itself or dragging collection onto item
    if (dragData.type === 'collection') return

    e.preventDefault()
    e.stopPropagation()
    onDragOverItem(e, item.id, collectionId, item.type)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDrop()
  }

  if (item.type === 'folder') {
    const folderActions: ContextMenuAction[] = [
      { label: 'Add Request', onClick: () => onAddRequest(collectionId, item.id) },
      { label: 'Add Folder', onClick: () => onAddFolder(collectionId, item.id) },
      { label: 'Edit Authorization', onClick: () => onSelectRequest(`folder-settings:${collectionId}:${item.id}`), separator: true },
      { label: 'Rename', onClick: () => onStartRename(item.id, item.name) },
      { label: 'Duplicate', onClick: () => onDuplicateItem(collectionId, item.id) },
      { label: 'Delete', onClick: () => onDeleteItem(collectionId, item.id), variant: 'destructive', separator: true },
    ]

    return (
      <div className="transition-all duration-150">
        {showLineBefore && <DropLine depth={depth} />}
        <div
          draggable={canDrag}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={onDragEnd}
          onContextMenu={(e) => onContextMenu(e, folderActions)}
          className={cn(
            "group w-full flex items-center gap-1 px-2 py-1 text-xs rounded transition-all duration-150",
            "hover:bg-accent",
            isDragging && "opacity-40",
            showInside && "bg-sky-500/20 ring-1 ring-sky-500/50",
          )}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {canDrag && (
            <GripVertical className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 flex-shrink-0 cursor-grab transition-colors" />
          )}
          {isEditing ? (
            <>
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <input
                autoFocus
                value={editingValue}
                onChange={(e) => onEditingValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCommitRename(collectionId, item.id)
                  if (e.key === 'Escape') onCancelRename()
                }}
                onBlur={() => onCommitRename(collectionId, item.id)}
                className="flex-1 bg-transparent border border-ring rounded px-1 py-0 text-xs outline-none"
              />
            </>
          ) : (
            <button
              onClick={() => onToggleFolder(item.id)}
              className="flex items-center gap-1 flex-1 text-left"
            >
              <ChevronRight className={cn(
                "h-3 w-3 text-muted-foreground flex-shrink-0 transition-transform duration-200",
                isExpanded && "rotate-90"
              )} />
              <FolderOpen className="h-3.5 w-3.5 text-amber-500/70 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </button>
          )}
        </div>
        <CollapsibleContent isOpen={isExpanded}>
          {item.items?.map((child) => (
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
              isDragEnabled={isDragEnabled}
              dragData={dragData}
              dropTarget={dropTarget}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOverItem={onDragOverItem}
              onDrop={onDrop}
            />
          ))}
        </CollapsibleContent>
        {showLineAfter && <DropLine depth={depth} />}
      </div>
    )
  }

  // Request item
  const method = item.request?.method ?? 'GET'

  const requestActions: ContextMenuAction[] = [
    { label: 'Rename', onClick: () => onStartRename(item.id, item.name) },
    { label: 'Duplicate', onClick: () => onDuplicateItem(collectionId, item.id) },
    { label: 'Delete', onClick: () => onDeleteItem(collectionId, item.id), variant: 'destructive', separator: true },
  ]

  return (
    <div className="transition-all duration-150">
      {showLineBefore && <DropLine depth={depth} />}
      <div
        draggable={canDrag}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={onDragEnd}
        onClick={() => { if (!isEditing) onSelectRequest(item.id) }}
        onContextMenu={(e) => onContextMenu(e, requestActions)}
        className={cn(
          "group w-full flex items-center gap-1 px-2 py-1 text-xs rounded cursor-default transition-all duration-150",
          "hover:bg-accent",
          selectedRequestId === item.id && "bg-accent",
          isDragging && "opacity-40",
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {canDrag && (
          <GripVertical className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/50 flex-shrink-0 cursor-grab transition-colors" />
        )}
        <span className={cn("text-[9px] font-bold uppercase flex-shrink-0 w-8", METHOD_COLORS[method])}>
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
            className="flex-1 bg-transparent border border-ring rounded px-1 py-0 text-xs outline-none min-w-0"
          />
        ) : (
          <span className="truncate">{item.name}</span>
        )}
      </div>
      {showLineAfter && <DropLine depth={depth} />}
    </div>
  )
}
