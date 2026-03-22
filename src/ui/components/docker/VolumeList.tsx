import { useState, useMemo, type FC } from 'react'
import { useDocker } from '@/ui/contexts/docker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Plus, Trash2, RefreshCw, Search, Eraser, FolderOpen, Container, Circle, Database, HardDrive } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

function CreateVolumeDialog({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      await onCreate(name.trim())
      setName('')
      setOpen(false)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Plus className="h-4 w-4 mr-1.5" />
          Create Volume
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Volume</DialogTitle>
          <DialogDescription>Enter a name for the new Docker volume.</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Volume name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate()
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PruneVolumesDialog({ onPrune }: { onPrune: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [pruning, setPruning] = useState(false)

  const handlePrune = async () => {
    setPruning(true)
    try {
      await onPrune()
      setOpen(false)
    } finally {
      setPruning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Eraser className="h-4 w-4 mr-1.5" />
          Prune
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prune Unused Volumes</DialogTitle>
          <DialogDescription>
            This will remove all volumes not referenced by any containers.
            This action cannot be undone and data will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handlePrune} disabled={pruning}>
            {pruning ? 'Pruning...' : 'Prune'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UsageIndicator({ usedBy }: { usedBy: DockerVolumeUsage[] }) {
  if (usedBy.length === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Circle className="h-2.5 w-2.5 fill-muted-foreground/30" />
              <span className="text-xs">Unused</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>This volume is not used by any container</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const runningCount = usedBy.filter((u) => u.running).length

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            {runningCount > 0 ? (
              <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500" />
            ) : (
              <Circle className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
            )}
            <div className="flex items-center gap-1">
              <Container className="h-3 w-3" />
              <span className="text-xs">{usedBy.length}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Used by {usedBy.length} container{usedBy.length > 1 ? 's' : ''}</p>
            {usedBy.map((u) => (
              <div key={u.containerId} className="flex items-center gap-1.5 text-xs">
                <Circle className={`h-2 w-2 ${u.running ? 'fill-green-500' : 'fill-yellow-500'}`} />
                <span>{u.containerName}</span>
                <span className="text-muted-foreground">({u.running ? 'running' : 'stopped'})</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export const VolumeList: FC = () => {
  const { volumes, createVolume, removeVolume, pruneVolumes, refreshVolumes } = useDocker()
  const [search, setSearch] = useState('')
  const [removingName, setRemovingName] = useState<string | null>(null)
  const [confirmName, setConfirmName] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase()
    return search
      ? volumes.filter((v) => v.name.toLowerCase().includes(lowerSearch))
      : volumes
  }, [volumes, search])

  const handleRemove = async (volume: DockerVolume) => {
    if (confirmName !== volume.name) {
      setConfirmName(volume.name)
      return
    }
    setRemovingName(volume.name)
    try {
      await removeVolume(volume.name, volume.dockerContext)
    } finally {
      setRemovingName(null)
      setConfirmName(null)
    }
  }

  const openInFinder = (path: string) => {
    window.electron.openInFinder(path)
  }

  // Check if mountpoint is a valid host path that can be opened in Finder
  // Docker volume paths like /var/lib/docker/volumes/... are inside the Docker VM on macOS
  // and cannot be opened directly from Finder
  const isHostPath = (mountpoint: string) => {
    if (!mountpoint || !mountpoint.startsWith('/')) return false
    // Docker VM paths on macOS that can't be opened in Finder
    if (mountpoint.startsWith('/var/lib/docker/')) return false
    return true
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 pb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search volumes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8"
          />
        </div>
        <CreateVolumeDialog onCreate={createVolume} />
        <PruneVolumesDialog onPrune={pruneVolumes} />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refreshVolumes}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 pb-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No volumes found</p>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[32px_1fr_100px_80px_1fr_80px] gap-2 px-3 py-1.5 text-xs text-muted-foreground font-medium">
              <span />
              <span>Name</span>
              <span>Used By</span>
              <span>Type</span>
              <span>Mountpoint</span>
              <span />
            </div>
            {filtered.map((volume) => {
              const isBind = volume.type === 'bind'
              const isDockerVolume = volume.type === 'volume'

              return (
                <div
                  key={`${volume.type}-${volume.mountpoint}`}
                  className="grid grid-cols-[32px_1fr_100px_80px_1fr_80px] gap-2 items-center px-3 py-2 rounded-md hover:bg-accent/50 border"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`p-1.5 rounded ${
                          isBind ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
                        }`}>
                          {isBind ? <HardDrive className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isBind ? 'Bind mount - stored on host filesystem' : 'Docker volume - managed by Docker'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="text-sm font-medium truncate" title={isBind ? volume.mountpoint : volume.name}>
                    {volume.name}
                  </span>
                  <UsageIndicator usedBy={volume.usedBy} />
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                    isBind ? 'border-green-500/50 text-green-500' : 'border-blue-500/50 text-blue-500'
                  }`}>
                    {isBind ? 'bind' : 'volume'}
                  </Badge>
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-xs text-muted-foreground font-mono truncate" title={volume.mountpoint}>
                      {volume.mountpoint}
                    </span>
                    {isHostPath(volume.mountpoint) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => openInFinder(volume.mountpoint)}
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open in Finder</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="flex items-center gap-1 justify-end">
                    {isDockerVolume && (
                      <Button
                        variant={confirmName === volume.name ? 'destructive' : 'ghost'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemove(volume)}
                        onBlur={() => setConfirmName(null)}
                        disabled={removingName === volume.name || volume.usedBy.length > 0}
                        title={volume.usedBy.length > 0 ? 'Cannot delete: volume is in use' : 'Delete volume'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
