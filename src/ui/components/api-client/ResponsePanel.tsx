import { useState, useMemo, type FC } from 'react'
import { AlertCircle } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ResponseMeta } from './ResponseMeta'

interface ResponsePanelProps {
  response: ApiResponse | null
  error?: string
}

const tryFormatJson = (body: string): { formatted: string; isJson: boolean } => {
  try {
    const parsed = JSON.parse(body)
    return { formatted: JSON.stringify(parsed, null, 2), isJson: true }
  } catch {
    return { formatted: body, isJson: false }
  }
}

export const ResponsePanel: FC<ResponsePanelProps> = ({ response, error }) => {
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty')

  const parsedBody = useMemo(() => {
    if (!response) return { formatted: '', isJson: false }
    return tryFormatJson(response.body)
  }, [response])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-destructive p-4">
        <AlertCircle className="size-8" />
        <p className="text-sm font-medium">Request Failed</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {error}
        </p>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Send a request to see the response</p>
      </div>
    )
  }

  const headerEntries = Object.entries(response.headers)

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between px-2 pt-2">
        <ResponseMeta
          status={response.status}
          statusText={response.statusText}
          time={response.time}
          size={response.size}
        />
      </div>

      <Tabs defaultValue="body" className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-2">
          <TabsList className="w-fit">
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger value="headers">
              Headers
              {headerEntries.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({headerEntries.length})
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === 'pretty' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setViewMode('pretty')}
            >
              Pretty
            </Button>
            <Button
              variant={viewMode === 'raw' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setViewMode('raw')}
            >
              Raw
            </Button>
          </div>
        </div>

        <TabsContent value="body" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <pre className="p-3 text-xs font-mono text-foreground whitespace-pre-wrap break-all">
              {viewMode === 'pretty' && parsedBody.isJson
                ? parsedBody.formatted
                : response.body}
            </pre>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="headers" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {headerEntries.map(([name, value]) => (
                  <tr key={name} className="border-b border-border/50">
                    <td className="py-1.5 px-3 font-mono text-xs text-foreground">
                      {name}
                    </td>
                    <td className="py-1.5 px-3 font-mono text-xs text-muted-foreground break-all">
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
