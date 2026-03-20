import { useState, useEffect, type FC } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDynamoDB } from '@/ui/contexts/dynamodb'
import { Loader2, CheckCircle, XCircle, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DynamoDBConnectionSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormState {
  name: string
  connectionMethod: DynamoDBConnectionMethod
  region: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  profileName: string
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

const emptyForm: FormState = {
  name: '',
  connectionMethod: 'custom-endpoint',
  region: 'eu-west-1',
  endpoint: 'http://localhost:8000',
  accessKeyId: 'root',
  secretAccessKey: 'root',
  profileName: 'default'
}

const formFromConfig = (config: DynamoDBConnectionConfig): FormState => ({
  name: config.name,
  connectionMethod: config.connectionMethod,
  region: config.region,
  endpoint: config.endpoint || '',
  accessKeyId: config.accessKeyId || '',
  secretAccessKey: config.secretAccessKey || '',
  profileName: config.profileName || 'default'
})

const formToConfig = (form: FormState, id: string): DynamoDBConnectionConfig => ({
  id,
  name: form.name,
  connectionMethod: form.connectionMethod,
  region: form.region,
  ...(form.connectionMethod === 'custom-endpoint' && {
    endpoint: form.endpoint,
    accessKeyId: form.accessKeyId,
    secretAccessKey: form.secretAccessKey,
  }),
  ...(form.connectionMethod === 'aws-credentials' && {
    accessKeyId: form.accessKeyId,
    secretAccessKey: form.secretAccessKey,
  }),
  ...(form.connectionMethod === 'aws-profile' && {
    profileName: form.profileName,
  }),
})

export const DynamoDBConnectionSettingsDialog: FC<DynamoDBConnectionSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { connections, saveConnection, deleteConnection, testConnection } = useDynamoDB()
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState<string | undefined>()
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open && connections.length > 0 && !selectedConnectionId) {
      const first = connections[0]
      setSelectedConnectionId(first.id)
      setForm(formFromConfig(first))
    }
  }, [open, connections, selectedConnectionId])

  useEffect(() => {
    if (selectedConnectionId) {
      const conn = connections.find(c => c.id === selectedConnectionId)
      if (conn) {
        setForm(formFromConfig(conn))
        setTestStatus('idle')
        setTestError(undefined)
      }
    }
  }, [selectedConnectionId, connections])

  const updateField = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setTestStatus('idle')
    setTestError(undefined)
  }

  const handleAddConnection = () => {
    const id = crypto.randomUUID()
    const newForm: FormState = {
      ...emptyForm,
      name: `Connection ${connections.length + 1}`
    }
    setSelectedConnectionId(id)
    setForm(newForm)
    setTestStatus('idle')
    setTestError(undefined)
  }

  const handleDeleteConnection = async () => {
    if (!selectedConnectionId || connections.length <= 1) return
    await deleteConnection(selectedConnectionId)
    const remaining = connections.filter(c => c.id !== selectedConnectionId)
    if (remaining.length > 0) {
      setSelectedConnectionId(remaining[0].id)
    } else {
      setSelectedConnectionId(null)
    }
  }

  const handleTestConnection = async () => {
    if (!selectedConnectionId) return
    setTestStatus('testing')
    setTestError(undefined)

    const config = formToConfig(form, selectedConnectionId)
    await saveConnection(config)

    const result = await testConnection(selectedConnectionId)
    if (result.isConnected) {
      setTestStatus('success')
    } else {
      setTestStatus('error')
      setTestError(result.lastError)
    }
  }

  const handleSave = async () => {
    if (!selectedConnectionId) return
    setIsSaving(true)
    const config = formToConfig(form, selectedConnectionId)
    await saveConnection(config)
    setIsSaving(false)
    onOpenChange(false)
  }

  const connectionMethodLabel = (method: DynamoDBConnectionMethod): string => {
    switch (method) {
      case 'custom-endpoint': return 'Custom Endpoint'
      case 'aws-credentials': return 'AWS Credentials'
      case 'aws-profile': return 'AWS Profile'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>DynamoDB Connection Settings</DialogTitle>
          <DialogDescription>
            Configure connections to DynamoDB instances.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 mt-4 min-h-[380px]">
          {/* Connection list */}
          <div className="w-[180px] flex-shrink-0 flex flex-col gap-2">
            <ScrollArea className="flex-1 max-h-[320px]">
              <div className="space-y-1 pr-2">
                {connections.map((conn) => (
                  <button
                    key={conn.id}
                    onClick={() => setSelectedConnectionId(conn.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent truncate",
                      selectedConnectionId === conn.id && "bg-accent"
                    )}
                  >
                    {conn.name}
                  </button>
                ))}
                {/* Show unsaved new connection */}
                {selectedConnectionId && !connections.find(c => c.id === selectedConnectionId) && (
                  <button
                    className="w-full text-left px-3 py-2 text-sm rounded-md bg-accent truncate"
                  >
                    {form.name || 'New Connection'}
                  </button>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleAddConnection}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteConnection}
                disabled={connections.length <= 1 || !selectedConnectionId}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Connection form */}
          {selectedConnectionId && (
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="conn-name">Name</Label>
                <Input
                  id="conn-name"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="My Connection"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="conn-method">Connection Method</Label>
                <Select
                  value={form.connectionMethod}
                  onValueChange={(v) => updateField('connectionMethod', v)}
                >
                  <SelectTrigger id="conn-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom-endpoint">{connectionMethodLabel('custom-endpoint')}</SelectItem>
                    <SelectItem value="aws-credentials">{connectionMethodLabel('aws-credentials')}</SelectItem>
                    <SelectItem value="aws-profile">{connectionMethodLabel('aws-profile')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="conn-region">Region</Label>
                <Input
                  id="conn-region"
                  value={form.region}
                  onChange={(e) => updateField('region', e.target.value)}
                  placeholder="eu-west-1"
                />
              </div>

              {form.connectionMethod === 'custom-endpoint' && (
                <div className="space-y-2">
                  <Label htmlFor="conn-endpoint">Endpoint URL</Label>
                  <Input
                    id="conn-endpoint"
                    value={form.endpoint}
                    onChange={(e) => updateField('endpoint', e.target.value)}
                    placeholder="http://localhost:8000"
                  />
                </div>
              )}

              {(form.connectionMethod === 'custom-endpoint' || form.connectionMethod === 'aws-credentials') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conn-access-key">Access Key ID</Label>
                    <Input
                      id="conn-access-key"
                      value={form.accessKeyId}
                      onChange={(e) => updateField('accessKeyId', e.target.value)}
                      placeholder="AKIA..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conn-secret-key">Secret Access Key</Label>
                    <Input
                      id="conn-secret-key"
                      type="password"
                      value={form.secretAccessKey}
                      onChange={(e) => updateField('secretAccessKey', e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {form.connectionMethod === 'aws-profile' && (
                <div className="space-y-2">
                  <Label htmlFor="conn-profile">Profile Name</Label>
                  <Input
                    id="conn-profile"
                    value={form.profileName}
                    onChange={(e) => updateField('profileName', e.target.value)}
                    placeholder="default"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                >
                  {testStatus === 'testing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Test Connection
                </Button>

                {testStatus === 'success' && (
                  <div className="flex items-center gap-2 text-status-green">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Connected</span>
                  </div>
                )}

                {testStatus === 'error' && (
                  <div className="flex items-center gap-2 text-status-red">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm truncate max-w-[200px]">{testError || 'Connection failed'}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !selectedConnectionId}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
