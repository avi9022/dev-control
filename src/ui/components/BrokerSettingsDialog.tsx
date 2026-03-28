import { useState, useEffect, type FC } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useBroker } from '@/ui/contexts/broker'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

interface BrokerSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormState {
  host: string
  port: string
  username: string
  password: string
  useHttps: boolean
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

const defaultFormStates: Record<BrokerType, FormState> = {
  elasticmq: {
    host: 'localhost',
    port: '9324',
    username: 'root',
    password: 'root',
    useHttps: false
  },
  rabbitmq: {
    host: 'localhost',
    port: '15671',
    username: 'user',
    password: 'bitnami',
    useHttps: true
  }
}

export const BrokerSettingsDialog: FC<BrokerSettingsDialogProps> = ({ open, onOpenChange }) => {
  const { configs, saveBrokerConfig, testConnection } = useBroker()
  const [activeTab, setActiveTab] = useState<BrokerType>('elasticmq')
  const [formStates, setFormStates] = useState<Record<BrokerType, FormState>>(defaultFormStates)
  const [testStatus, setTestStatus] = useState<Record<BrokerType, TestStatus>>({
    elasticmq: 'idle',
    rabbitmq: 'idle'
  })
  const [testError, setTestError] = useState<Record<BrokerType, string | undefined>>({
    elasticmq: undefined,
    rabbitmq: undefined
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (configs.length > 0) {
      const newFormStates = { ...defaultFormStates }
      configs.forEach(config => {
        newFormStates[config.type] = {
          host: config.host,
          port: String(config.port),
          username: config.username,
          password: config.password,
          useHttps: config.useHttps
        }
      })
      setFormStates(newFormStates)
    }
  }, [configs])

  const updateFormField = (type: BrokerType, field: keyof FormState, value: string | boolean) => {
    setFormStates(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }))
    setTestStatus(prev => ({ ...prev, [type]: 'idle' }))
    setTestError(prev => ({ ...prev, [type]: undefined }))
  }

  const handleTestConnection = async (type: BrokerType) => {
    setTestStatus(prev => ({ ...prev, [type]: 'testing' }))
    setTestError(prev => ({ ...prev, [type]: undefined }))

    const form = formStates[type]
    const config: BrokerConfig = {
      type,
      host: form.host,
      port: parseInt(form.port, 10),
      username: form.username,
      password: form.password,
      useHttps: form.useHttps
    }

    await saveBrokerConfig(config)

    const result = await testConnection(type)
    if (result.isConnected) {
      setTestStatus(prev => ({ ...prev, [type]: 'success' }))
    } else {
      setTestStatus(prev => ({ ...prev, [type]: 'error' }))
      setTestError(prev => ({ ...prev, [type]: result.lastError }))
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    const form = formStates[activeTab]
    const config: BrokerConfig = {
      type: activeTab,
      host: form.host,
      port: parseInt(form.port, 10),
      username: form.username,
      password: form.password,
      useHttps: form.useHttps
    }
    await saveBrokerConfig(config)
    setIsSaving(false)
    onOpenChange(false)
  }

  const renderBrokerForm = (type: BrokerType) => {
    const form = formStates[type]
    const status = testStatus[type]
    const error = testError[type]

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${type}-host`}>Host</Label>
            <Input
              id={`${type}-host`}
              value={form.host}
              onChange={(e) => updateFormField(type, 'host', e.target.value)}
              placeholder="localhost"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${type}-port`}>Port</Label>
            <Input
              id={`${type}-port`}
              type="number"
              value={form.port}
              onChange={(e) => updateFormField(type, 'port', e.target.value)}
              placeholder={type === 'elasticmq' ? '9324' : '15671'}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${type}-username`}>Username</Label>
            <Input
              id={`${type}-username`}
              value={form.username}
              onChange={(e) => updateFormField(type, 'username', e.target.value)}
              placeholder="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${type}-password`}>Password</Label>
            <Input
              id={`${type}-password`}
              type="password"
              value={form.password}
              onChange={(e) => updateFormField(type, 'password', e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id={`${type}-https`}
            checked={form.useHttps}
            onCheckedChange={(checked) => updateFormField(type, 'useHttps', checked === true)}
          />
          <Label htmlFor={`${type}-https`} className="cursor-pointer">
            Use HTTPS
          </Label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => handleTestConnection(type)}
            disabled={status === 'testing'}
          >
            {status === 'testing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>

          {status === 'success' && (
            <div className="flex items-center gap-2 text-status-green">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Connected</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-2 text-status-red">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">{error || 'Connection failed'}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Broker Settings</DialogTitle>
          <DialogDescription>
            Configure connection settings for message brokers.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BrokerType)} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="elasticmq" className="flex-1">ElasticMQ</TabsTrigger>
            <TabsTrigger value="rabbitmq" className="flex-1">RabbitMQ</TabsTrigger>
          </TabsList>

          <TabsContent value="elasticmq" className="mt-4">
            {renderBrokerForm('elasticmq')}
          </TabsContent>

          <TabsContent value="rabbitmq" className="mt-4">
            {renderBrokerForm('rabbitmq')}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
