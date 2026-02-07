import { type FC, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useDirectories } from '@/ui/contexts/directories'
import { Monitor, Server, Search } from 'lucide-react'

interface ServiceStepFieldsProps {
  serviceIds: string[]
  onServiceIdsChange: (ids: string[]) => void
}

export const ServiceStepFields: FC<ServiceStepFieldsProps> = ({
  serviceIds,
  onServiceIdsChange,
}) => {
  const { directories } = useDirectories()
  const [search, setSearch] = useState('')

  const filtered = directories.filter(({ name }) =>
    name.toLowerCase().includes(search.toLowerCase())
  )

  const handleToggle = (id: string, checked: boolean) => {
    if (checked) {
      onServiceIdsChange([...serviceIds, id])
    } else {
      onServiceIdsChange(serviceIds.filter((s) => s !== id))
    }
  }

  return (
    <div className="space-y-3">
      <Label className="text-xs">Services</Label>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-7 h-7 text-xs"
        />
      </div>
      <ScrollArea className="h-[150px] border rounded p-2">
        <div className="space-y-2">
          {filtered.length ? (
            filtered.map(({ id, name, isFrontendProj }) => (
              <div key={id} className="flex items-center gap-2">
                <Checkbox
                  checked={serviceIds.includes(id)}
                  onCheckedChange={(checked) => handleToggle(id, !!checked)}
                />
                <span className="text-xs flex-1 truncate">{name}</span>
                {isFrontendProj ? (
                  <Monitor className="h-3 w-3 text-green-500 shrink-0" />
                ) : (
                  <Server className="h-3 w-3 text-blue-500 shrink-0" />
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No services found</p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
