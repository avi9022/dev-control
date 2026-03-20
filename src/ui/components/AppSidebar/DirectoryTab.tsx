import type { FC } from "react";
import { useDirectories } from "@/ui/contexts/directories";
import { useViews } from "@/ui/contexts/views";
import { DirectoryDropdownMenu } from "./DirectoryDropdownMenu";
import { ServiceRow } from "@/ui/components/ServiceRow";

interface DirectoryTabProps {
  directorySettings: DirectorySettings
}

export const DirectoryTab: FC<DirectoryTabProps> = ({
  directorySettings
}) => {
  const { runService, directoriesStateMap, stopService } = useDirectories()
  const { id } = directorySettings
  const { views } = useViews()

  const state = directoriesStateMap[id] || 'UNKNOWN'
  const isDirectoryPanelOpen = views.some(({ itemId, type }) => type === 'directory' && itemId === id)

  return (
    <ServiceRow
      dir={directorySettings}
      state={state}
      isSelected={isDirectoryPanelOpen}
      onRun={() => runService(id)}
      onStop={() => stopService(id)}
      actions={<DirectoryDropdownMenu id={id} />}
    />
  )
}
