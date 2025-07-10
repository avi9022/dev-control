import {
  SidebarHeader,
} from "@/components/ui/sidebar"
import { type FC } from "react"
import { DirectoriesList } from "./DirectoriesList"
import { Button } from "@/components/ui/button"
import { useDirectories } from "../contexts/directories"
import { CirclePlus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QueuesList } from "./QueuesList"

export const AppSidebar: FC = () => {
  const { directories, removeDirectory, addFromFolder } = useDirectories()

  return (
    <>
      <SidebarHeader />

      <Tabs defaultValue="services">
        <TabsList className={`w-full flex gap-2`}>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="queues">Queues</TabsTrigger>
        </TabsList>
        <TabsContent value="services">
          <div className="flex justify-between mb-5 px-5 gap-20">
            <Button disabled={!directories.length} onClick={() => removeDirectory()} className="bg-destructive text-foreground flex-1">
              Remove all
            </Button>
            <div>
              <Button onClick={() => addFromFolder()} variant="default" className="size-8">
                <CirclePlus />
              </Button>
            </div>
          </div>
          <DirectoriesList />
        </TabsContent>
        <TabsContent value="queues">
          <QueuesList />
        </TabsContent>
      </Tabs>
    </>
  )
}
