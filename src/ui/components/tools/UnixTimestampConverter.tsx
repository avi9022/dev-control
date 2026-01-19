import { useState, useEffect, type FC } from 'react'
import { ToolLayout } from './shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CopyButton } from './shared/CopyButton'
import { RefreshCw } from 'lucide-react'

export const UnixTimestampConverter: FC = () => {
  const [timestamp, setTimestamp] = useState('')
  const [dateString, setDateString] = useState('')
  const [currentTimestamp, setCurrentTimestamp] = useState(Math.floor(Date.now() / 1000))
  const [error, setError] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimestamp(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleTimestampChange = (value: string) => {
    setTimestamp(value)
    setError('')

    if (!value.trim()) {
      setDateString('')
      return
    }

    const num = parseInt(value, 10)
    if (isNaN(num)) {
      setError('Invalid timestamp')
      setDateString('')
      return
    }

    const ms = value.length > 10 ? num : num * 1000
    const date = new Date(ms)

    if (isNaN(date.getTime())) {
      setError('Invalid timestamp')
      setDateString('')
      return
    }

    setDateString(date.toISOString())
  }

  const handleDateChange = (value: string) => {
    setDateString(value)
    setError('')

    if (!value.trim()) {
      setTimestamp('')
      return
    }

    const date = new Date(value)
    if (isNaN(date.getTime())) {
      setError('Invalid date format')
      setTimestamp('')
      return
    }

    setTimestamp(Math.floor(date.getTime() / 1000).toString())
  }

  const setNow = () => {
    const now = new Date()
    setTimestamp(Math.floor(now.getTime() / 1000).toString())
    setDateString(now.toISOString())
    setError('')
  }

  const formatDate = (ts: number) => {
    const date = new Date(ts * 1000)
    return {
      iso: date.toISOString(),
      local: date.toLocaleString(),
      utc: date.toUTCString(),
      relative: getRelativeTime(date),
    }
  }

  const getRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 0) return 'in the future'
    if (diffSecs < 60) return `${diffSecs} seconds ago`
    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 30) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const parsedTs = parseInt(timestamp, 10)
  const formatted = !isNaN(parsedTs) ? formatDate(parsedTs) : null

  return (
    <ToolLayout
      title="Unix Timestamp Converter"
      description="Convert between Unix timestamps and human-readable dates"
    >
      <div className="space-y-6">
        <div className="bg-muted/50 p-4 rounded-md">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Current Unix Timestamp</p>
              <p className="text-2xl font-mono font-bold">{currentTimestamp}</p>
            </div>
            <CopyButton text={currentTimestamp.toString()} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Unix Timestamp</label>
            <div className="flex gap-2">
              <Input
                value={timestamp}
                onChange={(e) => handleTimestampChange(e.target.value)}
                placeholder="1234567890"
                className="font-mono"
              />
              <Button variant="outline" onClick={setNow}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Date/Time (ISO 8601)</label>
            <Input
              value={dateString}
              onChange={(e) => handleDateChange(e.target.value)}
              placeholder="2024-01-01T00:00:00.000Z"
              className="font-mono"
            />
          </div>
        </div>

        {error && (
          <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {formatted && !error && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Formatted Output</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'ISO 8601', value: formatted.iso },
                { label: 'Local Time', value: formatted.local },
                { label: 'UTC', value: formatted.utc },
                { label: 'Relative', value: formatted.relative },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/50 p-3 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <CopyButton text={value} />
                  </div>
                  <p className="font-mono text-sm mt-1">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Supports both seconds (10 digits) and milliseconds (13 digits) timestamps.</p>
          <p>Enter a timestamp or date in ISO 8601 format to convert.</p>
        </div>
      </div>
    </ToolLayout>
  )
}
