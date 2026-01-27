import { useState, useCallback, type FC } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Logo } from "./Logo"
import { Sidebar, SidebarHeader } from "@/components/ui/sidebar"
import { ServicesMenu } from "./ServicesMenu"
import { QueuesMenu } from "./QueuesMenu"
import { WorkflowsMenu } from "./WorkflowsMenu"
import { ToolsMenu } from "./ToolsMenu"
import { DynamoDBMenu } from "./DynamoDBMenu"
import { ApiClientMenu } from "./ApiClientMenu"
import { DockerMenu } from "./DockerMenu"
import { MongoDBMenu } from "./MongoDBMenu"
import { useViews, type ViewType } from "@/ui/contexts/views"

const VIEW_TABS = new Set<string>(['dynamodb', 'api-client', 'docker', 'mongodb'])

export const AppSidebar: FC = () => {
  const [tab, setTab] = useState('services')
  const { updateView } = useViews()

  const handleTabClick = useCallback((tabName: string) => {
    setTab(tabName)
    if (VIEW_TABS.has(tabName)) {
      updateView(tabName as ViewType, null)
    }
  }, [updateView])
  return (
    <Sidebar>
      <div className="h-[100vh] flex flex-col">
        <SidebarHeader className="h-[80px] flex flex-row justify-between p-5 items-center">
          <Logo />
        </SidebarHeader>

        <Tabs defaultValue="services" value={tab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full flex gap-1 h-[36px] flex-shrink-0 overflow-x-auto overflow-y-hidden flex-nowrap px-1" style={{ scrollbarWidth: 'none' }}>
            <TabsTrigger className="text-xs px-2 py-1 flex-shrink-0" onClick={() => handleTabClick('services')} value="services">Services</TabsTrigger>
            <TabsTrigger className="text-xs px-2 py-1 flex-shrink-0" onClick={() => handleTabClick('queues')} value="queues">Queues</TabsTrigger>
            <TabsTrigger className="text-xs px-2 py-1 flex-shrink-0" onClick={() => handleTabClick('dynamodb')} value="dynamodb">DynamoDB</TabsTrigger>
            <TabsTrigger className="text-xs px-2 py-1 flex-shrink-0" onClick={() => handleTabClick('api-client')} value="api-client">API</TabsTrigger>
            <TabsTrigger className="text-xs px-2 py-1 flex-shrink-0" onClick={() => handleTabClick('docker')} value="docker">Docker</TabsTrigger>
            <TabsTrigger className="text-xs px-2 py-1 flex-shrink-0" onClick={() => handleTabClick('mongodb')} value="mongodb">MongoDB</TabsTrigger>
            <TabsTrigger className="text-xs px-2 py-1 flex-shrink-0" onClick={() => handleTabClick('workflows')} value="workflows">Workflows</TabsTrigger>
            <TabsTrigger className="text-xs px-2 py-1 flex-shrink-0" onClick={() => handleTabClick('tools')} value="tools">Tools</TabsTrigger>
          </TabsList>
          <TabsContent value="services" className="flex-1 min-h-0 overflow-auto mt-0">
            <ServicesMenu />
          </TabsContent>
          <TabsContent value="queues" className="flex-1 min-h-0 overflow-auto mt-0">
            <QueuesMenu />
          </TabsContent>
          <TabsContent value="dynamodb" className="flex-1 min-h-0 overflow-auto mt-0">
            <DynamoDBMenu />
          </TabsContent>
          <TabsContent value="api-client" className="flex-1 min-h-0 overflow-auto mt-0">
            <ApiClientMenu />
          </TabsContent>
          <TabsContent value="docker" className="flex-1 min-h-0 overflow-auto mt-0">
            <DockerMenu />
          </TabsContent>
          <TabsContent value="mongodb" className="flex-1 min-h-0 overflow-auto mt-0">
            <MongoDBMenu />
          </TabsContent>
          <TabsContent value="workflows" className="flex-1 min-h-0 overflow-auto mt-0">
            <WorkflowsMenu onStartWorkflow={() => setTab('services')} />
          </TabsContent>
          <TabsContent value="tools" className="flex-1 min-h-0 overflow-auto mt-0">
            <ToolsMenu />
          </TabsContent>
        </Tabs>
      </div >
    </Sidebar>

  )
}
