import { useEffect, useRef, type FC } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export interface ContextMenuAction {
  label: string
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
  separator?: boolean
}

export interface RightClickMenuState {
  x: number
  y: number
  actions: ContextMenuAction[]
}

export const RightClickMenu: FC<{
  menu: RightClickMenuState
  onClose: () => void
}> = ({ menu, onClose }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    document.addEventListener('contextmenu', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('contextmenu', handleClick)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 min-w-[140px] rounded border bg-popover p-0.5 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.actions.map((action, i) => (
        <div key={i}>
          {action.separator && <div className="bg-border -mx-0.5 my-0.5 h-px" />}
          <button
            className={cn(
              "relative flex w-full cursor-default items-center rounded px-2 py-1 text-xs outline-none select-none hover:bg-accent hover:text-accent-foreground",
              action.variant === 'destructive' && "text-destructive hover:bg-destructive/10 hover:text-destructive",
              action.disabled && "pointer-events-none opacity-50",
            )}
            onClick={() => {
              if (!action.disabled) {
                onClose()
                action.onClick()
              }
            }}
          >
            {action.label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
