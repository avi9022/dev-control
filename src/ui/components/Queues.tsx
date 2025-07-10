import { useEffect, useState, type FC } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDirectories } from "../contexts/directories";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { QueueDetails } from "./QueueDetails";


interface QueuesProps {
  queues: QueueSettings[]
}

export const Queues: FC<QueuesProps> = ({
  queues
}) => {
  const { directoryToView } = useDirectories()
  const { setValue: setSelectedQueueInStorage } = useLocalStorage(`${directoryToView?.id}-queue`, '')
  const [selectedQueue, setSelectedQueue] = useState('')
  const [queueUrl, setQueueUrl] = useState('')




  useEffect(() => {
    if (!directoryToView?.id) return;

    const newQueueKey = `${directoryToView.id}-queue`;
    const storedQueue = localStorage.getItem(newQueueKey);
    const parsedQueue = storedQueue ? JSON.parse(storedQueue) : '';

    setSelectedQueue(parsedQueue || '');
    const currQueue = queues.find(({ funcName }) => funcName === parsedQueue)
    if (!currQueue) return
    setQueueUrl(`${currQueue.offlineSqsEndpoint}/queue/${currQueue.funcAlias}`)

  }, [directoryToView, queues]);


  const handleQueueSelect = (funcName: string) => {
    setSelectedQueue(funcName)
    if (!directoryToView) return
    setSelectedQueueInStorage(funcName)
    const currQueue = queues.find(({ funcName: currFuncName }) => funcName === currFuncName)
    if (!currQueue) return
    setQueueUrl(`${currQueue.offlineSqsEndpoint}/queue/${currQueue.funcAlias}`)
  }



  return <div className="pt-5">
    <Select value={selectedQueue} onValueChange={handleQueueSelect}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a queue" />
      </SelectTrigger>
      <SelectContent>
        {queues.map(({ funcName }) => <SelectItem value={funcName}>{funcName}</SelectItem>)}
      </SelectContent>
    </Select>
    {selectedQueue && <QueueDetails queues={queues} queueUrl={queueUrl} selectedQueue={selectedQueue} />}
  </div>
}