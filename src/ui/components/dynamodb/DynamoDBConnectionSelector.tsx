import { type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { useDynamoDB } from '@/ui/contexts/dynamodb'
import { DynamoDBConnectionSettingsDialog } from './DynamoDBConnectionSettingsDialog'

export const DynamoDBConnectionSelector: FC = () => {
  const { connections, connectionStates, settingsOpen, setSettingsOpen } = useDynamoDB()

  const enabled = connections.filter((c) => c.enabled)
  const connectedCount = enabled.filter((c) => connectionStates.get(c.id)?.isConnected).length

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-stone-700 rounded-md mx-5">
      <span className="text-sm font-medium text-white flex-1 truncate">
        Connections
        <span className="ml-2 text-xs text-muted-foreground">
          {connectedCount}/{enabled.length} connected
        </span>
      </span>

      <div className="flex items-center gap-1.5">
        {enabled.map((conn) => {
          const state = connectionStates.get(conn.id)
          const color = state?.isConnected ? 'bg-green-500' : 'bg-red-500'
          return (
            <div
              key={conn.id}
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`}
              title={`${conn.name}${state?.isConnected ? '' : ' — disconnected'}`}
            />
          )
        })}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:bg-stone-600 flex-shrink-0"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings className="h-4 w-4" />
      </Button>

      <DynamoDBConnectionSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
