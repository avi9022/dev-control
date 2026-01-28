import type { FC } from 'react'
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
}

const METHOD_COLORS: Record<ApiHttpMethod, string> = {
  GET: 'text-green-500',
  POST: 'text-yellow-500',
  PUT: 'text-blue-500',
  PATCH: 'text-orange-500',
  DELETE: 'text-red-500',
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
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSending) {
      onSend()
    }
  }

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
    }

    navigator.clipboard.writeText(parts.join(' \\\n  '))
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={method}
        onValueChange={(v) => onMethodChange(v as ApiHttpMethod)}
      >
        <SelectTrigger className={`w-32 font-semibold ${METHOD_COLORS[method]}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {METHODS.map((m) => (
            <SelectItem key={m} value={m}>
              <span className={`font-semibold ${METHOD_COLORS[m]}`}>{m}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <VariableInput
        placeholder="Enter request URL..."
        value={url}
        onChange={onUrlChange}
        onKeyDown={handleKeyDown}
      />

      {isSending ? (
        <Button variant="destructive" size="sm" onClick={onCancel}>
          <X className="size-4" />
          Cancel
        </Button>
      ) : (
        <Button size="sm" onClick={onSend}>
          <Send className="size-4" />
          Send
        </Button>
      )}

      <Button variant="ghost" size="icon" className="size-8" onClick={handleCopyCurl} title="Copy as cURL">
        <Copy className="size-4" />
      </Button>

      {isSending && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
