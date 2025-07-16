import { type FC } from "react";
import { Separator } from "@/components/ui/separator";
import { useQueues } from "@/ui/contexts/queues";
import { useViews } from "@/ui/contexts/views";
import { DeleteQueueButton } from "../../DialogButtons/DeleteQueueButton";
import { OpenItemViewButton } from "../../OpenItemViewButton";
import { Tooltip, TooltipContent } from "@/components/ui/tooltip";
import { TooltipTrigger } from "@radix-ui/react-tooltip";

interface QueuesListProps {
  searchTerm: string
}

export const QueuesList: FC<QueuesListProps> = ({
  searchTerm
}) => {
  const { queues, onChooseQueue } = useQueues()
  const { views } = useViews()

  const filteredList = searchTerm ? queues.filter((url) => url.includes(searchTerm)) : queues

  return <div>
    {queues.length ? filteredList.length ? filteredList.map((url) => {
      const isCurrent = views.some(({ itemId, type }) => type === 'queue' && itemId === url)

      return <div key={url}>
        <div className={`py-5 px-3 flex w-full justify-between items-center ${isCurrent ? 'bg-stone-300 text-black' : ''}`}
          onClick={() => {
            onChooseQueue(url)
          }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-bold w-[250px] text-sm truncate overflow-hidden whitespace-nowrap">{url.split('/').pop()}</p>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-bold">{url.split('/').pop()}</p>
            </TooltipContent>
          </Tooltip>
          <div className="flex gap-2 justify-end flex-1">
            <OpenItemViewButton onOpenView={() => {
              onChooseQueue(url, false)
            }} id={url} type="queue" variant={isCurrent ? 'secondary' : 'outline'} />
            <DeleteQueueButton queueUrl={url} />
          </div>
        </div>
        <Separator />
      </div>
    }) : <div className="flex flex-col px-5 text-center gap-2 h-[400px] justify-center">
      <p>No queues to match the search</p>
    </div> : <div className="flex flex-col px-5 text-center gap-2 h-[400px] justify-center">
      <p>Looks like you have no queues</p>
    </div>}
  </div>
}