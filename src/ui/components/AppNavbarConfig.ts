import type { FC } from 'react'
import { LayoutGrid, Server, ListOrdered, Database, Globe, Container, Leaf, Wrench, DatabaseZap } from 'lucide-react'
import type { ViewType } from '@/ui/contexts/views'

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
