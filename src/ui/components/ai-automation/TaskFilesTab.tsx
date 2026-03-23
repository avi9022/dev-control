import { useState, useEffect, useCallback, type FC, type CSSProperties } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Trash2, FolderOpen, Paperclip, Check, List, LayoutGrid, FolderTree, FileText, ChevronRight, ChevronDown } from 'lucide-react'
import { MarkdownViewer } from './MarkdownViewer'

type FileViewMode = 'list' | 'grid' | 'tree'
type FileEntry = { name: string; prefix: 'agent' | 'attachments'; excluded: boolean }

const FileCheckbox: FC<{ excluded: boolean; onToggle: (e: React.MouseEvent) => void }> = ({ excluded, onToggle }) => (
  <button
    onClick={onToggle}
    className="flex-shrink-0 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors"
    style={{
      borderColor: excluded ? 'var(--ai-border)' : 'var(--ai-accent)',
      backgroundColor: excluded ? 'var(--ai-surface-2)' : 'var(--ai-accent)',
    }}
    title={excluded ? 'Include in agent prompts' : 'Exclude from agent prompts'}
  >
    {!excluded && <Check className="h-2.5 w-2.5" style={{ color: 'var(--ai-text-primary)' }} />}
  </button>
)

const FileIcon: FC<{ prefix: string; className?: string }> = ({ prefix, className = 'h-3.5 w-3.5' }) => (
  prefix === 'attachments'
    ? <Paperclip className={className} style={{ color: 'var(--ai-accent)' }} />
    : <FileText className={className} style={{ color: 'var(--ai-text-tertiary)' }} />
)

// --- List View ---
const FileListView: FC<{
  files: FileEntry[]
  selectedFile: { name: string; type: string } | null
  onSelect: (f: FileEntry) => void
  onToggleExclude: (f: FileEntry) => void
  onDelete: (f: FileEntry) => void
}> = ({ files, selectedFile, onSelect, onToggleExclude, onDelete }) => (
  <div className="rounded-md overflow-hidden" style={{ border: '1px solid var(--ai-border-subtle)' }}>
    {files.map((f, i) => {
      const isSelected = selectedFile?.name === f.name && selectedFile?.type === f.prefix
      const rowStyle: CSSProperties = {
        ...(i > 0 ? { borderTop: '1px solid var(--ai-border-subtle)' } : {}),
        backgroundColor: isSelected
          ? 'color-mix(in srgb, var(--ai-surface-3) 50%, transparent)'
          : f.excluded ? 'color-mix(in srgb, var(--ai-surface-0) 50%, transparent)' : undefined,
      }
      return (
        <div
          key={`${f.prefix}/${f.name}`}
          onClick={() => onSelect(f)}
          className="group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors"
          style={rowStyle}
        >
          <FileCheckbox excluded={f.excluded} onToggle={e => { e.stopPropagation(); onToggleExclude(f) }} />
          <FileIcon prefix={f.prefix} />
          <span
            className={`flex-1 text-xs truncate ${f.excluded ? 'line-through' : ''}`}
            style={{ color: f.excluded ? 'var(--ai-text-tertiary)' : 'var(--ai-text-secondary)' }}
          >
            {f.name}
          </span>
          <span className="text-[10px] mr-2" style={{ color: 'var(--ai-text-tertiary)' }}>{f.prefix === 'attachments' ? 'attached' : 'agent'}</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(f) }}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ color: 'var(--ai-pink)' }}
            title="Delete file"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )
    })}
  </div>
)

// --- Grid View ---
const FileGridView: FC<{
  files: FileEntry[]
  selectedFile: { name: string; type: string } | null
  onSelect: (f: FileEntry) => void
  onToggleExclude: (f: FileEntry) => void
  onDelete: (f: FileEntry) => void
}> = ({ files, selectedFile, onSelect, onToggleExclude, onDelete }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
    {files.map(f => {
      const isSelected = selectedFile?.name === f.name && selectedFile?.type === f.prefix
      const cardStyle: CSSProperties = isSelected
        ? { backgroundColor: 'color-mix(in srgb, var(--ai-surface-3) 50%, transparent)', borderColor: 'var(--ai-border)' }
        : f.excluded
          ? { backgroundColor: 'color-mix(in srgb, var(--ai-surface-0) 50%, transparent)', borderColor: 'var(--ai-border-subtle)' }
          : { backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 50%, transparent)', borderColor: 'var(--ai-border-subtle)' }
      return (
        <div
          key={`${f.prefix}/${f.name}`}
          onClick={() => onSelect(f)}
          className="group relative flex flex-col items-center gap-1.5 p-3 rounded-lg border cursor-pointer transition-colors"
          style={cardStyle}
        >
          <div className="absolute top-1.5 left-1.5">
            <FileCheckbox excluded={f.excluded} onToggle={e => { e.stopPropagation(); onToggleExclude(f) }} />
          </div>
          <button
            onClick={e => { e.stopPropagation(); onDelete(f) }}
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--ai-pink)' }}
            title="Delete file"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <FileIcon prefix={f.prefix} className="h-6 w-6" />
          <span
            className={`text-xs text-center truncate w-full ${f.excluded ? 'line-through' : ''}`}
            style={{ color: f.excluded ? 'var(--ai-text-tertiary)' : 'var(--ai-text-secondary)' }}
          >
            {f.name}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--ai-text-tertiary)' }}>{f.prefix === 'attachments' ? 'attached' : 'agent'}</span>
        </div>
      )
    })}
  </div>
)

// --- Tree View ---
const FileTreeView: FC<{
  agentFiles: FileEntry[]
  attachmentFiles: FileEntry[]
  selectedFile: { name: string; type: string } | null
  onSelect: (f: FileEntry) => void
  onToggleExclude: (f: FileEntry) => void
  onDelete: (f: FileEntry) => void
}> = ({ agentFiles, attachmentFiles, selectedFile, onSelect, onToggleExclude, onDelete }) => {
  const [agentExpanded, setAgentExpanded] = useState(true)
  const [attachExpanded, setAttachExpanded] = useState(true)

  const renderGroup = (label: string, files: FileEntry[], expanded: boolean, toggle: () => void) => (
    <div>
      <button onClick={toggle} className="flex items-center gap-1 text-xs py-1 w-full transition-colors" style={{ color: 'var(--ai-text-tertiary)' }}>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <FolderOpen className="h-3 w-3 text-yellow-600" />
        <span className="font-medium">{label}/</span>
        <span className="ml-1" style={{ color: 'var(--ai-text-tertiary)' }}>({files.length})</span>
      </button>
      {expanded && (
        <div className="ml-4" style={{ borderLeft: '1px solid var(--ai-border-subtle)' }}>
          {files.length === 0 ? (
            <p className="text-xs pl-3 py-1 italic" style={{ color: 'var(--ai-text-tertiary)' }}>empty</p>
          ) : files.map(f => {
            const isSelected = selectedFile?.name === f.name && selectedFile?.type === f.prefix
            return (
              <div
                key={`${f.prefix}/${f.name}`}
                onClick={() => onSelect(f)}
                className="group flex items-center gap-2 pl-3 pr-2 py-1 cursor-pointer transition-colors"
                style={{
                  backgroundColor: isSelected ? 'color-mix(in srgb, var(--ai-surface-3) 30%, transparent)' : undefined,
                }}
              >
                <FileCheckbox excluded={f.excluded} onToggle={e => { e.stopPropagation(); onToggleExclude(f) }} />
                <FileIcon prefix={f.prefix} className="h-3 w-3" />
                <span
                  className={`flex-1 text-xs truncate ${f.excluded ? 'line-through' : ''}`}
                  style={{ color: f.excluded ? 'var(--ai-text-tertiary)' : 'var(--ai-text-secondary)' }}
                >
                  {f.name}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(f) }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Delete file"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="rounded-md p-2 space-y-1" style={{ border: '1px solid var(--ai-border-subtle)' }}>
      {renderGroup('attachments', attachmentFiles, attachExpanded, () => setAttachExpanded(p => !p))}
      {renderGroup('agent', agentFiles, agentExpanded, () => setAgentExpanded(p => !p))}
    </div>
  )
}

export const TaskFilesTab: FC<{ taskId: string }> = ({ taskId }) => {
  const { tasks, settings, updateSettings } = useAIAutomation()
  const task = tasks.find(t => t.id === taskId)
  const [agentFiles, setAgentFiles] = useState<string[]>([])
  const [attachments, setAttachments] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: 'agent' | 'attachments' } | null>(null)
  const [content, setContent] = useState('')
  const [viewMode, setViewMode] = useState<FileViewMode>(settings?.fileViewMode || 'list')

  const persistViewMode = (mode: FileViewMode) => {
    setViewMode(mode)
    updateSettings({ fileViewMode: mode })
  }
  const excluded = task?.excludedFiles || []

  const loadFiles = useCallback(() => {
    window.electron.aiGetTaskFiles(taskId).then(setAgentFiles)
    window.electron.aiListTaskAttachments(taskId).then(setAttachments)
  }, [taskId])

  useEffect(() => { loadFiles() }, [loadFiles])

  useEffect(() => {
    if (selectedFile) {
      if (selectedFile.type === 'agent') {
        window.electron.aiReadTaskFile(taskId, selectedFile.name).then(setContent)
      } else {
        setContent('(Attachment — preview not available)')
      }
    }
  }, [taskId, selectedFile])

  const isExcluded = (prefix: string, filename: string) => excluded.includes(`${prefix}/${filename}`)

  const agentEntries: FileEntry[] = agentFiles.map(f => ({ name: f, prefix: 'agent', excluded: isExcluded('agent', f) }))
  const attachEntries: FileEntry[] = attachments.map(f => ({ name: f, prefix: 'attachments', excluded: isExcluded('attachments', f) }))
  const allFiles = [...attachEntries, ...agentEntries]

  const handleSelect = (f: FileEntry) => setSelectedFile({ name: f.name, type: f.prefix })
  const handleToggleExclude = async (f: FileEntry) => {
    await window.electron.aiToggleFileExclusion(taskId, `${f.prefix}/${f.name}`)
  }
  const handleDelete = async (f: FileEntry) => {
    if (f.prefix === 'attachments') {
      await window.electron.aiDeleteTaskAttachment(taskId, f.name)
    } else {
      await window.electron.aiDeleteAgentFile(taskId, f.name)
    }
    if (selectedFile?.name === f.name && selectedFile?.type === f.prefix) {
      setSelectedFile(null)
      setContent('')
    }
    loadFiles()
  }

  return (
    <div className="space-y-3">
      {/* Header: description + view toggle + attach button */}
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs leading-relaxed flex-1" style={{ color: 'var(--ai-text-tertiary)' }}>
          Files are included in agent prompts by default. Uncheck to exclude. Higher-numbered files supersede earlier versions.
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--ai-border-subtle)' }}>
            {([['list', List], ['grid', LayoutGrid], ['tree', FolderTree]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => persistViewMode(mode)}
                className="p-1.5 transition-colors"
                style={{
                  backgroundColor: viewMode === mode ? 'var(--ai-surface-3)' : undefined,
                  color: viewMode === mode ? 'var(--ai-text-primary)' : 'var(--ai-text-tertiary)',
                }}
                title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} view`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs ml-2" onClick={async () => {
            const selected = await window.electron.aiSelectFiles()
            if (selected && selected.length > 0) {
              await window.electron.aiAttachTaskFiles(taskId, selected)
              loadFiles()
            }
          }}>
            <Paperclip className="h-3 w-3 mr-1" /> Attach
          </Button>
        </div>
      </div>

      {/* File views */}
      {allFiles.length === 0 ? (
        <div className="text-center py-8 text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>
          <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--ai-text-tertiary)', opacity: 0.6 }} />
          <p>No files yet. Agents will create files during execution.</p>
          <p className="mt-1">Click "Attach" to add reference files.</p>
        </div>
      ) : (
        <>
          {viewMode === 'list' && (
            <FileListView files={allFiles} selectedFile={selectedFile} onSelect={handleSelect} onToggleExclude={handleToggleExclude} onDelete={handleDelete} />
          )}
          {viewMode === 'grid' && (
            <FileGridView files={allFiles} selectedFile={selectedFile} onSelect={handleSelect} onToggleExclude={handleToggleExclude} onDelete={handleDelete} />
          )}
          {viewMode === 'tree' && (
            <FileTreeView agentFiles={agentEntries} attachmentFiles={attachEntries} selectedFile={selectedFile} onSelect={handleSelect} onToggleExclude={handleToggleExclude} onDelete={handleDelete} />
          )}
        </>
      )}

      {/* File preview dialog */}
      <Dialog open={!!selectedFile && !!content} onOpenChange={(open) => { if (!open) { setSelectedFile(null); setContent('') } }}>
        <DialogContent
          className={`!max-w-[700px] h-[80vh] flex flex-col`}
          style={{ background: 'var(--ai-surface-1)', borderColor: 'var(--ai-border-subtle)' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm" style={{ color: 'var(--ai-text-primary)' }}>
              <FileText className="h-4 w-4" style={{ color: 'var(--ai-text-tertiary)' }} />
              {selectedFile?.name}
              {selectedFile && (
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--ai-surface-3)', color: 'var(--ai-text-tertiary)' }}>
                  {selectedFile.type}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto rounded-md p-4" style={{ background: 'var(--ai-surface-0)', border: '1px solid var(--ai-border-subtle)' }}>
            {selectedFile?.name.endsWith('.md') ? (
              <MarkdownViewer content={content} />
            ) : (
              <pre
                className="whitespace-pre-wrap text-sm"
                style={{ fontFamily: 'var(--ai-mono)', color: 'var(--ai-text-secondary)' }}
              >
                {content || 'Empty file'}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
