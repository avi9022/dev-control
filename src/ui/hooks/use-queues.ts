import { useEffect, useState } from "react"

export const useQueues = (id?: string) => {
  const [isLoading, setIsLoading] = useState(false)
  const [queues, setQueues] = useState<QueueSettings[]>([])



  useEffect(() => {
    const getQueues = async () => {
      if (!id) return
      setIsLoading(true)
      const newQueues = await window.electron.getQueues(id)
      setQueues(newQueues)
      setIsLoading(false)
    }

    getQueues()
  }, [id])

  return {
    isLoading,
    queues
  }
}