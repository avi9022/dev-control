import { useState, useRef, useCallback, useMemo, type FC } from 'react'
import { useApiClient } from '../contexts/api-client'
import { RequestPanel } from '../components/api-client/RequestPanel'
import { ScratchRequestPanel } from '../components/api-client/ScratchRequestPanel'
import { VariablesPanel } from '../components/api-client/VariablesPanel'
import { CollectionSettingsPanel } from '../components/api-client/CollectionSettingsPanel'
import { FolderSettingsPanel } from '../components/api-client/FolderSettingsPanel'
import { Button } from '@/components/ui/button'
import { Braces, GripVertical } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// Helper to find request in collections (returns item and collectionId)
function findRequestInCollections(
  collections: ApiCollection[],
  requestId: string
): { item: ApiCollectionItem; collectionId: string } | null {
  const findInItems = (items: ApiCollectionItem[]): ApiCollectionItem | null => {
    for (const item of items) {
      if (item.id === requestId) return item
      if (item.items) {
        const found = findInItems(item.items)
        if (found) return found
      }
    }
    return null
  }

  for (const collection of collections) {
    const found = findInItems(collection.items)
    if (found) return { item: found, collectionId: collection.id }
  }
  return null
}

// Parse special view IDs for settings panels
function parseViewId(id: string | null) {
  if (!id) return { type: 'empty' as const }
  if (id === 'scratch') return { type: 'scratch' as const }
  if (id.startsWith('collection-settings:')) {
    return { type: 'collection-settings' as const, collectionId: id.replace('collection-settings:', '') }
  }
  if (id.startsWith('folder-settings:')) {
    const [collectionId, folderId] = id.replace('folder-settings:', '').split(':')
    return { type: 'folder-settings' as const, collectionId, folderId }
  }
  return { type: 'request' as const, requestId: id }
}

interface ApiClientViewProps {
  itemId: string | null
}

export const ApiClientView: FC<ApiClientViewProps> = ({ itemId }) => {
  const { activeWorkspace, scratchRequest, selectRequest } = useApiClient()
  const [showVariables, setShowVariables] = useState(false)
  const [panelWidth, setPanelWidth] = useState(280)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = panelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const diff = startX.current - e.clientX
      const newWidth = Math.min(Math.max(startWidth.current + diff, 200), 500)
      setPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelWidth])

  // Parse view ID (memoized to avoid recalculating)
  const viewInfo = useMemo(() => parseViewId(itemId), [itemId])

  // Get current request data for variables panel and code snippet
  const currentRequestContext = useMemo(() => {
    if (!activeWorkspace) return undefined

    if (viewInfo.type === 'scratch' && scratchRequest) {
      return {
        data: {
          method: scratchRequest.method,
          url: scratchRequest.url,
          params: scratchRequest.params,
          headers: scratchRequest.headers,
          body: scratchRequest.body ?? { type: 'none' as const, content: '' },
          auth: scratchRequest.auth ?? { type: 'none' as const },
        },
        requestId: undefined as string | undefined,
        collectionId: undefined as string | undefined,
      }
    }

    if (viewInfo.type === 'request') {
      const found = findRequestInCollections(activeWorkspace.collections, viewInfo.requestId)
      if (found?.item.request) {
        return {
          data: {
            method: found.item.request.method,
            url: found.item.request.url,
            params: found.item.request.params,
            headers: found.item.request.headers,
            body: found.item.request.body ?? { type: 'none' as const, content: '' },
            auth: found.item.request.auth ?? { type: 'none' as const },
          },
          requestId: viewInfo.requestId,
          collectionId: found.collectionId,
        }
      }
    }

    return undefined
  }, [viewInfo, scratchRequest, activeWorkspace])

  // Don't show variables panel for settings views
  const canShowVariables = viewInfo.type === 'request' || viewInfo.type === 'scratch'

  // Early return AFTER all hooks
  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-sm font-medium">No workspace selected</p>
          <p className="text-xs mt-1">Create or select a workspace to get started</p>
        </div>
      </div>
    )
  }

  const mainContent = (() => {
    switch (viewInfo.type) {
      case 'scratch':
        if (!scratchRequest) return null
        return <ScratchRequestPanel />

      case 'collection-settings':
        return (
          <CollectionSettingsPanel
            collectionId={viewInfo.collectionId}
            onBack={() => selectRequest(null)}
          />
        )

      case 'folder-settings':
        return (
          <FolderSettingsPanel
            collectionId={viewInfo.collectionId}
            folderId={viewInfo.folderId}
            onBack={() => selectRequest(null)}
            onNavigateToCollection={() => selectRequest(`collection-settings:${viewInfo.collectionId}`)}
          />
        )

      case 'request':
        return <RequestPanel requestId={viewInfo.requestId} />

      case 'empty':
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-sm font-medium">Select a request</p>
              <p className="text-xs mt-1">Choose from sidebar or create new</p>
            </div>
          </div>
        )
    }
  })()

  return (
    <div className="h-full flex flex-col">
      {/* Top bar with Variables toggle */}
      <div className="flex items-center justify-end gap-1 px-2 py-1 border-b bg-background">
        {canShowVariables && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showVariables ? 'default' : 'ghost'}
                size="sm"
                className={cn("h-6 gap-1 text-[11px] px-2")}
                onClick={() => setShowVariables((v) => !v)}
              >
                <Braces className="h-3 w-3" />
                Variables
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">Toggle variables panel</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Main area with optional variables panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden">
          {mainContent}
        </div>

        {showVariables && canShowVariables && (
          <>
            {/* Resize handle */}
            <div
              onMouseDown={handleMouseDown}
              className="w-1 hover:w-1.5 bg-border hover:bg-primary/50 cursor-col-resize flex items-center justify-center group transition-all"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Variables panel - fixed to right */}
            <div style={{ width: panelWidth }} className="flex-shrink-0 h-full">
              <VariablesPanel
                requestData={currentRequestContext?.data}
                requestId={currentRequestContext?.requestId}
                collectionId={currentRequestContext?.collectionId}
                onClose={() => setShowVariables(false)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
