import { type FC } from "react";
import { Separator } from "@/components/ui/separator";
import { useWorkflows } from "@/ui/contexts/workflows";
import { DeleteWorkflowButton } from "../../DialogButtons/DeleteWorkflowButton";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { SaveWorkflowButton } from "../../DialogButtons/SaveWorkflowButton";

interface WorkflowsListProps {
  searchTerm: string
}

export const WorkflowsList: FC<WorkflowsListProps> = ({
  searchTerm
}) => {
  const { workflows } = useWorkflows()
  const filteredList = searchTerm ? workflows.filter(({ name }) => name.toLowerCase().includes(searchTerm.toLowerCase())) : workflows

  return <div>
    {workflows.length ? filteredList.length ? filteredList.map(({ id, name, services }) => {
      return <div key={id}>
        <div className={`px-5 py-5 flex justify-between items-center`}>
          <div className="flex flex-col gap-1">
            <p className="font-bold max-w-[300px] text-sm truncate overflow-hidden whitespace-nowrap">{name}</p>
            <p className='text-xs opacity-60'>
              Number of services: {services.length}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Button
              onClick={(ev) => {
                ev.stopPropagation()
                window.electron.startWorkflow(id)
              }}
              className={'bg-success hover:bg-success/80 cursor-pointer'} size="sm"
            >
              <Play fill="white" color="white" />
            </Button>
            <SaveWorkflowButton id={id} />
            <DeleteWorkflowButton id={id} />
          </div>
        </div>
        <Separator />
      </div>
    }) : <div className="flex flex-col px-5 text-center gap-2 h-[400px] justify-center">
      <p>No workflows to match the search</p>
    </div> : <div className="flex flex-col px-5 text-center gap-2 h-[400px] justify-center">
      <p>Looks like you have no workflows</p>
    </div>}
  </div >
}