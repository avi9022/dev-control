import { type FC } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDirectories } from "@/ui/contexts/directories";
import { DirectoryTab } from "../DirectoryTab";

interface DirectoriesListProps {
  searchTerm: string
}

export const DirectoriesList: FC<DirectoriesListProps> = ({
  searchTerm
}) => {

  const { directories, chooseDirectory, addFromFolder } = useDirectories()
  const filteredList = searchTerm ? directories.filter(({ name }) => name.toLowerCase().includes(searchTerm.toLowerCase())) : directories

  return <div>
    {directories.length ? filteredList.length ? filteredList.map((settings) => <div key={settings.id}>
      <div onClick={() => {
        chooseDirectory(settings.id)
      }}>
        <DirectoryTab directorySettings={settings} />
      </div>
      <Separator />
    </div>) : <div className="flex flex-col px-5 text-center gap-2 h-[400px] justify-center">
      <p>No directories to match the search</p>
    </div> : <div className="flex flex-col px-5 text-center gap-2 h-[400px] justify-center">
      <p>Looks like you have no directories</p>
      <Button onClick={addFromFolder}>Add new directories</Button>
    </div>}
  </div>
}