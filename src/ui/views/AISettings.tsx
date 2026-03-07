import { useState, type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Folder, ChevronUp, ChevronDown, Wand2, Loader2 } from 'lucide-react'

interface AISettingsProps {
  onBack: () => void
}

export const AISettings: FC<AISettingsProps> = ({ onBack }) => {
  const { settings, updateSettings } = useAIAutomation()

  if (!settings) return <div className="h-full flex items-center justify-center text-neutral-500">Loading settings...</div>

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-700">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-white">AI Automation Settings</h2>
      </div>

      <Tabs defaultValue="pipeline" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 w-fit">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Docs</TabsTrigger>
          <TabsTrigger value="rules">Global Rules</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          <PipelineTab settings={settings} updateSettings={updateSettings} />
        </TabsContent>

        <TabsContent value="knowledge" className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          <KnowledgeDocsTab settings={settings} updateSettings={updateSettings} />
        </TabsContent>

        <TabsContent value="rules" className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          <div className="space-y-2 mt-4">
            <Label>Global rules applied to all agents</Label>
            <Textarea
              value={settings.globalRules}
              onChange={e => updateSettings({ globalRules: e.target.value })}
              placeholder="Enter global rules in markdown. These are included in every agent prompt..."
              rows={15}
              className="font-mono text-sm"
            />
          </div>
        </TabsContent>

        <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          <GeneralTab settings={settings} updateSettings={updateSettings} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// --- Sub-components ---

interface SettingsTabProps {
  settings: AIAutomationSettings
  updateSettings: (updates: Partial<AIAutomationSettings>) => void
}

const PipelineTab: FC<SettingsTabProps> = ({ settings, updateSettings }) => {
  const pipeline = settings.pipeline || []

  const addPhase = () => {
    const newPhase: AIPipelinePhase = {
      id: crypto.randomUUID(),
      name: 'New Phase',
      type: 'agent',
      prompt: '',
    }
    updateSettings({ pipeline: [...pipeline, newPhase] })
  }

  const updatePhase = (id: string, updates: Partial<AIPipelinePhase>) => {
    updateSettings({
      pipeline: pipeline.map(p => p.id === id ? { ...p, ...updates } : p)
    })
  }

  const deletePhase = (id: string) => {
    updateSettings({
      pipeline: pipeline
        .filter(p => p.id !== id)
        .map(p => p.rejectTarget === id ? { ...p, rejectTarget: undefined, rejectPattern: undefined } : p)
    })
  }

  const movePhase = (index: number, direction: -1 | 1) => {
    const newPipeline = [...pipeline]
    const target = index + direction
    if (target < 0 || target >= newPipeline.length) return
    ;[newPipeline[index], newPipeline[target]] = [newPipeline[target], newPipeline[index]]
    updateSettings({ pipeline: newPipeline })
  }

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-neutral-400">
        Configure the phases a task flows through between Backlog and Done. Each phase is either an AI agent step or a manual human step.
      </p>

      <div className="px-3 py-2 rounded bg-neutral-800/50 border border-neutral-700 text-sm text-neutral-400">
        Backlog (fixed)
      </div>

      {pipeline.map((phase, index) => (
        <PipelinePhaseCard
          key={phase.id}
          phase={phase}
          index={index}
          total={pipeline.length}
          allPhases={pipeline}
          onUpdate={(updates) => updatePhase(phase.id, updates)}
          onDelete={() => deletePhase(phase.id)}
          onMove={(dir) => movePhase(index, dir)}
        />
      ))}

      <Button size="sm" onClick={addPhase}>
        <Plus className="h-4 w-4 mr-1" /> Add Phase
      </Button>

      <div className="px-3 py-2 rounded bg-neutral-800/50 border border-neutral-700 text-sm text-neutral-400">
        Done (fixed)
      </div>
    </div>
  )
}

const PipelinePhaseCard: FC<{
  phase: AIPipelinePhase
  index: number
  total: number
  allPhases: AIPipelinePhase[]
  onUpdate: (updates: Partial<AIPipelinePhase>) => void
  onDelete: () => void
  onMove: (direction: -1 | 1) => void
}> = ({ phase, index, total, allPhases, onUpdate, onDelete, onMove }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-neutral-700 rounded-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50">
        <div className="flex flex-col gap-0.5">
          <button onClick={() => onMove(-1)} disabled={index === 0} className="text-neutral-500 hover:text-white disabled:opacity-30">
            <ChevronUp className="h-3 w-3" />
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="text-neutral-500 hover:text-white disabled:opacity-30">
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
        <button className="flex-1 text-left" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{phase.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${phase.type === 'agent' ? 'bg-blue-900/50 text-blue-300' : 'bg-neutral-700 text-neutral-300'}`}>
              {phase.type}
            </span>
            {phase.rejectPattern && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300">has routing</span>
            )}
          </div>
        </button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </Button>
      </div>

      {expanded && (
        <div className="px-3 py-3 space-y-3 border-t border-neutral-700">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label>Name</Label>
              <Input value={phase.name} onChange={e => onUpdate({ name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={phase.type} onValueChange={v => onUpdate({ type: v as 'agent' | 'manual' })}>
                <SelectTrigger className="mt-1 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {phase.type === 'agent' && (
            <>
              <div>
                <Label>System Prompt</Label>
                <Textarea
                  value={phase.prompt || ''}
                  onChange={e => onUpdate({ prompt: e.target.value })}
                  placeholder="Instructions for the AI agent in this phase..."
                  rows={6}
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label>Allowed Tools <span className="text-neutral-500 font-normal">(optional)</span></Label>
                <Input
                  value={phase.allowedTools || ''}
                  onChange={e => onUpdate({ allowedTools: e.target.value })}
                  placeholder="Leave empty for all tools, or e.g. Read,Glob,Grep,Bash(git:*)"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label>Reject Pattern <span className="text-neutral-500 font-normal">(optional)</span></Label>
                  <Input
                    value={phase.rejectPattern || ''}
                    onChange={e => onUpdate({ rejectPattern: e.target.value })}
                    placeholder="e.g. REVIEW_DECISION: REJECT"
                    className="mt-1 font-mono text-sm"
                  />
                </div>
                <div className="flex-1">
                  <Label>Reject Target</Label>
                  <Select
                    value={phase.rejectTarget || ''}
                    onValueChange={v => onUpdate({ rejectTarget: v || undefined })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select phase..." /></SelectTrigger>
                    <SelectContent>
                      {allPhases.filter(p => p.id !== phase.id).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const KnowledgeDocsTab: FC<SettingsTabProps> = ({ settings, updateSettings }) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generatePath, setGeneratePath] = useState('')

  const { tasks } = useAIAutomation()

  const knownPaths = [...new Set(
    tasks.flatMap(t => t.projectPaths || [])
  )]

  const addDoc = () => {
    const newDoc: AIKnowledgeDoc = {
      id: crypto.randomUUID(),
      title: 'New Document',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      autoGenerated: false
    }
    updateSettings({ knowledgeDocs: [...settings.knowledgeDocs, newDoc] })
    setEditingId(newDoc.id)
  }

  const updateDoc = (id: string, updates: Partial<AIKnowledgeDoc>) => {
    const docs = settings.knowledgeDocs.map(d =>
      d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
    )
    updateSettings({ knowledgeDocs: docs })
  }

  const deleteDoc = (id: string) => {
    updateSettings({ knowledgeDocs: settings.knowledgeDocs.filter(d => d.id !== id) })
    if (editingId === id) setEditingId(null)
  }

  const handleGenerate = () => {
    if (!generatePath) return

    const existing = settings.knowledgeDocs.find(d => d.sourcePath === generatePath)
    if (existing) {
      if (!confirm(`A knowledge doc already exists for "${generatePath.split('/').pop()}". Replace it?`)) {
        return
      }
    }

    // Fire and forget — the IPC handler creates the doc immediately and updates it as generation progresses
    window.electron.aiGenerateKnowledgeDoc(generatePath)
    setGenerateOpen(false)
    setGeneratePath('')
  }

  const editingDoc = settings.knowledgeDocs.find(d => d.id === editingId)

  if (editingDoc) {
    return (
      <div className="space-y-3 mt-4">
        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to list
        </Button>
        <Input
          value={editingDoc.title}
          onChange={e => updateDoc(editingDoc.id, { title: e.target.value })}
          className="text-lg font-semibold"
        />
        {editingDoc.sourcePath && (
          <p className="text-xs text-neutral-500">Source: {editingDoc.sourcePath}</p>
        )}
        <Textarea
          value={editingDoc.content}
          onChange={e => updateDoc(editingDoc.id, { content: e.target.value })}
          placeholder="Write knowledge in markdown. Describe your system architecture, project relationships, tech stacks..."
          rows={20}
          className="font-mono text-sm"
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 mt-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-neutral-400">
          Knowledge documents describe your system. Agents use these as context when planning and working.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
            <Wand2 className="h-4 w-4 mr-1" /> Auto-Generate
          </Button>
          <Button size="sm" onClick={addDoc}>
            <Plus className="h-4 w-4 mr-1" /> Add Doc
          </Button>
        </div>
      </div>

      {generateOpen && (
        <div className="p-4 border border-neutral-700 rounded-md bg-neutral-800/50 space-y-3">
          <h4 className="text-sm font-medium text-white">Generate Knowledge Doc</h4>
          <p className="text-xs text-neutral-400">Select a project to explore. Claude will analyze the codebase and generate a knowledge document.</p>

          {knownPaths.length > 0 && (
            <div>
              <Label className="text-xs">From existing tasks</Label>
              <Select value={generatePath} onValueChange={setGeneratePath}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select a project..." /></SelectTrigger>
                <SelectContent>
                  {knownPaths.map(p => (
                    <SelectItem key={p} value={p}>{p.split('/').pop()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs">Or choose a folder</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={generatePath}
                onChange={e => setGeneratePath(e.target.value)}
                placeholder="/path/to/project"
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                className="px-3 shrink-0"
                onClick={async () => {
                  const selected = await window.electron.aiSelectWorktreeDir()
                  if (selected) setGeneratePath(selected)
                }}
              >
                <Folder className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setGenerateOpen(false); setGeneratePath('') }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={!generatePath}>
              Generate
            </Button>
          </div>
        </div>
      )}

      {settings.knowledgeDocs.length === 0 && !generateOpen ? (
        <div className="text-neutral-600 text-sm py-8 text-center border border-dashed border-neutral-700 rounded">
          No knowledge docs yet. Add one to help agents understand your projects.
        </div>
      ) : (
        <div className="space-y-2">
          {settings.knowledgeDocs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-neutral-800 rounded border border-neutral-700 hover:border-neutral-600 transition-colors">
              <div className="cursor-pointer flex-1" onClick={() => !doc.generatingStatus && setEditingId(doc.id)}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{doc.title}</p>
                  {doc.autoGenerated && !doc.generatingStatus && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300">auto-generated</span>
                  )}
                </div>
                {doc.generatingStatus ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {doc.generatingStatus.startsWith('Failed') ? (
                      <span className="text-xs text-red-400">{doc.generatingStatus}</span>
                    ) : (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-blue-400 flex-shrink-0" />
                        <span className="text-xs text-blue-300 truncate">{doc.generatingStatus}</span>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {doc.sourcePath ? doc.sourcePath : `Updated ${new Date(doc.updatedAt).toLocaleDateString()}`}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id) }}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const GeneralTab: FC<SettingsTabProps> = ({ settings, updateSettings }) => {
  return (
    <div className="space-y-4 mt-4 max-w-md">
      <div>
        <Label>Max Concurrent Agents</Label>
        <p className="text-xs text-neutral-500 mb-1">How many tasks can run agents simultaneously.</p>
        <Input
          type="number"
          value={settings.maxConcurrency}
          onChange={e => updateSettings({ maxConcurrency: Math.max(1, Math.min(5, Number(e.target.value))) })}
          min={1}
          max={5}
          className="w-24"
        />
      </div>
      <div>
        <Label>Default Max Review Cycles</Label>
        <p className="text-xs text-neutral-500 mb-1">How many times the reviewer can send work back before escalating to human review.</p>
        <Input
          type="number"
          value={settings.defaultMaxReviewCycles}
          onChange={e => updateSettings({ defaultMaxReviewCycles: Math.max(1, Math.min(10, Number(e.target.value))) })}
          min={1}
          max={10}
          className="w-24"
        />
      </div>
      <div>
        <Label>Default Git Strategy</Label>
        <p className="text-xs text-neutral-500 mb-1">How the agent manages code changes for new tasks.</p>
        <Select value={settings.defaultGitStrategy === 'none' ? 'none' : 'worktree'} onValueChange={v => updateSettings({ defaultGitStrategy: v as AIGitStrategy })}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="worktree">Worktree</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Default Base Branch</Label>
        <p className="text-xs text-neutral-500 mb-1">Branch to create task branches from. Can be overridden per task.</p>
        <Input
          value={settings.defaultBaseBranch}
          onChange={e => updateSettings({ defaultBaseBranch: e.target.value })}
          placeholder="main"
          className="w-48"
        />
      </div>
      <div>
        <Label>Default Worktree Directory</Label>
        <p className="text-xs text-neutral-500 mb-1">Where git worktrees are created. Leave empty to use app data directory. Can be overridden per task.</p>
        <div className="flex gap-2">
          <Input
            value={settings.defaultWorktreeDir}
            onChange={e => updateSettings({ defaultWorktreeDir: e.target.value })}
            placeholder="Auto (app data directory)"
            className="w-64"
          />
          <Button
            variant="outline"
            size="sm"
            className="px-3 shrink-0"
            onClick={async () => {
              const selected = await window.electron.aiSelectWorktreeDir()
              if (selected) updateSettings({ defaultWorktreeDir: selected })
            }}
          >
            <Folder className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
