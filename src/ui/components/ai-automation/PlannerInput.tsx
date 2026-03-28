import { type FC, type RefObject } from 'react'
import { Send, Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MentionEditor, type MentionEditorHandle } from '@/ui/components/ai-automation/MentionEditor'
import { INPUT_MIN_HEIGHT, INPUT_MAX_HEIGHT } from '@/ui/components/ai-automation/planner-constants'

interface PlannerInputProps {
  editorRef: RefObject<MentionEditorHandle | null>
  pendingFiles: { name: string; path: string }[]
  onFilesChange: (files: { name: string; path: string }[]) => void
  onAddFiles: () => void
  onSubmit: () => void
  onProjectTagged: (dir: DirectorySettings) => void
  onProjectRemoved: (label: string) => void
  isLoading: boolean
}

export const PlannerInput: FC<PlannerInputProps> = ({
  editorRef,
  pendingFiles,
  onFilesChange,
  onAddFiles,
  onSubmit,
  onProjectTagged,
  onProjectRemoved,
  isLoading,
}) => {
  const handleFormSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (isLoading) return
    onSubmit()
  }

  return (
    <div
      className="flex-shrink-0 px-5 py-4"
      style={{ borderTop: '1px solid var(--ai-border-subtle)' }}
    >
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {pendingFiles.map((f, i) => (
            <span
              key={f.path}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs"
              style={{
                background: 'var(--ai-surface-2)',
                borderColor: 'var(--ai-border-subtle)',
                color: 'var(--ai-text-secondary)',
              }}
            >
              <Paperclip className="h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
              {f.name}
              <button onClick={() => onFilesChange(pendingFiles.filter((_, j) => j !== i))} style={{ color: 'var(--ai-text-tertiary)' }}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={handleFormSubmit} className="flex gap-2.5 items-end">
        <div
          className="flex-1 rounded-xl overflow-hidden"
          style={{}}
        >
          <MentionEditor
            ref={editorRef}
            placeholder="Describe what you want to plan... Use @ to tag projects, # to reference tasks"
            minHeight={INPUT_MIN_HEIGHT}
            className={`!min-h-[${INPUT_MIN_HEIGHT}] max-h-[${INPUT_MAX_HEIGHT}]`}
            onEnterSubmit={onSubmit}
            onProjectTagged={onProjectTagged}
            onProjectRemoved={onProjectRemoved}
          />
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 rounded-full"
            onClick={onAddFiles}
            disabled={isLoading}
            style={{ borderColor: 'var(--ai-border)' }}
          >
            <Paperclip className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            size="sm"
            className="h-9 w-9 p-0 rounded-full"
            style={{ background: 'var(--ai-accent)', color: 'var(--ai-surface-0)' }}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>
    </div>
  )
}
