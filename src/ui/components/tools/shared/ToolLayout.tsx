import type { FC, PropsWithChildren, ReactNode } from 'react'

interface ToolLayoutProps extends PropsWithChildren {
  title: string
  description?: string
  actions?: ReactNode
}

export const ToolLayout: FC<ToolLayoutProps> = ({ title, description, actions, children }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  )
}
