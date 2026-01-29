import { useState, useEffect, useMemo, useCallback, useRef, type FC } from 'react'
import { useApiClient } from '@/ui/contexts/api-client'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { RequestUrlBar } from './RequestUrlBar'
import { RequestTabs } from './RequestTabs'
import { ResponsePanel } from './ResponsePanel'
import { CodeSnippetPanel } from './CodeSnippetPanel'
import { useUrlParamsSync } from '@/ui/hooks/useUrlParamsSync'
import { ChevronRight, Code2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ParsedCurl } from '@/ui/utils/curl-parser'
import type { InsertRule } from './InsertVariableEditor'

interface RequestPanelProps {
  requestId: string
}

const DEFAULT_BODY: ApiRequestBody = {
  type: 'none',
  content: '',
}

const DEFAULT_AUTH: ApiAuth = {
  type: 'none',
}

// Find path to request: returns [collection, ...folders, request]
interface PathSegment {
  id: string
  name: string
  type: 'collection' | 'folder' | 'request'
}

function findPathToRequest(
  collections: ApiCollection[],
  requestId: string
): { path: PathSegment[]; collectionId: string } | null {
  for (const collection of collections) {
    const itemPath = findItemPath(collection.items, requestId, [])
    if (itemPath) {
      return {
        path: [
          { id: collection.id, name: collection.name, type: 'collection' },
          ...itemPath.map(item => ({
            id: item.id,
            name: item.name,
            type: item.type as 'folder' | 'request',
          })),
        ],
        collectionId: collection.id,
      }
    }
  }
  return null
}

function findItemPath(
  items: ApiCollectionItem[],
  targetId: string,
  currentPath: ApiCollectionItem[]
): ApiCollectionItem[] | null {
  for (const item of items) {
    if (item.id === targetId) {
      return [...currentPath, item]
    }
    if (item.type === 'folder' && item.items) {
      const found = findItemPath(item.items, targetId, [...currentPath, item])
      if (found) return found
    }
  }
  return null
}

function findRequestInCollections(
  collections: ApiCollection[],
  requestId: string
): { item: ApiCollectionItem; collectionId: string } | null {
  const result = findPathToRequest(collections, requestId)
  if (!result) return null
  // Find the actual item with request data
  for (const collection of collections) {
    const found = findInItems(collection.items, requestId)
    if (found) return { item: found, collectionId: result.collectionId }
  }
  return null
}

function findInItems(
  items: ApiCollectionItem[],
  id: string
): ApiCollectionItem | null {
  for (const item of items) {
    if (item.id === id) return item
    if (item.items) {
      const found = findInItems(item.items, id)
      if (found) return found
    }
  }
  return null
}

// Helper to get value from nested object using dot notation
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export const RequestPanel: FC<RequestPanelProps> = ({ requestId }) => {
  const { activeWorkspace, sendRequest, cancelRequest, updateRequest, renameItem, updateEnvironment } =
    useApiClient()

  const found = useMemo(() => {
    if (!activeWorkspace) return null
    return findRequestInCollections(activeWorkspace.collections, requestId)
  }, [activeWorkspace, requestId])

  // Get the path to the request for breadcrumb
  const requestPath = useMemo(() => {
    if (!activeWorkspace) return null
    return findPathToRequest(activeWorkspace.collections, requestId)
  }, [activeWorkspace, requestId])

  const [method, setMethod] = useState<ApiHttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [params, setParams] = useState<ApiKeyValue[]>([])
  const [headers, setHeaders] = useState<ApiKeyValue[]>([])
  const [auth, setAuth] = useState<ApiAuth>(DEFAULT_AUTH)
  const [body, setBody] = useState<ApiRequestBody>(DEFAULT_BODY)
  const [insertRules, setInsertRules] = useState<InsertRule[]>([])
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [responseError, setResponseError] = useState<string | undefined>()
  const [isSending, setIsSending] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renamingValue, setRenamingValue] = useState('')
  const [showCodeSnippet, setShowCodeSnippet] = useState(false)
  const [codeSnippetWidth, setCodeSnippetWidth] = useState(400)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const prevRequestIdRef = useRef<string | null>(null)

  // Bidirectional URL-Params sync
  const { handleUrlChange, handleParamsChange } = useUrlParamsSync(url, params, setUrl, setParams)

  // Load request data only when switching to a different request
  useEffect(() => {
    if (prevRequestIdRef.current === requestId) return
    prevRequestIdRef.current = requestId

    if (!found?.item.request) return
    const req = found.item.request
    setMethod(req.method)
    setUrl(req.url)
    setParams(req.params)
    setHeaders(req.headers)
    setAuth(req.auth ?? DEFAULT_AUTH)
    setBody(req.body ?? DEFAULT_BODY)
    setInsertRules((req as ApiRequestConfig & { insertRules?: InsertRule[] }).insertRules ?? [])
    setResponse(null)
    setResponseError(undefined)
  }, [requestId, found?.item.request])

  const buildConfig = useCallback((): ApiRequestConfig & { insertRules?: InsertRule[] } => ({
    method,
    url,
    params,
    headers,
    auth,
    body,
    insertRules: insertRules.length > 0 ? insertRules : undefined,
  }), [method, url, params, headers, auth, body, insertRules])

  // Process insert rules after successful response
  const processInsertRules = useCallback(async (responseBody: string) => {
    if (!activeWorkspace || insertRules.length === 0) return

    const enabledRules = insertRules.filter(
      (r) => r.enabled && r.variableName && r.responseKey
    )
    if (enabledRules.length === 0) return

    // Try to parse response as JSON
    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(responseBody)
    } catch {
      // Response is not JSON, can't extract values
      return
    }

    const activeEnv = activeWorkspace.environments.find(
      (e) => e.id === activeWorkspace.activeEnvironmentId
    )
    if (!activeEnv) return

    // Build updated variables
    let updatedVariables = [...activeEnv.variables]
    let hasChanges = false

    for (const rule of enabledRules) {
      const extractedValue = getNestedValue(parsedBody, rule.responseKey)
      if (extractedValue !== undefined && extractedValue !== null) {
        const stringValue = typeof extractedValue === 'string'
          ? extractedValue
          : JSON.stringify(extractedValue)

        const existingIdx = updatedVariables.findIndex((v) => v.key === rule.variableName)
        if (existingIdx >= 0) {
          // Update existing variable
          if (updatedVariables[existingIdx].value !== stringValue) {
            updatedVariables = updatedVariables.map((v, i) =>
              i === existingIdx ? { ...v, value: stringValue } : v
            )
            hasChanges = true
          }
        } else {
          // Add new variable
          updatedVariables = [
            ...updatedVariables,
            { key: rule.variableName, value: stringValue, type: 'default' as const, enabled: true },
          ]
          hasChanges = true
        }
      }
    }

    if (hasChanges) {
      await updateEnvironment(activeEnv.id, { ...activeEnv, variables: updatedVariables })
    }
  }, [activeWorkspace, insertRules, updateEnvironment])

  const handleSend = useCallback(async () => {
    setIsSending(true)
    setResponseError(undefined)
    try {
      const config = buildConfig()

      if (found) {
        await updateRequest(found.collectionId, requestId, config)
      }

      // Pass requestId and collectionId for auth inheritance
      const result = await sendRequest(config, requestId, found?.collectionId)
      setResponse(result)

      // Process insert rules to extract values from response
      if (result.status >= 200 && result.status < 300) {
        await processInsertRules(result.body)
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred'
      setResponseError(message)
      setResponse(null)
    } finally {
      setIsSending(false)
    }
  }, [buildConfig, found, requestId, sendRequest, updateRequest, processInsertRules])

  const handleCancel = useCallback(async () => {
    try {
      await cancelRequest()
    } catch {
      // cancellation may fail if request already completed
    } finally {
      setIsSending(false)
    }
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

  const handleStartRename = useCallback(() => {
    if (!found) return
    setRenamingValue(found.item.name)
    setIsRenaming(true)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }, [found])

  const handleRename = useCallback(async () => {
    if (!found || !renamingValue.trim()) {
      setIsRenaming(false)
      return
    }
    await renameItem(found.collectionId, requestId, renamingValue.trim())
    setIsRenaming(false)
  }, [found, renamingValue, renameItem, requestId])

  // Handle resize for code snippet panel
  const handleCodeSnippetResize = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX
    const startWidth = codeSnippetWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      const diff = startX - e.clientX
      const newWidth = Math.min(Math.max(startWidth + diff, 300), 700)
      setCodeSnippetWidth(newWidth)
    }

    const handleMouseUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [codeSnippetWidth])

  if (!found) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-xs">Request not found</p>
      </div>
    )
  }

  const requestName = found.item.name

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Breadcrumb Path with Code button */}
        {requestPath && (
          <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/30 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
              {requestPath.path.map((segment, index) => {
                const isLast = index === requestPath.path.length - 1
                return (
                  <div key={segment.id} className="flex items-center gap-1 min-w-0">
                    {index > 0 && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                    {isLast ? (
                      // Editable request name
                      isRenaming ? (
                        <input
                          ref={renameInputRef}
                          value={renamingValue}
                          onChange={(e) => setRenamingValue(e.target.value)}
                          onBlur={handleRename}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename()
                            if (e.key === 'Escape') setIsRenaming(false)
                          }}
                          className="h-5 px-1.5 rounded border border-primary bg-background text-[11px] font-medium outline-none min-w-[60px]"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={handleStartRename}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[11px] font-medium truncate max-w-[200px]",
                            "hover:bg-accent border border-transparent hover:border-border transition-colors"
                          )}
                          title="Click to rename"
                        >
                          {requestName}
                        </button>
                      )
                    ) : (
                      <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                        {segment.name}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Code Snippet toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showCodeSnippet ? 'default' : 'ghost'}
                  size="sm"
                  className="h-6 gap-1 text-[11px] px-2 flex-shrink-0"
                  onClick={() => setShowCodeSnippet(v => !v)}
                >
                  <Code2 className="h-3 w-3" />
                  Code
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">Generate code snippet</TooltipContent>
            </Tooltip>
          </div>
        )}

      <div className="p-2 border-b min-w-0 overflow-hidden">
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

      <ResizablePanelGroup direction="vertical" className="flex-1">
        <ResizablePanel defaultSize={50} minSize={15}>
          <div className="h-full overflow-hidden p-2 flex flex-col">
            <RequestTabs
              method={method}
              params={params}
              headers={headers}
              auth={auth}
              body={body}
              insertRules={insertRules}
              onParamsChange={handleParamsChange}
              onHeadersChange={setHeaders}
              onAuthChange={setAuth}
              onBodyChange={setBody}
              onInsertRulesChange={setInsertRules}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={15}>
          <ResponsePanel response={response} error={responseError} />
        </ResizablePanel>
      </ResizablePanelGroup>
      </div>

      {/* Code Snippet Panel */}
      {showCodeSnippet && (
        <>
          {/* Resize handle */}
          <div
            onMouseDown={handleCodeSnippetResize}
            className="w-1 hover:w-1.5 bg-border hover:bg-primary/50 cursor-col-resize flex items-center justify-center group transition-all flex-shrink-0"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Code snippet panel */}
          <div style={{ width: codeSnippetWidth }} className="flex-shrink-0 h-full">
            <CodeSnippetPanel
              method={method}
              url={url}
              headers={headers}
              params={params}
              body={body}
              auth={auth}
              requestId={requestId}
              collectionId={found?.collectionId}
              onClose={() => setShowCodeSnippet(false)}
            />
          </div>
        </>
      )}
    </div>
  )
}
