import { Button } from "@/components/ui/button";
import { DialogHeader, Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CirclePlus } from "lucide-react";
import type { FC } from "react";
import { NewQueueForm } from "../NewQueueForm";

export const AddNewQueueButton: FC = () => {
  return <div className="w-full">
    <Dialog>
      <DialogTrigger asChild>
        <Button onClick={() => { }} className="w-full">
          <CirclePlus />
          <p>Add new queue</p>
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