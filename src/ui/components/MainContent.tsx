import type { FC } from "react"
import { useViews } from "../contexts/views"
import { Service } from "../views/Service"
import { Queue } from "../views/Queue"
import { Tool } from "../views/Tool"
import { DynamoDBView } from "../views/DynamoDB"
import { ApiClientView } from "../views/ApiClient"
import { DockerView } from "../views/Docker"
import { MongoDBView } from "../views/MongoDB"
import { SQLView } from "../views/SQL"
import { AIKanban } from "../views/AIKanban"
import { ServicesMenu } from "./AppSidebar/ServicesMenu"
import { QueuesMenu } from "./AppSidebar/QueuesMenu"
import { DynamoDBMenu } from "./AppSidebar/DynamoDBMenu"
import { ApiClientMenu } from "./AppSidebar/ApiClientMenu"
import { DockerMenu } from "./AppSidebar/DockerMenu"
import { MongoDBMenu } from "./AppSidebar/MongoDBMenu"
import { SQLMenu } from "./AppSidebar/SQLMenu"
import { ToolsMenu } from "./AppSidebar/ToolsMenu"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"

interface MainContentProps {
  selectedTaskId?: string | null
  onSelectTask?: (taskId: string | null) => void
  show3D?: boolean
}

function ViewSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="relative flex-shrink-0 h-full" style={{ width: collapsed ? 0 : 280, transition: 'width 0.2s ease' }}>
      <div className="h-full overflow-hidden" style={{ borderRight: collapsed ? 'none' : '1px solid var(--ai-border-subtle)' }}>
        {!collapsed && children}
      </div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-3 z-10 w-5 h-6 flex items-center justify-center rounded-r-md transition-colors"
        style={{
          right: -20,
          background: 'var(--ai-surface-2)',
          border: '1px solid var(--ai-border-subtle)',
          borderLeft: 'none',
          color: 'var(--ai-text-tertiary)',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--ai-text-primary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--ai-text-tertiary)')}
      >
        {collapsed ? <ChevronRight className="size-3" /> : <ChevronLeft className="size-3" />}
      </button>
    </div>
  )
}

export const MainContent: FC<MainContentProps> = ({ selectedTaskId = null, onSelectTask, show3D }) => {
  const { views, setCurrentViewIndex, currentViewIndex, closeView } = useViews()

  const renderView = (type: string, itemId: string | null, index: number) => {
    switch (type) {
      case 'kanban':
        return <AIKanban key={index} selectedTaskId={selectedTaskId} onSelectTask={onSelectTask || (() => {})} show3D={show3D} />
      case 'directory':
        return (
          <div className="flex h-full" key={index}>
            <ViewSidebar><ServicesMenu /></ViewSidebar>
            <div className="flex-1 min-w-0 overflow-hidden">
              <Service id={itemId} />
            </div>
          </div>
        )
      case 'queue':
        return (
          <div className="flex h-full" key={index}>
            <ViewSidebar><QueuesMenu /></ViewSidebar>
            <div className="flex-1 min-w-0 overflow-hidden">
              <Queue id={itemId} />
            </div>
          </div>
        )
      case 'dynamodb':
        return (
          <div className="flex h-full" key={index}>
            <ViewSidebar><DynamoDBMenu /></ViewSidebar>
            <div className="flex-1 min-w-0 overflow-hidden">
              <DynamoDBView tableName={itemId} />
            </div>
          </div>
        )
      case 'api-client':
        return (
          <div className="flex h-full" key={index}>
            <ViewSidebar><ApiClientMenu /></ViewSidebar>
            <div className="flex-1 min-w-0 overflow-hidden">
              <ApiClientView itemId={itemId} />
            </div>
          </div>
        )
      case 'docker':
        return (
          <div className="flex h-full" key={index}>
            <ViewSidebar><DockerMenu /></ViewSidebar>
            <div className="flex-1 min-w-0 overflow-hidden">
              <DockerView itemId={itemId} />
            </div>
          </div>
        )
      case 'mongodb':
        return (
          <div className="flex h-full" key={index}>
            <ViewSidebar><MongoDBMenu /></ViewSidebar>
            <div className="flex-1 min-w-0 overflow-hidden">
              <MongoDBView itemId={itemId} />
            </div>
          </div>
        )
      case 'sql':
        return (
          <div className="flex h-full" key={index}>
            <ViewSidebar><SQLMenu /></ViewSidebar>
            <div className="flex-1 min-w-0 overflow-hidden">
              <SQLView itemId={itemId} />
            </div>
          </div>
        )
      case 'tool':
        return (
          <div className="flex h-full" key={index}>
            <ViewSidebar><ToolsMenu /></ViewSidebar>
            <div className="flex-1 min-w-0 overflow-hidden">
              <Tool id={itemId} />
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className={`flex flex-row w-full h-full ${views.length > 1 ? 'px-3' : ''} gap-2 flex-1`}>
      {views.map(({ type, itemId }, index) => (
        <div key={`${itemId}-${type}-${index}`} onClick={() => setCurrentViewIndex(index)} className={`relative h-full flex-1 basis-1/${views.length} flex flex-col overflow-hidden ${views.length > 1 ? `border rounded-md ${currentViewIndex === index ? 'border-status-green' : ''}` : 'w-full'}`}>
          {views.length > 1 && <div className="flex-shrink-0 flex justify-between px-5 bg-card rounded-t-md items-center py-2">
            <p className="font-bold">View: {index + 1}</p>
            <Button className="h-5" onClick={(ev) => {
              ev.stopPropagation()
              closeView(index)
            }}>
              <p className="text-xs">Close</p>
            </Button>
          </div>}
          <div className="flex-1 min-h-0 overflow-hidden">
            {renderView(type, itemId, index)}
          </div>
        </div>
      ))}
    </div>
  )
}
