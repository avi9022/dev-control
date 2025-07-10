import { createContext, useContext, useEffect, useState, type FC, type PropsWithChildren } from 'react'

export const QueuesContext = createContext<{
  queues: string[]
  chosenQueue: string | null
  onChooseQueue: (url: string | null) => void
  // getQueueData: (url: string) => Promise<QueueData>,
  // refreshQueueData: (url: string) => Promise<QueueData>
}>({
  queues: [],
  chosenQueue: null,
  onChooseQueue: () => { }
  // getQueueData: async () => ({
  //   lastFiveMessages: [],
  //   waitingMessages: [],
  //   queueAttributes: {}
  // }),
  // refreshQueueData: async () => ({
  //   lastFiveMessages: [],
  //   waitingMessages: [],
  //   queueAttributes: {}
  // })
})

export function useQueues() {
  return useContext(QueuesContext)
}

export const QueuesProvider: FC<PropsWithChildren> = ({ children }) => {
  const [queues, setQueues] = useState<string[]>([])
  const [chosenQueue, setChosenQueue] = useState<string | null>(null)


  useEffect(() => {
    window.electron.subscribeQueuesList((list) => {
      setQueues(list)
    })
  }, [])

  const onChooseQueue = (url: string | null) => setChosenQueue(url)

  // const refreshQueueData = async (queueUrl: string) => {
  //   const data = await window.electron.getQueueData(queueUrl)
  //   setQueues((prev) => ({
  //     ...prev,
  //     [queueUrl]: data
  //   }))

  //   return data
  // }

  // const getQueueData = async (queueUrl: string) => {
  //   const existingData = queues[queueUrl]

  //   if (existingData) {
  //     return existingData
  //   }

  //   return await refreshQueueData(queueUrl)
  // }




  return <QueuesContext.Provider value={{
    queues,
    onChooseQueue,
    chosenQueue
    // getQueueData,
    // refreshQueueData
  }}>
    {children}
  </QueuesContext.Provider>

}