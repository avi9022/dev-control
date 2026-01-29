import { useState, useEffect, type FC } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KeyValueTable } from './KeyValueTable'
import { RequestAuthEditor } from './RequestAuthEditor'
import { RequestBodyEditor } from './RequestBodyEditor'
import { InsertVariableEditor, type InsertRule } from './InsertVariableEditor'

interface RequestTabsProps {
  method: ApiMethod
  params: ApiKeyValue[]
  headers: ApiKeyValue[]
  auth: ApiAuth
  body: ApiRequestBody
  insertRules: InsertRule[]
  onParamsChange: (params: ApiKeyValue[]) => void
  onHeadersChange: (headers: ApiKeyValue[]) => void
  onAuthChange: (auth: ApiAuth) => void
  onBodyChange: (body: ApiRequestBody) => void
  onInsertRulesChange: (rules: InsertRule[]) => void
}

const countEnabled = (items: ApiKeyValue[]): number =>
  items.filter((i) => i.enabled && i.key.length > 0).length

export const RequestTabs: FC<RequestTabsProps> = ({
  method,
  params,
  headers,
  auth,
  body,
  insertRules,
  onParamsChange,
  onHeadersChange,
  onAuthChange,
  onBodyChange,
  onInsertRulesChange,
}) => {
  const paramsCount = countEnabled(params)
  const headersCount = countEnabled(headers)

  // Methods that typically don't have a body
  const noBodyMethods = ['GET', 'DELETE', 'HEAD', 'OPTIONS']
  const defaultTab = noBodyMethods.includes(method) ? 'params' : 'body'

  // Track current tab and reset when method changes
  const [activeTab, setActiveTab] = useState(defaultTab)

  useEffect(() => {
    setActiveTab(noBodyMethods.includes(method) ? 'params' : 'body')
  }, [method])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 h-full">
      <TabsList className="w-fit h-8 p-0.5 flex-shrink-0">
        <TabsTrigger value="params" className="text-xs h-7 px-3">
          Params
          {paramsCount > 0 && (
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({paramsCount})
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="headers" className="text-xs h-7 px-3">
          Headers
          {headersCount > 0 && (
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({headersCount})
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="auth" className="text-xs h-7 px-3">Auth</TabsTrigger>
        <TabsTrigger value="body" className="text-xs h-7 px-3">Body</TabsTrigger>
        <TabsTrigger value="insert" className="text-xs h-7 px-3">
          Insert
          {insertRules.filter(r => r.enabled && r.variableName && r.responseKey).length > 0 && (
            <span className="ml-1 text-[10px] text-muted-foreground">
              ({insertRules.filter(r => r.enabled && r.variableName && r.responseKey).length})
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="params" className="flex-1 min-h-0 overflow-auto p-1.5 pt-2">
        <KeyValueTable
          items={params}
          onChange={onParamsChange}
          showDescription
        />
      </TabsContent>

      <TabsContent value="headers" className="flex-1 min-h-0 overflow-auto p-1.5 pt-2">
        <KeyValueTable
          items={headers}
          onChange={onHeadersChange}
          showDescription
        />
      </TabsContent>

      <TabsContent value="auth" className="flex-1 min-h-0 overflow-auto p-1.5 pt-2">
        <RequestAuthEditor auth={auth} onChange={onAuthChange} />
      </TabsContent>

      <TabsContent value="body" className="flex-1 min-h-0 overflow-hidden p-1.5 pt-2 flex flex-col">
        <RequestBodyEditor body={body} onChange={onBodyChange} />
      </TabsContent>

      <TabsContent value="insert" className="flex-1 min-h-0 overflow-auto p-1.5 pt-2">
        <InsertVariableEditor rules={insertRules} onChange={onInsertRulesChange} />
      </TabsContent>
    </Tabs>
  )
}
