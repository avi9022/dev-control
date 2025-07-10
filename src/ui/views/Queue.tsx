import { useState, type FC } from "react";
import { useQueues } from "../contexts/queues";
import { Button } from "@/components/ui/button";
import { JsonInput } from "../components/JsonInput";

export const Queue: FC = () => {

  const { chosenQueue } = useQueues()
  const [requestBody, setRequestBody] = useState('{}')


  const handlePurgeQueue = () => {
    if (!chosenQueue) return
    window.electron.purgeQueue(chosenQueue)
  }

  const sendMessageToQueue = () => {
    if (!chosenQueue) return
    window.electron.sendQueueMessage(chosenQueue, requestBody)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorChange = (json: any) => {
    setRequestBody(json)
    // if (selectedQueue) {
    //   setSavedMessages(prev => ({
    //     ...prev,
    //     [selectedQueue]: json
    //   }));
    // }
  }

  if (!chosenQueue) {
    return <div className="w-full h-full flex justify-center items-center">
      <p className="">
        Please choose a queue
      </p>
    </div>
  }

  return <div className="p-5">
    <div className="mt-5 flex flex-col gap-2">
      <p className="text-xl">{chosenQueue.split('/').pop()}</p>
    </div>
    <div className="mt-5 flex flex-col gap-2">
      <p className="text-xl">Actions</p>
    </div>
    <div className="mt-2">
      <Button onClick={handlePurgeQueue}>Purge queue</Button>
    </div>
    <div className="mt-5 flex flex-col gap-2">
      <p>Request</p>
      <JsonInput value={requestBody} disabled={!chosenQueue} onChange={handleEditorChange} />
    </div>
    <div className="mt-2">
      <Button onClick={sendMessageToQueue} disabled={!chosenQueue}>Send</Button>
    </div>
  </div>
}