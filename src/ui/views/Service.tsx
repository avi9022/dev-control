import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FC } from "react";
import { ServiceSettings } from "../components/ServiceSettings";
import { Terminal } from "../components/Terminal";
import { useLogger } from "../contexts/logger";
import { useDirectories } from "../contexts/directories";
import { useViews } from "../contexts/views";
import clsx from "clsx";

const headerHeight = '56px'
const tabsListHeight = '40px'
const height = 'h-[calc(100vh-56px-40px-70px-30px)]'
const heightWithLesSpace = 'h-[calc(100vh-56px-40px-70px-30px-30px)]'


interface ServiceProps {
  id: string | null
}

export const Service: FC<ServiceProps> = ({
  id
}) => {
  const { directories } = useDirectories()
  const { getLogsByDirId } = useLogger()
  const { views } = useViews()

  if (!id) {
    return <div className="w-full h-full flex justify-center items-center">
      <p className="">
        Please choose a service
      </p>
    </div>
  }

  const directoryToView = directories.find(({ id: currId }) => currId === id)

  return <div className="p-5 pt-0 pb-0 h-full">
    <div className={`h-[${headerHeight}] pb-4`}>
      <p className="text-3xl font-bold">Directory manager</p>
      <p >{directoryToView?.name}</p>
    </div>
    <Tabs defaultValue="terminal" className={`w-full`}>
      <TabsList className={`w-full flex gap-2 h-[${tabsListHeight}]`}>
        <TabsTrigger onChange={(ev) => console.log(ev)
        } value="terminal">Terminal</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="terminal">
        <div className={clsx(views.length > 1 ? heightWithLesSpace : height)}>
          <Terminal logs={getLogsByDirId(id)} id={id} />
        </div>
      </TabsContent>
      <TabsContent value="settings">
        <ServiceSettings id={id} />
      </TabsContent>
    </Tabs>
  </div>

}