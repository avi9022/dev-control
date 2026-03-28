import type { FC } from "react"
import { cn } from "@/lib/utils"

// --- Drag & Drop Types ---

export type DragType = 'item' | 'collection'

export interface DragData {
  type: DragType
  id: string
  collectionId?: string // Only for items
  itemType?: 'request' | 'folder' // Only for items
}

export interface DropTarget {
  type: 'item' | 'collection' | 'collection-root'
  id: string
  collectionId: string
  position: 'before' | 'after' | 'inside'
}

// --- Drop Indicator Line Component ---

export const DropLine: FC<{ depth: number }> = ({ depth }) => (
  <div
    className="h-[2px] bg-sky-500 rounded-full my-[-1px] relative z-10 animate-in fade-in-0 duration-100"
    style={{ marginLeft: `${8 + depth * 12}px`, marginRight: '8px' }}
  />
)

// --- Collapsible Container for smooth expand/collapse ---

export const CollapsibleContent: FC<{ isOpen: boolean; children: React.ReactNode }> = ({ isOpen, children }) => (
  <div
    className={cn(
      "grid transition-[grid-template-rows] duration-200 ease-out",
      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
    )}
  >
    <div className="overflow-hidden">
      {children}
    </div>
  </div>
)
