import { useState, type FC } from 'react'
import { useBroker } from '@/ui/contexts/broker'
import { BrokerSettingsDialog } from './BrokerSettingsDialog'
import { ConnectionSelector } from './ConnectionSelector'

const BROKER_OPTIONS = [
  { value: 'elasticmq', label: 'ElasticMQ' },
  { value: 'rabbitmq', label: 'RabbitMQ' },
]

export const BrokerSelector: FC = () => {
  const { activeBroker, setActiveBroker, isConnected } = useBroker()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <ConnectionSelector
      options={BROKER_OPTIONS}
      value={activeBroker}
      onChange={(v) => setActiveBroker(v as BrokerType)}
      isConnected={isConnected}
      onSettingsClick={() => setSettingsOpen(true)}
      extra={<BrokerSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />}
    />
  )
}
