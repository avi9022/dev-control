import { useState, useMemo, type FC } from 'react'
import { useDocker } from '@/ui/contexts/docker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Trash2,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

const DEFAULT_NETWORKS = new Set(['bridge', 'host', 'none'])

function CreateNetworkDialog({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [driver, setDriver] = useState('bridge')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      await onCreate(name.trim())
      setName('')
      setDriver('bridge')
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
          Create Network
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Network</DialogTitle>
          <DialogDescription>Create a new Docker network.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="network-name">Name</Label>
            <Input
              id="network-name"
              placeholder="Network name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Driver</Label>
            <Select value={driver} onValueChange={setDriver}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bridge">bridge</SelectItem>
                <SelectItem value="overlay">overlay</SelectItem>
                <SelectItem value="macvlan">macvlan</SelectItem>
                <SelectItem value="ipvlan">ipvlan</SelectItem>
                <SelectItem value="host">host</SelectItem>
                <SelectItem value="none">none</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
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

function NetworkRow({ network, onRemove }: { network: DockerNetwork; onRemove: (id: string, dockerContext?: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const containerEntries = Object.entries(network.containers)
  const isDefault = DEFAULT_NETWORKS.has(network.name)

  return (
    <div className="border rounded-md hover:bg-accent/50">
      <div className="grid grid-cols-[24px_1fr_80px_70px_100px_90px_80px_60px_40px] gap-2 items-center px-3 py-2">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center justify-center"
          disabled={containerEntries.length === 0}
        >
          {containerEntries.length > 0 ? (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>
        <span className="text-sm font-medium truncate" title={network.name}>
          {network.name}
          {network.internal && (
            <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">internal</Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{network.driver}</span>
        <span className="text-xs text-muted-foreground">{network.scope}</span>
        <span className="text-xs text-muted-foreground font-mono">
          {network.ipam.subnet ?? '-'}
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          {network.ipam.gateway ?? '-'}
        </span>
        <span className="text-xs text-blue-400 truncate">{network.dockerContext || ''}</span>
        <Badge variant="secondary" className="text-xs justify-center">
          {containerEntries.length}
        </Badge>
        {isDefault ? (
          <span className="w-7" />
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onRemove(network.id, network.dockerContext)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {expanded && containerEntries.length > 0 && (
        <div className="px-10 pb-2 space-y-1">
          {containerEntries.map(([id, info]) => (
            <div key={id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{info.name}</span>
              {info.ipv4Address && (
                <span className="font-mono">{info.ipv4Address}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const NetworkList: FC = () => {
  const { networks, createNetwork, removeNetwork, refreshNetworks } = useDocker()
  const [search, setSearch] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase()
    return search
      ? networks.filter((n) => n.name.toLowerCase().includes(lowerSearch))
      : networks
  }, [networks, search])

  const handleRemove = (id: string, dockerContext?: string) => {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    removeNetwork(id, dockerContext)
    setConfirmId(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 pb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search networks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8"
          />
        </div>
        <CreateNetworkDialog onCreate={createNetwork} />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refreshNetworks}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 pb-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No networks found</p>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[24px_1fr_80px_70px_100px_90px_80px_60px_40px] gap-2 px-3 py-1.5 text-xs text-muted-foreground font-medium">
              <span />
              <span>Name</span>
              <span>Driver</span>
              <span>Scope</span>
              <span>Subnet</span>
              <span>Gateway</span>
              <span>Context</span>
              <span>Containers</span>
              <span />
            </div>
            {filtered.map((network) => (
              <NetworkRow
                key={network.id}
                network={network}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
