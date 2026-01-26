import { useState, type FC } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'
import { useBroker } from '@/ui/contexts/broker'
import { BrokerSettingsDialog } from './BrokerSettingsDialog'

export const BrokerSelector: FC = () => {
  const { activeBroker, setActiveBroker, isConnected } = useBroker()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleBrokerChange = async (value: string) => {
    await setActiveBroker(value as BrokerType)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-stone-700 rounded-md mx-5">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />

      <Select value={activeBroker} onValueChange={handleBrokerChange}>
        <SelectTrigger className="flex-1 bg-transparent border-none text-white h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="elasticmq">ElasticMQ</SelectItem>
          <SelectItem value="rabbitmq">RabbitMQ</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:bg-stone-600 flex-shrink-0"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings className="h-4 w-4" />
      </Button>

      <BrokerSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
