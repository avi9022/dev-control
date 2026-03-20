import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, CircleX, CirclePlus } from "lucide-react"
import { useState, type FC } from "react"
import { WorkflowsList } from "./Lists/WorkflowsList"
import { WorkflowEditor } from "../workflow/WorkflowEditor"

export const WorkflowsMenu: FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showEditor, setShowEditor] = useState(false)

  return (
    <div>
      <div className="relative h-[35px] mb-4 px-5">
        <Search className="absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search..." className="pl-9" value={searchTerm} onChange={(ev) => setSearchTerm(ev.target.value)} />
        <Button onClick={() => setSearchTerm('')} className="absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 bg-transparent hover:bg-transparent text-muted-foreground">
          <CircleX />
        </Button>
      </div>
      <ScrollArea className="h-[calc(100vh-80px-40px-80px-35px-20px)]">
        <WorkflowsList searchTerm={searchTerm} />
      </ScrollArea>
      <div className="flex justify-between items-center px-4 gap-20 h-[80px] bg-muted">
        <Button className="w-full" onClick={() => setShowEditor(true)}>
          <CirclePlus className="mr-2 h-4 w-4" />
          Add new workflow
        </Button>
      </div>
      <WorkflowEditor open={showEditor} onOpenChange={setShowEditor} />
    </div>
  )
}
