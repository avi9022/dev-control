import { createContext, useContext, useState, type FC, type PropsWithChildren } from 'react'

export type ViewType = 'directory' | 'queue'

interface View {
  type: ViewType,
  itemId: string | null
}

export const ViewsContext = createContext<{
  setViewsCount: (count: number) => void,
  updateView: (type: ViewType, id: string | null) => void
  setCurrentViewIndex: (index: number) => void
  closeView: (index: number) => void
  openViewForItem: (type: ViewType, itemId: string) => void
  views: View[]
  currentViewIndex: number
}>({
  setViewsCount: () => { },
  updateView: () => { },
  setCurrentViewIndex: () => { },
  closeView: () => { },
  openViewForItem: () => { },
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

  const closeView = (index: number) => {
    setViews((prev) => prev.filter((_, currIndex) => currIndex !== index))
    setCurrentViewIndex(0)
  }

  const openViewForItem = (type: ViewType, itemId: string) => {
    if (views.length >= 3) return

    setViews((prev) => [...prev, {
      itemId,
      type,
    }])
  }

  return <ViewsContext.Provider value={{
    setViewsCount,
    updateView,
    setCurrentViewIndex,
    closeView,
    views,
    currentViewIndex,
    openViewForItem
  }}>
    {children}
  </ViewsContext.Provider>

}