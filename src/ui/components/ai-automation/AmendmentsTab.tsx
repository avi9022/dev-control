import { useState, type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { Button } from '@/components/ui/button'
import { Trash2, FilePlus, EyeOff, Eye } from 'lucide-react'
import { AmendmentForm } from './AmendmentForm'
import { renderMentions } from './mention-utils'

export const AmendmentsTab: FC<{ task: AITask; pipeline: AIPipelinePhase[] }> = ({ task, pipeline }) => {
  const { updateTask, moveTaskPhase, settings } = useAIAutomation()
  const [showForm, setShowForm] = useState(false)
  const excludePaths = new Set((task.projects || []).map(p => p.path))

  const handleSubmit = async (text: string, targetPhase: string, newProjects?: AITaskProject[]) => {
    const amendment: AITaskAmendment = {
      id: crypto.randomUUID(),
      text,
      targetPhase,
      createdAt: new Date().toISOString()
    }
    const existing = task.amendments || []
    const updates: Partial<AITask> = { amendments: [...existing, amendment] }
    if (newProjects?.length) {
      updates.projects = [...(task.projects || []), ...newProjects]
    }
    await updateTask(task.id, updates)
    await moveTaskPhase(task.id, targetPhase)
    setShowForm(false)
  }

  const handleToggleHidden = async (amendmentId: string) => {
    const amendments = (task.amendments || []).map(a =>
      a.id === amendmentId ? { ...a, hidden: !a.hidden } : a
    )
    await updateTask(task.id, { amendments })
  }

  const handleDelete = async (amendmentId: string) => {
    const amendments = (task.amendments || []).filter(a => a.id !== amendmentId)
    await updateTask(task.id, { amendments })
  }

  const amendments = task.amendments || []

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>
          Add new requirements to this task and send it back into the pipeline.
        </p>
        {!showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <FilePlus className="h-3 w-3 mr-1" /> Add Amendment
          </Button>
        )}
      </div>

      {showForm && (
        <div
          className="rounded-lg p-4"
          style={{
            border: '1px solid var(--ai-border-subtle)',
            backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 50%, transparent)',
          }}
        >
          <AmendmentForm
            pipeline={pipeline}
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
            excludeProjectPaths={excludePaths}
            defaultPhase={settings?.defaultAmendmentPhase}
            defaultGitStrategy={settings?.defaultGitStrategy}
            defaultBaseBranch={settings?.defaultBaseBranch}
          />
        </div>
      )}

      {amendments.length === 0 && !showForm ? (
        <div className="text-center py-8 text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>
          <FilePlus className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--ai-text-tertiary)', opacity: 0.6 }} />
          <p>No amendments yet.</p>
          <p className="mt-1">Use amendments to add new requirements to a completed or in-progress task.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {amendments.map((a) => {
            const phaseConf = pipeline.find(p => p.id === a.targetPhase)
            return (
              <div
                key={a.id}
                className="rounded-lg p-3"
                style={{
                  border: '1px solid var(--ai-border-subtle)',
                  backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 30%, transparent)',
                  opacity: a.hidden ? 0.5 : 1,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono" style={{ color: 'var(--ai-text-tertiary)' }}>
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                    {a.hidden && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--ai-surface-3)', color: 'var(--ai-text-tertiary)' }}>
                        hidden
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--ai-surface-3)', color: 'var(--ai-text-tertiary)' }}
                    >
                      → {phaseConf?.name || a.targetPhase}
                    </span>
                    <button
                      onClick={() => handleToggleHidden(a.id)}
                      className="p-1 rounded hover:bg-[var(--ai-surface-3)] transition-colors"
                      title={a.hidden ? 'Show to agents' : 'Hide from agents'}
                    >
                      {a.hidden
                        ? <Eye className="h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
                        : <EyeOff className="h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
                      }
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1 rounded hover:bg-[var(--ai-surface-3)] transition-colors"
                      title="Delete amendment"
                    >
                      <Trash2 className="h-3 w-3" style={{ color: 'var(--ai-pink)' }} />
                    </button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--ai-text-secondary)' }}>
                  {renderMentions(a.text, new Set((task.projects || []).map(p => p.label)))}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
