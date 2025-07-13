import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Square, Columns2, Columns3 } from "lucide-react";
import type { FC } from "react";
import { useViews } from "../contexts/views";

const mapCountToIcon = {
  1: <Square />,
  2: <Columns2 />,
  3: <Columns3 />
}

export const SplitScreenChoice: FC = () => {
  const { setViewsCount, views } = useViews()
  return <DropdownMenu>
    <DropdownMenuTrigger>{
      // @ts-expect-error keys stuff
      mapCountToIcon[views.length]
    }</DropdownMenuTrigger>
    <DropdownMenuContent className='flex'>
      {Object.entries(mapCountToIcon).map(([count, icon]) => <DropdownMenuItem onClick={() => setViewsCount(+count)} >{icon}</DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>
}