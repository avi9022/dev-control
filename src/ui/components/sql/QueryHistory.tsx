import { useState, useMemo, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Search, Trash2, CheckCircle, AlertCircle, Clock, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QueryHistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  history: SQLHistoryEntry[]
  onClear: () => void
  onSelect: (sql: string) => void
  onSave: (entry: SQLHistoryEntry) => void
}

export const QueryHistory: FC<QueryHistoryProps> = ({
  open,
  onOpenChange,
  history,
  onClear,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = useMemo(() => {
    if (!searchTerm) return history
    const term = searchTerm.toLowerCase()
    return history.filter((h) => h.sql.toLowerCase().includes(term))
  }, [history, searchTerm])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 flex-shrink-0">
          <SheetTitle className="flex items-center justify-between">
            <span>Query History</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={onClear}
              disabled={history.length === 0}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="relative px-4 pb-2 flex-shrink-0">
          <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search history..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 pb-4 space-y-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchTerm ? 'No matches found' : 'No query history'}
              </p>
            )}

            {filtered.map((entry) => (
              <div
                key={entry.id}
                className="group p-2 rounded-md hover:bg-accent cursor-pointer border border-transparent hover:border-border"
                onClick={() => {
                  onSelect(entry.sql)
                  onOpenChange(false)
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  {entry.status === 'success' ? (
                    <CheckCircle className="h-3 w-3 text-green-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-red-400 flex-shrink-0" />
                  )}
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(entry.executedAt).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {entry.executionTime}ms | {entry.rowCount} rows
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigator.clipboard.writeText(entry.sql)
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <pre className="text-xs font-mono text-foreground truncate max-h-[60px] overflow-hidden">
                  {entry.sql}
                </pre>
                {entry.error && (
                  <p className={cn('text-[10px] mt-1 text-red-400 truncate')}>{entry.error}</p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
