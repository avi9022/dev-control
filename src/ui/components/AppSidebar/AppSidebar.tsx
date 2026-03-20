import { useEffect, type FC } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Sidebar } from "@/components/ui/sidebar"
import { ServicesMenu } from "./ServicesMenu"
import { QueuesMenu } from "./QueuesMenu"
import { WorkflowsMenu } from "./WorkflowsMenu"
import { ToolsMenu } from "./ToolsMenu"
import { DynamoDBMenu } from "./DynamoDBMenu"
import { ApiClientMenu } from "./ApiClientMenu"
import { DockerMenu } from "./DockerMenu"
import { MongoDBMenu } from "./MongoDBMenu"
import { useViews, type ViewType } from "@/ui/contexts/views"
import { SQLMenu } from "./SQLMenu"

const VIEW_TABS = new Set<string>(['dynamodb', 'api-client', 'docker', 'mongodb', 'sql'])

interface AppSidebarProps {
  activeTab: string
}

export const AppSidebar: FC<AppSidebarProps> = ({ activeTab }) => {
  const { updateView } = useViews()

  // Trigger view update when activeTab changes
  useEffect(() => {
    if (VIEW_TABS.has(activeTab)) {
      updateView(activeTab as ViewType, null)
    }
  }, [activeTab])

  return (
    <Sidebar>
      <div className="h-full flex flex-col">
        <Tabs value={activeTab} className="flex-1 flex flex-col min-h-0 pt-4">
          <TabsContent value="services" className="flex-1 min-h-0 mt-0">
            <ServicesMenu />
          </TabsContent>
          <TabsContent value="queues" className="flex-1 min-h-0 mt-0">
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
          <TabsContent value="sql" className="flex-1 min-h-0 overflow-auto mt-0">
            <SQLMenu />
          </TabsContent>
          <TabsContent value="workflows" className="flex-1 min-h-0 overflow-auto mt-0">
            <WorkflowsMenu />
          </TabsContent>
          <TabsContent value="tools" className="flex-1 min-h-0 overflow-auto mt-0">
            <ToolsMenu />
          </TabsContent>
        </Tabs>
      </div>
    </Sidebar>
  )
}
