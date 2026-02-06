import { type FC } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface DbmsOutputPanelProps {
  output: string[]
  onClear: () => void
}

export const DbmsOutputPanel: FC<DbmsOutputPanelProps> = ({ output, onClear }) => {
  if (output.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No DBMS_OUTPUT. Enable with SET SERVEROUTPUT ON.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border">
        <span className="text-xs text-muted-foreground">{output.length} line{output.length !== 1 ? 's' : ''}</span>
        <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={onClear}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <pre className="p-3 text-xs font-mono text-foreground whitespace-pre-wrap">
          {output.join('\n')}
        </pre>
      </ScrollArea>
    </div>
  )
}
