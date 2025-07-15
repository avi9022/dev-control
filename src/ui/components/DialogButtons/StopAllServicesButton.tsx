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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDirectories } from "../../contexts/directories"
import { Square } from "lucide-react"

export const StopAllServicesButton = () => {
  const { stopAllServices, directoriesStateMap } = useDirectories()

  const hasRunningService = Object.values(directoriesStateMap).some(state => state === 'RUNNING')

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              disabled={!hasRunningService}
              className={'bg-destructive hover:bg-destructive/80'} size="sm"
            >
              <Square fill="white" color="white" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Stop all</p>
        </TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Force stop all services</DialogTitle>
          <DialogDescription>
            Are you sure you want to force stop all the services?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button onClick={() => stopAllServices()} variant='destructive' type="button">Yes</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              No
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
