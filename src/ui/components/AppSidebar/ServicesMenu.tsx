import { Button } from "@/components/ui/button";
import { CirclePlus } from "lucide-react";
import { useState, type FC } from "react";
import { useDirectories } from "@/ui/contexts/directories";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StopAllServicesButton } from "../DialogButtons/StopAllServicesButton";
import { SearchInput } from "../Inputs/SearchInput";
import { DirectoriesList } from "./Lists/DirectoriesList";

export const ServicesMenu: FC = () => {
  const { directories, removeDirectory, addFromFolder } = useDirectories()
  const [directorySearchTerm, setDirectorySearchTerm] = useState('')
  return <div>
    <div className="mb-4 px-5">
      <SearchInput value={directorySearchTerm} onChange={(ev) => setDirectorySearchTerm(ev.target.value)} onClear={() => setDirectorySearchTerm('')} />
    </div>
    <ScrollArea className="h-[calc(100vh-80px-40px-40px-50px-50px)]">
      <DirectoriesList searchTerm={directorySearchTerm} />
    </ScrollArea>
    <div className="flex justify-between items-center px-4 gap-20 h-[80px] bg-stone-600">
      <Button disabled={!directories.length} onClick={() => removeDirectory()} className="bg-destructive text-foreground flex-1">
        Remove all
      </Button>
      <div className="flex gap-2">
        <Button onClick={() => addFromFolder()} variant="default" className="size-8">
          <CirclePlus />
        </Button>
        <StopAllServicesButton />
      </div>
    </div>
  </div>
}