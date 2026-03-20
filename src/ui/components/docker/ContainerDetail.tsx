import { useState, useEffect, useCallback, type FC } from 'react'
import { useDocker } from '@/ui/contexts/docker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Pause,
  Trash2,
  Search,
  Terminal,
  RefreshCw,
} from 'lucide-react'

interface ContainerDetailProps {
  container: DockerContainer
}

const STATE_BADGE_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  running: 'default',
  paused: 'secondary',
  exited: 'destructive',
  dead: 'destructive',
  created: 'outline',
  restarting: 'secondary',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ResourceBar({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  const clamped = Math.min(100, Math.max(0, percent))
  const barColor = clamped > 80 ? 'bg-status-red' : clamped > 50 ? 'bg-status-yellow' : 'bg-status-green'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{detail}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null
  return (
    <div className="flex py-1.5">
      <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm break-all">{value}</span>
    </div>
  )
}

function OverviewTab({ container, containerStats }: { container: DockerContainer; containerStats?: DockerContainerStats }) {
  const portsDisplay = container.ports
    .filter((p) => p.publicPort)
    .map((p) => `${p.publicPort}:${p.privatePort}/${p.type}`)
    .join(', ')

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-2">Information</h3>
          <div className="border rounded-md p-3 divide-y">
            <InfoRow label="Image" value={container.image} />
            <InfoRow label="Status" value={container.status} />
            <InfoRow label="Created" value={formatDate(container.created)} />
            <InfoRow label="ID" value={container.id.slice(0, 12)} />
            {portsDisplay && <InfoRow label="Ports" value={portsDisplay} />}
            {container.networks.length > 0 && (
              <InfoRow label="Networks" value={container.networks.join(', ')} />
            )}
            {container.composeProject && (
              <InfoRow label="Compose" value={`${container.composeProject} / ${container.composeService ?? ''}`} />
            )}
          </div>
        </div>

        {container.mounts.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Mounts</h3>
            <div className="border rounded-md p-3 space-y-1">
              {container.mounts.map((m, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  <span className="font-mono">{m.source}</span>
                  <span className="mx-1">{'->'}</span>
                  <span className="font-mono">{m.destination}</span>
                  <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">{m.type}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(container.labels).length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Labels</h3>
            <div className="border rounded-md p-3 space-y-1 max-h-40 overflow-auto">
              {Object.entries(container.labels).map(([k, v]) => (
                <div key={k} className="text-xs">
                  <span className="text-muted-foreground">{k}:</span>{' '}
                  <span className="font-mono break-all">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {containerStats && (
          <div>
            <h3 className="text-sm font-medium mb-2">Resource Usage</h3>
            <div className="border rounded-md p-3 space-y-3">
              <ResourceBar
                label="CPU"
                percent={containerStats.cpuPercent}
                detail={`${containerStats.cpuPercent.toFixed(2)}%`}
              />
              <ResourceBar
                label="Memory"
                percent={containerStats.memoryPercent}
                detail={`${formatBytes(containerStats.memoryUsage)} / ${formatBytes(containerStats.memoryLimit)}`}
              />
              <Separator />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>Net RX: {formatBytes(containerStats.networkRx)}</span>
                <span>Net TX: {formatBytes(containerStats.networkTx)}</span>
                <span>Block Read: {formatBytes(containerStats.blockRead)}</span>
                <span>Block Write: {formatBytes(containerStats.blockWrite)}</span>
                <span>PIDs: {containerStats.pids}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

function LogsTab({ containerId }: { containerId: string }) {
  const { getContainerLogs } = useDocker()
  const [logs, setLogs] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [follow, setFollow] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getContainerLogs(containerId, { tail: 500, follow: false })
      setLogs(result)
    } catch {
      setLogs('Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }, [containerId, getContainerLogs])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    if (!follow) return
    const interval = setInterval(fetchLogs, 2000)
    return () => clearInterval(interval)
  }, [follow, fetchLogs])

  const displayedLogs = searchTerm
    ? logs.split('\n').filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase())).join('\n')
    : logs

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-7 text-xs"
          />
        </div>
        <Button
          variant={follow ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setFollow((prev) => !prev)}
        >
          {follow ? 'Following' : 'Follow'}
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setLogs('')}>
          Clear
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all text-foreground">
          {displayedLogs || 'No logs available'}
        </pre>
      </ScrollArea>
    </div>
  )
}

function ExecTab({ containerId }: { containerId: string }) {
  const { execInContainer } = useDocker()
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState('')
  const [executing, setExecuting] = useState(false)

  const presets = [
    { label: '/bin/sh', cmd: '/bin/sh -c "echo shell ready"' },
    { label: '/bin/bash', cmd: '/bin/bash -c "echo bash ready"' },
    { label: 'ls', cmd: 'ls -la' },
    { label: 'env', cmd: 'env' },
  ]

  const runCommand = async (cmd: string) => {
    if (!cmd.trim()) return
    setExecuting(true)
    try {
      const result = await execInContainer(containerId, cmd)
      setOutput((prev) => `$ ${cmd}\n${result}\n${prev}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution failed'
      setOutput((prev) => `$ ${cmd}\nError: ${message}\n${prev}`)
    } finally {
      setExecuting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runCommand(command)
    setCommand('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <div className="flex gap-1 flex-wrap">
          {presets.map((p) => (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => runCommand(p.cmd)}
              disabled={executing}
            >
              <Terminal className="h-3 w-3 mr-1" />
              {p.label}
            </Button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Enter command..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="h-8 text-sm font-mono"
            disabled={executing}
          />
          <Button type="submit" size="sm" className="h-8" disabled={executing || !command.trim()}>
            Run
          </Button>
        </form>
      </div>
      <ScrollArea className="flex-1">
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all text-foreground">
          {output || 'Execute a command above to see output'}
        </pre>
      </ScrollArea>
    </div>
  )
}

export const ContainerDetail: FC<ContainerDetailProps> = ({ container }) => {
  const {
    stats,
    selectContainer,
    startContainer,
    stopContainer,
    restartContainer,
    pauseContainer,
    unpauseContainer,
    removeContainer,
  } = useDocker()

  const [confirmRemove, setConfirmRemove] = useState(false)
  const containerStats = stats[container.id]
  const isRunning = container.state === 'running'
  const isPaused = container.state === 'paused'
  const isStopped = container.state === 'exited' || container.state === 'dead' || container.state === 'created'
  const badgeVariant = STATE_BADGE_VARIANTS[container.state] ?? 'outline'

  const handleRemove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true)
      return
    }
    await removeContainer(container.id)
    selectContainer(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => selectContainer(null)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-medium truncate">{container.name}</h2>
          <p className="text-xs text-muted-foreground truncate">{container.image}</p>
        </div>
        <Badge variant={badgeVariant}>{container.state}</Badge>
      </div>

      <div className="flex items-center gap-1 px-4 py-2 border-b">
        {isStopped && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => startContainer(container.id)}>
            <Play className="h-3 w-3 mr-1" /> Start
          </Button>
        )}
        {isRunning && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => stopContainer(container.id)}>
            <Square className="h-3 w-3 mr-1" /> Stop
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => restartContainer(container.id)}>
          <RotateCcw className="h-3 w-3 mr-1" /> Restart
        </Button>
        {isRunning && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => pauseContainer(container.id)}>
            <Pause className="h-3 w-3 mr-1" /> Pause
          </Button>
        )}
        {isPaused && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => unpauseContainer(container.id)}>
            <Play className="h-3 w-3 mr-1" /> Unpause
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant={confirmRemove ? 'destructive' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={handleRemove}
          onBlur={() => setConfirmRemove(false)}
        >
          <Trash2 className="h-3 w-3 mr-1" /> {confirmRemove ? 'Confirm Remove' : 'Remove'}
        </Button>
      </div>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-2">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="exec">Exec</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview" className="flex-1 min-h-0">
          <OverviewTab container={container} containerStats={containerStats} />
        </TabsContent>
        <TabsContent value="logs" className="flex-1 min-h-0">
          <LogsTab containerId={container.id} />
        </TabsContent>
        <TabsContent value="exec" className="flex-1 min-h-0">
          <ExecTab containerId={container.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
