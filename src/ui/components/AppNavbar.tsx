import type { FC } from 'react'
import { LayoutGrid, Wrench } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export type AppView = 'kanban' | 'devcontrol'

interface NavItemProps {
  icon: FC<{ className?: string }>
  label: string
  isActive: boolean
  onClick: () => void
}

const NavItem: FC<NavItemProps> = ({ icon: Icon, label, isActive, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className="relative w-10 h-9 flex items-center justify-center rounded-md transition-colors"
        style={{
          color: isActive ? 'var(--ai-accent)' : 'var(--ai-text-tertiary)',
        }}
        onMouseEnter={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--ai-text-secondary)'
        }}
        onMouseLeave={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--ai-text-tertiary)'
        }}
      >
        {isActive && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
            style={{ background: 'var(--ai-accent)' }}
          />
        )}
        <Icon className="size-[18px]" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="right" sideOffset={8}>
      <p>{label}</p>
    </TooltipContent>
  </Tooltip>
)

interface AppNavbarProps {
  activeView: AppView
  onViewChange: (view: AppView) => void
}

export const AppNavbar: FC<AppNavbarProps> = ({ activeView, onViewChange }) => (
  <nav
    className="fixed left-0 top-0 w-12 h-screen flex flex-col items-center pt-3 gap-1 z-50"
    style={{
      background: 'var(--ai-surface-0)',
    }}
  >
    <NavItem
      icon={LayoutGrid}
      label="Kanban"
      isActive={activeView === 'kanban'}
      onClick={() => onViewChange('kanban')}
    />
    <NavItem
      icon={Wrench}
      label="DevControl"
      isActive={activeView === 'devcontrol'}
      onClick={() => onViewChange('devcontrol')}
    />
  </nav>
)
