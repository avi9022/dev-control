import { useState, useCallback, type FC } from 'react'
import { Save, ChevronRight, FolderOpen } from 'lucide-react'
import { useApiClient } from '@/ui/contexts/api-client'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { RequestUrlBar } from './RequestUrlBar'
import { RequestTabs } from './RequestTabs'
import { ResponsePanel } from './ResponsePanel'
import { useUrlParamsSync } from '@/ui/hooks/useUrlParamsSync'
import type { ParsedCurl } from '@/ui/utils/curl-parser'

const DEFAULT_BODY: ApiRequestBody = { type: 'none', content: '' }
const DEFAULT_AUTH: ApiAuth = { type: 'none' }

export const ScratchRequestPanel: FC = () => {
  const { scratchRequest, sendRequest, cancelRequest, activeWorkspace, saveRequestToCollection, createCollection } = useApiClient()

  const [method, setMethod] = useState<ApiHttpMethod>(scratchRequest?.method ?? 'GET')
  const [url, setUrl] = useState(scratchRequest?.url ?? '')
  const [params, setParams] = useState<ApiKeyValue[]>(scratchRequest?.params ?? [])
  const [headers, setHeaders] = useState<ApiKeyValue[]>(scratchRequest?.headers ?? [])
  const [auth, setAuth] = useState<ApiAuth>(scratchRequest?.auth ?? DEFAULT_AUTH)
  const [body, setBody] = useState<ApiRequestBody>(scratchRequest?.body ?? DEFAULT_BODY)

  // Bidirectional URL-Params sync
  const { handleUrlChange, handleParamsChange } = useUrlParamsSync(url, params, setUrl, setParams)
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [responseError, setResponseError] = useState<string | undefined>()
  const [isSending, setIsSending] = useState(false)

  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [requestName, setRequestName] = useState('')
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [newCollectionName, setNewCollectionName] = useState('')

  const buildConfig = useCallback((): ApiRequestConfig => ({
    method, url, params, headers, auth, body,
  }), [method, url, params, headers, auth, body])

  const handleSend = useCallback(async () => {
    setIsSending(true)
    setResponseError(undefined)
    try {
      const config = buildConfig()
      const result = await sendRequest(config)
      setResponse(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setResponseError(message)
      setResponse(null)
    } finally {
      setIsSending(false)
    }
  }, [buildConfig, sendRequest])

  const handleCancel = useCallback(async () => {
    try { await cancelRequest() } catch { /* may already be done */ } finally { setIsSending(false) }
  }, [cancelRequest])

  const handleCurlImport = useCallback((parsed: ParsedCurl) => {
    setMethod(parsed.method)
    setUrl(parsed.url)
    setParams(parsed.params.length > 0 ? parsed.params : [])
    setHeaders(parsed.headers.length > 0 ? parsed.headers : [])
    if (parsed.auth) {
      setAuth(parsed.auth)
    }
    if (parsed.body) {
      // Auto-format JSON body
      if (parsed.body.type === 'json' && parsed.body.content) {
        try {
          const formatted = JSON.stringify(JSON.parse(parsed.body.content), null, 2)
          setBody({ ...parsed.body, content: formatted })
        } catch {
          setBody(parsed.body)
        }
      } else {
        setBody(parsed.body)
      }
    }
  }, [])

  const handleOpenSaveDialog = () => {
    // Default name from URL or method
    const defaultName = url ? new URL(url.startsWith('http') ? url : `http://${url}`).pathname.split('/').filter(Boolean).pop() || 'New Request' : 'New Request'
    setRequestName(defaultName)
    setSelectedCollectionId(null)
    setSelectedFolderId(null)
    setSaveDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selectedCollectionId || !requestName.trim()) return
    const config = buildConfig()
    await saveRequestToCollection(selectedCollectionId, selectedFolderId, requestName.trim(), config)
    setSaveDialogOpen(false)
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return
    await createCollection(newCollectionName.trim())
    setNewCollectionName('')
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }))
  }

  const renderFolderTree = (items: ApiCollectionItem[], collectionId: string, depth = 0) => {
    return items.filter(item => item.type === 'folder').map(folder => (
      <div key={folder.id}>
        <button
          onClick={() => {
            setSelectedCollectionId(collectionId)
            setSelectedFolderId(folder.id)
            toggleFolder(folder.id)
          }}
          className={cn(
            "w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-accent text-left",
            selectedFolderId === folder.id && "bg-accent"
          )}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", expandedFolders[folder.id] && "rotate-90")} />
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate">{folder.name}</span>
        </button>
        {expandedFolders[folder.id] && folder.items && (
          renderFolderTree(folder.items, collectionId, depth + 1)
        )}
      </div>
    ))
  }

  const collections = activeWorkspace?.collections ?? []
  const canSave = !!activeWorkspace

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b flex items-center gap-2 min-w-0">
        <div className="flex-1 min-w-0 overflow-hidden">
          <RequestUrlBar
            method={method}
            url={url}
            isSending={isSending}
            headers={headers}
            body={body}
            onMethodChange={setMethod}
            onUrlChange={handleUrlChange}
            onSend={handleSend}
            onCancel={handleCancel}
            onCurlImport={handleCurlImport}
          />
        </div>
        {canSave && (
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleOpenSaveDialog}>
            <Save className="size-3.5 mr-1" />
            Save
          </Button>
        )}
      </div>
      <ResizablePanelGroup direction="vertical" className="flex-1">
        <ResizablePanel defaultSize={50} minSize={15}>
          <div className="h-full overflow-hidden p-2 flex flex-col">
            <RequestTabs
              method={method}
              params={params}
              headers={headers}
              auth={auth}
              body={body}
              onParamsChange={handleParamsChange}
              onHeadersChange={setHeaders}
              onAuthChange={setAuth}
              onBodyChange={setBody}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={15}>
          <ResponsePanel response={response} error={responseError} />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Save Request Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Save Request</DialogTitle>
            <DialogDescription className="text-xs">
              Choose a collection and optionally a folder to save this request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Request Name</label>
              <Input
                placeholder="Request name..."
                value={requestName}
                onChange={(e) => setRequestName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Save to Collection</label>
              {collections.length === 0 ? (
                <div className="border rounded p-3">
                  <p className="text-xs text-muted-foreground mb-2">No collections yet. Create one first.</p>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Collection name..."
                      value={newCollectionName}
                      onChange={(e) => setNewCollectionName(e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Button size="sm" className="h-7 text-xs" onClick={handleCreateCollection} disabled={!newCollectionName.trim()}>
                      Create
                    </Button>
                  </div>
                </div>
              ) : (
                <ScrollArea className="h-48 border rounded">
                  <div className="p-1">
                    {collections.map(collection => (
                      <div key={collection.id}>
                        <button
                          onClick={() => {
                            setSelectedCollectionId(collection.id)
                            setSelectedFolderId(null)
                          }}
                          className={cn(
                            "w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded hover:bg-accent text-left",
                            selectedCollectionId === collection.id && !selectedFolderId && "bg-accent"
                          )}
                        >
                          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{collection.name}</span>
                        </button>
                        {renderFolderTree(collection.items, collection.id)}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={!selectedCollectionId || !requestName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
