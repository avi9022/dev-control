import type { FC } from 'react'
import { Plus } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useViews } from '@/ui/contexts/views'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { NAV_ITEMS, DEFAULT_VISIBLE_VIEWS } from './AppNavbarConfig'

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
  onOpenLayoutSettings?: () => void
}

export const AppNavbar: FC<AppNavbarProps> = ({ onOpenLayoutSettings }) => {
  const { views, currentViewIndex, updateView } = useViews()
  const { settings } = useAIAutomation()
  const currentView = views[currentViewIndex]
  const visibleViews = settings?.visibleViews || DEFAULT_VISIBLE_VIEWS
  const filteredItems = NAV_ITEMS.filter(item => visibleViews.includes(item.value))

  return (
    <nav
      className="fixed left-0 top-0 w-12 h-screen flex flex-col items-center pt-3 gap-1 z-50"
      style={{
        background: 'var(--ai-surface-0)',
        borderRight: '1px solid var(--ai-border-subtle)',
      }}
    >
      {filteredItems.map(({ value, label, icon }) => (
        <NavItem
          key={value}
          icon={icon}
          label={label}
          isActive={currentView?.type === value}
          onClick={() => updateView(value, null)}
        />
      ))}

      <div className="flex-1" />

      <div className="mb-3">
        <NavItem
          icon={Plus}
          label="Customize sidebar"
          isActive={false}
          onClick={() => onOpenLayoutSettings?.()}
        />
      </div>
    </nav>
  )
}
