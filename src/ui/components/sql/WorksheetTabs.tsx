import { type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorksheetTabsProps {
  worksheets: SQLWorksheet[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onClose: (id: string) => void
}

export const WorksheetTabs: FC<WorksheetTabsProps> = ({
  worksheets,
  activeId,
  onSelect,
  onAdd,
  onClose,
}) => {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-[#1e1f23] overflow-x-auto">
      {worksheets.map((ws) => (
        <div
          key={ws.id}
          className={cn(
            'group flex items-center gap-1 px-3 py-1 text-xs rounded-t-md cursor-pointer',
            'hover:bg-[#252629] transition-colors',
            ws.id === activeId
              ? 'bg-[#1a1b1e] text-foreground border-t-2 border-t-[#c74634]'
              : 'text-muted-foreground'
          )}
          onClick={() => onSelect(ws.id)}
        >
          <span className="truncate max-w-[120px]">{ws.name}</span>
          {worksheets.length > 1 && (
            <button
              className="h-4 w-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation()
                onClose(ws.id)
              }}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 ml-1"
        onClick={onAdd}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  )
}
