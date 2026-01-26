import { createContext, useContext, useEffect, useState, type FC, type PropsWithChildren } from 'react'

interface BrokerContextValue {
  activeBroker: BrokerType
  connectionState: BrokerConnectionState | null
  configs: BrokerConfig[]
  setActiveBroker: (type: BrokerType) => Promise<void>
  saveBrokerConfig: (config: BrokerConfig) => Promise<void>
  testConnection: (type?: BrokerType) => Promise<BrokerConnectionState>
  isConnected: boolean
}

const BrokerContext = createContext<BrokerContextValue | null>(null)

export function useBroker() {
  const context = useContext(BrokerContext)
  if (!context) {
    throw new Error('useBroker must be used within BrokerProvider')
  }
  return context
}

export const BrokerProvider: FC<PropsWithChildren> = ({ children }) => {
  const [activeBroker, setActiveBrokerState] = useState<BrokerType>('elasticmq')
  const [connectionState, setConnectionState] = useState<BrokerConnectionState | null>(null)
  const [configs, setConfigs] = useState<BrokerConfig[]>([])

  useEffect(() => {
    Promise.all([
      window.electron.getActiveBroker(),
      window.electron.getBrokerConfigs(),
    ]).then(([broker, brokerConfigs]) => {
      setActiveBrokerState(broker)
      setConfigs(brokerConfigs)
    })

    const unsubscribe = window.electron.subscribeBrokerConnectionState((state) => {
      setConnectionState(state)
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  const setActiveBroker = async (type: BrokerType) => {
    await window.electron.setActiveBroker(type)
    setActiveBrokerState(type)
  }

  const saveBrokerConfig = async (config: BrokerConfig) => {
    await window.electron.saveBrokerConfig(config)
    setConfigs(prev => prev.map(c => c.type === config.type ? config : c))
  }

  const testConnection = async (type?: BrokerType) => {
    return window.electron.testBrokerConnection(type || activeBroker)
  }

  const isConnected = connectionState?.type === activeBroker && connectionState?.isConnected === true

  return (
    <BrokerContext.Provider value={{
      activeBroker,
      connectionState,
      configs,
      setActiveBroker,
      saveBrokerConfig,
      testConnection,
      isConnected
    }}>
      {children}
    </BrokerContext.Provider>
  )
}
