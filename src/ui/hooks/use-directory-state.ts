import { useCallback, useEffect, useState } from "react"

const POLLING_INTERVAL = 1000;

export const useDirectoryState = (id: string) => {
  const [isLoading, setIsLoading] = useState(false)
  const [state, setState] = useState<DirectoryState>()

  const checkServiceState = useCallback(async () => {
    setState((prev) => {
      if (!prev) setIsLoading(true)
      return prev
    })
    const currState = await window.electron.checkServiceState(id)
    setState(currState)
    setIsLoading(false)
  }, [id])

  useEffect(() => {
    const intervalId = setInterval(() => {
      checkServiceState()
    }, POLLING_INTERVAL)

    return () => clearInterval(intervalId)
  }, [checkServiceState])

  return {
    state,
    isLoading
  }

}