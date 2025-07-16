import { Button, } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Columns2 } from "lucide-react";
import type { FC } from "react";
import { useViews, type ViewType } from "../contexts/views";

interface OpenItemViewButtonProps {
  id: string,
  type: ViewType
  variant: "link" | "default" | "destructive" | "outline" | "secondary" | "ghost" | null | undefined,
  onOpenView?: () => void
}

export const OpenItemViewButton: FC<OpenItemViewButtonProps> = ({
  id,
  type,
  variant,
  onOpenView
}) => {
  const { openViewForItem, views } = useViews()
  const isOpen = views.some(({ itemId }) => itemId === id)
  return <Tooltip>
    <TooltipTrigger asChild>
      <Button
        size={'icon'}
        disabled={views.length >= 3 || isOpen}
        variant={variant}
        onClick={(ev) => {
          ev.stopPropagation()
          onOpenView?.()
          openViewForItem(type, id)
        }}
      >
        {<Columns2 />}
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Open in new split view</p>
    </TooltipContent>
  </Tooltip>
}