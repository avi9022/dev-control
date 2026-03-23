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
import { Download, Trash2, RefreshCw, Search, Eraser } from 'lucide-react'
import { formatBytes, formatDate } from '@/ui/utils/format'

type SortKey = 'name' | 'size' | 'date'

function getDisplayTag(image: DockerImage): string {
  if (image.repoTags.length === 0) return '<none>:<none>'
  return image.repoTags[0]
}

function PullImageDialog({ onPull }: { onPull: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [imageName, setImageName] = useState('')
  const [pulling, setPulling] = useState(false)

  const handlePull = async () => {
    if (!imageName.trim()) return
    setPulling(true)
    try {
      await onPull(imageName.trim())
      setImageName('')
      setOpen(false)
    } finally {
      setPulling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Download className="h-4 w-4 mr-1.5" />
          Pull Image
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pull Image</DialogTitle>
          <DialogDescription>Enter the image name and optional tag (e.g. nginx:latest)</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="image:tag"
          value={imageName}
          onChange={(e) => setImageName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handlePull()
          }}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handlePull} disabled={pulling || !imageName.trim()}>
            {pulling ? 'Pulling...' : 'Pull'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PruneDialog({ onPrune }: { onPrune: () => Promise<void> }) {
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
          <DialogTitle>Prune Dangling Images</DialogTitle>
          <DialogDescription>
            This will remove all dangling images. This action cannot be undone.
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

export const ImageList: FC = () => {
  const { images, pullImage, removeImage, pruneImages, refreshImages } = useDocker()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [removingRef, setRemovingRef] = useState<string | null>(null)
  const [confirmRef, setConfirmRef] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase()
    const matching = search
      ? images.filter((img) => getDisplayTag(img).toLowerCase().includes(lowerSearch))
      : [...images]

    return matching.sort((a, b) => {
      if (sortBy === 'size') return b.size - a.size
      if (sortBy === 'date') return b.created - a.created
      return getDisplayTag(a).localeCompare(getDisplayTag(b))
    })
  }, [images, search, sortBy])

  const handleRemove = async (image: DockerImage) => {
    const ref = getDisplayTag(image)
    if (confirmRef !== ref) {
      setConfirmRef(ref)
      return
    }
    setRemovingRef(ref)
    try {
      await removeImage(ref, image.dockerContext)
    } finally {
      setRemovingRef(null)
      setConfirmRef(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-4 pb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search images..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => { const valid: SortKey[] = ['name', 'size', 'date']; if (valid.includes(v as SortKey)) setSortBy(v as SortKey) }}>
          <SelectTrigger className="w-[100px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="size">Size</SelectItem>
            <SelectItem value="date">Date</SelectItem>
          </SelectContent>
        </Select>
        <PullImageDialog onPull={pullImage} />
        <PruneDialog onPrune={pruneImages} />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refreshImages}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 pb-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No images found</p>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_80px_100px_90px_80px_40px] gap-2 px-3 py-1.5 text-xs text-muted-foreground font-medium">
              <span>Repository:Tag</span>
              <span>Size</span>
              <span>Created</span>
              <span>ID</span>
              <span>Context</span>
              <span />
            </div>
            {filtered.map((image) => (
              <div
                key={image.id}
                className="grid grid-cols-[1fr_80px_100px_90px_80px_40px] gap-2 items-center px-3 py-2 rounded-md hover:bg-accent/50 border"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{getDisplayTag(image)}</p>
                  {image.repoTags.length > 1 && (
                    <div className="flex gap-1 flex-wrap mt-0.5">
                      {image.repoTags.slice(1).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{formatBytes(image.size)}</span>
                <span className="text-xs text-muted-foreground">{formatDate(image.created)}</span>
                <span className="text-xs text-muted-foreground font-mono">{image.id.slice(7, 19)}</span>
                <span className="text-xs text-blue-400 truncate">{image.dockerContext || ''}</span>
                <Button
                  variant={confirmRef === getDisplayTag(image) ? 'destructive' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleRemove(image)}
                  onBlur={() => setConfirmRef(null)}
                  disabled={removingRef === getDisplayTag(image)}
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
