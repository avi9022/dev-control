import type { FC } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KeyValueTable } from './KeyValueTable'
import { RequestAuthEditor } from './RequestAuthEditor'
import { RequestBodyEditor } from './RequestBodyEditor'

interface RequestTabsProps {
  params: ApiKeyValue[]
  headers: ApiKeyValue[]
  auth: ApiAuth
  body: ApiRequestBody
  onParamsChange: (params: ApiKeyValue[]) => void
  onHeadersChange: (headers: ApiKeyValue[]) => void
  onAuthChange: (auth: ApiAuth) => void
  onBodyChange: (body: ApiRequestBody) => void
}

const countEnabled = (items: ApiKeyValue[]): number =>
  items.filter((i) => i.enabled && i.key.length > 0).length

export const RequestTabs: FC<RequestTabsProps> = ({
  params,
  headers,
  auth,
  body,
  onParamsChange,
  onHeadersChange,
  onAuthChange,
  onBodyChange,
}) => {
  const paramsCount = countEnabled(params)
  const headersCount = countEnabled(headers)

  return (
    <Tabs defaultValue="params" className="flex flex-col flex-1 min-h-0">
      <TabsList className="w-fit">
        <TabsTrigger value="params">
          Params
          {paramsCount > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({paramsCount})
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="headers">
          Headers
          {headersCount > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({headersCount})
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="auth">Auth</TabsTrigger>
        <TabsTrigger value="body">Body</TabsTrigger>
      </TabsList>

      <TabsContent value="params" className="overflow-auto p-2">
        <KeyValueTable
          items={params}
          onChange={onParamsChange}
          showDescription
        />
      </TabsContent>

      <TabsContent value="headers" className="overflow-auto p-2">
        <KeyValueTable
          items={headers}
          onChange={onHeadersChange}
          showDescription
        />
      </TabsContent>

      <TabsContent value="auth" className="overflow-auto p-2">
        <RequestAuthEditor auth={auth} onChange={onAuthChange} />
      </TabsContent>

      <TabsContent value="body" className="overflow-auto p-2">
        <RequestBodyEditor body={body} onChange={onBodyChange} />
      </TabsContent>
    </Tabs>
  )
}
