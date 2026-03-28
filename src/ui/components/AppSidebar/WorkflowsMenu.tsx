import { Button } from "@/components/ui/button"
import { CirclePlus } from "lucide-react"
import { useState, type FC } from "react"
import { WorkflowsList } from "./Lists/WorkflowsList"
import { WorkflowEditor } from "../workflow/WorkflowEditor"
import { SearchInput } from "../Inputs/SearchInput"
import { SidebarPanel } from "./SidebarPanel"

export const WorkflowsMenu: FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showEditor, setShowEditor] = useState(false)

  return (
    <SidebarPanel
      header={
        <SearchInput
          value={searchTerm}
          onChange={(ev) => setSearchTerm(ev.target.value)}
          onClear={() => setSearchTerm('')}
        />
      }
      footer={
        <Button className="w-full h-7 text-[11px]" onClick={() => setShowEditor(true)}>
          <CirclePlus className="mr-2 h-4 w-4" />
          Add new workflow
        </Button>
      }
    >
      <WorkflowsList searchTerm={searchTerm} />
      <WorkflowEditor open={showEditor} onOpenChange={setShowEditor} />
    </SidebarPanel>
  )
}
