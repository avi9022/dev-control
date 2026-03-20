import type { FC } from 'react'
import { LayoutGrid, Server, ListOrdered, Database, Globe, Container, Leaf, GitBranch, Wrench, DatabaseZap, Plus } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useViews, type ViewType } from '@/ui/contexts/views'
import { useAIAutomation } from '@/ui/contexts/ai-automation'

export const DEFAULT_VISIBLE_VIEWS = ['kanban', 'directory']

export const NAV_ITEMS: { value: ViewType; label: string; icon: FC<{ className?: string }> }[] = [
  { value: 'kanban', label: 'Kanban', icon: LayoutGrid },
  { value: 'directory', label: 'Services', icon: Server },
  { value: 'queue', label: 'Queues', icon: ListOrdered },
  { value: 'dynamodb', label: 'DynamoDB', icon: Database },
  { value: 'api-client', label: 'API Client', icon: Globe },
  { value: 'docker', label: 'Docker', icon: Container },
  { value: 'mongodb', label: 'MongoDB', icon: Leaf },
  { value: 'sql', label: 'SQL Developer', icon: DatabaseZap },
  { value: 'tool', label: 'Tools', icon: Wrench },
]

// Tabs that need the DevControl sidebar
export const SIDEBAR_VIEWS = new Set<ViewType>(['directory', 'queue', 'dynamodb', 'api-client', 'docker', 'mongodb', 'sql', 'tool'])

// Map from ViewType to the sidebar tab value used by AppSidebar
export const VIEW_TO_SIDEBAR_TAB: Partial<Record<ViewType, string>> = {
  'directory': 'services',
  'queue': 'queues',
  'dynamodb': 'dynamodb',
  'api-client': 'api-client',
  'docker': 'docker',
  'mongodb': 'mongodb',
  'sql': 'sql',
  'tool': 'tools',
}

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
