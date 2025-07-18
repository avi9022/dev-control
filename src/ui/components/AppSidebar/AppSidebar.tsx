import { useState, type FC } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Logo } from "./Logo"
import { Sidebar, SidebarHeader } from "@/components/ui/sidebar"
import { ServicesMenu } from "./ServicesMenu"
import { QueuesMenu } from "./QueuesMenu"
import { WorkflowsMenu } from "./WorkflowsMenu"

export const AppSidebar: FC = () => {
  const [tab, setTab] = useState('services')
  return (
    <Sidebar>
      <div className="h-[100vh] flex flex-col">
        <SidebarHeader className="h-[80px] flex flex-row justify-between p-5 items-center">
          <Logo />
        </SidebarHeader>

        <Tabs defaultValue="services" value={tab} className="flex-1 h-[calc(100vh-80px)]">
          <TabsList className={`w-full flex gap-2 h-[40px]`}>
            <TabsTrigger onClick={() => setTab('services')} value="services">Services</TabsTrigger>
            <TabsTrigger onClick={() => setTab('queues')} value="queues">Queues</TabsTrigger>
            <TabsTrigger onClick={() => setTab('workflows')} value="workflows">Workflows</TabsTrigger>
          </TabsList>
          <TabsContent value="services">
            <ServicesMenu />
          </TabsContent>
          <TabsContent value="queues">
            <QueuesMenu />
          </TabsContent>
          <TabsContent value="workflows">
            <WorkflowsMenu onStartWorkflow={() => setTab('services')} />
          </TabsContent>
        </Tabs>
      </div >
    </Sidebar>

  )
}
