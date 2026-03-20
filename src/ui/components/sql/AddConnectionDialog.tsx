import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useState, useEffect, type FC } from 'react'
import { cn } from '@/lib/utils'

interface AddConnectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (config: SQLConnectionConfig) => Promise<void>
  onTest: (id: string) => Promise<SQLConnectionState>
  onActivate: (id: string) => Promise<void>
  editConnection?: SQLConnectionConfig | null
}

export const AddConnectionDialog: FC<AddConnectionDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  onTest,
  onActivate,
  editConnection,
}) => {
  const [configId, setConfigId] = useState(() => crypto.randomUUID())
  const [name, setName] = useState('')
  const [host, setHost] = useState('localhost')
  const [port, setPort] = useState('1521')
  const [connectionType, setConnectionType] = useState<'sid' | 'serviceName'>('sid')
  const [sid, setSid] = useState('XE')
  const [serviceName, setServiceName] = useState('')
  const [username, setUsername] = useState('system')
  const [password, setPassword] = useState('')
  const [color, setColor] = useState('#c74634')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isEditMode = !!editConnection

  useEffect(() => {
    if (editConnection && open) {
      setConfigId(editConnection.id)
      setName(editConnection.name)
      setHost(editConnection.host)
      setPort(String(editConnection.port))
      setConnectionType(editConnection.serviceName ? 'serviceName' : 'sid')
      setSid(editConnection.sid ?? 'XE')
      setServiceName(editConnection.serviceName ?? '')
      setUsername(editConnection.username)
      setPassword(editConnection.password)
      setColor(editConnection.color ?? '#c74634')
      setSaved(true)
    }
  }, [editConnection, open])

  const resetForm = () => {
    setConfigId(crypto.randomUUID())
    setName('')
    setHost('localhost')
    setPort('1521')
    setConnectionType('sid')
    setSid('XE')
    setServiceName('')
    setUsername('system')
    setPassword('')
    setColor('#c74634')
    setTestResult(null)
    setTestError(null)
    setSaved(false)
  }

  const getConfig = (): SQLConnectionConfig => {
    const now = Date.now()
    return {
      id: configId,
      name: name.trim() || `${host}:${port}/${connectionType === 'sid' ? sid : serviceName}`,
      host: host.trim(),
      port: parseInt(port, 10) || 1521,
      ...(connectionType === 'sid' ? { sid: sid.trim() } : { serviceName: serviceName.trim() }),
      username: username.trim(),
      password: password.trim(),
      color,
      createdAt: editConnection?.createdAt ?? now,
      updatedAt: now,
    }
  }

  const ensureSaved = async () => {
    const config = getConfig()
    await onSave(config)
    setSaved(true)
    return config
  }

  const handleTest = async () => {
    if (!host.trim() || !username.trim() || !password.trim()) return
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
    if (!host.trim() || !username.trim() || !password.trim()) return
    setSaving(true)
    try {
      const config = await ensureSaved()
      if (!isEditMode) {
        await onActivate(config.id)
      }
      resetForm()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const isValid = host.trim() && username.trim() && password.trim() &&
    (connectionType === 'sid' ? sid.trim() : serviceName.trim())

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Connection' : 'New Oracle Connection'}</DialogTitle>
          <DialogDescription>{isEditMode ? 'Update connection settings.' : 'Add a connection to an Oracle Database instance.'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sql-conn-name">Connection Name</Label>
            <Input
              id="sql-conn-name"
              placeholder="My Oracle DB"
              value={name}
              onChange={(e) => { setName(e.target.value); setTestResult(null) }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="sql-host">Host</Label>
              <Input
                id="sql-host"
                placeholder="localhost"
                value={host}
                onChange={(e) => { setHost(e.target.value); setTestResult(null) }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sql-port">Port</Label>
              <Input
                id="sql-port"
                placeholder="1521"
                value={port}
                onChange={(e) => { setPort(e.target.value); setTestResult(null) }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Connection Type</Label>
            <Select value={connectionType} onValueChange={(v) => setConnectionType(v as 'sid' | 'serviceName')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sid">SID</SelectItem>
                <SelectItem value="serviceName">Service Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {connectionType === 'sid' ? (
            <div className="space-y-1.5">
              <Label htmlFor="sql-sid">SID</Label>
              <Input
                id="sql-sid"
                placeholder="XE"
                value={sid}
                onChange={(e) => { setSid(e.target.value); setTestResult(null) }}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sql-service">Service Name</Label>
              <Input
                id="sql-service"
                placeholder="ORCLPDB1"
                value={serviceName}
                onChange={(e) => { setServiceName(e.target.value); setTestResult(null) }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="sql-user">Username</Label>
              <Input
                id="sql-user"
                placeholder="system"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setTestResult(null) }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sql-pass">Password</Label>
              <Input
                id="sql-pass"
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setTestResult(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAndConnect() }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sql-color">Color Tag</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                id="sql-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">{color}</span>
            </div>
          </div>

          {testResult && (
            <p className={cn('text-xs', testResult === 'success' ? 'text-green-500' : 'text-red-500')}>
              {testResult === 'success' ? 'Connection successful' : testError}
            </p>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || saving || !isValid}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { onOpenChange(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleSaveAndConnect} disabled={saving || testing || !isValid}>
              {saving ? 'Saving...' : isEditMode ? 'Save' : 'Save & Connect'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
