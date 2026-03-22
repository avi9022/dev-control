import { useState, useMemo, type FC } from 'react'
import { useDocker } from '@/ui/contexts/docker'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Play,
  Square,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  RefreshCw,
} from 'lucide-react'

type StateFilter = 'all' | 'running' | 'stopped' | 'paused'

const STATE_DOT_COLORS: Record<string, string> = {
  running: 'bg-status-green',
  paused: 'bg-status-yellow',
  exited: 'bg-status-red',
  created: 'bg-blue-500',
  dead: 'bg-gray-500',
  restarting: 'bg-orange-500',
}

function getStateDotColor(state: DockerContainerState): string {
  return STATE_DOT_COLORS[state] ?? 'bg-gray-500'
}

function formatPorts(ports: DockerPortMapping[]): string {
  return ports
    .filter((p) => p.publicPort)
    .map((p) => `${p.publicPort}:${p.privatePort}/${p.type}`)
    .join(', ')
}

function matchesFilter(state: DockerContainerState, filter: StateFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'running') return state === 'running'
  if (filter === 'stopped') return state === 'exited' || state === 'dead' || state === 'created'
  if (filter === 'paused') return state === 'paused'
  return true
}

function ResourceBar({ label, percent }: { label: string; percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent))
  const barColor = clamped > 80 ? 'bg-status-red' : clamped > 50 ? 'bg-status-yellow' : 'bg-status-green'

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-8">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-muted-foreground w-10 text-right">{clamped.toFixed(1)}%</span>
    </div>
  )
}

interface ContainerCardProps {
  container: DockerContainer
  containerStats?: DockerContainerStats
  onSelect: (id: string) => void
  onStart: (id: string, dockerContext?: string) => Promise<void>
  onStop: (id: string, dockerContext?: string) => Promise<void>
  onRestart: (id: string, dockerContext?: string) => Promise<void>
  onRemove: (id: string, dockerContext?: string) => Promise<void>
}

function ContainerCard({
  container,
  containerStats,
  onSelect,
  onStart,
  onStop,
  onRestart,
  onRemove,
}: ContainerCardProps) {
  const [removing, setRemoving] = useState(false)
  const isRunning = container.state === 'running'
  const isStopped = container.state === 'exited' || container.state === 'dead' || container.state === 'created'
  const portsDisplay = formatPorts(container.ports)

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await onRemove(container.id, container.dockerContext)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="border rounded-lg p-3 bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${getStateDotColor(container.state)}`} />
            <button
              onClick={() => onSelect(container.id)}
              className="text-sm font-medium truncate hover:underline text-left"
            >
              {container.name}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate pl-4">{container.image}</p>
          <p className="text-xs text-muted-foreground mt-0.5 pl-4">{container.status}</p>
          {container.dockerContext && (
            <p className="text-xs text-blue-400 mt-0.5 pl-4">ctx: {container.dockerContext}</p>
          )}
          {portsDisplay && (
            <p className="text-xs text-muted-foreground mt-0.5 pl-4">{portsDisplay}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isStopped ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onStart(container.id, container.dockerContext)}>
              <Play className="h-3.5 w-3.5" />
            </Button>
          ) : isRunning ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onStop(container.id, container.dockerContext)}>
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRestart(container.id, container.dockerContext)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSelect(container.id)}>
            <FileText className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={handleRemove}
            disabled={removing}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {containerStats && isRunning && (
        <div className="mt-2 space-y-1 pl-4">
          <ResourceBar label="CPU" percent={containerStats.cpuPercent} />
          <ResourceBar label="MEM" percent={containerStats.memoryPercent} />
        </div>
      )}
    </div>
  )
}

interface ComposeGroupProps {
  projectName: string
  containers: DockerContainer[]
  stats: Record<string, DockerContainerStats>
  onSelect: (id: string) => void
  onStart: (id: string, dockerContext?: string) => Promise<void>
  onStop: (id: string, dockerContext?: string) => Promise<void>
  onRestart: (id: string, dockerContext?: string) => Promise<void>
  onRemove: (id: string, dockerContext?: string) => Promise<void>
}

function ComposeGroup({
  projectName,
  containers,
  stats,
  onSelect,
  onStart,
  onStop,
  onRestart,
  onRemove,
}: ComposeGroupProps) {
  const [expanded, setExpanded] = useState(true)
  const [groupAction, setGroupAction] = useState<'starting' | 'stopping' | null>(null)

  const hasMultiple = containers.length > 1
  const allRunning = containers.every((c) => c.state === 'running')
  const someRunning = containers.some((c) => c.state === 'running')

  const handleStartAll = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setGroupAction('starting')
    try {
      await Promise.all(
        containers
          .filter((c) => c.state !== 'running')
          .map((c) => onStart(c.id, c.dockerContext))
      )
    } finally {
      setGroupAction(null)
    }
  }

  const handleStopAll = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setGroupAction('stopping')
    try {
      await Promise.all(
        containers
          .filter((c) => c.state === 'running')
          .map((c) => onStop(c.id, c.dockerContext))
      )
    } finally {
      setGroupAction(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {projectName}
          <Badge variant="secondary" className="ml-1 text-xs">
            {containers.length}
          </Badge>
        </button>
        {hasMultiple && (
          <div className="flex items-center gap-0.5 ml-1">
            {!allRunning && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleStartAll}
                disabled={groupAction !== null}
                title="Start all"
              >
                <Play className="h-3 w-3" />
              </Button>
            )}
            {someRunning && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleStopAll}
                disabled={groupAction !== null}
                title="Stop all"
              >
                <Square className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
      {expanded && (
        <div className="space-y-2 pl-2">
          {containers.map((c) => (
            <ContainerCard
              key={c.id}
              container={c}
              containerStats={stats[c.id]}
              onSelect={onSelect}
              onStart={onStart}
              onStop={onStop}
              onRestart={onRestart}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const ContainerList: FC = () => {
  const {
    containers,
    stats,
    loading,
    selectContainer,
    startContainer,
    stopContainer,
    restartContainer,
    removeContainer,
    refreshContainers,
  } = useDocker()

  const [filter, setFilter] = useState<StateFilter>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase()
    return containers.filter((c) => {
      if (!matchesFilter(c.state, filter)) return false
      if (lowerSearch && !c.name.toLowerCase().includes(lowerSearch) && !c.image.toLowerCase().includes(lowerSearch)) {
        return false
      }
      return true
    })
  }, [containers, filter, search])

  const { composeGroups, standalone } = useMemo(() => {
    const groups: Record<string, DockerContainer[]> = {}
    const ungrouped: DockerContainer[] = []

    for (const c of filtered) {
      if (c.composeProject) {
        const existing = groups[c.composeProject] ?? []
        groups[c.composeProject] = [...existing, c]
      } else {
        ungrouped.push(c)
      }
    }

    return { composeGroups: groups, standalone: ungrouped }
  }, [filtered])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 pb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search containers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as StateFilter)}>
          <SelectTrigger className="w-[120px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refreshContainers}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-4 pb-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {containers.length === 0 ? 'No containers found' : 'No containers match filters'}
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(composeGroups).map(([project, groupContainers]) => (
              <ComposeGroup
                key={project}
                projectName={project}
                containers={groupContainers}
                stats={stats}
                onSelect={selectContainer}
                onStart={startContainer}
                onStop={stopContainer}
                onRestart={restartContainer}
                onRemove={removeContainer}
              />
            ))}

            {standalone.map((c) => (
              <ComposeGroup
                key={c.id}
                projectName={c.name}
                containers={[c]}
                stats={stats}
                onSelect={selectContainer}
                onStart={startContainer}
                onStop={stopContainer}
                onRestart={restartContainer}
                onRemove={removeContainer}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
