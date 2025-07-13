import { useState, type FC } from "react"
import { DirectoriesList } from "./DirectoriesList"
import { Button } from "@/components/ui/button"
import { useDirectories } from "../contexts/directories"
import { CirclePlus, CircleX, Search } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QueuesList } from "./QueuesList"
import { StopAllServicesButton } from "./StopAllServicesButton"
import { Logo } from "./Logo"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AddNewQueueButton } from "./AddNewQueueButton"
import { Input } from "@/components/ui/input"
import { Sidebar } from "@/components/ui/sidebar"

export const AppSidebar: FC = () => {
  const { directories, removeDirectory, addFromFolder } = useDirectories()
  const [queueSearchTerm, setQueueSearchTerm] = useState('')
  const [directorySearchTerm, setDirectorySearchTerm] = useState('')

  return (
    <Sidebar>
      <div className="h-[100vh] flex flex-col">
        <div className="h-[80px]">
          <Logo />
        </div>

        <Tabs defaultValue="services" className="flex-1 h-[calc(100vh-80px)]">
          <TabsList className={`w-full flex gap-2 h-[40px]`}>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="queues">Queues</TabsTrigger>
          </TabsList>
          <TabsContent value="services">
            <div className="relative h-[35px] mb-4 px-5">
              <Search className="absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9" value={directorySearchTerm} onChange={(ev) => setDirectorySearchTerm(ev.target.value)} />
              <Button onClick={() => setDirectorySearchTerm('')} className="absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 bg-transparent hover:bg-transparent text-muted-foreground">
                <CircleX />
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-80px-40px-40px-50px-50px)]">
              <DirectoriesList searchTerm={directorySearchTerm} />
            </ScrollArea>
            <div className="flex justify-between items-center px-4 gap-20 h-[80px] bg-stone-600">
              <Button disabled={!directories.length} onClick={() => removeDirectory()} className="bg-destructive text-foreground flex-1">
                Remove all
              </Button>
              <div className="flex gap-2">
                <Button onClick={() => addFromFolder()} variant="default" className="size-8">
                  <CirclePlus />
                </Button>
                <StopAllServicesButton />
              </div>
            </div>

          </TabsContent>
          <TabsContent value="queues">
            <div className="relative h-[35px] mb-4 px-5">
              <Search className="absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9" value={queueSearchTerm} onChange={(ev) => setQueueSearchTerm(ev.target.value)} />
              <Button onClick={() => setQueueSearchTerm('')} className="absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 bg-transparent hover:bg-transparent text-muted-foreground">
                <CircleX />
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-80px-40px-80px-35px-20px)]">
              <QueuesList searchTerm={queueSearchTerm} />
            </ScrollArea>
            <div className="flex justify-between items-center px-4 gap-20 h-[80px] bg-stone-600">
              <AddNewQueueButton />
            </div>
          </TabsContent>
        </Tabs>
      </div >
    </Sidebar>

  )
}
