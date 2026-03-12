import { useState, useEffect, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Paperclip, X } from 'lucide-react'
import { MentionEditor, type MentionEditorHandle } from './MentionEditor'
import { renderMentions } from './mention-utils'

interface TaskDetailsCardProps {
  task: AITask
  editing: boolean
  editTitle: string
  setEditTitle: (v: string) => void
  editProjects: AITaskProject[]
  setEditProjects: React.Dispatch<React.SetStateAction<AITaskProject[]>>
  editDescRef: React.RefObject<MentionEditorHandle | null>
  settings: AIAutomationSettings | null
}

const AttachmentsInline: FC<{ taskId: string }> = ({ taskId }) => {
  const [attachments, setAttachments] = useState<string[]>([])

  const loadAttachments = () => {
    window.electron.aiListTaskAttachments(taskId).then(setAttachments)
  }

  useEffect(() => { loadAttachments() }, [taskId])

  return (
    <div>
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={async () => {
          const selected = await window.electron.aiSelectFiles()
          if (selected && selected.length > 0) {
            await window.electron.aiAttachTaskFiles(taskId, selected)
            loadAttachments()
          }
        }}>
          <Paperclip className="h-3 w-3 mr-1" /> Attach
        </Button>
      </div>
      {attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-1">
          {attachments.map(f => (
            <div
              key={f}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs"
              style={{
                backgroundColor: 'var(--ai-surface-2)',
                border: '1px solid var(--ai-border-subtle)',
                color: 'var(--ai-text-secondary)',
              }}
            >
              <Paperclip className="h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
              {f}
              <button
                onClick={async () => {
                  await window.electron.aiDeleteTaskAttachment(taskId, f)
                  loadAttachments()
                }}
                className="ml-1"
                style={{ color: 'var(--ai-pink)' }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const TaskDetailsCard: FC<TaskDetailsCardProps> = ({
  task,
  editing,
  editTitle,
  setEditTitle,
  editProjects,
  setEditProjects,
  editDescRef,
  settings,
}) => {
  const projectLabels = new Set((task.projects || []).map(p => p.label))

  const SectionLabel: FC<{ children: React.ReactNode }> = ({ children }) => (
    <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--ai-text-tertiary)', opacity: 0.7 }}>
      {children}
    </h4>
  )

  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ai-text-tertiary)' }}>
        Task Details
      </h3>
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-1) 30%, transparent)' }}
      >
        {/* Title */}
        <div className="px-4 pt-4 pb-3">
          {editing ? (
            <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-base font-semibold" />
          ) : (
            <h2 className="text-lg font-semibold leading-snug" style={{ color: 'var(--ai-text-primary)' }}>
              {task.title}
            </h2>
          )}
          <span className="text-[11px] mt-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>
            Created {new Date(task.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            {' · '}
            {new Date(task.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        {/* Description */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--ai-border-subtle)' }}>
          <SectionLabel>Description</SectionLabel>
          {editing ? (
            <MentionEditor
              ref={editDescRef}
              placeholder="Describe what needs to be done... Type @ to tag a project"
              minHeight="120px"
              excludeProjectPaths={new Set(editProjects.map(p => p.path))}
              onProjectTagged={(dir) => {
                if (!editProjects.some(p => p.path === dir.path)) {
                  setEditProjects(prev => [...prev, {
                    path: dir.path,
                    label: dir.customLabel || dir.name,
                    gitStrategy: settings?.defaultGitStrategy === 'none' ? 'none' : 'worktree',
                    baseBranch: settings?.defaultBaseBranch ?? 'main'
                  }])
                }
              }}
            />
          ) : (
            task.description ? (
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ai-text-secondary)' }}>
                {renderMentions(task.description, projectLabels)}
              </p>
            ) : (
              <p className="text-xs italic" style={{ color: 'var(--ai-text-tertiary)' }}>No description</p>
            )
          )}
        </div>

        {/* Attachments */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--ai-border-subtle)' }}>
          <SectionLabel>Attachments</SectionLabel>
          <AttachmentsInline taskId={task.id} />
        </div>
      </div>
    </div>
  )
}
