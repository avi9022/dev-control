import { useState, useEffect, useCallback, type FC } from 'react'
import { Button } from '@/components/ui/button'

import { ChevronRight, ChevronDown, Loader2, Trash2, RefreshCw, Eye, Save } from 'lucide-react'
import { WORKTREE_ID_PREFIX } from '@/shared/constants'
import { MarkdownViewer } from './MarkdownViewer'

const PROFILE_STATUS_GENERATED = 'Generated' as const
const PROFILE_STATUS_NOT_GENERATED = 'Not generated' as const

interface ProjectRow {
  directory: DirectorySettings
  profile: ProjectProfile | null
}

export const ProjectKnowledgePanel: FC = () => {
  const [directories, setDirectories] = useState<DirectorySettings[]>([])
  const [profiles, setProfiles] = useState<ProjectProfile[]>([])
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const [generatingPaths, setGeneratingPaths] = useState<Set<string>>(new Set())
  const [errorMap, setErrorMap] = useState<Record<string, string>>({})
  const [editState, setEditState] = useState<Record<string, Partial<ProjectProfile>>>({})
  const [knowledgeDoc, setKnowledgeDoc] = useState<string | null>(null)
  const [knowledgeDocPath, setKnowledgeDocPath] = useState<string | null>(null)
  const [showKnowledge, setShowKnowledge] = useState(false)
  const [loadingKnowledge, setLoadingKnowledge] = useState(false)

  const fetchData = useCallback(() => {
    window.electron.getDirectories().then(setDirectories)
    window.electron.aiGetProjectProfiles().then(setProfiles)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredDirectories = directories.filter(d => !d.id.startsWith(WORKTREE_ID_PREFIX))

  const projectRows: ProjectRow[] = filteredDirectories.map(directory => ({
    directory,
    profile: profiles.find(p => p.projectPath === directory.path) ?? null,
  }))

  const handleGenerate = useCallback((projectPath: string) => {
    setGeneratingPaths(prev => new Set([...prev, projectPath]))
    setErrorMap(prev => {
      const next = { ...prev }
      delete next[projectPath]
      return next
    })

    window.electron.aiGenerateProjectKnowledge(projectPath).then(result => {
      setGeneratingPaths(prev => {
        const next = new Set(prev)
        next.delete(projectPath)
        return next
      })
      if (result.success) {
        window.electron.aiGetProjectProfiles().then(setProfiles)
      } else {
        setErrorMap(prev => ({ ...prev, [projectPath]: result.error ?? 'Generation failed' }))
      }
    })
  }, [])

  const handleDelete = useCallback((projectPath: string) => {
    window.electron.aiDeleteProjectKnowledge(projectPath).then(() => {
      setProfiles(prev => prev.filter(p => p.projectPath !== projectPath))
      if (expandedPath === projectPath) setExpandedPath(null)
      setShowKnowledge(false)
      setKnowledgeDoc(null)
      setKnowledgeDocPath(null)
    })
  }, [expandedPath])

  const handleToggleExpand = useCallback((projectPath: string) => {
    setExpandedPath(prev => prev === projectPath ? null : projectPath)
    setShowKnowledge(false)
    setKnowledgeDoc(null)
    setKnowledgeDocPath(null)
  }, [])

  const handleEditField = useCallback((projectPath: string, field: string, value: string) => {
    setEditState(prev => ({
      ...prev,
      [projectPath]: { ...prev[projectPath], [field]: value },
    }))
  }, [])

  const handleSave = useCallback((profile: ProjectProfile) => {
    const edits = editState[profile.projectPath]
    if (!edits) return
    const updated: ProjectProfile = { ...profile, ...edits }
    window.electron.aiSaveProjectProfile(updated).then(() => {
      setProfiles(prev => prev.map(p => p.projectPath === profile.projectPath ? updated : p))
      setEditState(prev => {
        const next = { ...prev }
        delete next[profile.projectPath]
        return next
      })
    })
  }, [editState])

  const handleViewKnowledge = useCallback((projectPath: string) => {
    if (showKnowledge && knowledgeDocPath === projectPath) {
      setShowKnowledge(false)
      return
    }
    setLoadingKnowledge(true)
    setShowKnowledge(true)
    setKnowledgeDocPath(projectPath)
    window.electron.aiGetProjectKnowledgeDoc(projectPath).then(doc => {
      setKnowledgeDoc(doc)
      setLoadingKnowledge(false)
    })
  }, [showKnowledge, knowledgeDocPath])

  const hasEdits = useCallback((projectPath: string) => {
    const edits = editState[projectPath]
    return edits !== undefined && Object.keys(edits).length > 0
  }, [editState])

  if (filteredDirectories.length === 0) {
    return (
      <div className="text-sm py-8 text-center rounded mt-4" style={{ color: 'var(--ai-text-tertiary)', border: '1px dashed var(--ai-border-subtle)' }}>
        No projects registered. Add directories in the Services view first.
      </div>
    )
  }

  return (
    <div className="space-y-3 mt-4">
      <p className="text-sm" style={{ color: 'var(--ai-text-secondary)' }}>
        Project profiles give the planner structured knowledge about each project. Generate profiles to improve task planning accuracy.
      </p>

      <div className="space-y-2">
        {projectRows.map(({ directory, profile }) => {
          const isExpanded = expandedPath === directory.path
          const isGenerating = generatingPaths.has(directory.path)
          const error = errorMap[directory.path]
          const edits = editState[directory.path]
          const currentSummary = edits?.summary ?? profile?.summary ?? ''
          const currentStack = edits?.stack ?? profile?.stack ?? ''
          const currentResponsibilities = edits?.responsibilities ?? profile?.responsibilities ?? ''

          return (
            <div key={directory.id} className="rounded" style={{ border: '1px solid var(--ai-border-subtle)', background: 'var(--ai-surface-2)' }}>
              <div
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => profile && handleToggleExpand(directory.path)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {profile ? (
                    isExpanded
                      ? <ChevronDown className="size-4 shrink-0" style={{ color: 'var(--ai-text-secondary)' }} />
                      : <ChevronRight className="size-4 shrink-0" style={{ color: 'var(--ai-text-secondary)' }} />
                  ) : (
                    <div className="size-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--ai-text-primary)' }}>
                      {directory.customLabel || directory.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--ai-text-tertiary)' }}>
                      {directory.path}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {profile ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--ai-accent-subtle)', color: 'var(--ai-accent)' }}>
                      {PROFILE_STATUS_GENERATED}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--ai-surface-3)', color: 'var(--ai-text-tertiary)' }}>
                      {PROFILE_STATUS_NOT_GENERATED}
                    </span>
                  )}

                  {isGenerating ? (
                    <Loader2 className="size-4 animate-spin" style={{ color: 'var(--ai-accent)' }} />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleGenerate(directory.path) }}
                    >
                      <RefreshCw className="size-3 mr-1" />
                      {profile ? 'Regenerate' : 'Generate'}
                    </Button>
                  )}
                </div>
              </div>

              {error && (
                <div className="px-3 pb-3">
                  <p className="text-xs" style={{ color: 'var(--ai-pink)' }}>{error}</p>
                </div>
              )}

              {isExpanded && profile && (
                <div className="px-3 pb-3 space-y-3" style={{ borderTop: '1px solid var(--ai-border-subtle)' }}>
                  <div className="pt-3 space-y-2">
                    <div>
                      <label className="text-xs font-medium" style={{ color: 'var(--ai-text-secondary)' }}>Summary</label>
                      <textarea
                        value={currentSummary}
                        onChange={e => handleEditField(directory.path, 'summary', e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
                        style={{ borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-2)', color: 'var(--ai-text-primary)', resize: 'vertical' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium" style={{ color: 'var(--ai-text-secondary)' }}>Stack</label>
                      <textarea
                        value={currentStack}
                        onChange={e => handleEditField(directory.path, 'stack', e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
                        style={{ borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-2)', color: 'var(--ai-text-primary)', resize: 'vertical' }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium" style={{ color: 'var(--ai-text-secondary)' }}>Responsibilities</label>
                      <textarea
                        value={currentResponsibilities}
                        onChange={e => handleEditField(directory.path, 'responsibilities', e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1"
                        style={{ borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-2)', color: 'var(--ai-text-primary)', resize: 'vertical' }}
                      />
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--ai-text-tertiary)' }}>
                      Generated {new Date(profile.generatedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasEdits(directory.path) && (
                      <Button size="sm" onClick={() => handleSave(profile)} style={{ background: 'var(--ai-accent)', color: 'var(--ai-surface-0)' }}>
                        <Save className="size-3 mr-1" /> Save
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewKnowledge(directory.path)}
                    >
                      <Eye className="size-3 mr-1" />
                      {showKnowledge && knowledgeDocPath === directory.path ? 'Hide Full Knowledge' : 'View Full Knowledge'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(directory.path)}
                    >
                      <Trash2 className="size-3 mr-1" style={{ color: 'var(--ai-pink)' }} />
                      <span style={{ color: 'var(--ai-pink)' }}>Delete</span>
                    </Button>
                  </div>

                  {showKnowledge && knowledgeDocPath === directory.path && (
                    <div className="rounded p-3 text-sm overflow-auto max-h-96" style={{ background: 'var(--ai-surface-1)', color: 'var(--ai-text-primary)', border: '1px solid var(--ai-border-subtle)' }}>
                      {loadingKnowledge ? (
                        <div className="flex items-center gap-2" style={{ color: 'var(--ai-text-tertiary)' }}>
                          <Loader2 className="size-4 animate-spin" /> Loading knowledge document...
                        </div>
                      ) : knowledgeDoc ? (
                        <MarkdownViewer content={knowledgeDoc} className="text-sm" />
                      ) : (
                        <span style={{ color: 'var(--ai-text-tertiary)' }}>No detailed knowledge document found.</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
