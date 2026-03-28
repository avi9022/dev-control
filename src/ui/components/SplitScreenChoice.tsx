import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Square, Columns2, Columns3 } from "lucide-react";
import type { FC, ReactNode } from "react";
import { useViews } from "../contexts/views";

const mapCountToIcon: Record<number, ReactNode> = {
  1: <Square className="h-3.5 w-3.5" />,
  2: <Columns2 className="h-3.5 w-3.5" />,
  3: <Columns3 className="h-3.5 w-3.5" />
}

export const SplitScreenChoice: FC = () => {
  const { setViewsCount, views } = useViews()
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: 'var(--ai-text-secondary)', background: 'var(--ai-surface-2)' }}
        title="Split screen"
      >
        {mapCountToIcon[views.length]}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className='flex'>
      {Object.entries(mapCountToIcon).map(([count, icon]) => (
        <DropdownMenuItem key={count} onClick={() => setViewsCount(+count)}>{icon}</DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
}
