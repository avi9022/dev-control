import { Button } from "@/components/ui/button";
import { DialogHeader, Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CirclePlus } from "lucide-react";
import type { FC } from "react";
import { NewQueueForm } from "../NewQueueForm";

export const AddNewQueueButton: FC = () => {
  return <div className="flex-1">
    <Dialog>
      <DialogTrigger asChild>
        <Button onClick={() => { }} className="w-full h-7 text-[11px]">
          <CirclePlus className="size-3 mr-1" />
          Add new queue
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add new Queue</DialogTitle>
          <DialogDescription>
            Please fill in the form with all the queues new details
          </DialogDescription>
        </DialogHeader>
        <NewQueueForm />
      </DialogContent>
    </Dialog>
  </div>
}