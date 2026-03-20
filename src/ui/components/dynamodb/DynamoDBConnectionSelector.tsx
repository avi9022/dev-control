import { useState, type FC } from 'react'
import { useDynamoDB } from '@/ui/contexts/dynamodb'
import { DynamoDBConnectionSettingsDialog } from './DynamoDBConnectionSettingsDialog'
import { ConnectionSelector } from '../ConnectionSelector'

export const DynamoDBConnectionSelector: FC = () => {
  const { connections, activeConnectionId, setActiveConnection, isConnected } = useDynamoDB()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const options = connections.map(conn => ({ value: conn.id, label: conn.name }))

  return (
    <ConnectionSelector
      options={options}
      value={activeConnectionId || ''}
      onChange={(v) => setActiveConnection(v)}
      isConnected={isConnected}
      onSettingsClick={() => setSettingsOpen(true)}
      placeholder="Select connection..."
      extra={<DynamoDBConnectionSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />}
    />
  )
}
