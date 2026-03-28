import { useState, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { useDynamoDB } from '@/ui/contexts/dynamodb'
import { AlertCircle, Loader2, RefreshCw, Settings } from 'lucide-react'
import { DynamoDBConnectionSettingsDialog } from './DynamoDBConnectionSettingsDialog'

export const DynamoDBEmptyState: FC = () => {
  const { connectionState, testConnection } = useDynamoDB()
  const [isRetrying, setIsRetrying] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    await testConnection()
    setIsRetrying(false)
  }

  return (
    <div className="flex flex-col items-center justify-center h-[400px] px-6 text-center gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-status-red-bg">
        <AlertCircle className="w-6 h-6 text-status-red" />
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-lg">Not Connected</h3>
        <p className="text-sm text-muted-foreground">
          Unable to connect to DynamoDB
        </p>
        {connectionState?.lastError && (
          <p className="text-xs text-status-red max-w-[280px] break-words">
            {connectionState.lastError}
          </p>
        )}
      </div>

      <div className="flex gap-2 mt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Retry
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      <DynamoDBConnectionSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
