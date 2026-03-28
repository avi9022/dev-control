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

interface RenameCollectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName: string
  currentName: string
  onSubmit: (newName: string) => Promise<void>
}

export function RenameCollectionDialog({ open, onOpenChange, databaseName, currentName, onSubmit }: RenameCollectionDialogProps) {
  const [newName, setNewName] = useState(currentName)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => { setNewName(currentName); setError(null) }

  const handleSubmit = async () => {
    if (!newName.trim() || newName.trim() === currentName) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(newName.trim())
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename collection')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Collection</DialogTitle>
          <DialogDescription>Rename "{currentName}" in {databaseName}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-coll-name">New Name</Label>
            <Input
              id="new-coll-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            />
          </div>
          {error && <p className="text-xs text-status-red">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !newName.trim() || newName.trim() === currentName}>
            {submitting ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
