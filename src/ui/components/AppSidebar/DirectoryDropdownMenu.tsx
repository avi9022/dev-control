import { type FC, useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EllipsisVertical } from "lucide-react";

interface IDE {
  name: string;
  command: string;
}

interface DirectoryDropdownMenuProps {
  id: string
}

export const DirectoryDropdownMenu: FC<DirectoryDropdownMenuProps> = ({
  id
}) => {
  const [ides, setIdes] = useState<IDE[]>([])

  useEffect(() => {
    window.electron.getAvailableIDEs().then(setIdes)
  }, [])

  return <DropdownMenu>
    <DropdownMenuTrigger className="cursor-pointer outline-0 h-[33px] p-0">
      <div className="h-full flex justify-center items-center">
        <EllipsisVertical />
      </div>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      {ides.map((ide) => (
        <DropdownMenuItem
          key={ide.command}
          onClick={(ev) => {
            ev.stopPropagation()
            window.electron.openInIDE(id, ide.command)
          }}
        >
          Open in {ide.name}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
}
