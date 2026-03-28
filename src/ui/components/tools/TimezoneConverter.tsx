import { useState, useMemo, type FC } from 'react'
import { ToolLayout } from './shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CopyButton } from './shared/CopyButton'
import { RefreshCw } from 'lucide-react'

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'Denver (MST/MDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
]

function formatInTimezone(date: Date, timezone: string): string {
  try {
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  } catch {
    return 'Invalid timezone'
  }
}

function getTimezoneOffset(date: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
    const parts = formatter.formatToParts(date)
    const offsetPart = parts.find((p) => p.type === 'timeZoneName')
    return offsetPart?.value || ''
  } catch {
    return ''
  }
}

export const TimezoneConverter: FC = () => {
  const [inputDate, setInputDate] = useState('')
  const [inputTime, setInputTime] = useState('')
  const [fromTimezone, setFromTimezone] = useState('UTC')
  const [toTimezone, setToTimezone] = useState('America/New_York')

  const result = useMemo(() => {
    if (!inputDate || !inputTime) return null

    try {
      const dateTimeStr = `${inputDate}T${inputTime}`
      const localDate = new Date(dateTimeStr)

      if (isNaN(localDate.getTime())) return null

      const fromOffset = getTimezoneOffset(localDate, fromTimezone)
      const toOffset = getTimezoneOffset(localDate, toTimezone)

      const fromFormatted = formatInTimezone(localDate, fromTimezone)
      const toFormatted = formatInTimezone(localDate, toTimezone)

      return {
        from: { formatted: fromFormatted, offset: fromOffset },
        to: { formatted: toFormatted, offset: toOffset },
      }
    } catch {
      return null
    }
  }, [inputDate, inputTime, fromTimezone, toTimezone])

  const setNow = () => {
    const now = new Date()
    setInputDate(now.toISOString().split('T')[0])
    setInputTime(now.toTimeString().slice(0, 8))
  }

  const swapTimezones = () => {
    setFromTimezone(toTimezone)
    setToTimezone(fromTimezone)
  }

  const allTimezones = useMemo(() => {
    const now = new Date()
    return COMMON_TIMEZONES.map((tz) => ({
      ...tz,
      offset: getTimezoneOffset(now, tz.value),
    }))
  }, [])

  return (
    <ToolLayout
      title="Timezone Converter"
      description="Convert times between different timezones"
    >
      <div className="space-y-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Date</label>
            <Input
              type="date"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Time</label>
            <Input
              type="time"
              step="1"
              value={inputTime}
              onChange={(e) => setInputTime(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={setNow}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Now
          </Button>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">From Timezone</label>
            <Select value={fromTimezone} onValueChange={setFromTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allTimezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label} ({tz.offset})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="ghost" onClick={swapTimezones} className="mt-6">
            ⇄
          </Button>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">To Timezone</label>
            <Select value={toTimezone} onValueChange={setToTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allTimezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label} ({tz.offset})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {result && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 p-4 rounded-md">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs text-muted-foreground">From: {fromTimezone}</p>
                  <p className="text-xs text-muted-foreground">{result.from.offset}</p>
                </div>
                <CopyButton text={result.from.formatted} />
              </div>
              <p className="font-mono text-lg">{result.from.formatted}</p>
            </div>

            <div className="bg-primary/10 p-4 rounded-md border border-primary/20">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs text-muted-foreground">To: {toTimezone}</p>
                  <p className="text-xs text-muted-foreground">{result.to.offset}</p>
                </div>
                <CopyButton text={result.to.formatted} />
              </div>
              <p className="font-mono text-lg font-semibold">{result.to.formatted}</p>
            </div>
          </div>
        )}

        {!result && inputDate && inputTime && (
          <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md">
            Invalid date or time
          </div>
        )}

        {!inputDate && !inputTime && (
          <div className="text-center py-8 text-muted-foreground">
            Enter a date and time to convert
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
