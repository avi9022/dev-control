import { useState, useEffect, useCallback, type FC } from 'react'
import { useMongoDB } from '@/ui/contexts/mongodb'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Loader2,
  FileWarning,
  Inbox,
} from 'lucide-react'
import { formatBytes } from '@/ui/utils/format'

interface IndexListProps {
  database: string
  collection: string
}

interface IndexKeyField {
  field: string
  direction: '1' | '-1' | 'text' | '2dsphere' | 'hashed'
}

function formatKeyFields(key: Record<string, unknown>): string {
  return Object.entries(key)
    .map(([field, dir]) => `${field}: ${dir}`)
    .join(', ')
}

export const IndexList: FC<IndexListProps> = ({ database, collection }) => {
  const { getIndexes, createIndex, dropIndex } = useMongoDB()

  const [indexes, setIndexes] = useState<MongoIndex[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [keyFields, setKeyFields] = useState<IndexKeyField[]>([{ field: '', direction: '1' }])
  const [indexName, setIndexName] = useState('')
  const [isUnique, setIsUnique] = useState(false)
  const [isSparse, setIsSparse] = useState(false)

  const [dropOpen, setDropOpen] = useState(false)
  const [dropTarget, setDropTarget] = useState<MongoIndex | null>(null)
  const [dropLoading, setDropLoading] = useState(false)

  const fetchIndexes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getIndexes(database, collection)
      setIndexes(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch indexes')
    } finally {
      setLoading(false)
    }
  }, [database, collection, getIndexes])

  useEffect(() => {
    fetchIndexes()
  }, [fetchIndexes])

  const handleAddKeyField = useCallback(() => {
    setKeyFields((prev) => [...prev, { field: '', direction: '1' }])
  }, [])

  const handleRemoveKeyField = useCallback((index: number) => {
    setKeyFields((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleUpdateKeyField = useCallback((index: number, update: Partial<IndexKeyField>) => {
    setKeyFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...update } : f))
    )
  }, [])

  const resetCreateForm = useCallback(() => {
    setKeyFields([{ field: '', direction: '1' }])
    setIndexName('')
    setIsUnique(false)
    setIsSparse(false)
    setCreateError(null)
  }, [])

  const handleCreateIndex = useCallback(async () => {
    const validFields = keyFields.filter((f) => f.field.trim() !== '')
    if (validFields.length === 0) {
      setCreateError('At least one key field is required')
      return
    }

    const keys: Record<string, unknown> = {}
    for (const kf of validFields) {
      keys[kf.field] = kf.direction === '1' || kf.direction === '-1'
        ? Number(kf.direction)
        : kf.direction
    }

    const options: MongoCreateIndexOptions = {
      key: keys as MongoCreateIndexOptions['key'],
      ...(indexName.trim() ? { name: indexName.trim() } : {}),
      ...(isUnique ? { unique: true } : {}),
      ...(isSparse ? { sparse: true } : {}),
    }

    try {
      setCreateLoading(true)
      setCreateError(null)
      await createIndex(database, collection, options)
      setCreateOpen(false)
      resetCreateForm()
      await fetchIndexes()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create index')
    } finally {
      setCreateLoading(false)
    }
  }, [keyFields, indexName, isUnique, isSparse, database, collection, createIndex, fetchIndexes, resetCreateForm])

  const handleDropConfirm = useCallback(async () => {
    if (!dropTarget) return
    try {
      setDropLoading(true)
      await dropIndex(database, collection, dropTarget.name)
      setDropOpen(false)
      setDropTarget(null)
      await fetchIndexes()
    } catch {
      // silently handle
    } finally {
      setDropLoading(false)
    }
  }, [dropTarget, database, collection, dropIndex, fetchIndexes])

  if (loading && indexes.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading indexes...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
        <FileWarning className="h-8 w-8" />
        <p className="text-sm">{error}</p>
        <Button size="sm" variant="outline" onClick={fetchIndexes}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {indexes.length} index{indexes.length !== 1 ? 'es' : ''}
          </Badge>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5"
          onClick={() => {
            resetCreateForm()
            setCreateOpen(true)
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Create Index
        </Button>
      </div>

      {indexes.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground gap-2 py-12">
          <Inbox className="h-8 w-8" />
          <p className="text-sm">No indexes found</p>
        </div>
      ) : (
        <ScrollArea className="flex-1 min-h-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 px-3 text-left font-medium">Name</th>
                <th className="py-2 px-3 text-left font-medium">Keys</th>
                <th className="py-2 px-3 text-left font-medium">Properties</th>
                <th className="py-2 px-3 text-right font-medium">Size</th>
                <th className="py-2 px-3 text-right font-medium">Usage</th>
                <th className="py-2 px-3 text-right font-medium w-[60px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {indexes.map((idx) => (
                <tr key={idx.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3">
                    <span className="font-mono text-sm">{idx.name}</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatKeyFields(idx.key)}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex gap-1">
                      {idx.unique && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Unique
                        </Badge>
                      )}
                      {idx.sparse && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          Sparse
                        </Badge>
                      )}
                      {idx.expireAfterSeconds !== undefined && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          TTL: {idx.expireAfterSeconds}s
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(idx.size)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-xs text-muted-foreground">
                      {idx.usage?.ops ?? 0} ops
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      disabled={idx.name === '_id_'}
                      title={idx.name === '_id_' ? 'Cannot drop _id index' : 'Drop index'}
                      onClick={() => {
                        setDropTarget(idx)
                        setDropOpen(true)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}

      {/* Create Index Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Index</DialogTitle>
            <DialogDescription>
              Define index keys and options for {database}.{collection}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Key Fields</Label>
              {keyFields.map((kf, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Field name"
                    value={kf.field}
                    onChange={(e) => handleUpdateKeyField(i, { field: e.target.value })}
                    className="flex-1 h-8 text-sm font-mono"
                  />
                  <Select
                    value={kf.direction}
                    onValueChange={(val) => {
                      const valid: IndexKeyField['direction'][] = ['1', '-1', 'text', '2dsphere', 'hashed']
                      if (valid.includes(val as IndexKeyField['direction'])) handleUpdateKeyField(i, { direction: val as IndexKeyField['direction'] })
                    }}
                  >
                    <SelectTrigger className="w-[100px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">ASC (1)</SelectItem>
                      <SelectItem value="-1">DESC (-1)</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="2dsphere">2dsphere</SelectItem>
                      <SelectItem value="hashed">Hashed</SelectItem>
                    </SelectContent>
                  </Select>
                  {keyFields.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleRemoveKeyField(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={handleAddKeyField} className="h-7 gap-1 text-xs">
                <Plus className="h-3 w-3" />
                Add Field
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Options</Label>
              <Input
                placeholder="Index name (optional)"
                value={indexName}
                onChange={(e) => setIndexName(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="unique"
                    checked={isUnique}
                    onCheckedChange={(checked) => setIsUnique(checked === true)}
                  />
                  <Label htmlFor="unique" className="text-sm">
                    Unique
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="sparse"
                    checked={isSparse}
                    onCheckedChange={(checked) => setIsSparse(checked === true)}
                  />
                  <Label htmlFor="sparse" className="text-sm">
                    Sparse
                  </Label>
                </div>
              </div>
            </div>

            {createError && <p className="text-sm text-status-red">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateIndex} disabled={createLoading}>
              {createLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drop Confirmation Dialog */}
      <Dialog open={dropOpen} onOpenChange={setDropOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Drop Index</DialogTitle>
            <DialogDescription>
              Are you sure you want to drop this index? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {dropTarget && (
            <div className="space-y-1">
              <p className="text-sm font-mono">{dropTarget.name}</p>
              <p className="text-xs text-muted-foreground font-mono">
                Keys: {formatKeyFields(dropTarget.key)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDropOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDropConfirm} disabled={dropLoading}>
              {dropLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Drop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
