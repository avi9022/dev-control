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
import { cn } from "@/lib/utils"

interface AddConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (config: MongoConnectionConfig) => Promise<void>
  onTest: (id: string) => Promise<MongoConnectionState>
  onActivate: (id: string) => Promise<void>
}

export function AddConnectionDialog({ open, onOpenChange, onSave, onTest, onActivate }: AddConnectionDialogProps) {
  const [configId, setConfigId] = useState(() => crypto.randomUUID())
  const [name, setName] = useState('')
  const [connectionString, setConnectionString] = useState('mongodb://localhost:27017')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const resetForm = () => {
    setConfigId(crypto.randomUUID())
    setName('')
    setConnectionString('mongodb://localhost:27017')
    setTestResult(null)
    setTestError(null)
  }

  const getConfig = (): MongoConnectionConfig => {
    const now = Date.now()
    return {
      id: configId,
      name: name.trim(),
      connectionString: connectionString.trim(),
      createdAt: now,
      updatedAt: now,
    }
  }

  const ensureSaved = async () => {
    const config = getConfig()
    await onSave(config)
    return config
  }

  const handleTest = async () => {
    if (!name.trim() || !connectionString.trim()) return
    setTesting(true)
    setTestResult(null)
    setTestError(null)
    try {
      const config = await ensureSaved()
      const result = await onTest(config.id)
      if (result.status === 'connected') {
        setTestResult('success')
      } else {
        setTestResult('error')
        setTestError(result.error ?? 'Connection failed')
      }
    } catch (err) {
      setTestResult('error')
      setTestError(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  const handleSaveAndConnect = async () => {
    if (!name.trim() || !connectionString.trim()) return
    setSaving(true)
    try {
      const config = await ensureSaved()
      await onActivate(config.id)
      resetForm()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New MongoDB Connection</DialogTitle>
          <DialogDescription>Add a connection to a MongoDB instance.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="conn-name">Name</Label>
            <Input
              id="conn-name"
              placeholder="My MongoDB"
              value={name}
              onChange={(e) => { setName(e.target.value); setTestResult(null) }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conn-string">Connection String</Label>
            <Input
              id="conn-string"
              placeholder="mongodb://localhost:27017"
              value={connectionString}
              onChange={(e) => { setConnectionString(e.target.value); setTestResult(null) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAndConnect()
              }}
            />
          </div>
          {testResult && (
            <p className={cn("text-xs", testResult === 'success' ? 'text-status-green' : 'text-status-red')}>
              {testResult === 'success' ? 'Connection successful' : testError}
            </p>
          )}
        </div>
        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || saving || !name.trim() || !connectionString.trim()}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleSaveAndConnect} disabled={saving || testing || !name.trim() || !connectionString.trim()}>
              {saving ? 'Connecting...' : 'Save & Connect'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
