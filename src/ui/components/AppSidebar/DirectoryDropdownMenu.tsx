import type { FC } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EllipsisVertical } from "lucide-react";

interface DirectoryDropdownMenuProps {
  id: string
}

export const DirectoryDropdownMenu: FC<DirectoryDropdownMenuProps> = ({
  id
}) => {
  return <DropdownMenu>
    <DropdownMenuTrigger className="cursor-pointer outline-0 h-[33px] p-0">
      <div className="h-full flex justify-center items-center">
        <EllipsisVertical />
      </div>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={(ev) => {
        ev.stopPropagation()
        window.electron.openInVSCode(id)
      }}>
        Open in VScode
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
}