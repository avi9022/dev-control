import { useState, useEffect, useCallback, useRef, type FC } from 'react'
import { useDocker } from '@/ui/contexts/docker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  FolderOpen,
  HardDrive,
  Database,
  MemoryStick,
} from 'lucide-react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { FilesTab } from './files/FilesTab'

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
  const barColor = clamped > 80 ? 'bg-red-500' : clamped > 50 ? 'bg-yellow-500' : 'bg-green-500'

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
            <div className="border rounded-md divide-y">
              {container.mounts.map((m, i) => {
                const isBind = m.type === 'bind'
                const isVolume = m.type === 'volume'
                const isTmpfs = m.type === 'tmpfs'
                // Can only open in Finder if it's a bind mount with a real host path
                // Docker volume paths (/var/lib/docker/...) are inside the Docker VM on macOS
                const canOpenInFinder = isBind && m.source && m.source.startsWith('/') && !m.source.startsWith('/var/lib/docker/')

                return (
                  <div key={i} className="p-3 flex items-start gap-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`shrink-0 p-1.5 rounded ${
                            isBind ? 'bg-green-500/10 text-green-500' :
                            isVolume ? 'bg-blue-500/10 text-blue-500' :
                            'bg-orange-500/10 text-orange-500'
                          }`}>
                            {isBind && <HardDrive className="h-4 w-4" />}
                            {isVolume && <Database className="h-4 w-4" />}
                            {isTmpfs && <MemoryStick className="h-4 w-4" />}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isBind && 'Bind mount - stored on host filesystem'}
                          {isVolume && 'Docker volume - managed by Docker'}
                          {isTmpfs && 'Temporary filesystem - stored in memory'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {m.type}
                        </Badge>
                        {m.readOnly && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            read-only
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground shrink-0">Source:</span>
                          <span className="font-mono truncate" title={m.source}>{m.source || '(none)'}</span>
                          {canOpenInFinder && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 shrink-0"
                                    onClick={() => window.electron.openInFinder(m.source)}
                                  >
                                    <FolderOpen className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Open in Finder</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground shrink-0">Dest:</span>
                          <span className="font-mono truncate" title={m.destination}>{m.destination}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
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

const SHELLS = [
  { value: 'auto', label: 'Auto' },
  { value: '/bin/sh', label: 'sh' },
  { value: '/bin/bash', label: 'bash' },
]

function ExecTab({ containerId }: { containerId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedShell, setSelectedShell] = useState('auto')
  const [currentShell, setCurrentShell] = useState<string | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // Keep sessionId ref in sync
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  // Initialize terminal and start session automatically
  useEffect(() => {
    if (!terminalRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#c9d1d9',
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Initial fit after render
    setTimeout(() => {
      fitAddon.fit()
      startSession(term)
    }, 100)

    // Handle user input - send to PTY
    term.onData((data) => {
      if (sessionIdRef.current) {
        window.electron.dockerExecInput(sessionIdRef.current, data)
      }
    })

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (sessionIdRef.current && term) {
        window.electron.dockerExecResize(sessionIdRef.current, term.cols, term.rows)
      }
    })
    resizeObserver.observe(terminalRef.current)

    return () => {
      resizeObserver.disconnect()
      if (sessionIdRef.current) {
        window.electron.dockerExecClose(sessionIdRef.current)
      }
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [containerId])

  // Subscribe to session output
  useEffect(() => {
    const unsubOutput = window.electron.subscribeDockerExecOutput((data) => {
      if (data.sessionId === sessionIdRef.current && xtermRef.current) {
        xtermRef.current.write(data.data)
      }
    })

    const unsubClosed = window.electron.subscribeDockerExecClosed((data) => {
      if (data.sessionId === sessionIdRef.current) {
        if (xtermRef.current) {
          xtermRef.current.write('\r\n\x1b[33m[Session ended - Exit code: ' + (data.exitCode ?? 'unknown') + ']\x1b[0m\r\n')
          xtermRef.current.write('\x1b[90mPress any key to reconnect...\x1b[0m')
        }
        setSessionId(null)
      }
    })

    return () => {
      unsubOutput()
      unsubClosed()
    }
  }, [])

  const startSession = async (term?: XTerm, shell?: string) => {
    const terminal = term || xtermRef.current
    if (!terminal) return

    setConnecting(true)
    setError(null)
    setCurrentShell(null)

    // If specific shell selected, try only that one
    // Otherwise try shells in order
    const shellToUse = shell || selectedShell
    const shells = shellToUse === 'auto'
      ? ['/bin/sh', '/bin/bash']
      : [shellToUse]

    for (const sh of shells) {
      try {
        terminal.write(`\x1b[90mConnecting with ${sh}...\x1b[0m\r\n`)
        const session = await window.electron.dockerExecInteractive(containerId, sh)
        setSessionId(session.sessionId)
        setCurrentShell(sh)
        setConnecting(false)

        // Send initial resize
        setTimeout(() => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit()
            window.electron.dockerExecResize(session.sessionId, terminal.cols, terminal.rows)
          }
        }, 100)

        return
      } catch {
        // Try next shell
      }
    }

    setError(shellToUse === 'auto' ? 'No compatible shell found' : `${shellToUse} not available`)
    setConnecting(false)
    terminal.write('\x1b[31mFailed to connect. Shell may not be installed or container not running.\x1b[0m\r\n')
  }

  const reconnect = () => {
    if (xtermRef.current) {
      xtermRef.current.clear()
      startSession()
    }
  }

  const switchShell = (shell: string) => {
    setSelectedShell(shell)
    if (sessionId) {
      window.electron.dockerExecClose(sessionId)
      setSessionId(null)
    }
    if (xtermRef.current) {
      xtermRef.current.clear()
      startSession(undefined, shell === 'auto' ? undefined : shell)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#30363d] bg-[#161b22]">
        <Terminal className="h-4 w-4 text-green-500" />
        <span className="text-sm font-medium text-[#c9d1d9]">Terminal</span>
        {connecting && (
          <span className="text-xs text-yellow-500 animate-pulse">Connecting...</span>
        )}
        {sessionId && currentShell && (
          <span className="text-xs text-green-500">● {currentShell}</span>
        )}
        {!sessionId && !connecting && (
          <span className="text-xs text-red-400">● Disconnected</span>
        )}
        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
        <div className="flex-1" />
        {/* Shell selector */}
        <div className="flex items-center gap-1">
          {SHELLS.map((sh) => (
            <button
              key={sh.value}
              onClick={() => switchShell(sh.value)}
              disabled={connecting}
              className={`
                px-2 py-0.5 text-xs rounded transition-colors
                ${selectedShell === sh.value
                  ? 'bg-[#58a6ff] text-white'
                  : 'bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] hover:text-[#c9d1d9]'
                }
                ${connecting ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {sh.label}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-[#30363d] mx-1" />
        {!sessionId && !connecting && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs bg-[#21262d] border-[#30363d] text-[#c9d1d9] hover:bg-[#30363d]"
            onClick={reconnect}
          >
            Reconnect
          </Button>
        )}
        {sessionId && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs bg-[#21262d] border-[#30363d] text-[#c9d1d9] hover:bg-[#30363d]"
            onClick={() => {
              if (sessionId) {
                window.electron.dockerExecClose(sessionId)
                setSessionId(null)
                setCurrentShell(null)
              }
            }}
          >
            Disconnect
          </Button>
        )}
      </div>
      <div
        ref={terminalRef}
        className="flex-1 p-1"
        onClick={() => xtermRef.current?.focus()}
      />
    </div>
  )
}

export const ContainerDetail: FC<ContainerDetailProps> = ({ container: containerProp }) => {
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
  const [detailedContainer, setDetailedContainer] = useState<DockerContainer | null>(null)

  // Fetch detailed container info to get proper mount types
  useEffect(() => {
    let mounted = true
    window.electron.dockerGetContainer(containerProp.id).then((detailed) => {
      if (mounted) {
        setDetailedContainer(detailed)
      }
    }).catch(() => {
      // Fallback to prop if fetch fails
    })
    return () => { mounted = false }
  }, [containerProp.id])

  // Use detailed container if available, otherwise fallback to prop
  const container = detailedContainer ?? containerProp
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
            <TabsTrigger value="files">
              <FolderOpen className="h-3.5 w-3.5 mr-1" />
              Files
            </TabsTrigger>
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
        <TabsContent value="files" className="flex-1 min-h-0">
          <FilesTab containerId={container.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
