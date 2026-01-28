import { useState, useCallback, type FC } from 'react'
import { useApiClient } from '@/ui/contexts/api-client'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { RequestUrlBar } from './RequestUrlBar'
import { RequestTabs } from './RequestTabs'
import { ResponsePanel } from './ResponsePanel'

const DEFAULT_BODY: ApiRequestBody = { type: 'none', content: '' }
const DEFAULT_AUTH: ApiAuth = { type: 'none' }

export const ScratchRequestPanel: FC = () => {
  const { scratchRequest, sendRequest, cancelRequest } = useApiClient()

  const [method, setMethod] = useState<ApiHttpMethod>(scratchRequest?.method ?? 'GET')
  const [url, setUrl] = useState(scratchRequest?.url ?? '')
  const [params, setParams] = useState<ApiKeyValue[]>(scratchRequest?.params ?? [])
  const [headers, setHeaders] = useState<ApiKeyValue[]>(scratchRequest?.headers ?? [])
  const [auth, setAuth] = useState<ApiAuth>(scratchRequest?.auth ?? DEFAULT_AUTH)
  const [body, setBody] = useState<ApiRequestBody>(scratchRequest?.body ?? DEFAULT_BODY)
  const [response, setResponse] = useState<ApiResponse | null>(null)
  const [responseError, setResponseError] = useState<string | undefined>()
  const [isSending, setIsSending] = useState(false)

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

  const hasResponse = response !== null || responseError !== undefined

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <RequestUrlBar
          method={method}
          url={url}
          isSending={isSending}
          headers={headers}
          body={body}
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
