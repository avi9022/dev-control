import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play, Square } from "lucide-react";
import type { FC } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDirectories } from "../contexts/directories";
import { Loader2 } from "lucide-react";

interface DirectoryTabProps {
  directorySettings: DirectorySettings
}

export const DirectoryTab: FC<DirectoryTabProps> = ({
  directorySettings
}) => {
  const { runService, directoriesStateMap, stopService } = useDirectories()
  const { id, isFrontendProj, name, runCommand } = directorySettings

  const state = directoriesStateMap[id] || 'UNKNOWN'
  const isRunning = state === 'RUNNING'
  const isUnknown = state === 'UNKNOWN'
  const isInitializing = state === 'INITIALIZING'

  const toggleService = () => {
    if (isRunning) {
      stopService(id)
    } else {
      runService(id)
    }
  }


  return <div className="px-5 flex justify-between mb-5">
    <div>
      <div className="w-full flex gap-3 justify-start">
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="font-bold max-w-[150px] text-sm truncate overflow-hidden whitespace-nowrap capitalize">
                {name}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              <p className="capitalize">
                {name?.replace('-', ' ')}
              </p>
            </TooltipContent>
          </Tooltip>
          <p className='text-xs opacity-60'>
            {runCommand}
          </p>
        </div>

        <Badge className={`${isRunning ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'} h-6`}>
          <p className="capitalize">
            {state?.toLowerCase()}
          </p>
        </Badge>
      </div>

    </div>
    <div className="flex gap-2">
      {isFrontendProj && <Tooltip>
        <TooltipTrigger asChild>
          <Button
            disabled={!isRunning}
            style={!isRunning ? {
              pointerEvents: 'auto',
              cursor: 'auto'
            } : {}}
            onClick={(ev) => {
              ev.stopPropagation()
              window.electron.openProjectInBrowser(directorySettings.id)
            }}
            size="sm"
          >
            {<ExternalLink />}
          </Button>
        </TooltipTrigger>
        {isUnknown ? <TooltipContent>
          <p>Please update the project's port to use this action</p>
        </TooltipContent> : !isRunning ? <TooltipContent>
          <p>Project is not running</p>
        </TooltipContent> : <TooltipContent>
          <p>Open in browser</p>
        </TooltipContent>}
        { }
      </Tooltip>}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            disabled={isUnknown || isInitializing}
            style={isUnknown || isInitializing ? {
              pointerEvents: 'auto',
              cursor: 'auto'
            } : {}}
            onClick={(ev) => {
              ev.stopPropagation()
              toggleService()
            }}
            className={`${isRunning ? 'bg-destructive' : 'bg-success'}`} size="sm"
          >
            {isRunning ? <Square fill="white" color="white" /> : isInitializing ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              : <Play fill="white" color="white" />}
          </Button>
        </TooltipTrigger>
        {isUnknown && <TooltipContent>
          <p>Please update the project's port to use this action</p>
        </TooltipContent>}
      </Tooltip>
    </div>
  </div>
}