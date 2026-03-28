import { Button } from "@/components/ui/button"
import { RefreshCw, Box, Circle } from "lucide-react"
import { useState, type FC } from "react"
import { useDocker } from "@/ui/contexts/docker"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { SearchInput } from "../Inputs/SearchInput"
import { SidebarPanel } from "./SidebarPanel"

const STATE_DOT_COLORS: Record<string, string> = {
  running: 'bg-status-green',
  paused: 'bg-status-yellow',
  restarting: 'bg-blue-500',
  exited: 'bg-gray-500',
  dead: 'bg-gray-500',
  created: 'bg-gray-500',
}

function getStateDotColor(state: string): string {
  return STATE_DOT_COLORS[state] ?? 'bg-gray-500'
}

function sortContainers(containers: DockerContainer[]): DockerContainer[] {
  return [...containers].sort((a, b) => {
    if (a.state === 'running' && b.state !== 'running') return -1
    if (a.state !== 'running' && b.state === 'running') return 1
    return a.name.localeCompare(b.name)
  })
}

export const DockerMenu: FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const {
    isAvailable,
    contexts,
    activeContext,
    containers,
    dashboardStats,
    loading,
    selectedContainerId,
    switchContext,
    refreshContainers,
    selectContainer,
  } = useDocker()

  const filteredContainers = sortContainers(
    containers.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  if (!isAvailable) {
    return (
      <div className="px-5 py-8 text-sm text-muted-foreground text-center">
        Docker is not available. Make sure Docker is installed and running.
      </div>
    )
  }

  return (
    <SidebarPanel
      header={
        <div className="space-y-2">
          <Select value={activeContext} onValueChange={switchContext}>
            <SelectTrigger className="w-full bg-muted border-none text-foreground h-8">
              {activeContext === '__all__' ? 'All' : activeContext}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {contexts.filter((ctx) => ctx.name !== '__all__').map((ctx) => (
                <SelectItem key={ctx.name} value={ctx.name}>
                  {ctx.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {dashboardStats && (
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Circle className="h-2 w-2 fill-status-green text-status-green" />
                {dashboardStats.containersRunning} running
              </div>
              <div className="flex items-center gap-1">
                <Circle className="h-2 w-2 fill-gray-500 text-gray-500" />
                {dashboardStats.containersStopped} stopped
              </div>
              <div className="flex items-center gap-1">
                <Box className="h-3 w-3" />
                {dashboardStats.imagesTotal} images
              </div>
              <div className="flex items-center gap-1">
                <Box className="h-3 w-3" />
                {dashboardStats.volumesTotal} volumes
              </div>
            </div>
          )}

          <SearchInput
            placeholder="Search containers..."
            value={searchTerm}
            onChange={(ev) => setSearchTerm(ev.target.value)}
            onClear={() => setSearchTerm('')}
          />
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshContainers}
            disabled={loading}
            className="size-7 p-0"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <span className="text-xs text-muted-foreground">
            {containers.length} container{containers.length !== 1 ? 's' : ''}
          </span>
        </div>
      }
    >
      <div className="px-2">
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading containers...
          </div>
        )}

        {!loading && filteredContainers.length === 0 && (
          <div className="px-3 py-8 text-sm text-muted-foreground text-center">
            {searchTerm ? 'No containers match your search' : 'No containers found'}
          </div>
        )}

        {!loading && filteredContainers.map((container) => (
          <button
            key={container.id}
            onClick={() => selectContainer(container.id)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left",
              selectedContainerId === container.id && "bg-accent"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", getStateDotColor(container.state))} />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate">{container.name}</span>
              <span className="truncate text-xs text-muted-foreground">{container.image}</span>
              {container.dockerContext && (
                <span className="truncate text-xs text-blue-400">{container.dockerContext}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </SidebarPanel>
  )
}
