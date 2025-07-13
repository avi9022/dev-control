import { type FC } from "react";
import { Separator } from "@/components/ui/separator";
import { useQueues } from "../contexts/queues";
import { DeleteQueueButton } from "./DeleteQueueButton";
import { useViews } from "../contexts/views";

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
        <div className={`px-5 py-5 flex justify-between items-center ${isCurrent ? 'bg-stone-300 text-black' : ''}`}
          onClick={() => {
            onChooseQueue(url)
          }}>
          <p className="font-bold max-w-[300px] text-sm truncate overflow-hidden whitespace-nowrap">{url.split('/').pop()}</p>
          <DeleteQueueButton queueUrl={url} />
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