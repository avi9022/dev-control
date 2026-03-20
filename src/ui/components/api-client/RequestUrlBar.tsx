import { useCallback, type FC } from 'react'
import { Loader2, Send, X, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VariableInput } from './VariableInput'
import { isCurlCommand, parseCurl, type ParsedCurl } from '@/ui/utils/curl-parser'
import { toast } from 'sonner'

interface RequestUrlBarProps {
  method: ApiHttpMethod
  url: string
  isSending: boolean
  headers?: ApiKeyValue[]
  body?: ApiRequestBody
  onMethodChange: (method: ApiHttpMethod) => void
  onUrlChange: (url: string) => void
  onSend: () => void
  onCancel: () => void
  onCurlImport?: (parsed: ParsedCurl) => void
}

const METHOD_COLORS: Record<ApiHttpMethod, string> = {
  GET: 'text-status-green',
  POST: 'text-status-yellow',
  PUT: 'text-blue-500',
  PATCH: 'text-orange-500',
  DELETE: 'text-status-red',
  HEAD: 'text-purple-500',
  OPTIONS: 'text-gray-500',
}

const METHODS: ApiHttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]

export const RequestUrlBar: FC<RequestUrlBarProps> = ({
  method,
  url,
  isSending,
  headers,
  body,
  onMethodChange,
  onUrlChange,
  onSend,
  onCancel,
  onCurlImport,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSending) {
      onSend()
    }
  }

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text')

    if (isCurlCommand(pastedText)) {
      e.preventDefault()

      const parsed = parseCurl(pastedText)
      if (parsed && onCurlImport) {
        onCurlImport(parsed)
        toast.success('cURL command imported', {
          description: `${parsed.method} ${parsed.url || 'request'}`,
        })
      } else {
        toast.error('Failed to parse cURL command')
      }
    }
  }, [onCurlImport])

  const handleChange = useCallback((value: string) => {
    // Also check for cURL on direct input (e.g., if paste event didn't fire)
    if (isCurlCommand(value) && onCurlImport) {
      const parsed = parseCurl(value)
      if (parsed) {
        onCurlImport(parsed)
        toast.success('cURL command imported', {
          description: `${parsed.method} ${parsed.url || 'request'}`,
        })
        return
      }
    }
    onUrlChange(value)
  }, [onCurlImport, onUrlChange])

  const handleCopyCurl = () => {
    const parts = ['curl']
    if (method !== 'GET') parts.push(`-X ${method}`)
    parts.push(`'${url}'`)

    for (const h of (headers ?? []).filter(h => h.enabled && h.key)) {
      parts.push(`-H '${h.key}: ${h.value}'`)
    }

    if (body && body.type === 'json' && body.content) {
      parts.push(`-H 'Content-Type: application/json'`)
      parts.push(`-d '${body.content}'`)
    } else if (body && body.type === 'raw' && body.content) {
      parts.push(`--data-raw '${body.content}'`)
    } else if (body && body.type === 'x-www-form-urlencoded' && body.formData?.length) {
      parts.push(`-H 'Content-Type: application/x-www-form-urlencoded'`)
      const formStr = body.formData
        .filter(f => f.enabled && f.key)
        .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
        .join('&')
      if (formStr) parts.push(`-d '${formStr}'`)
    } else if (body && body.type === 'form-data' && body.formData?.length) {
      for (const f of body.formData.filter(f => f.enabled && f.key)) {
        parts.push(`-F '${f.key}=${f.value}'`)
      }
    }

    navigator.clipboard.writeText(parts.join(' \\\n  '))
    toast.success('Copied as cURL')
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Select
        value={method}
        onValueChange={(v) => onMethodChange(v as ApiHttpMethod)}
      >
        <SelectTrigger className={`w-24 h-8 text-xs font-semibold ${METHOD_COLORS[method]}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {METHODS.map((m) => (
            <SelectItem key={m} value={m} className="text-xs">
              <span className={`font-semibold ${METHOD_COLORS[m]}`}>{m}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <VariableInput
        placeholder="Enter URL or paste cURL..."
        value={url}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="[&_input]:h-8 [&_input]:text-xs [&>div]:h-8 [&>div]:text-xs"
      />

      {isSending ? (
        <Button variant="destructive" size="sm" className="h-8 px-3 text-xs" onClick={onCancel}>
          <X className="size-3.5 mr-1" />
          Cancel
        </Button>
      ) : (
        <Button size="sm" className="h-8 px-3 text-xs" onClick={onSend}>
          <Send className="size-3.5 mr-1" />
          Send
        </Button>
      )}

      <Button variant="ghost" size="icon" className="size-7" onClick={handleCopyCurl} title="Copy as cURL">
        <Copy className="size-3.5" />
      </Button>

      {isSending && (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
