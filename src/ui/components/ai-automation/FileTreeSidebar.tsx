import { type FC } from 'react'
import { FileCode, ChevronRight, ChevronDown, Folder } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { type DiffFile } from './diff-parser'

export interface FileTreeNode {
  name: string
  fullPath: string // full file path for leaf nodes
  children: FileTreeNode[]
  file?: DiffFile // only on leaf nodes
}

export function buildFileTree(files: DiffFile[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', fullPath: '', children: [] }

  for (const file of files) {
    const filePath = file.newPath || file.oldPath
    const parts = filePath.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      let child = current.children.find(c => c.name === part && !c.file === !isFile)
      if (!child) {
        child = { name: part, fullPath: isFile ? filePath : parts.slice(0, i + 1).join('/'), children: [], ...(isFile ? { file } : {}) }
        current.children.push(child)
      }
      current = child
    }
  }

  // Collapse single-child folders: a/b/c -> a/b/c
  function collapse(node: FileTreeNode): FileTreeNode {
    node.children = node.children.map(collapse)
    if (!node.file && node.children.length === 1 && !node.children[0].file) {
      const child = node.children[0]
      return { ...child, name: node.name + '/' + child.name }
    }
    return node
  }

  return root.children.map(collapse)
}

export const FileTreeItem: FC<{
  node: FileTreeNode
  depth: number
  getFileStats: (file: DiffFile) => { added: number; removed: number }
  onScrollToFile: (path: string) => void
  collapsedFolders: Set<string>
  onToggleFolder: (path: string) => void
}> = ({ node, depth, getFileStats, onScrollToFile, collapsedFolders, onToggleFolder }) => {
  if (node.file) {
    const stats = getFileStats(node.file)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onScrollToFile(node.fullPath)}
            className="w-full flex items-center gap-1.5 py-0.5 pr-1 text-left rounded group"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <FileCode className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
            <span className="text-[11px] truncate flex-1" style={{ color: 'var(--ai-text-secondary)' }}>{node.name}</span>
            <span className="text-[10px] shrink-0 opacity-0 group-hover:opacity-100">
              <span style={{ color: 'var(--ai-diff-added-text)' }}>+{stats.added}</span>
              <span style={{ color: 'var(--ai-diff-removed-text)' }} className="ml-0.5">-{stats.removed}</span>
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs font-mono">{node.fullPath}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  const isCollapsed = collapsedFolders.has(node.fullPath)

  return (
    <div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onToggleFolder(node.fullPath)}
            className="w-full flex items-center gap-1 py-0.5 text-left rounded"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {isCollapsed
              ? <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
              : <ChevronDown className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
            }
            <Folder className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
            <span className="text-[11px] truncate" style={{ color: 'var(--ai-text-tertiary)' }}>{node.name}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs font-mono">{node.fullPath}</p>
        </TooltipContent>
      </Tooltip>
      {!isCollapsed && node.children.map(child => (
        <FileTreeItem
          key={child.fullPath}
          node={child}
          depth={depth + 1}
          getFileStats={getFileStats}
          onScrollToFile={onScrollToFile}
          collapsedFolders={collapsedFolders}
          onToggleFolder={onToggleFolder}
        />
      ))}
    </div>
  )
}
