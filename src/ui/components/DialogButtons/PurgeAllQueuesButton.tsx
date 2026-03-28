import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogHeader,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
import { Eraser, Loader2 } from "lucide-react"
import { useState, type FC } from "react"
import { useBroker } from "@/ui/contexts/broker"
import { useQueues } from "@/ui/contexts/queues"

export const PurgeAllQueuesButton: FC = () => {
  const { isConnected, activeBroker } = useBroker()
  const { queues } = useQueues()
  const [isPurging, setIsPurging] = useState(false)
  const [open, setOpen] = useState(false)

  const handlePurgeAll = async () => {
    setIsPurging(true)
    await window.electron.purgeAllQueues()
    setIsPurging(false)
    setOpen(false)
  }

  const brokerLabel = activeBroker === 'elasticmq' ? 'ElasticMQ' : 'RabbitMQ'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          disabled={!isConnected || queues.length === 0}
          className="size-7 p-0 flex-shrink-0"
        >
          <Eraser className="size-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Purge All Queues</DialogTitle>
          <DialogDescription>
            This will delete all messages from all {queues.length} queue{queues.length !== 1 ? 's' : ''} in {brokerLabel}.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handlePurgeAll}
            disabled={isPurging}
          >
            {isPurging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Purge All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
