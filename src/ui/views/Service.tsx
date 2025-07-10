import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FC } from "react";
import { ServiceSettings } from "../components/ServiceSettings";
import { useDirectories } from "../contexts/directories";
import { Terminal } from "../components/Terminal";
import { useLogger } from "../contexts/logger";
import { useQueues } from "../hooks/use-queues";
import { Queues } from "../components/Queues";

export const Service: FC = () => {

  const { directoryToView } = useDirectories()
  const { getLogsByDirId } = useLogger()
  const { queues } = useQueues(directoryToView?.id)

  if (!directoryToView) {
    return <div className="w-full h-full flex justify-center items-center">
      <p className="">
        Please choose a service
      </p>
    </div>
  }

  return <div className="bg-card p-5 h-screen">
    <Tabs defaultValue="terminal" className="w-full h-full">
      <TabsList className={`w-full flex gap-2`}>
        <TabsTrigger onChange={(ev) => console.log(ev)
        } value="terminal">Terminal</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        {queues.length ? <TabsTrigger value="queues">Queues</TabsTrigger> : <></>}
      </TabsList>
      <TabsContent value="terminal" className=" h-95">
        <Terminal logs={getLogsByDirId(directoryToView.id)} />
      </TabsContent>
      <TabsContent value="settings">
        <ServiceSettings />
      </TabsContent>
      {queues.length && <TabsContent value="queues">
        <Queues queues={queues} />
      </TabsContent>}
    </Tabs>
  </div>
}