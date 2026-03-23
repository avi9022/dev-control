import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useState } from "react"

interface CreateCollectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName: string
  onSubmit: (name: string) => Promise<void>
}

export function CreateCollectionDialog({ open, onOpenChange, databaseName, onSubmit }: CreateCollectionDialogProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => { setName(''); setError(null) }

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(name.trim())
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
          <DialogDescription>Create a new collection in {databaseName}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="coll-name">Collection Name</Label>
            <Input
              id="coll-name"
              placeholder="my_collection"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            />
          </div>
          {error && <p className="text-xs text-status-red">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting ? 'Creating...' : 'Create Collection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
