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
import { useWorkflows } from "@/ui/contexts/workflows"

interface DeleteQueueButtonProps {
  id: string
}

export const DeleteWorkflowButton: FC<DeleteQueueButtonProps> = ({ id }) => {
  const { getWorkflowById } = useWorkflows()

  const onDeleteQueue = () => {
    window.electron.removeWorkflow(id)
  }

  const workflow = getWorkflowById(id)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='destructive' type="button" onClick={(ev) => ev.stopPropagation()}>
          <Trash color="white" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove workflow</DialogTitle>
          <DialogDescription>
            You are about to delete '{workflow?.name}'.
            Are you sure about that?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-start">
          <Button onClick={() => onDeleteQueue()} variant='destructive' type="button">Delete this workflow</Button>
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
