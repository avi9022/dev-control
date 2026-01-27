import type { FC } from "react"
import { useViews } from "../contexts/views"
import { Service } from "../views/Service"
import { Queue } from "../views/Queue"
import { Tool } from "../views/Tool"
import { DynamoDBView } from "../views/DynamoDB"
import { ApiClientView } from "../views/ApiClient"
import { DockerView } from "../views/Docker"
import { MongoDBView } from "../views/MongoDB"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const OVERFLOW_VIEWS = new Set(['dynamodb', 'tool', 'api-client', 'docker', 'mongodb'])

export const MainContent: FC = () => {
  const { views, setCurrentViewIndex, currentViewIndex, closeView } = useViews()

  const renderView = (type: string, itemId: string | null, index: number) => {
    switch (type) {
      case 'dynamodb':
        return <DynamoDBView key={index} tableName={itemId} />
      case 'tool':
        return <Tool key={index} id={itemId} />
      case 'api-client':
        return <ApiClientView key={index} itemId={itemId} />
      case 'docker':
        return <DockerView key={index} itemId={itemId} />
      case 'mongodb':
        return <MongoDBView key={index} itemId={itemId} />
      case 'directory':
        return <Service key={index} id={itemId} />
      case 'queue':
        return <Queue key={index} id={itemId} />
      default:
        return null
    }
  }

  return (
    <div className={`flex flex-row w-full h-full ${views.length > 1 ? 'px-3' : ''} gap-2 flex-1`}>
      {views.map(({ type, itemId }, index) => (
        <div key={`${itemId}-${type}-${index}`} onClick={() => setCurrentViewIndex(index)} className={`relative h-full flex-1 basis-1/${views.length} flex flex-col overflow-hidden ${views.length > 1 ? `border rounded-md ${currentViewIndex === index ? 'border-green-700' : ''}` : 'w-full'}`}>
          {views.length > 1 && <div className="flex-shrink-0 flex justify-between px-5 bg-card rounded-t-md items-center py-2">
            <p className="font-bold">View: {index + 1}</p>
            <Button className="h-5" onClick={(ev) => {
              ev.stopPropagation()
              closeView(index)
            }}>
              <p className="text-xs">Close</p>
            </Button>
          </div>}
          {OVERFLOW_VIEWS.has(type) ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              {renderView(type, itemId, index)}
            </div>
          ) : (
            <ScrollArea className="flex-1 min-h-0">
              {renderView(type, itemId, index)}
            </ScrollArea>
          )}
        </div>
      ))}
    </div>
  )
}
