import { useState, useEffect, useCallback, type FC } from 'react'
import { GitBranch, Pencil, Check, X, Loader2, ExternalLink, GitMerge } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

interface GitCardProps {
  taskId: string
}

export const GitCard: FC<GitCardProps> = ({ taskId }) => {
  const [branches, setBranches] = useState<AIBranchInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [editingBranch, setEditingBranch] = useState<string | null>(null) // worktreePath
  const [newBranchName, setNewBranchName] = useState('')
  const [editingCommit, setEditingCommit] = useState<string | null>(null) // hash
  const [newCommitMessage, setNewCommitMessage] = useState('')
  const [pushToRemote, setPushToRemote] = useState(true)
  const [operating, setOperating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [squashingWorktree, setSquashingWorktree] = useState<string | null>(null)
  const [squashMessage, setSquashMessage] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    window.electron.aiGetBranchInfo(taskId).then(info => {
      setBranches(info)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [taskId])

  useEffect(() => { load() }, [load])

  if (loading) return null
  if (branches.length === 0) return null

  const handleRenameBranch = async (worktreePath: string) => {
    if (!newBranchName.trim()) return
    setOperating(true)
    setError(null)
    try {
      await window.electron.aiRenameBranch(taskId, worktreePath, newBranchName.trim(), pushToRemote)
      setEditingBranch(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOperating(false)
    }
  }

  const handleEditCommit = async (worktreePath: string, hash: string) => {
    if (!newCommitMessage.trim()) return
    setOperating(true)
    setError(null)
    try {
      await window.electron.aiEditCommitMessage(worktreePath, hash, newCommitMessage.trim(), pushToRemote)
      setEditingCommit(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOperating(false)
    }
  }

  const handleSquash = async (worktreePath: string, baseBranch: string) => {
    if (!squashMessage.trim()) return
    setOperating(true)
    setError(null)
    try {
      await window.electron.aiSquashCommits(worktreePath, baseBranch, squashMessage.trim(), pushToRemote)
      setSquashingWorktree(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOperating(false)
    }
  }

  return (
    <div className="space-y-3">
      {branches.map(branch => {
        const isEditingThisBranch = editingBranch === branch.worktreePath
        const isSquashingThis = squashingWorktree === branch.worktreePath

        return (
          <div
            key={branch.worktreePath}
            className="rounded-md overflow-hidden"
            style={{ border: '1px solid var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 30%, transparent)' }}
          >
            {/* Branch header */}
            <div
              className="flex items-center gap-3 px-3 py-2.5"
              style={{ backgroundColor: 'color-mix(in srgb, var(--ai-surface-1) 40%, transparent)' }}
            >
              <GitBranch className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ai-accent)' }} />
              <div className="min-w-0 flex-1">
                {isEditingThisBranch ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newBranchName}
                      onChange={e => setNewBranchName(e.target.value)}
                      className="h-7 text-xs font-mono flex-1"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameBranch(branch.worktreePath)
                        if (e.key === 'Escape') setEditingBranch(null)
                      }}
                    />
                    <button
                      onClick={() => handleRenameBranch(branch.worktreePath)}
                      disabled={operating}
                      className="p-1 rounded transition-colors"
                      style={{ color: 'var(--ai-success)' }}
                    >
                      {operating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button onClick={() => setEditingBranch(null)} className="p-1 rounded" style={{ color: 'var(--ai-text-tertiary)' }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium" style={{ color: 'var(--ai-text-primary)' }}>{branch.branchName}</span>
                    <button
                      onClick={() => { setEditingBranch(branch.worktreePath); setNewBranchName(branch.branchName) }}
                      className="p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                      style={{ color: 'var(--ai-text-tertiary)' }}
                      title="Rename branch"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  {branch.hasRemote && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'var(--ai-accent-subtle)', color: 'var(--ai-accent)' }}>
                      pushed
                    </span>
                  )}
                  {branch.prNumber && (
                    <button
                      onClick={() => branch.prUrl && window.electron.openExternalUrl(branch.prUrl)}
                      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--ai-accent) 15%, transparent)', color: 'var(--ai-accent)' }}
                    >
                      PR #{branch.prNumber}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              </div>
              {!isEditingThisBranch && (
                <button
                  onClick={() => { setEditingBranch(branch.worktreePath); setNewBranchName(branch.branchName) }}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: 'var(--ai-text-tertiary)' }}
                  title="Rename branch"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Commits */}
            {branch.commits.length > 0 && (
              <div>
                {branch.commits.map((commit) => {
                  const isEditing = editingCommit === commit.hash
                  return (
                    <div
                      key={commit.hash}
                      className="flex items-start gap-2.5 px-3 py-2 group"
                      style={{
                        borderTop: '1px solid var(--ai-border-subtle)',
                        backgroundColor: 'color-mix(in srgb, var(--ai-surface-1) 20%, transparent)',
                      }}
                    >
                      <span
                        className="text-[11px] font-mono flex-shrink-0 mt-0.5 select-all"
                        style={{ color: 'var(--ai-text-tertiary)' }}
                      >
                        {commit.shortHash}
                      </span>
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={newCommitMessage}
                              onChange={e => setNewCommitMessage(e.target.value)}
                              className="h-7 text-xs flex-1"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleEditCommit(branch.worktreePath, commit.hash)
                                if (e.key === 'Escape') setEditingCommit(null)
                              }}
                            />
                            <button
                              onClick={() => handleEditCommit(branch.worktreePath, commit.hash)}
                              disabled={operating}
                              className="p-1 rounded"
                              style={{ color: 'var(--ai-success)' }}
                            >
                              {operating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => setEditingCommit(null)} className="p-1 rounded" style={{ color: 'var(--ai-text-tertiary)' }}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--ai-text-secondary)' }}>{commit.message}</span>
                        )}
                      </div>
                      {!isEditing && (
                        <button
                          onClick={() => { setEditingCommit(commit.hash); setNewCommitMessage(commit.message) }}
                          className="p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                          style={{ color: 'var(--ai-text-tertiary)' }}
                          title="Edit commit message"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )
                })}

                {/* Squash action */}
                {branch.commits.length >= 2 && (
                  <div
                    className="px-3 py-1.5"
                    style={{
                      borderTop: '1px solid var(--ai-border-subtle)',
                      backgroundColor: 'color-mix(in srgb, var(--ai-surface-1) 10%, transparent)',
                    }}
                  >
                    {isSquashingThis ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={squashMessage}
                          onChange={e => setSquashMessage(e.target.value)}
                          placeholder="Squashed commit message..."
                          className="h-7 text-xs flex-1"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const proj = branches.find(b => b.worktreePath === branch.worktreePath)
                              const base = proj?.projectPath ? undefined : 'main'
                              handleSquash(branch.worktreePath, base || 'main')
                            }
                            if (e.key === 'Escape') setSquashingWorktree(null)
                          }}
                        />
                        <button
                          onClick={() => handleSquash(branch.worktreePath, 'main')}
                          disabled={operating}
                          className="p-1 rounded"
                          style={{ color: 'var(--ai-success)' }}
                        >
                          {operating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => setSquashingWorktree(null)} className="p-1 rounded" style={{ color: 'var(--ai-text-tertiary)' }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setSquashingWorktree(branch.worktreePath); setSquashMessage('') }}
                        className="flex items-center gap-1 text-[11px] transition-colors"
                        style={{ color: 'var(--ai-text-tertiary)' }}
                      >
                        <GitMerge className="h-3 w-3" /> Squash {branch.commits.length} commits
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Push to remote toggle */}
            {(isEditingThisBranch || editingCommit || isSquashingThis) && (
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{
                  borderTop: '1px solid var(--ai-border-subtle)',
                  backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 30%, transparent)',
                }}
              >
                <Checkbox
                  id={`push-remote-${branch.worktreePath}`}
                  checked={pushToRemote}
                  onCheckedChange={v => setPushToRemote(!!v)}
                />
                <label
                  htmlFor={`push-remote-${branch.worktreePath}`}
                  className="text-[11px]"
                  style={{ color: 'var(--ai-text-tertiary)' }}
                >
                  Push changes to remote
                  {branch.prNumber ? ` (PR #${branch.prNumber})` : ''}
                </label>
              </div>
            )}
          </div>
        )
      })}

      {/* Error display */}
      {error && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{ backgroundColor: 'color-mix(in srgb, var(--ai-pink) 10%, transparent)', color: 'var(--ai-pink)', border: '1px solid color-mix(in srgb, var(--ai-pink) 20%, transparent)' }}
        >
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}
    </div>
  )
}
