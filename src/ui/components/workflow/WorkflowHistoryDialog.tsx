import { type FC, useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { History, CheckCircle2, XCircle, Ban } from 'lucide-react'

interface WorkflowHistoryDialogProps {
  workflowId: string
  workflowName: string
}

const statusConfig = {
  completed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/20' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
  cancelled: { icon: Ban, color: 'text-zinc-400', bg: 'bg-zinc-500/20' },
}

export const WorkflowHistoryDialog: FC<WorkflowHistoryDialogProps> = ({
  workflowId,
  workflowName,
}) => {
  const [records, setRecords] = useState<WorkflowExecutionRecord[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) {
      window.electron.getWorkflowExecutionHistory(workflowId).then(setRecords)
    }
  }, [open, workflowId])

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (start: number, end: number) => {
    const ms = end - start
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Execution History">
          <History className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>History: {workflowName}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[400px]">
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No execution history yet
            </p>
          ) : (
            <div className="space-y-3">
              {records.map((record) => {
                const config = statusConfig[record.status]
                const StatusIcon = config.icon

                return (
                  <div key={record.id} className="border rounded p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`h-4 w-4 ${config.color}`} />
                        <Badge variant="outline" className={`text-xs ${config.bg}`}>
                          {record.phase}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">
                          {record.status}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(record.startedAt, record.completedAt)}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {formatDate(record.startedAt)}
                    </p>

                    <div className="space-y-0.5">
                      {record.steps.map((step, idx) => (
                        <div key={step.stepId} className="flex items-center gap-1.5 text-xs">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              step.status === 'completed'
                                ? 'bg-green-400'
                                : step.status === 'failed'
                                  ? 'bg-red-400'
                                  : step.status === 'skipped'
                                    ? 'bg-zinc-500'
                                    : 'bg-muted-foreground'
                            }`}
                          />
                          <span className="text-muted-foreground">Step {idx + 1}</span>
                          <span className="capitalize text-muted-foreground">{step.status}</span>
                          {step.message && (
                            <span className="text-red-400 truncate ml-1">{step.message}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
