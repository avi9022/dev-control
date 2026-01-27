import type { FC } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RequestUrlBarProps {
  method: ApiHttpMethod
  url: string
  isSending: boolean
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

      <Input
        placeholder="Enter request URL..."
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 font-mono text-sm"
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

      {isSending && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
