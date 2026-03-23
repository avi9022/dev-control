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

interface CreateDatabaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (dbName: string, collectionName: string) => Promise<void>
}

export function CreateDatabaseDialog({ open, onOpenChange, onSubmit }: CreateDatabaseDialogProps) {
  const [dbName, setDbName] = useState('')
  const [collectionName, setCollectionName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setDbName('')
    setCollectionName('')
    setError(null)
  }

  const handleSubmit = async () => {
    if (!dbName.trim() || !collectionName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(dbName.trim(), collectionName.trim())
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create database')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Database</DialogTitle>
          <DialogDescription>A new database requires an initial collection.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="db-name">Database Name</Label>
            <Input id="db-name" placeholder="my_database" value={dbName} onChange={(e) => setDbName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="initial-collection">Initial Collection Name</Label>
            <Input
              id="initial-collection"
              placeholder="my_collection"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            />
          </div>
          {error && <p className="text-xs text-status-red">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset() }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !dbName.trim() || !collectionName.trim()}>
            {submitting ? 'Creating...' : 'Create Database'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
