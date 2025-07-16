import { createContext, useContext, useEffect, useState, type FC, type PropsWithChildren } from 'react'
import { useViews } from './views'

type QueuesData = Record<string, QueueData>

export const QueuesContext = createContext<{
  queues: string[]
  onChooseQueue: (url: string | null, openView?: boolean) => void
  getQueueData: (url: string) => Promise<QueueData>,
  subscribedQueuesData: QueuesData
}>({
  queues: [],
  onChooseQueue: () => { },
  subscribedQueuesData: {},
  getQueueData: async () => ({
    lastFiveMessages: [],
    waitingMessages: [],
    queueAttributes: {}
  }),
})

export function useQueues() {
  return useContext(QueuesContext)
}

export const QueuesProvider: FC<PropsWithChildren> = ({ children }) => {
  const [queues, setQueues] = useState<string[]>([])
  const [subscribedQueuesData, setSubscribedQueuesData] = useState<QueuesData>({})
  const { updateView, views, currentViewIndex } = useViews()

  useEffect(() => {
    window.electron.subscribeQueuesList((list) => {
      setQueues(list)
    })
    window.electron.subscribeQueueData((res) => {
      setSubscribedQueuesData((prev) => {
        const copy = { ...prev }
        copy[res.queueUrl] = res.data

        return copy
      })
    })
  }, [])



  const onChooseQueue = async (url: string | null, openView: boolean = true) => {
    if (openView) {
      const currentView = views[currentViewIndex]
      if (currentView?.type === 'queue' && currentView.itemId) {
        await window.electron.stopPollingQueue(currentView.itemId)
      }
      updateView('queue', url)
    }
    if (url) {
      window.electron.pollQueue(url || '')
    }
  }

  const getQueueData = async (queueUrl: string) => {
    const data = await window.electron.getQueueData(queueUrl)

    return data
  }

  return <QueuesContext.Provider value={{
    queues,
    onChooseQueue,
    getQueueData,
    subscribedQueuesData
  }}>
    {children}
  </QueuesContext.Provider>

}