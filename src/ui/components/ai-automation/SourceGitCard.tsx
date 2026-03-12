import { useState, useEffect, useCallback, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FolderOpen, GitBranch, Trash2, Plus, X, Pencil, Check, Loader2, ExternalLink, GitMerge, Save } from 'lucide-react'

type PendingChange =
  | { type: 'rename-branch'; worktreePath: string; taskId: string; newName: string }
  | { type: 'edit-commit'; worktreePath: string; hash: string; newMessage: string }
  | { type: 'squash'; worktreePath: string; baseBranch: string; message: string }

interface SourceGitCardProps {
  task: AITask
  editing: boolean
  editProjects: AITaskProject[]
  setEditProjects: React.Dispatch<React.SetStateAction<AITaskProject[]>>
  isAgentRunning: boolean
}

// Branch+commits for a single project worktree — edits are staged, not applied
const ProjectBranchSection: FC<{
  branch: AIBranchInfo
  pendingChanges: PendingChange[]
  onStageChange: (change: PendingChange) => void
  onUnstageChange: (change: PendingChange) => void
}> = ({ branch, pendingChanges, onStageChange, onUnstageChange }) => {
  const [editingBranch, setEditingBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [editingCommit, setEditingCommit] = useState<string | null>(null)
  const [newCommitMessage, setNewCommitMessage] = useState('')
  const [squashing, setSquashing] = useState(false)
  const [squashMessage, setSquashMessage] = useState('')

  // Get the displayed branch name (pending rename overrides original)
  const pendingRename = pendingChanges.find(
    c => c.type === 'rename-branch' && c.worktreePath === branch.worktreePath
  ) as (PendingChange & { type: 'rename-branch' }) | undefined
  const displayBranchName = pendingRename?.newName || branch.branchName

  // Get displayed commit messages (pending edits override originals)
  const getDisplayCommitMessage = (commit: AIBranchCommit) => {
    const pending = pendingChanges.find(
      c => c.type === 'edit-commit' && c.worktreePath === branch.worktreePath && c.hash === commit.hash
    ) as (PendingChange & { type: 'edit-commit' }) | undefined
    return pending?.newMessage || commit.message
  }

  const pendingSquash = pendingChanges.find(
    c => c.type === 'squash' && c.worktreePath === branch.worktreePath
  ) as (PendingChange & { type: 'squash' }) | undefined

  const confirmBranchRename = () => {
    const trimmed = newBranchName.trim()
    if (!trimmed || trimmed === branch.branchName) {
      // Remove any existing pending rename if reverting
      if (pendingRename) onUnstageChange(pendingRename)
      setEditingBranch(false)
      return
    }
    // Remove old pending rename if exists, add new one
    if (pendingRename) onUnstageChange(pendingRename)
    onStageChange({ type: 'rename-branch', worktreePath: branch.worktreePath, taskId: '', newName: trimmed })
    setEditingBranch(false)
  }

  const confirmCommitEdit = (hash: string) => {
    const trimmed = newCommitMessage.trim()
    const original = branch.commits.find(c => c.hash === hash)?.message
    if (!trimmed || trimmed === original) {
      // Remove pending if reverting
      const existing = pendingChanges.find(c => c.type === 'edit-commit' && c.hash === hash)
      if (existing) onUnstageChange(existing)
      setEditingCommit(null)
      return
    }
    const existing = pendingChanges.find(c => c.type === 'edit-commit' && c.hash === hash)
    if (existing) onUnstageChange(existing)
    onStageChange({ type: 'edit-commit', worktreePath: branch.worktreePath, hash, newMessage: trimmed })
    setEditingCommit(null)
  }

  const confirmSquash = () => {
    const trimmed = squashMessage.trim()
    if (!trimmed) { setSquashing(false); return }
    if (pendingSquash) onUnstageChange(pendingSquash)
    onStageChange({ type: 'squash', worktreePath: branch.worktreePath, baseBranch: 'main', message: trimmed })
    setSquashing(false)
  }

  return (
    <div className="ml-5 mt-1.5" style={{ borderLeft: '1px solid var(--ai-border-subtle)' }}>
      {/* Branch name row */}
      <div className="flex items-center gap-2 pl-3 py-1">
        <GitBranch className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--ai-accent)' }} />
        {editingBranch ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Input
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              className="h-6 text-xs font-mono flex-1"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') confirmBranchRename()
                if (e.key === 'Escape') setEditingBranch(false)
              }}
            />
            <button onClick={confirmBranchRename} className="p-0.5 rounded" style={{ color: 'var(--ai-success)' }}>
              <Check className="h-3 w-3" />
            </button>
            <button onClick={() => setEditingBranch(false)} className="p-0.5 rounded" style={{ color: 'var(--ai-text-tertiary)' }}>
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span
              className="text-xs font-mono font-medium truncate"
              style={{ color: pendingRename ? 'var(--ai-accent)' : 'var(--ai-text-primary)' }}
            >
              {displayBranchName}
            </span>
            {pendingRename && (
              <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--ai-accent-subtle)', color: 'var(--ai-accent)' }}>
                edited
              </span>
            )}
            <button
              onClick={() => { setEditingBranch(true); setNewBranchName(displayBranchName) }}
              className="p-0.5 rounded transition-colors opacity-60 hover:opacity-100 flex-shrink-0"
              style={{ color: 'var(--ai-text-tertiary)' }}
              title="Rename branch"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
            {branch.hasRemote && (
              <span className="text-[9px] px-1 py-0.5 rounded font-medium" style={{ backgroundColor: 'var(--ai-accent-subtle)', color: 'var(--ai-accent)' }}>
                pushed
              </span>
            )}
            {branch.prNumber && (
              <button
                onClick={() => branch.prUrl && window.electron.openExternalUrl(branch.prUrl)}
                className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded font-medium transition-colors"
                style={{ backgroundColor: 'color-mix(in srgb, var(--ai-accent) 15%, transparent)', color: 'var(--ai-accent)' }}
              >
                PR #{branch.prNumber}
                <ExternalLink className="h-2 w-2" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Commits (hidden if squash is pending) */}
      {!pendingSquash && branch.commits.length > 0 && branch.commits.map(commit => {
        const isEditingThis = editingCommit === commit.hash
        const displayMsg = getDisplayCommitMessage(commit)
        const isPendingEdit = pendingChanges.some(c => c.type === 'edit-commit' && c.hash === commit.hash)
        return (
          <div
            key={commit.hash}
            className="flex items-start gap-2 pl-3 pr-2 py-1 group"
            style={{ borderTop: '1px solid color-mix(in srgb, var(--ai-border-subtle) 50%, transparent)' }}
          >
            <span className="text-[10px] font-mono flex-shrink-0 mt-0.5 select-all" style={{ color: 'var(--ai-text-tertiary)' }}>
              {commit.shortHash}
            </span>
            <div className="min-w-0 flex-1">
              {isEditingThis ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={newCommitMessage}
                    onChange={e => setNewCommitMessage(e.target.value)}
                    className="h-6 text-xs flex-1"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') confirmCommitEdit(commit.hash)
                      if (e.key === 'Escape') setEditingCommit(null)
                    }}
                  />
                  <button onClick={() => confirmCommitEdit(commit.hash)} className="p-0.5 rounded" style={{ color: 'var(--ai-success)' }}>
                    <Check className="h-3 w-3" />
                  </button>
                  <button onClick={() => setEditingCommit(null)} className="p-0.5 rounded" style={{ color: 'var(--ai-text-tertiary)' }}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span className="text-xs" style={{ color: isPendingEdit ? 'var(--ai-accent)' : 'var(--ai-text-secondary)' }}>
                  {displayMsg}
                </span>
              )}
            </div>
            {!isEditingThis && (
              <button
                onClick={() => { setEditingCommit(commit.hash); setNewCommitMessage(displayMsg) }}
                className="p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                style={{ color: 'var(--ai-text-tertiary)' }}
                title="Edit commit message"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )
      })}

      {/* Pending squash indicator */}
      {pendingSquash && (
        <div
          className="flex items-center gap-2 pl-3 pr-2 py-1.5"
          style={{ borderTop: '1px solid color-mix(in srgb, var(--ai-border-subtle) 50%, transparent)' }}
        >
          <GitMerge className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--ai-accent)' }} />
          <div className="min-w-0 flex-1">
            <span className="text-[10px]" style={{ color: 'var(--ai-text-tertiary)' }}>
              Squash {branch.commits.length} commits into:
            </span>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ai-accent)' }}>{pendingSquash.message}</p>
          </div>
          <button
            onClick={() => onUnstageChange(pendingSquash)}
            className="p-0.5 rounded flex-shrink-0"
            style={{ color: 'var(--ai-text-tertiary)' }}
            title="Cancel squash"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Squash action (only if no pending squash and 2+ commits) */}
      {!pendingSquash && branch.commits.length >= 2 && (
        <div className="pl-3 pr-2 py-1" style={{ borderTop: '1px solid color-mix(in srgb, var(--ai-border-subtle) 50%, transparent)' }}>
          {squashing ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={squashMessage}
                onChange={e => setSquashMessage(e.target.value)}
                placeholder="Squashed commit message..."
                className="h-6 text-xs flex-1"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmSquash()
                  if (e.key === 'Escape') setSquashing(false)
                }}
              />
              <button onClick={confirmSquash} className="p-0.5 rounded" style={{ color: 'var(--ai-success)' }}>
                <Check className="h-3 w-3" />
              </button>
              <button onClick={() => setSquashing(false)} className="p-0.5 rounded" style={{ color: 'var(--ai-text-tertiary)' }}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setSquashing(true); setSquashMessage('') }}
              className="flex items-center gap-1 text-[10px] transition-colors"
              style={{ color: 'var(--ai-text-tertiary)' }}
            >
              <GitMerge className="h-2.5 w-2.5" /> Squash {branch.commits.length} commits
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export const SourceGitCard: FC<SourceGitCardProps> = ({
  task,
  editing,
  editProjects,
  setEditProjects,
  isAgentRunning,
}) => {
  const hasProjects = task.projects && task.projects.length > 0
  const hasWorktrees = task.worktrees && task.worktrees.length > 0

  const [branches, setBranches] = useState<AIBranchInfo[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [pushToRemote, setPushToRemote] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBranches = useCallback(() => {
    if (!hasWorktrees) return
    setLoadingBranches(true)
    window.electron.aiGetBranchInfo(task.id).then(info => {
      setBranches(info)
      setLoadingBranches(false)
    }).catch(() => setLoadingBranches(false))
  }, [task.id, hasWorktrees])

  useEffect(() => { loadBranches() }, [loadBranches])

  const stageChange = (change: PendingChange) => {
    setPendingChanges(prev => [...prev, change])
  }

  const unstageChange = (change: PendingChange) => {
    setPendingChanges(prev => prev.filter(c => c !== change))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      // Group commit edits by worktree so they can be applied in a single rebase
      const commitEdits = pendingChanges.filter(c => c.type === 'edit-commit') as (PendingChange & { type: 'edit-commit' })[]
      const editsByWorktree = new Map<string, { hash: string; newMessage: string }[]>()
      for (const edit of commitEdits) {
        const existing = editsByWorktree.get(edit.worktreePath) || []
        existing.push({ hash: edit.hash, newMessage: edit.newMessage })
        editsByWorktree.set(edit.worktreePath, existing)
      }

      // Apply squashes first (they replace all commits, so commit edits on that worktree are moot)
      const squashes = pendingChanges.filter(c => c.type === 'squash') as (PendingChange & { type: 'squash' })[]
      const squashedWorktrees = new Set(squashes.map(s => s.worktreePath))
      for (const squash of squashes) {
        await window.electron.aiSquashCommits(squash.worktreePath, squash.baseBranch, squash.message, pushToRemote)
      }

      // Apply batched commit edits (skip worktrees that were squashed)
      for (const [worktreePath, edits] of editsByWorktree) {
        if (squashedWorktrees.has(worktreePath)) continue
        await window.electron.aiEditMultipleCommitMessages(worktreePath, edits, pushToRemote)
      }

      // Apply branch renames last
      const renames = pendingChanges.filter(c => c.type === 'rename-branch') as (PendingChange & { type: 'rename-branch' })[]
      for (const rename of renames) {
        await window.electron.aiRenameBranch(task.id, rename.worktreePath, rename.newName, pushToRemote)
      }

      setPendingChanges([])
      loadBranches()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setPendingChanges([])
  }

  if (!editing && !hasProjects && !hasWorktrees) return null

  // Sort projects: worktree first, read-only last
  const sortedProjects = hasProjects
    ? [...task.projects!].sort((a, b) => {
        if (a.gitStrategy === 'worktree' && b.gitStrategy !== 'worktree') return -1
        if (a.gitStrategy !== 'worktree' && b.gitStrategy === 'worktree') return 1
        return 0
      })
    : []

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ai-text-tertiary)' }}>
          Source & Git
        </h3>
        {!editing && hasWorktrees && (
          <button
            className="text-[11px] flex items-center gap-1 transition-colors"
            style={{ color: 'var(--ai-pink)', opacity: isAgentRunning ? 0.4 : 0.7 }}
            disabled={isAgentRunning}
            onClick={async () => {
              if (confirm('Remove all worktrees? The branches will be kept.')) {
                await window.electron.aiRemoveWorktree(task.id)
              }
            }}
          >
            <Trash2 className="h-3 w-3" /> Remove worktrees
          </button>
        )}
      </div>
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-1) 30%, transparent)' }}
      >
        {editing ? (
          <div className="p-4 space-y-2">
            {editProjects.map((proj, i) => (
              <div
                key={i}
                className="rounded-md p-2"
                style={{
                  border: '1px solid var(--ai-border-subtle)',
                  backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 50%, transparent)',
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-accent)' }} />
                      <span className="text-sm truncate" style={{ color: 'var(--ai-accent)' }}>{proj.label}</span>
                    </div>
                    <p className="text-[11px] truncate ml-5" style={{ color: 'var(--ai-text-tertiary)' }}>{proj.path}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => setEditProjects(prev => prev.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" style={{ color: 'var(--ai-pink)' }} />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={proj.gitStrategy} onValueChange={v => setEditProjects(prev => prev.map((p, j) => j === i ? { ...p, gitStrategy: v as AIGitStrategy } : p))}>
                    <SelectTrigger className="h-7 w-[110px] text-xs flex-shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="worktree">Worktree</SelectItem>
                      <SelectItem value="none">Read Only</SelectItem>
                    </SelectContent>
                  </Select>
                  {proj.gitStrategy === 'worktree' && (
                    <>
                      <Input
                        value={proj.customBranchName || ''}
                        onChange={e => setEditProjects(prev => prev.map((p, j) => j === i ? { ...p, customBranchName: e.target.value || undefined } : p))}
                        placeholder="Branch (auto)"
                        className="h-7 text-xs flex-1 min-w-0"
                      />
                      <Input
                        value={proj.baseBranch || ''}
                        onChange={e => setEditProjects(prev => prev.map((p, j) => j === i ? { ...p, baseBranch: e.target.value || undefined } : p))}
                        placeholder="Base"
                        className="h-7 text-xs w-[90px] flex-shrink-0"
                      />
                    </>
                  )}
                  {proj.gitStrategy === 'none' && (
                    <span className="text-[11px] italic" style={{ color: 'var(--ai-text-tertiary)' }}>Read only</span>
                  )}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={async () => {
              const selected = await window.electron.aiSelectDirectory()
              if (selected && !editProjects.some(p => p.path === selected)) {
                setEditProjects(prev => [...prev, { path: selected, label: selected.split('/').pop() || selected, gitStrategy: 'worktree', baseBranch: 'main' }])
              }
            }}>
              <Plus className="h-3 w-3 mr-1" /> Add Project
            </Button>
          </div>
        ) : (
          <>
            {sortedProjects.map((proj, i) => {
              const wt = task.worktrees?.find(w => w.projectPath === proj.path)
              const branchInfo = wt ? branches.find(b => b.worktreePath === wt.worktreePath) : null

              return (
                <div
                  key={i}
                  className="px-4 py-3"
                  style={i > 0 ? { borderTop: '1px solid var(--ai-border-subtle)' } : undefined}
                >
                  {/* Project header */}
                  <div className="flex items-center gap-2.5">
                    <FolderOpen className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ai-accent)' }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--ai-text-primary)' }}>{proj.label}</span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={proj.gitStrategy === 'worktree'
                            ? { backgroundColor: 'var(--ai-accent-subtle)', color: 'var(--ai-accent)' }
                            : { backgroundColor: 'var(--ai-surface-3)', color: 'var(--ai-text-tertiary)' }
                          }
                        >
                          {proj.gitStrategy === 'worktree' ? 'worktree' : 'read only'}
                        </span>
                        {proj.gitStrategy === 'worktree' && proj.baseBranch && (
                          <span className="text-[11px]" style={{ color: 'var(--ai-text-tertiary)' }}>
                            base: <span className="font-mono">{proj.baseBranch}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Branch + commits nested under project */}
                  {wt && loadingBranches && (
                    <div className="ml-5 mt-2 flex items-center gap-2 pl-3 py-1" style={{ borderLeft: '1px solid var(--ai-border-subtle)' }}>
                      <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'var(--ai-text-tertiary)' }} />
                      <span className="text-[11px]" style={{ color: 'var(--ai-text-tertiary)' }}>Loading branch info...</span>
                    </div>
                  )}
                  {branchInfo && !loadingBranches && (
                    <ProjectBranchSection
                      branch={branchInfo}
                      pendingChanges={pendingChanges}
                      onStageChange={stageChange}
                      onUnstageChange={unstageChange}
                    />
                  )}
                </div>
              )
            })}

            {/* Save bar — appears when there are pending changes */}
            {pendingChanges.length > 0 && (
              <div
                className="flex items-center gap-3 px-4 py-2.5"
                style={{
                  borderTop: '1px solid var(--ai-border-subtle)',
                  backgroundColor: 'color-mix(in srgb, var(--ai-accent-subtle) 40%, transparent)',
                }}
              >
                <div className="flex items-center gap-2 flex-1">
                  <Checkbox
                    id="push-to-remote"
                    checked={pushToRemote}
                    onCheckedChange={v => setPushToRemote(!!v)}
                  />
                  <label htmlFor="push-to-remote" className="text-[11px]" style={{ color: 'var(--ai-text-secondary)' }}>
                    Push changes to remote
                  </label>
                </div>
                <span className="text-[10px]" style={{ color: 'var(--ai-text-tertiary)' }}>
                  {pendingChanges.length} pending {pendingChanges.length === 1 ? 'change' : 'changes'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleDiscard}
                  disabled={saving}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  style={{ background: 'var(--ai-accent)', color: 'var(--ai-surface-0)' }}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Saving...</>
                  ) : (
                    <><Save className="h-3 w-3 mr-1" /> Save Changes</>
                  )}
                </Button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div
                className="px-4 py-2 text-xs"
                style={{
                  borderTop: '1px solid var(--ai-border-subtle)',
                  backgroundColor: 'color-mix(in srgb, var(--ai-pink) 10%, transparent)',
                  color: 'var(--ai-pink)',
                }}
              >
                {error}
                <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
