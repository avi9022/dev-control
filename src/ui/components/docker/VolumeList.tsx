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
import { Plus, Trash2, RefreshCw, Search, Eraser } from 'lucide-react'

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
            <div className="grid grid-cols-[1fr_80px_1fr_70px_80px_40px] gap-2 px-3 py-1.5 text-xs text-muted-foreground font-medium">
              <span>Name</span>
              <span>Driver</span>
              <span>Mountpoint</span>
              <span>Scope</span>
              <span>Context</span>
              <span />
            </div>
            {filtered.map((volume) => (
              <div
                key={volume.name}
                className="grid grid-cols-[1fr_80px_1fr_70px_80px_40px] gap-2 items-center px-3 py-2 rounded-md hover:bg-accent/50 border"
              >
                <span className="text-sm font-medium truncate" title={volume.name}>
                  {volume.name}
                </span>
                <span className="text-xs text-muted-foreground">{volume.driver}</span>
                <span className="text-xs text-muted-foreground font-mono truncate" title={volume.mountpoint}>
                  {volume.mountpoint}
                </span>
                <span className="text-xs text-muted-foreground">{volume.scope}</span>
                <span className="text-xs text-blue-400 truncate">{volume.dockerContext || ''}</span>
                <Button
                  variant={confirmName === volume.name ? 'destructive' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleRemove(volume)}
                  onBlur={() => setConfirmName(null)}
                  disabled={removingName === volume.name}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
