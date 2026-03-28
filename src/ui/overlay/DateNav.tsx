import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DateNavProps {
  selectedDate: string
  onDateChange: (date: string) => void
}

const getToday = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatDate = (dateStr: string): string => {
  const today = getToday()
  const yesterdayStr = addDays(today, -1)

  if (dateStr === today) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'

  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  })
}

const addDays = (dateStr: string, days: number): string => {
  // Parse date parts to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day) // month is 0-indexed
  date.setDate(date.getDate() + days)

  // Format back to YYYY-MM-DD using local date parts
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const DateNav = ({ selectedDate, onDateChange }: DateNavProps) => {
  const today = getToday()
  const isToday = selectedDate === today

  const handlePrevious = () => {
    onDateChange(addDays(selectedDate, -1))
  }

  const handleNext = () => {
    if (isToday) return
    const nextDate = addDays(selectedDate, 1)
    if (nextDate <= today) {
      onDateChange(nextDate)
    }
  }

  const handleTodayClick = () => {
    onDateChange(today)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handlePrevious}
        className="p-1.5 rounded hover:bg-neutral-700/50 text-neutral-400 hover:text-white transition-colors"
      >
        <ChevronLeft size={16} />
      </button>

      <button
        onClick={handleTodayClick}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          isToday
            ? 'text-white'
            : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
        }`}
      >
        {formatDate(selectedDate)}
      </button>

      <button
        onClick={handleNext}
        disabled={isToday}
        className="p-1.5 rounded hover:bg-neutral-700/50 text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
