import { useState, type FC } from 'react'
import { useApiClient } from '../contexts/api-client'
import { RequestPanel } from '../components/api-client/RequestPanel'
import { ScratchRequestPanel } from '../components/api-client/ScratchRequestPanel'
import { VariablesPanel } from '../components/api-client/VariablesPanel'
import { Button } from '@/components/ui/button'
import { Braces } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ApiClientViewProps {
  itemId: string | null
}

export const ApiClientView: FC<ApiClientViewProps> = ({ itemId }) => {
  const { activeWorkspace, scratchRequest } = useApiClient()
  const [showVariables, setShowVariables] = useState(false)

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

  const mainContent = (() => {
    if (itemId === 'scratch' && scratchRequest) {
      return <ScratchRequestPanel />
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
  })()

  return (
    <div className="h-full flex flex-col">
      {/* Top bar with variables toggle */}
      <div className="flex items-center justify-end px-3 py-1.5 border-b bg-background">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showVariables ? 'secondary' : 'ghost'}
              size="sm"
              className={cn("h-7 gap-1.5 text-xs", showVariables && "bg-accent")}
              onClick={() => setShowVariables((v) => !v)}
            >
              <Braces className="h-3.5 w-3.5" />
              Variables
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle environment variables panel</TooltipContent>
        </Tooltip>
      </div>

      {/* Main area with optional variables panel */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0">
          {mainContent}
        </div>
        {showVariables && (
          <div className="w-[350px] flex-shrink-0">
            <VariablesPanel />
          </div>
        )}
      </div>
    </div>
  )
}
