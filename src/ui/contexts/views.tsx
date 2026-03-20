import { createContext, useContext, useState, useCallback, useMemo, type FC, type PropsWithChildren } from 'react'

export type ViewType = 'directory' | 'queue' | 'tool' | 'dynamodb' | 'api-client' | 'docker' | 'mongodb' | 'sql'

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

  const setViewsCount = useCallback((count: number) => {
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
  }, [currentViewIndex])

  const updateView = useCallback((type: ViewType, itemId: string | null) => {
    setViews((prev) => {
      return prev.map((view, index) => {
        if (index === currentViewIndex) {
          return { ...view, itemId, type }
        }
        return view
      })
    })
  }, [currentViewIndex])

  const closeView = useCallback((index: number) => {
    setViews((prev) => prev.filter((_, currIndex) => currIndex !== index))
    setCurrentViewIndex(0)
  }, [])

  const openViewForItem = useCallback((type: ViewType, itemId: string) => {
    setViews((prev) => {
      if (prev.length >= 3) return prev
      return [...prev, { itemId, type }]
    })
  }, [])

  const value = useMemo(() => ({
    setViewsCount,
    updateView,
    setCurrentViewIndex,
    closeView,
    views,
    currentViewIndex,
    openViewForItem,
  }), [setViewsCount, updateView, setCurrentViewIndex, closeView, views, currentViewIndex, openViewForItem])

  return <ViewsContext.Provider value={value}>
    {children}
  </ViewsContext.Provider>

}