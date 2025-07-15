import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Play, Square } from "lucide-react";
import type { FC } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { useDirectories } from "@/ui/contexts/directories";
import { useViews } from "@/ui/contexts/views";

interface DirectoryTabProps {
  directorySettings: DirectorySettings
}

export const DirectoryTab: FC<DirectoryTabProps> = ({
  directorySettings
}) => {
  const { runService, directoriesStateMap, stopService } = useDirectories()
  const { id, isFrontendProj, name, runCommand } = directorySettings
  const { views } = useViews()

  const state = directoriesStateMap[id] || 'UNKNOWN'
  const isRunning = state === 'RUNNING'
  const isUnknown = state === 'UNKNOWN'
  const isInitializing = state === 'INITIALIZING'
  const isDirectoryPanelOpen = views.some(({ itemId, type }) => type === 'directory' && itemId === directorySettings.id)

  const toggleService = () => {
    if (isRunning) {
      stopService(id)
    } else {
      runService(id)
    }
  }


  return <div className={`px-5 py-5 flex justify-between ${isDirectoryPanelOpen ? 'bg-stone-300 text-black' : ''}`}>
    <div>
      <div className="w-full flex gap-3 justify-start">
        <div className="w-[180px]">
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

        <Badge className={`font-semibold
 ${isRunning ?
            isDirectoryPanelOpen ? 'bg-success/40 text-green-900' : 'bg-success/20 text-success' :
            isDirectoryPanelOpen ? 'bg-destructive/40 text-red-900' : 'bg-destructive/20 text-red-400'
          } h-6`}>
          <p className="capitalize">
            {state?.toLowerCase()}
          </p>
        </Badge>
      </div>

    </div>
    <div className="flex gap-2">
      {isFrontendProj && !isInitializing && <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="shadow-gray-600"
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
      {isInitializing && <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={(ev) => {
              ev.stopPropagation()
              stopService(id)
            }}
            className={'bg-destructive hover:bg-destructive/80'} size="sm"
          >
            <Square fill="white" color="white" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Force stop</p>
        </TooltipContent>
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
            className={`${isRunning ? 'bg-destructive hover:bg-destructive/80' : 'bg-success hover:bg-success/80'} shadow-gray-600`} size="sm"
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