import { type FC } from "react";
import { Button } from "@/components/ui/button";
import { useDirectories } from "@/ui/contexts/directories";
import { DirectoryTab } from "../DirectoryTab";

interface DirectoriesListProps {
  searchTerm: string
}

export const DirectoriesList: FC<DirectoriesListProps> = ({
  searchTerm
}) => {

  const { directories, chooseDirectory, addFromFolder } = useDirectories()
  const visibleDirs = directories.filter(({ id }) => !id.startsWith('wt-'))
  const filteredList = searchTerm ? visibleDirs.filter(({ name }) => name.toLowerCase().includes(searchTerm.toLowerCase())) : visibleDirs

  return <div>
    {visibleDirs.length ? filteredList.length ? filteredList.map((settings) => (
      <div
        key={settings.id}
        onClick={() => chooseDirectory(settings.id)}
      >
        <DirectoryTab directorySettings={settings} />
      </div>
    )) : <div className="flex flex-col px-5 text-center gap-2 h-[200px] justify-center">
      <p className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>No directories to match the search</p>
    </div> : <div className="flex flex-col px-5 text-center gap-2 h-[200px] justify-center">
      <p className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>Looks like you have no directories</p>
      <Button onClick={addFromFolder} className="h-7 text-xs">Add new directories</Button>
    </div>}
  </div>
}