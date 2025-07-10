import { type FC } from "react";
import { Separator } from "@/components/ui/separator";
import { useQueues } from "../contexts/queues";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDirectories } from "../contexts/directories";


export const QueuesList: FC = () => {
  const { queues, onChooseQueue } = useQueues()
  const { chooseDirectory } = useDirectories()

  return <div>
    <ScrollArea className="h-300 w-full rounded-md border" style={{ paddingBottom: '250px' }}>

      {queues.length ? queues.map((url) => <div key={url}>
        <div className="p-3" onClick={() => {
          chooseDirectory(null)
          onChooseQueue(url)
        }}>
          <p>{url.split('/').pop()}</p>
        </div>
        <Separator className="my-4 " />
      </div>) : <div className="flex flex-col px-5 text-center gap-2 h-[400px] justify-center">
        <p>Looks like you have no queues</p>
      </div>}
    </ScrollArea>
  </div>
}