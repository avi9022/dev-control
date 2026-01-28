import type { FC } from 'react'
import { Badge } from '@/components/ui/badge'
import { Clock, ArrowDownToLine } from 'lucide-react'

interface ResponseMetaProps {
  status: number
  statusText: string
  time: number
  size: number
}

const getStatusColor = (status: number): string => {
  if (status >= 200 && status < 300) return 'bg-green-600 text-white'
  if (status >= 300 && status < 400) return 'bg-blue-600 text-white'
  if (status >= 400 && status < 500) return 'bg-yellow-600 text-white'
  if (status >= 500) return 'bg-red-600 text-white'
  return 'bg-gray-600 text-white'
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const formatTime = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export const ResponseMeta: FC<ResponseMetaProps> = ({
  status,
  statusText,
  time,
  size,
}) => {
  return (
    <div className="flex items-center gap-1.5">
      <Badge className={`${getStatusColor(status)} text-[10px] h-5 px-1.5`}>
        {status} {statusText}
      </Badge>
      <Badge variant="outline" className="gap-1 font-mono text-[10px] h-5 px-1.5">
        <Clock className="size-2.5" />
        {formatTime(time)}
      </Badge>
      <Badge variant="outline" className="gap-1 font-mono text-[10px] h-5 px-1.5">
        <ArrowDownToLine className="size-2.5" />
        {formatSize(size)}
      </Badge>
    </div>
  )
}
