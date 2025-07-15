import { useEffect, useState, type FC } from "react";
import { useQueues } from "../contexts/queues";
import { Button } from "@/components/ui/button";
import { JsonInput } from "../components/JsonInput";
import { QueueDataCards } from "../components/QueueDataCards";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookCheck, Clock } from "lucide-react";
import { QueueMessage } from "../components/QueueMessage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QueueDataCardsSkeleton } from "../components/Skeletons/QueueDataCardsSkeleton";

interface QueueProps {
  id: string | null
}

export const Queue: FC<QueueProps> = ({
  id
}) => {
  const { subscribedQueuesData } = useQueues()
  const [requestBody, setRequestBody] = useState('{}')
  const { setValue: setSavedMessages } = useLocalStorage<Record<string, string>>(`${id}-message`, {})


  useEffect(() => {
    if (!id) return
    const storedMessage = localStorage.getItem(`${id}-message`);
    const parsedMessages = storedMessage ? JSON.parse(storedMessage) : '{}';
    setRequestBody(parsedMessages ? parsedMessages : '{}');
  }, [id])

  const handlePurgeQueue = () => {
    if (!id) return
    window.electron.purgeQueue(id)
  }

  const sendMessageToQueue = () => {
    if (!id) return
    window.electron.sendQueueMessage(id, requestBody)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorChange = (json: any) => {
    setRequestBody(json)
    if (id) {
      setSavedMessages(json);
    }
  }

  if (!id) {
    return <div className="w-full h-full flex justify-center items-center">
      <p className="">
        Please choose a queue
      </p>
    </div>
  }

  const chosenQueueData = subscribedQueuesData[id]

  if (!chosenQueueData) {
    return <div className="p-5">
      <div className="mt-5 flex justify-between items-end mb-5 sticky">
        <div>
          <p className="text-3xl font-bold">Queue manager</p>
          <p >{id.split('/').pop()}</p>
        </div>
        <Button onClick={handlePurgeQueue}>Purge queue</Button>
      </div>
      <QueueDataCardsSkeleton />
    </div>
  }

  return <ScrollArea className='h-[calc(100vh-50px)]'>
    <div className="p-5 pt-0">
      <div className="flex justify-between items-end mb-5">
        <div>
          <p className="text-3xl font-bold">Queue manager</p>
          <p >{id.split('/').pop()}</p>
        </div>
        <Button onClick={handlePurgeQueue}>Purge queue</Button>
      </div>
      <QueueDataCards data={chosenQueueData} />
      <div className="flex justify-between align-end mb-4 mt-4">
        <p className="text-3xl">Send message</p>
        <Button onClick={sendMessageToQueue} disabled={!id}>Send</Button>
      </div>
      <div className="w-[99%]">
        <JsonInput value={requestBody} disabled={!id} onChange={handleEditorChange} />
      </div>

      <Tabs defaultValue="prev" className="flex-1">
        <TabsList className={`w-full flex gap-2 h-[40px]`}>
          <TabsTrigger value="prev">Previous messages</TabsTrigger>
          <TabsTrigger value="current">Current messages</TabsTrigger>
        </TabsList>
        <TabsContent value="prev">
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex gap-3 items-start">
                  <div className="pt-1">
                    <Clock className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl mb-2">Previous messages sent</p>
                    <p>The last 5 messages you have sent from DevControl</p>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">

                {chosenQueueData?.lastFiveMessages.map(({ createdAt, id, message }) => <QueueMessage
                  onReuseMessage={(message) => handleEditorChange(message)}
                  createdAt={createdAt}
                  id={id}
                  message={message}
                />)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="current">
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex gap-3 items-start">
                  <div className="pt-1">
                    <BookCheck className="text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl mb-2">Current messages</p>
                    <p>The messages that are currently in the queue</p>
                  </div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">

                {chosenQueueData?.waitingMessages.map(({ createdAt, id, message }) => <QueueMessage
                  onReuseMessage={(message) => handleEditorChange(message)}
                  createdAt={createdAt}
                  id={id}
                  message={message}
                />)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  </ScrollArea>
}