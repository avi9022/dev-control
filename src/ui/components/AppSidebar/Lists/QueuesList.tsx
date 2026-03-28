import { type FC } from "react";
import { Separator } from "@/components/ui/separator";
import { useQueues } from "@/ui/contexts/queues";
import { useViews } from "@/ui/contexts/views";
import { useBroker } from "@/ui/contexts/broker";
import { DeleteQueueButton } from "../../DialogButtons/DeleteQueueButton";
import { Tooltip, TooltipContent } from "@/components/ui/tooltip";
import { TooltipTrigger } from "@radix-ui/react-tooltip";
import { BrokerEmptyState } from "../../BrokerEmptyState";

interface QueuesListProps {
  searchTerm: string
}

export const QueuesList: FC<QueuesListProps> = ({
  searchTerm
}) => {
  const { queues, onChooseQueue } = useQueues()
  const { views } = useViews()
  const { isConnected } = useBroker()

  const filteredList = searchTerm ? queues.filter((url) => url.includes(searchTerm)) : queues

  if (!isConnected) {
    return <BrokerEmptyState />
  }

  return <div>
    {queues.length ? filteredList.length ? filteredList.map((url) => {
      const isCurrent = views.some(({ itemId, type }) => type === 'queue' && itemId === url)

      return <div key={url}>
        <div className={`py-2 px-2.5 flex w-full justify-between items-center cursor-pointer ${isCurrent ? 'bg-accent text-accent-foreground' : ''}`}
          onClick={() => {
            onChooseQueue(url)
          }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-medium text-xs w-[140px] truncate flex-shrink-0">{url.split('/').pop()}</p>
            </TooltipTrigger>
            <TooltipContent>
              <p>{url.split('/').pop()}</p>
            </TooltipContent>
          </Tooltip>
          <div className="flex gap-1 justify-end flex-shrink-0">
            <DeleteQueueButton queueUrl={url} />
          </div>
        </div>
        <Separator />
      </div>
    }) : <div className="flex flex-col px-5 text-center gap-2 h-[200px] justify-center">
      <p className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>No queues to match the search</p>
    </div> : <div className="flex flex-col px-5 text-center gap-2 h-[200px] justify-center">
      <p className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>Looks like you have no queues</p>
    </div>}
  </div>
}
