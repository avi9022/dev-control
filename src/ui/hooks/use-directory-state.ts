import { useEffect, useState } from "react"

const POLLING_INTERVAL = 1000;

export const useDirectoryState = (id: string) => {
  const [isLoading, setIsLoading] = useState(false)
  const [state, setState] = useState<DirectoryState>()

  const checkServiceState = async () => {
    if (!state) {
      setIsLoading(true)
    }
    const currState = await window.electron.checkServiceState(id)
    setState(currState)
    setIsLoading(false)
  }

  useEffect(() => {
    const intervalId = setInterval(() => {
      checkServiceState()
    }, POLLING_INTERVAL)

    return () => clearInterval(intervalId)
  }, [id])

  return {
    state,
    isLoading
  }

}