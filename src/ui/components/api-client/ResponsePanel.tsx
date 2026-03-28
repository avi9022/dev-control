import { useState, useMemo, useCallback, useRef, type FC, type ReactNode } from 'react'
import { AlertCircle, Copy, Check, Download } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ResponseMeta } from './ResponseMeta'
import { JsonViewer } from './JsonViewer'
import { cn } from '@/lib/utils'

interface ResponsePanelProps {
  response: ApiResponse | null
  error?: string
}

const isJson = (body: string): boolean => {
  try {
    JSON.parse(body)
    return true
  } catch {
    return false
  }
}

const isHtml = (body: string): boolean => {
  return body.trim().startsWith('<!') || body.trim().startsWith('<html')
}

const isXml = (body: string): boolean => {
  return body.trim().startsWith('<?xml') || (body.trim().startsWith('<') && !isHtml(body))
}

const formatXml = (xml: string): string => {
  let formatted = ''
  let indent = ''
  const tab = '  '
  xml.split(/>\s*</).forEach((node) => {
    if (node.match(/^\/\w/)) {
      indent = indent.substring(tab.length)
    }
    formatted += indent + '<' + node + '>\n'
    if (node.match(/^<?\w[^>]*[^/]$/) && !node.startsWith('?')) {
      indent += tab
    }
  })
  return formatted.substring(1, formatted.length - 2)
}

const getContentType = (headers: Record<string, string>): string => {
  const contentType = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === 'content-type'
  )
  return contentType?.[1] ?? ''
}

const detectBodyType = (body: string, headers: Record<string, string>): 'json' | 'xml' | 'html' | 'text' => {
  const contentType = getContentType(headers).toLowerCase()

  if (contentType.includes('json') || isJson(body)) return 'json'
  if (contentType.includes('xml') || isXml(body)) return 'xml'
  if (contentType.includes('html') || isHtml(body)) return 'html'
  return 'text'
}

export const ResponsePanel: FC<ResponsePanelProps> = ({ response, error }) => {
  const [viewMode, setViewMode] = useState<'pretty' | 'raw' | 'preview'>('pretty')
  const [copied, setCopied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const bodyType = useMemo(() => {
    if (!response) return 'text'
    return detectBodyType(response.body, response.headers)
  }, [response])

  const formattedBody = useMemo(() => {
    if (!response) return ''
    if (bodyType === 'xml') {
      try {
        return formatXml(response.body)
      } catch {
        return response.body
      }
    }
    return response.body
  }, [response, bodyType])

  const handleCopy = useCallback(() => {
    if (!response) return
    navigator.clipboard.writeText(response.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [response])

  const handleDownload = useCallback(() => {
    if (!response) return
    const blob = new Blob([response.body], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `response.${bodyType === 'json' ? 'json' : bodyType === 'xml' ? 'xml' : bodyType === 'html' ? 'html' : 'txt'}`
    a.click()
    URL.revokeObjectURL(url)
  }, [response, bodyType])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
          <AlertCircle className="size-6 text-destructive" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-destructive">Request Failed</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="text-xs">Send a request to see the response</p>
      </div>
    )
  }

  const headerEntries = Object.entries(response.headers)
  const showPreview = bodyType === 'html'

  return (
    <div className="flex flex-col h-full">
      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <ResponseMeta
          status={response.status}
          statusText={response.statusText}
          time={response.time}
          size={response.size}
        />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDownload}
            title="Download response"
          >
            <Download className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={handleCopy}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="body" className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b">
          <TabsList className="h-7 p-0.5 bg-muted/50">
            <TabsTrigger value="body" className="text-[11px] h-6 px-2.5 data-[state=active]:bg-background">
              Body
              <span className={cn(
                "ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium",
                bodyType === 'json' && "bg-status-yellow-bg text-yellow-600 dark:text-yellow-400",
                bodyType === 'xml' && "bg-orange-500/20 text-orange-600 dark:text-orange-400",
                bodyType === 'html' && "bg-blue-500/20 text-blue-600 dark:text-blue-400",
                bodyType === 'text' && "bg-gray-500/20 text-gray-600 dark:text-gray-400",
              )}>
                {bodyType.toUpperCase()}
              </span>
            </TabsTrigger>
            <TabsTrigger value="headers" className="text-[11px] h-6 px-2.5 data-[state=active]:bg-background">
              Headers
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-muted text-muted-foreground">
                {headerEntries.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-0.5">
            <Button
              variant={viewMode === 'pretty' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setViewMode('pretty')}
            >
              Pretty
            </Button>
            <Button
              variant={viewMode === 'raw' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setViewMode('raw')}
            >
              Raw
            </Button>
            {showPreview && (
              <Button
                variant={viewMode === 'preview' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setViewMode('preview')}
              >
                Preview
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="body" className="flex-1 m-0 min-h-0">
          {viewMode === 'preview' && bodyType === 'html' ? (
            <iframe
              ref={iframeRef}
              srcDoc={response.body}
              className="w-full h-full border-0 bg-white"
              sandbox="allow-same-origin"
              title="Response Preview"
            />
          ) : (
            <ScrollArea className="h-full w-full">
              <div className="p-3 overflow-hidden">
                {viewMode === 'pretty' && bodyType === 'json' ? (
                  <JsonViewer data={response.body} maxInitialDepth={4} className="overflow-hidden" />
                ) : viewMode === 'pretty' && bodyType === 'xml' ? (
                  <XmlHighlighter xml={formattedBody} />
                ) : (
                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-all text-foreground">
                    {viewMode === 'raw' ? response.body : formattedBody}
                  </pre>
                )}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="headers" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-2">
              {headerEntries.map(([name, value]) => (
                <HeaderRow key={name} name={name} value={value} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Header row with copy functionality
const HeaderRow: FC<{ name: string; value: string }> = ({ name, value }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-muted/50 group">
      <span className="font-mono text-[11px] text-purple-400 font-medium min-w-[140px] flex-shrink-0">
        {name}
      </span>
      <span className="font-mono text-[11px] text-status-green break-all flex-1">
        {value}
      </span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded"
        title="Copy value"
      >
        {copied ? (
          <Check className="h-3 w-3 text-status-green" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}

// XML Syntax Highlighter using React elements (safe)
const XmlHighlighter: FC<{ xml: string }> = ({ xml }) => {
  const elements = useMemo(() => {
    const result: ReactNode[] = []
    let key = 0

    // Simple tokenization for XML
    const regex = /(<\/?[\w:-]+)|(\s+[\w:-]+=)|("[^"]*")|('[^']*')|(>)|(<!--[\s\S]*?-->)|([^<>"']+)/g
    let match

    while ((match = regex.exec(xml)) !== null) {
      const [fullMatch] = match

      if (fullMatch.startsWith('<!--')) {
        result.push(<span key={key++} className="text-muted-foreground">{fullMatch}</span>)
      } else if (fullMatch.startsWith('</') || fullMatch.startsWith('<')) {
        const tagName = fullMatch.replace(/[</>]/g, '')
        result.push(
          <span key={key++}>
            <span className="text-muted-foreground">{fullMatch.startsWith('</') ? '</' : '<'}</span>
            <span className="text-cyan-400">{tagName}</span>
          </span>
        )
      } else if (fullMatch.match(/^\s+[\w:-]+=$/)) {
        const attrName = fullMatch.trim().replace('=', '')
        result.push(
          <span key={key++}>
            {' '}<span className="text-purple-400">{attrName}</span>=
          </span>
        )
      } else if (fullMatch.startsWith('"') || fullMatch.startsWith("'")) {
        result.push(<span key={key++} className="text-status-green">{fullMatch}</span>)
      } else if (fullMatch === '>') {
        result.push(<span key={key++} className="text-muted-foreground">{'>'}</span>)
      } else {
        result.push(<span key={key++}>{fullMatch}</span>)
      }
    }

    return result
  }, [xml])

  return (
    <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">
      {elements}
    </pre>
  )
}
