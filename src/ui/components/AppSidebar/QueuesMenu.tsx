import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, CircleX } from "lucide-react";
import { useState, type FC } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AddNewQueueButton } from "../DialogButtons/AddNewQueueButton";
import { QueuesList } from "./Lists/QueuesList";

export const QueuesMenu: FC = () => {
  const [queueSearchTerm, setQueueSearchTerm] = useState('')

  return <div>
    <div className="relative h-[35px] mb-4 px-5">
      <Search className="absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input placeholder="Search..." className="pl-9" value={queueSearchTerm} onChange={(ev) => setQueueSearchTerm(ev.target.value)} />
      <Button onClick={() => setQueueSearchTerm('')} className="absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 bg-transparent hover:bg-transparent text-muted-foreground">
        <CircleX />
      </Button>
    </div>
    <ScrollArea className="h-[calc(100vh-80px-40px-80px-35px-20px)]">
      <QueuesList searchTerm={queueSearchTerm} />
    </ScrollArea>
    <div className="flex justify-between items-center px-4 gap-20 h-[80px] bg-stone-600">
      <AddNewQueueButton />
    </div>
  </div>
}