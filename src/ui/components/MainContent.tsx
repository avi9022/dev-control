import type { FC } from "react"
import { useViews } from "../contexts/views"
import { Service } from "../views/Service"
import { Queue } from "../views/Queue"

export const MainContent: FC = () => {
  const { views, setCurrentViewIndex, currentViewIndex } = useViews()

  return (
    <div className={`flex flex-row w-full gap-1`}>
      {views.map(({ type, itemId }, index) => (
        <div key={`${itemId}-${type}-${index}`} onClick={() => setCurrentViewIndex(index)} className={`pt-2 flex-1 basis-1/${views.length} ${views.length > 1 ? `border rounded-md ${currentViewIndex === index ? 'border-green-700' : ''}` : 'w-full'}`}>
          {type === 'directory' ?
            <Service key={index} id={itemId} /> :
            <Queue key={index} id={itemId} />}
        </div>
      ))}
    </div>
  )
}
