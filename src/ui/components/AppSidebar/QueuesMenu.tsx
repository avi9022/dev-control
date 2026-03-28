import { useState, type FC } from "react";
import { AddNewQueueButton } from "../DialogButtons/AddNewQueueButton";
import { PurgeAllQueuesButton } from "../DialogButtons/PurgeAllQueuesButton";
import { QueuesList } from "./Lists/QueuesList";
import { BrokerSelector } from "../BrokerSelector";
import { SearchInput } from "../Inputs/SearchInput";
import { SidebarPanel } from "./SidebarPanel";

export const QueuesMenu: FC = () => {
  const [queueSearchTerm, setQueueSearchTerm] = useState('')

  return (
    <SidebarPanel
      header={
        <div className="flex flex-col gap-2">
          <BrokerSelector />
          <SearchInput value={queueSearchTerm} onChange={(ev) => setQueueSearchTerm(ev.target.value)} onClear={() => setQueueSearchTerm('')} />
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <AddNewQueueButton />
          <PurgeAllQueuesButton />
        </div>
      }
    >
      <QueuesList searchTerm={queueSearchTerm} />
    </SidebarPanel>
  )
}
