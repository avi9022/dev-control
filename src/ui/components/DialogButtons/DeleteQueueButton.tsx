import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { FC } from "react"
import { Trash } from "lucide-react"

interface DeleteQueueButtonProps {
  queueUrl: string
}

export const DeleteQueueButton: FC<DeleteQueueButtonProps> = ({ queueUrl }) => {

  const onDeleteQueue = () => {
    window.electron.deleteQueue(queueUrl)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='destructive' type="button" className="size-6 p-0" onClick={(ev) => ev.stopPropagation()}>
          <Trash className="size-2.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete queue</DialogTitle>
          <DialogDescription>
            You are about to delete {queueUrl.split('/').pop()}.
            Are you sure about that?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-start">
          <Button onClick={() => onDeleteQueue()} variant='destructive' type="button">Delete this queue</Button>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
