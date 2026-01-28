import { useState, useCallback, type FC } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
import { Server, ListOrdered, Database, Globe, Container, Leaf, GitBranch, Wrench } from "lucide-react"

const SIDEBAR_TABS = [
  { value: 'services', label: 'Services', icon: Server },
  { value: 'queues', label: 'Queues', icon: ListOrdered },
  { value: 'dynamodb', label: 'DynamoDB', icon: Database },
  { value: 'api-client', label: 'API Client', icon: Globe },
  { value: 'docker', label: 'Docker', icon: Container },
  { value: 'mongodb', label: 'MongoDB', icon: Leaf },
  { value: 'workflows', label: 'Workflows', icon: GitBranch },
  { value: 'tools', label: 'Tools', icon: Wrench },
] as const

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
          <TabsList className="w-full flex gap-1 h-[36px] flex-shrink-0 px-1">
            {SIDEBAR_TABS.map(({ value, label, icon: Icon }) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    className="px-2 py-1 flex-shrink-0"
                    onClick={() => handleTabClick(value)}
                    value={value}
                  >
                    <Icon className="h-4 w-4" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {label}
                </TooltipContent>
              </Tooltip>
            ))}
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
