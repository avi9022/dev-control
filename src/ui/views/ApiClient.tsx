import type { FC } from 'react'
import { useApiClient } from '../contexts/api-client'
import { RequestPanel } from '../components/api-client/RequestPanel'

interface ApiClientViewProps {
  itemId: string | null
}

export const ApiClientView: FC<ApiClientViewProps> = ({ itemId }) => {
  const { activeWorkspace } = useApiClient()

  if (!activeWorkspace) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No workspace selected</p>
          <p className="text-sm mt-1">Create or select a workspace to get started</p>
        </div>
      </div>
    )
  }

  if (!itemId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">Select a request</p>
          <p className="text-sm mt-1">Choose a request from the sidebar or create a new one</p>
        </div>
      </div>
    )
  }

  return <RequestPanel requestId={itemId} />
}
