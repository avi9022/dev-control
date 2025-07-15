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
import { useDirectories } from "../../contexts/directories"
import type { FC } from "react"

interface RemoveDirectoryButtonProps {
  id: string
}

export const RemoveDirectoryButton: FC<RemoveDirectoryButtonProps> = ({ id }) => {
  const { removeDirectory, directories } = useDirectories()
  const directoryToView = directories.find(({ id: currId }) => currId === id)
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='destructive' type="button">Delete this project</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove directory</DialogTitle>
          <DialogDescription>
            You are about to remove {directoryToView?.name || ''}.
            Are you sure about that?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-start">
          <Button onClick={() => removeDirectory(directoryToView?.id)} variant='destructive' type="button">Delete this project</Button>
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
