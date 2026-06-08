import { type FC } from 'react'
import { Button } from '@/components/ui/button'
import { useDynamoDB } from '@/ui/contexts/dynamodb'
import { AlertCircle, Settings } from 'lucide-react'

export const DynamoDBEmptyState: FC = () => {
  const { connections, connectionStates, setSettingsOpen } = useDynamoDB()

  // Surface the most recent error across enabled connections, if any.
  const lastError = connections
    .filter((c) => c.enabled)
    .map((c) => connectionStates.get(c.id)?.lastError)
    .find(Boolean)

  return (
    <div className="flex flex-col items-center justify-center h-[400px] px-6 text-center gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10">
        <AlertCircle className="w-6 h-6 text-red-500" />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Not Connected</h3>
        <p className="text-sm text-muted-foreground">
          No DynamoDB connection is currently connected
        </p>
        {lastError && (
          <p className="text-xs text-red-400 max-w-[280px] break-words">
            {lastError}
          </p>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </Button>
    </div>
  )
}
