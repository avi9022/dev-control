import { Button } from "@/components/ui/button";
import { CirclePlus } from "lucide-react";
import { useState, type FC } from "react";
import { useDirectories } from "@/ui/contexts/directories";
import { StopAllServicesButton } from "../DialogButtons/StopAllServicesButton";
import { SearchInput } from "../Inputs/SearchInput";
import { DirectoriesList } from "./Lists/DirectoriesList";
import { SidebarPanel } from "./SidebarPanel";

export const ServicesMenu: FC = () => {
  const { directories, removeDirectory, addFromFolder } = useDirectories()
  const [directorySearchTerm, setDirectorySearchTerm] = useState('')

  return (
    <SidebarPanel
      header={
        <SearchInput value={directorySearchTerm} onChange={(ev) => setDirectorySearchTerm(ev.target.value)} onClear={() => setDirectorySearchTerm('')} />
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <Button disabled={!directories.length} onClick={() => removeDirectory()} variant="destructive" className="h-7 px-3 text-[11px]">
            Remove all
          </Button>
          <div className="flex gap-1">
            <Button onClick={() => addFromFolder()} variant="outline" className="size-7 p-0">
              <CirclePlus className="size-3" />
            </Button>
            <StopAllServicesButton />
          </div>
        </div>
      }
    >
      <DirectoriesList searchTerm={directorySearchTerm} />
    </SidebarPanel>
  )
}
