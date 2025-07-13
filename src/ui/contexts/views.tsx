import { createContext, useContext, useState, type FC, type PropsWithChildren } from 'react'

type ViewType = 'directory' | 'queue'

interface View {
  type: ViewType,
  itemId: string | null
}

export const ViewsContext = createContext<{
  setViewsCount: (count: number) => void,
  updateView: (type: ViewType, id: string | null) => void
  setCurrentViewIndex: (index: number) => void
  views: View[]
  currentViewIndex: number
}>({
  setViewsCount: () => { },
  updateView: () => { },
  setCurrentViewIndex: () => { },
  views: [],
  currentViewIndex: 0
})

export function useViews() {
  return useContext(ViewsContext);
}

export const ViewsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [views, setViews] = useState<View[]>([{
    type: 'directory',
    itemId: null
  }])
  const [currentViewIndex, setCurrentViewIndex] = useState(0)

  const setViewsCount = (count: number) => {
    setViews((prev) => {
      const updated: View[] = []
      for (let i = 0; i < count; i++) {
        const existing = prev[i]
        if (existing) {
          updated.push(existing)
        } else {
          updated.push({
            itemId: null,
            type: 'directory'
          })
        }
      }

      if (!updated[currentViewIndex]) {
        setCurrentViewIndex(0)
      }

      return updated
    })
  }

  const updateView = (type: ViewType, itemId: string | null) => {
    setViews((prev) => {
      const prevCopy = [...prev]
      if (prevCopy[currentViewIndex]) {
        prevCopy[currentViewIndex].itemId = itemId
        prevCopy[currentViewIndex].type = type
      }
      return prevCopy
    })
  }

  return <ViewsContext.Provider value={{
    setViewsCount,
    updateView,
    setCurrentViewIndex,
    views,
    currentViewIndex,
  }}>
    {children}
  </ViewsContext.Provider>

}