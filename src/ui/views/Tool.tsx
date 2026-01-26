import type { FC } from 'react'
import { useTools } from '../contexts/tools'
import { Wrench } from 'lucide-react'
import { toolComponents } from '../components/tools'

interface ToolProps {
  id: string | null
}

export const Tool: FC<ToolProps> = ({ id }) => {
  const { getToolById } = useTools()

  if (!id) {
    return (
      <div className="w-full h-full flex flex-col justify-center items-center gap-4">
        <Wrench className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Please choose a tool from the sidebar</p>
      </div>
    )
  }

  const tool = getToolById(id)

  if (!tool) {
    return (
      <div className="w-full h-full flex flex-col justify-center items-center gap-4">
        <p className="text-destructive">Tool not found: {id}</p>
      </div>
    )
  }

  const ToolComponent = toolComponents[id]

  if (!ToolComponent) {
    return (
      <div className="w-full h-full flex flex-col justify-center items-center gap-4">
        <Wrench className="h-12 w-12 text-muted-foreground" />
        <p className="text-xl font-semibold">{tool.name}</p>
        <p className="text-muted-foreground">{tool.description}</p>
        <p className="text-sm text-muted-foreground mt-4">Coming soon...</p>
      </div>
    )
  }

  return (
    <div className="p-5 h-full overflow-hidden">
      <ToolComponent />
    </div>
  )
}
