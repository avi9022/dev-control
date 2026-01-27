import { useState, useEffect, useMemo, useCallback, type FC } from 'react'
import { useApiClient } from '@/ui/contexts/api-client'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { RequestUrlBar } from './RequestUrlBar'
import { RequestTabs } from './RequestTabs'
import { ResponsePanel } from './ResponsePanel'

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

function findRequestInCollections(
  collections: ApiCollection[],
  requestId: string
): { item: ApiCollectionItem; collectionId: string } | null {
  for (const collection of collections) {
    const found = findInItems(collection.items, requestId)
    if (found) return { item: found, collectionId: collection.id }
  }
  return null
}

export const RequestPanel: FC<RequestPanelProps> = ({ requestId }) => {
  const { activeWorkspace, sendRequest, cancelRequest, updateRequest } =
    useApiClient()

  const found = useMemo(() => {
    if (!activeWorkspace) return null
    return findRequestInCollections(activeWorkspace.collections, requestId)
  }, [activeWorkspace, requestId])

  const [method, setMethod] = useState<ApiHttpMethod>('GET')
  const [url, setUrl] = useState('')
  const [params, setParams] = useState<ApiKeyValue[]>([])
  const [headers, setHeaders] = useState<ApiKeyValue[]>([])
  const [auth, setAuth] = useState<ApiAuth>(DEFAULT_AUTH)
  const [body, setBody] = useState<ApiRequestBody>(DEFAULT_BODY)
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [responseError, setResponseError] = useState<string | undefined>()
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (!found?.item.request) return
    const req = found.item.request
    setMethod(req.method)
    setUrl(req.url)
    setParams(req.params)
    setHeaders(req.headers)
    setAuth(req.auth ?? DEFAULT_AUTH)
    setBody(req.body ?? DEFAULT_BODY)
    setResponse(null)
    setResponseError(undefined)
  }, [found?.item.request, requestId])

  const buildConfig = useCallback((): ApiRequestConfig => ({
    method,
    url,
    params,
    headers,
    auth,
    body,
  }), [method, url, params, headers, auth, body])

  const handleSend = useCallback(async () => {
    setIsSending(true)
    setResponseError(undefined)
    try {
      const config = buildConfig()

      if (found) {
        await updateRequest(found.collectionId, requestId, config)
      }

      const result = await sendRequest(config)
      setResponse(result)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred'
      setResponseError(message)
      setResponse(null)
    } finally {
      setIsSending(false)
    }
  }, [buildConfig, found, requestId, sendRequest, updateRequest])

  const handleCancel = useCallback(async () => {
    try {
      await cancelRequest()
    } catch {
      // cancellation may fail if request already completed
    } finally {
      setIsSending(false)
    }
  }, [cancelRequest])

  if (!found) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Request not found</p>
      </div>
    )
  }

  const hasResponse = response !== null || responseError !== undefined

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <RequestUrlBar
          method={method}
          url={url}
          isSending={isSending}
          onMethodChange={setMethod}
          onUrlChange={setUrl}
          onSend={handleSend}
          onCancel={handleCancel}
        />
      </div>

      <ResizablePanelGroup direction="vertical" className="flex-1">
        <ResizablePanel defaultSize={hasResponse ? 50 : 100} minSize={20}>
          <div className="h-full overflow-auto p-3">
            <RequestTabs
              params={params}
              headers={headers}
              auth={auth}
              body={body}
              onParamsChange={setParams}
              onHeadersChange={setHeaders}
              onAuthChange={setAuth}
              onBodyChange={setBody}
            />
          </div>
        </ResizablePanel>

        {hasResponse && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={20}>
              <ResponsePanel response={response} error={responseError} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
}
