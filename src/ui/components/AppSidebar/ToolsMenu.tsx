import { useState, type FC } from 'react'
import { SearchInput } from '../Inputs/SearchInput'
import { SidebarPanel } from './SidebarPanel'
import { useTools, CATEGORY_LABELS, type ToolCategory, type Tool } from '@/ui/contexts/tools'
import { useViews } from '@/ui/contexts/views'
import {
  KeyRound,
  Binary,
  Link,
  Code,
  Braces,
  GitCompare,
  FileJson,
  FileCode,
  Fingerprint,
  Hash,
  Lock,
  Text,
  Clock,
  Globe,
  Regex,
  CaseSensitive,
  FileDiff,
  BarChart2,
  Server,
  Terminal,
  History,
} from 'lucide-react'

const iconMap: Record<string, FC<{ className?: string }>> = {
  KeyRound,
  Binary,
  Link,
  Code,
  Braces,
  GitCompare,
  FileJson,
  FileCode,
  Fingerprint,
  Hash,
  Lock,
  Text,
  Clock,
  Globe,
  Regex,
  CaseSensitive,
  FileDiff,
  BarChart2,
  Server,
  Terminal,
}

const ToolCard: FC<{ tool: Tool; onClick: () => void }> = ({ tool, onClick }) => {
  const Icon = iconMap[tool.icon]
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-colors cursor-pointer text-center min-h-[80px]"
    >
      {Icon && <Icon className="h-5 w-5 mb-1.5 text-muted-foreground" />}
      <span className="text-xs font-medium leading-tight">{tool.name}</span>
    </button>
  )
}

const CategorySection: FC<{ category: ToolCategory; tools: Tool[]; onToolClick: (toolId: string) => void }> = ({
  category,
  tools,
  onToolClick,
}) => {
  if (tools.length === 0) return null
  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
        {CATEGORY_LABELS[category]}
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} onClick={() => onToolClick(tool.id)} />
        ))}
      </div>
    </div>
  )
}

export const ToolsMenu: FC = () => {
  const { tools, recentTools, getToolById, searchTools, addRecentTool } = useTools()
  const { updateView } = useViews()
  const [searchTerm, setSearchTerm] = useState('')

  const handleToolClick = (toolId: string) => {
    addRecentTool(toolId)
    updateView('tool', toolId)
  }

  const filteredTools = searchTerm ? searchTools(searchTerm) : tools

  const recentToolObjects = recentTools
    .map((id) => getToolById(id))
    .filter((t): t is Tool => t !== undefined)

  const categories: ToolCategory[] = ['encoding', 'formatting', 'generators', 'time', 'text', 'network']

  return (
    <SidebarPanel
      header={
        <SearchInput
          value={searchTerm}
          onChange={(ev) => setSearchTerm(ev.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder="Search tools..."
        />
      }
    >
      <div className="px-5 pb-4">
        {!searchTerm && recentToolObjects.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
              <History className="h-3 w-3" />
              Recent
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {recentToolObjects.map((tool) => (
                <ToolCard key={tool.id} tool={tool} onClick={() => handleToolClick(tool.id)} />
              ))}
            </div>
          </div>
        )}

        {searchTerm ? (
          <div>
            {filteredTools.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No tools found</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {filteredTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} onClick={() => handleToolClick(tool.id)} />
                ))}
              </div>
            )}
          </div>
        ) : (
          categories.map((category) => (
            <CategorySection
              key={category}
              category={category}
              tools={tools.filter((t) => t.category === category)}
              onToolClick={handleToolClick}
            />
          ))
        )}
      </div>
    </SidebarPanel>
  )
}
