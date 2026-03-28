# Task Amendments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to add new requirements (amendments) to existing tasks and send them back into the pipeline at a chosen phase.

**Architecture:** Add `AITaskAmendment` type and `amendments` field to `AITask`. Prompt builder includes amendments section. New `AmendmentForm` shared component (with MentionEditor) used by both an Amendments tab and a header quick-action dialog.

**Tech Stack:** TypeScript, React 19, Radix UI (Dialog, Tabs), existing MentionEditor component, electron-store

---

### Task 1: Add AITaskAmendment type and update AITask

**Files:**
- Modify: `types.d.ts`

**Step 1: Add the AITaskAmendment interface**

Add after the `AIHumanComment` interface (~line 660):

```typescript
interface AITaskAmendment {
  id: string
  text: string
  targetPhase: string
  createdAt: string
}
```

**Step 2: Add amendments field to AITask**

In the `AITask` interface, add after `excludedFiles?: string[]` (~line 622):

```typescript
amendments?: AITaskAmendment[]
```

**Step 3: Commit**

```bash
git add types.d.ts
git commit -m "feat(ai): add AITaskAmendment type to AITask"
```

---

### Task 2: Update prompt builder to include amendments

**Files:**
- Modify: `src/electron/ai-automation/prompt-builder.ts`

**Step 1: Add amendments section to buildPrompt**

In `prompt-builder.ts`, add a new section after the task context section (after `parts.push(taskContext)` at ~line 64) and before the task directory context section:

```typescript
// 5b. Amendments (new requirements added after initial implementation)
if (task.amendments && task.amendments.length > 0) {
  let amendSection = `## Amendments\n\nThe following requirements were added after the initial task was created. Your existing work already addresses the original task description — focus on these additions:\n`
  for (const amendment of task.amendments) {
    const date = new Date(amendment.createdAt).toLocaleDateString()
    amendSection += `\n### Amendment (${date})\n\n${amendment.text}\n`
  }
  parts.push(amendSection)
}
```

**Step 2: Commit**

```bash
git add src/electron/ai-automation/prompt-builder.ts
git commit -m "feat(ai): include amendments in agent prompt"
```

---

### Task 3: Create AmendmentForm shared component

**Files:**
- Create: `src/ui/components/ai-automation/AmendmentForm.tsx`

**Step 1: Create the component**

This component is used both inline (Amendments tab) and inside a Dialog (header button). It contains:
- A `MentionEditor` for the amendment text (with @mention support)
- A `Select` dropdown for picking the target pipeline phase (excluding BACKLOG and DONE)
- A Submit button

```typescript
import { useState, useRef, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MentionEditor, type MentionEditorHandle } from './MentionEditor'
import { Send } from 'lucide-react'

interface AmendmentFormProps {
  pipeline: AIPipelinePhase[]
  onSubmit: (text: string, targetPhase: string) => Promise<void>
  onCancel?: () => void
  /** Optional: projects already on the task, to exclude from mention dropdown */
  excludeProjectPaths?: Set<string>
}

export const AmendmentForm: FC<AmendmentFormProps> = ({ pipeline, onSubmit, onCancel, excludeProjectPaths }) => {
  const editorRef = useRef<MentionEditorHandle>(null)
  const [targetPhase, setTargetPhase] = useState<string>(pipeline[0]?.id || '')
  const [submitting, setSubmitting] = useState(false)

  const phases = pipeline.filter(p => p.id !== 'BACKLOG' && p.id !== 'DONE')

  const handleSubmit = async () => {
    const text = editorRef.current?.getPlainText().trim()
    if (!text || !targetPhase) return
    setSubmitting(true)
    try {
      await onSubmit(text, targetPhase)
      editorRef.current?.clear()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-neutral-400 mb-1 block">New Requirement</label>
        <MentionEditor
          ref={editorRef}
          placeholder="Describe the new requirement... Type @ to tag a project"
          minHeight="80px"
          excludeProjectPaths={excludeProjectPaths}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-400 mb-1 block">Send to Phase</label>
        <Select value={targetPhase} onValueChange={setTargetPhase}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select phase..." />
          </SelectTrigger>
          <SelectContent>
            {phases.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        )}
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          <Send className="h-3 w-3 mr-1" />
          {submitting ? 'Submitting...' : 'Submit Amendment'}
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/ui/components/ai-automation/AmendmentForm.tsx
git commit -m "feat(ai): create AmendmentForm shared component"
```

---

### Task 4: Add Amendments tab to AITaskDetail

**Files:**
- Modify: `src/ui/views/AITaskDetail.tsx`

**Step 1: Add imports**

Add to the imports at the top of the file:

```typescript
import { AmendmentForm } from '@/ui/components/ai-automation/AmendmentForm'
```

Add `FilePlus` to the lucide-react imports.

**Step 2: Create the AmendmentsTab inline component**

Add before the `AITaskDetail` export (after `AttachmentsInline` component, ~line 341):

```typescript
const AmendmentsTab: FC<{ task: AITask; pipeline: AIPipelinePhase[] }> = ({ task, pipeline }) => {
  const { updateTask, moveTaskPhase } = useAIAutomation()
  const [showForm, setShowForm] = useState(false)
  const excludePaths = new Set((task.projects || []).map(p => p.path))

  const handleSubmit = async (text: string, targetPhase: string) => {
    const amendment: AITaskAmendment = {
      id: crypto.randomUUID(),
      text,
      targetPhase,
      createdAt: new Date().toISOString()
    }
    const existing = task.amendments || []
    await updateTask(task.id, { amendments: [...existing, amendment] })
    await moveTaskPhase(task.id, targetPhase)
    setShowForm(false)
  }

  const amendments = task.amendments || []

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-neutral-500 text-xs">
          Add new requirements to this task and send it back into the pipeline.
        </p>
        {!showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <FilePlus className="h-3 w-3 mr-1" /> Add Amendment
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
          <AmendmentForm
            pipeline={pipeline}
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
            excludeProjectPaths={excludePaths}
          />
        </div>
      )}

      {amendments.length === 0 && !showForm ? (
        <div className="text-center py-8 text-neutral-600 text-xs">
          <FilePlus className="h-8 w-8 mx-auto mb-2 text-neutral-700" />
          <p>No amendments yet.</p>
          <p className="mt-1">Use amendments to add new requirements to a completed or in-progress task.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {amendments.map((a, i) => {
            const phaseConf = pipeline.find(p => p.id === a.targetPhase)
            return (
              <div key={a.id} className="rounded-lg border border-neutral-700 bg-neutral-800/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-neutral-500">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">
                    → {phaseConf?.name || a.targetPhase}
                  </span>
                </div>
                <p className="text-sm text-neutral-300 whitespace-pre-wrap">
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
```

**Step 3: Add the Amendments tab trigger and content**

In the `TabsList` section (~line 585), add after the History tab trigger:

```typescript
<TabsTrigger value="amendments" className="relative">
  Amendments
  {(task.amendments?.length || 0) > 0 && (
    <span className="ml-1 text-[10px] min-w-[16px] h-4 px-1 inline-flex items-center justify-center rounded-full bg-blue-900/50 text-blue-300">
      {task.amendments!.length}
    </span>
  )}
</TabsTrigger>
```

Add the tab content after the History `TabsContent` (~line 819):

```typescript
<TabsContent value="amendments" className="flex-1 min-h-0 overflow-y-auto p-4">
  <AmendmentsTab task={task} pipeline={pipeline} />
</TabsContent>
```

**Step 4: Commit**

```bash
git add src/ui/views/AITaskDetail.tsx
git commit -m "feat(ai): add Amendments tab to task detail"
```

---

### Task 5: Add quick-action amendment button in task detail header

**Files:**
- Modify: `src/ui/views/AITaskDetail.tsx`

**Step 1: Add Dialog imports**

Add to imports:

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
```

**Step 2: Add dialog state**

Inside the `AITaskDetail` component, add state:

```typescript
const [showAmendDialog, setShowAmendDialog] = useState(false)
```

**Step 3: Add the amendment handler for the dialog**

```typescript
const handleAmendment = async (text: string, targetPhase: string) => {
  const amendment: AITaskAmendment = {
    id: crypto.randomUUID(),
    text,
    targetPhase,
    createdAt: new Date().toISOString()
  }
  const existing = task.amendments || []
  await updateTask(task.id, { amendments: [...existing, amendment] })
  await moveTaskPhase(task.id, targetPhase)
  setShowAmendDialog(false)
}
```

**Step 4: Add button + dialog in the header**

In the header actions area (~line 499), add before the Edit button:

```typescript
<Dialog open={showAmendDialog} onOpenChange={setShowAmendDialog}>
  <DialogTrigger asChild>
    <Button variant="outline" size="sm">
      <FilePlus className="h-3 w-3 mr-1" /> Amend
    </Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-[500px]">
    <DialogHeader>
      <DialogTitle>Add Amendment</DialogTitle>
    </DialogHeader>
    <AmendmentForm
      pipeline={pipeline}
      onSubmit={handleAmendment}
      onCancel={() => setShowAmendDialog(false)}
      excludeProjectPaths={new Set((task.projects || []).map(p => p.path))}
    />
  </DialogContent>
</Dialog>
```

**Step 5: Commit**

```bash
git add src/ui/views/AITaskDetail.tsx
git commit -m "feat(ai): add quick-action amendment button in task header"
```

---

### Task 6: Update roadmap

**Files:**
- Modify: `docs/AI_KANBAN_ROADMAP.md`

**Step 1: Mark amendment feature as complete in roadmap**

Add a new feature entry (or update existing) marking amendments as implemented.

**Step 2: Commit**

```bash
git add docs/AI_KANBAN_ROADMAP.md
git commit -m "docs: update roadmap with amendments feature"
```
