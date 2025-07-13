import type { FC } from "react"
import { useViews } from "../contexts/views"
import { Service } from "../views/Service"
import { Queue } from "../views/Queue"

export const MainContent: FC = () => {
  const { views, setCurrentViewIndex, currentViewIndex } = useViews()

  return (
    <div className="flex w-full gap-1">
      {views.map(({ type, itemId }, index) => (
        <div onClick={() => setCurrentViewIndex(index)} className={`${views.length > 1 ? `border rounded-md w-1/2 ${currentViewIndex === index ? 'border-green-700' : ''}` : 'w-full'}`}>
          {type === 'directory' ?
            <Service key={index} id={itemId} /> :
            <Queue key={index} id={itemId} />}
        </div>
      ))}
    </div>
  )
}
