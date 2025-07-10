import { type FC } from "react";
import { DirectoryTab } from "./DirectoryTab";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDirectories } from "../contexts/directories";
import { useQueues } from "../contexts/queues";


export const DirectoriesList: FC = () => {

  const { directories, chooseDirectory, addFromFolder } = useDirectories()
  const { onChooseQueue } = useQueues()

  return <div>
    {directories.length ? directories.map((settings) => <div key={settings.id}>
      <div onClick={() => {
        onChooseQueue(null)
        chooseDirectory(settings.id)
      }}>
        <DirectoryTab directorySettings={settings} />
      </div>
      <Separator className="my-4 " />
    </div>) : <div className="flex flex-col px-5 text-center gap-2 h-[400px] justify-center">
      <p>Looks like you have no directories</p>
      <Button onClick={addFromFolder}>Add new directories</Button>
    </div>}
  </div>
}