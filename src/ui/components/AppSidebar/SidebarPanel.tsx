import type { FC, ReactNode } from 'react'

interface SidebarPanelProps {
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

export const SidebarPanel: FC<SidebarPanelProps> = ({ header, footer, children }) => (
  <div className="h-full flex flex-col text-xs">
    {header && (
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        {header}
      </div>
    )}
    <div className="flex-1 min-h-0 overflow-y-auto">
      {children}
    </div>
    {footer && (
      <div className="flex-shrink-0 px-3 h-[48px] flex items-center" style={{ borderTop: '1px solid var(--ai-border-subtle)' }}>
        {footer}
      </div>
    )}
  </div>
)
