import { Button } from "@/components/ui/button";
import { useEffect, useState, type FC } from "react";
import { JsonInput } from "./JsonInput";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useDirectories } from "../contexts/directories";
import { useQueues } from "../contexts/queues";

interface QueueDetailsProps {
  queueUrl: string
  selectedQueue: string
  queues: QueueSettings[]
}

export const QueueDetails: FC<QueueDetailsProps> = ({
  queueUrl,
  selectedQueue,
}) => {
  const { directoryToView } = useDirectories()
  const { setValue: setSavedMessages } = useLocalStorage<Record<string, string>>(`${directoryToView?.id}-messages`, {})
  const [requestBody, setRequestBody] = useState('{}')
  const [queueData, setQueueData] = useState<QueueData>()
  const { getQueueData } = useQueues()

  // console.log(queueData);


  useEffect(() => {
    const getData = async () => {
      const data = await getQueueData(queueUrl)
      setQueueData(data)
    }

    getData()
  }, [getQueueData, queueUrl])

  useEffect(() => {
    if (!directoryToView) return

    const newMessagesKey = `${directoryToView.id}-messages`;
    const storedMessages = localStorage.getItem(newMessagesKey);
    const parsedMessages = storedMessages ? JSON.parse(storedMessages) : '{}';
    setRequestBody(parsedMessages[selectedQueue] ? parsedMessages[selectedQueue] : '{}');
  }, [selectedQueue, directoryToView])

  const handlePurgeQueue = () => {
    window.electron.purgeQueue(queueUrl)
  }

  const sendMessageToQueue = () => {
    window.electron.sendQueueMessage(queueUrl, requestBody)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorChange = (json: any) => {
    setRequestBody(json)
    if (selectedQueue) {
      setSavedMessages(prev => ({
        ...prev,
        [selectedQueue]: json
      }));
    }
  }
  return <div>
    <div className="mt-5 flex flex-col gap-2">
      <p className="text-xl">Actions</p>
    </div>
    <div className="mt-2">
      <Button onClick={handlePurgeQueue}>Purge queue</Button>
    </div>
    <div className="mt-5 flex flex-col gap-2">
      <p>Request</p>
      <JsonInput value={requestBody} disabled={!selectedQueue} onChange={handleEditorChange} />
    </div>
    <div className="mt-2">
      <Button onClick={sendMessageToQueue} disabled={!selectedQueue}>Send</Button>
    </div>
  </div>
}