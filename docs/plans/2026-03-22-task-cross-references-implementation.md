# F46: Task Cross-References Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow tasks to reference other tasks via `#shortId` syntax, with autocomplete in the UI and context injection in agent prompts.

**Architecture:** Extend the existing `MentionEditor` to support a second trigger character (`#` for tasks, alongside `@` for projects). Parse `#shortId` references from description/amendment text on save, store resolved full UUIDs in `linkedTaskIds[]`. Prompt builder appends a lightweight "Related Tasks" section with title, truncated description, phase, and task directory path.

**Tech Stack:** React (contentEditable, existing MentionEditor pattern), TypeScript, Electron IPC

**Design doc:** `docs/plans/2026-03-22-task-cross-references-design.md`

---

### Task 1: Add `linkedTaskIds` to AITask type

**Files:**
- Modify: `types.d.ts:731-763` (AITask interface)

**Step 1: Add the field**

In the `AITask` interface, add after `amendments?`:

```typescript
linkedTaskIds?: string[]
```

**Step 2: Commit**

```bash
git add types.d.ts
git commit -m "feat(F46): add linkedTaskIds field to AITask type"
```

---

### Task 2: Create cross-reference parser utility

**Files:**
- Create: `src/electron/ai-automation/cross-reference-parser.ts`

**Step 1: Write the parser**

```typescript
/**
 * Extract #shortId references from text and resolve to full task UUIDs.
 * Short IDs are the first 8 hex chars of a UUID.
 */
export function parseLinkedTaskIds(
  text: string,
  allTasks: AITask[],
  selfId?: string
): string[] {
  const regex = /#([a-f0-9]{8})\b/g
  const shortIds = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    shortIds.add(match[1])
  }

  const resolved: string[] = []
  for (const shortId of shortIds) {
    const task = allTasks.find(t => t.id.startsWith(shortId) && t.id !== selfId)
    if (task) resolved.push(task.id)
  }
  return resolved
}

/**
 * Extract linked task IDs from a task's description + amendments.
 */
export function extractLinkedTaskIds(
  task: { id: string; description: string; amendments?: AITaskAmendment[] },
  allTasks: AITask[]
): string[] {
  const texts = [task.description]
  if (task.amendments) {
    for (const a of task.amendments) {
      if (!a.hidden) texts.push(a.text)
    }
  }
  const combined = texts.join('\n')
  return parseLinkedTaskIds(combined, allTasks, task.id)
}
```

**Step 2: Commit**

```bash
git add src/electron/ai-automation/cross-reference-parser.ts
git commit -m "feat(F46): cross-reference parser for #shortId syntax"
```

---

### Task 3: Auto-parse linkedTaskIds on task save/update

**Files:**
- Modify: `src/electron/ai-automation/task-manager.ts:30-71` (createTask, updateTask functions)

**Step 1: Import the parser**

Add at top of task-manager.ts:

```typescript
import { extractLinkedTaskIds } from './cross-reference-parser.js'
```

**Step 2: Update createTask**

After building the task object (before `tasks.push(task)`), add:

```typescript
task.linkedTaskIds = extractLinkedTaskIds(task, store.get('aiTasks'))
```

**Step 3: Update updateTask**

After the merge line (`tasks[index] = { ...tasks[index], ...updates, ... }`), add re-parsing logic:

```typescript
// Re-parse linked task IDs when description or amendments change
if (updates.description !== undefined || updates.amendments !== undefined) {
  tasks[index].linkedTaskIds = extractLinkedTaskIds(tasks[index], tasks)
}
```

**Step 4: Commit**

```bash
git add src/electron/ai-automation/task-manager.ts
git commit -m "feat(F46): auto-parse linkedTaskIds on task create/update"
```

---

### Task 4: Add Related Tasks section to prompt builder

**Files:**
- Modify: `src/electron/ai-automation/prompt-builder.ts:75-84` (after amendments section)

**Step 1: Import task getter**

The file already imports `getSettings` from task-manager. Add a new import for getting all tasks:

```typescript
import { getSettings, getTasks } from './task-manager.js'
```

(Verify `getTasks` exists — if not, it's likely `store.get('aiTasks')` accessed via the store import.)

**Step 2: Add Related Tasks section after amendments (after line 84)**

Insert after the amendments block:

```typescript
// 5c. Related tasks (cross-references)
if (task.linkedTaskIds && task.linkedTaskIds.length > 0) {
  const allTasks = getTasks()
  const linkedEntries: string[] = []
  for (const linkedId of task.linkedTaskIds) {
    const linked = allTasks.find(t => t.id === linkedId)
    if (!linked) continue
    const shortId = linked.id.slice(0, 8)
    const truncDesc = linked.description.length > 200
      ? linked.description.slice(0, 200) + '...'
      : linked.description
    const phaseName = linked.currentPhaseName || linked.phase
    let entry = `- #${shortId} — "${linked.title}" [phase: ${phaseName}]\n  ${truncDesc}`
    if (linked.taskDirPath) {
      entry += `\n  Task directory: ${linked.taskDirPath}`
    }
    linkedEntries.push(entry)
  }
  if (linkedEntries.length > 0) {
    parts.push(
      `## Related Tasks\n\nThe following tasks are related to this work. If you need more context about a related task, use a subagent to explore its task directory — do not read everything into your main context.\n\n${linkedEntries.join('\n\n')}`
    )
  }
}
```

**Step 3: Commit**

```bash
git add src/electron/ai-automation/prompt-builder.ts
git commit -m "feat(F46): inject related tasks section into agent prompts"
```

---

### Task 5: Extend MentionEditor to support `#` task references

**Files:**
- Modify: `src/ui/components/ai-automation/MentionEditor.tsx`

This is the most complex task. The MentionEditor currently handles `@` for projects. We need to add `#` for tasks.

**Step 1: Add new props and types**

Add to `MentionEditorProps`:

```typescript
onTaskTagged?: (taskId: string, title: string) => void
onTaskRemoved?: (taskId: string) => void
/** Task IDs to exclude from the task dropdown (e.g., self) */
excludeTaskIds?: Set<string>
/** Board ID to filter tasks from */
boardId?: string
```

**Step 2: Add task-related state**

Add alongside existing state:

```typescript
const [allTasks, setAllTasks] = useState<AITask[]>([])
const [showTaskMention, setShowTaskMention] = useState(false)
const [taskMentionFilter, setTaskMentionFilter] = useState('')
const [taskMentionIndex, setTaskMentionIndex] = useState(0)
```

Load tasks:

```typescript
useEffect(() => {
  window.electron.aiGetTasks().then(tasks => {
    setAllTasks(boardId ? tasks.filter(t => t.boardId === boardId) : tasks)
  })
}, [boardId])
```

**Step 3: Add task chip creation**

Add a new constant and function for task chips:

```typescript
const TASK_MENTION_ATTR = 'data-task-id'

function createTaskChipElement(taskId: string, title: string): HTMLSpanElement {
  const chip = document.createElement('span')
  chip.setAttribute(TASK_MENTION_ATTR, taskId)
  chip.setAttribute('contenteditable', 'false')
  chip.className = 'inline-flex items-center gap-0.5 px-1.5 py-0 rounded border text-xs mx-0.5 align-baseline cursor-default select-none'
  chip.style.background = 'var(--ai-warning-subtle, #fef3c7)'
  chip.style.borderColor = 'var(--ai-warning, #f59e0b)'
  chip.style.color = 'var(--ai-warning, #d97706)'
  chip.textContent = title
  return chip
}
```

**Step 4: Add filtered tasks**

```typescript
const filteredTasks = allTasks.filter(t => {
  if (excludeTaskIds?.has(t.id)) return false
  const shortId = t.id.slice(0, 8)
  const query = taskMentionFilter.toLowerCase()
  return t.title.toLowerCase().includes(query) || shortId.includes(query)
})
```

**Step 5: Update `getPlainText`**

In the `getPlainText` function, add handling for task chips:

```typescript
if (node.hasAttribute(TASK_MENTION_ATTR)) {
  const taskId = node.getAttribute(TASK_MENTION_ATTR) || ''
  text += `#${taskId.slice(0, 8)}`
}
```

This goes right after the existing `if (node.hasAttribute(MENTION_ATTR))` block, as an `else if`.

**Step 6: Update `hydrateText`**

Extend `hydrateText` to accept a task map and reconstruct `#shortId` as chips:

Add a new parameter to the `MentionEditorHandle`:

```typescript
hydrateText: (text: string, labels: Set<string>, taskMap?: Map<string, string>) => void
```

In the hydrate logic, after processing `@` mentions, also process `#` references:

Handle `#` the same way as `@` — find `#`, check if followed by a short ID that matches a task in `taskMap`, insert chip if matched.

**Step 7: Add `insertTaskMention` function**

Similar to `insertMention` but for tasks:

```typescript
const insertTaskMention = (task: AITask) => {
  const editor = editorRef.current
  if (!editor) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  const range = sel.getRangeAt(0)
  const textNode = range.startContainer
  if (textNode.nodeType !== Node.TEXT_NODE) return

  const text = textNode.textContent || ''
  const cursorOffset = range.startOffset
  const textBefore = text.slice(0, cursorOffset)
  const hashIndex = textBefore.lastIndexOf('#')
  if (hashIndex === -1) return

  const beforeText = text.slice(0, hashIndex)
  const afterText = text.slice(cursorOffset)
  const chip = createTaskChipElement(task.id, task.title)
  const parent = textNode.parentNode!

  const beforeNode = document.createTextNode(beforeText)
  const afterNode = document.createTextNode('\u00A0' + afterText)

  parent.insertBefore(beforeNode, textNode)
  parent.insertBefore(chip, textNode)
  parent.insertBefore(afterNode, textNode)
  parent.removeChild(textNode)

  if (afterNode.textContent && afterNode.textContent.length > 0) {
    const newSel = window.getSelection()
    if (newSel) {
      const newRange = document.createRange()
      newRange.setStart(afterNode, 1)
      newRange.collapse(true)
      newSel.removeAllRanges()
      newSel.addRange(newRange)
    }
  }

  setShowTaskMention(false)
  setTaskMentionFilter('')
  onTaskTagged?.(task.id, task.title)
  setTimeout(() => editor.focus(), 0)
}
```

**Step 8: Update `handleInput` to detect `#`**

After the existing `@` detection block, add `#` detection:

```typescript
const hashIndex = textBefore.lastIndexOf('#')
if (hashIndex !== -1) {
  const query = textBefore.slice(hashIndex + 1)
  const charBeforeHash = hashIndex > 0 ? text[hashIndex - 1] : ' '
  if ((charBeforeHash === ' ' || charBeforeHash === '\u00A0' || charBeforeHash === '\n' || hashIndex === 0) && !query.includes(' ')) {
    setShowTaskMention(true)
    setTaskMentionFilter(query)
    setTaskMentionIndex(0)
    setShowMention(false)  // close project dropdown if open
    return
  }
}
setShowTaskMention(false)
```

**Step 9: Update `handleKeyDown` for task dropdown**

Add a block before the existing project mention key handling:

```typescript
if (showTaskMention && filteredTasks.length > 0) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    setTaskMentionIndex(prev => (prev + 1) % filteredTasks.length)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    setTaskMentionIndex(prev => (prev - 1 + filteredTasks.length) % filteredTasks.length)
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    insertTaskMention(filteredTasks[taskMentionIndex])
  } else if (e.key === 'Escape') {
    e.preventDefault()
    setShowTaskMention(false)
  }
  return
}
```

**Step 10: Update backspace handling for task chips**

In the backspace handler, add checks for `TASK_MENTION_ATTR` alongside `MENTION_ATTR`:

```typescript
if (prev instanceof HTMLElement && prev.hasAttribute(TASK_MENTION_ATTR)) {
  e.preventDefault()
  const taskId = prev.getAttribute(TASK_MENTION_ATTR) || ''
  prev.remove()
  onTaskRemoved?.(taskId)
  return
}
```

**Step 11: Add task dropdown UI**

After the existing project dropdown `{showMention && ...}`, add:

```tsx
{showTaskMention && filteredTasks.length > 0 && (
  <div
    ref={taskMenuRef}
    className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto rounded-md border shadow-lg"
    style={{ borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-1)' }}
  >
    {filteredTasks.map((task, i) => (
      <button
        key={task.id}
        onMouseDown={e => { e.preventDefault(); insertTaskMention(task) }}
        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
        style={{
          background: i === taskMentionIndex ? 'var(--ai-surface-3)' : undefined,
          color: i === taskMentionIndex ? 'var(--ai-text-primary)' : 'var(--ai-text-secondary)',
        }}
      >
        <Hash className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
        <div className="min-w-0">
          <p className="truncate font-medium">{task.title}</p>
          <p className="truncate text-[11px]" style={{ color: 'var(--ai-text-tertiary)' }}>
            #{task.id.slice(0, 8)} · {task.currentPhaseName || task.phase}
          </p>
        </div>
      </button>
    ))}
  </div>
)}
```

Import `Hash` from lucide-react alongside `FolderOpen`.

**Step 12: Add taskMenuRef and scroll effect**

```typescript
const taskMenuRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (!showTaskMention || !taskMenuRef.current) return
  const activeItem = taskMenuRef.current.children[taskMentionIndex] as HTMLElement | undefined
  if (activeItem) activeItem.scrollIntoView({ block: 'nearest' })
}, [taskMentionIndex, showTaskMention])
```

**Step 13: Commit**

```bash
git add src/ui/components/ai-automation/MentionEditor.tsx
git commit -m "feat(F46): extend MentionEditor with # task reference autocomplete"
```

---

### Task 6: Render task references as clickable chips in TaskDetailsCard

**Files:**
- Modify: `src/ui/components/ai-automation/TaskDetailsCard.tsx`

**Step 1: Examine the file**

Read `TaskDetailsCard.tsx` to understand how description text is currently displayed.

**Step 2: Add task reference rendering**

Where the description is rendered as plain text (non-edit mode), replace `#xxxxxxxx` patterns with clickable styled spans:

```typescript
function renderDescriptionWithRefs(
  text: string,
  allTasks: AITask[],
  onTaskClick: (taskId: string) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /#([a-f0-9]{8})\b/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const shortId = match[1]
    const linked = allTasks.find(t => t.id.startsWith(shortId))
    if (linked) {
      parts.push(
        <button
          key={match.index}
          onClick={() => onTaskClick(linked.id)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded border text-xs mx-0.5 align-baseline cursor-pointer hover:opacity-80 transition-opacity"
          style={{
            background: 'var(--ai-warning-subtle, #fef3c7)',
            borderColor: 'var(--ai-warning, #f59e0b)',
            color: 'var(--ai-warning, #d97706)',
          }}
          title={`${linked.title} · ${linked.currentPhaseName || linked.phase}`}
        >
          #{shortId} {linked.title}
        </button>
      )
    } else {
      parts.push(match[0])
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}
```

Use this function where the description is rendered in read mode, passing all tasks from context and a navigation callback.

**Step 3: Commit**

```bash
git add src/ui/components/ai-automation/TaskDetailsCard.tsx
git commit -m "feat(F46): render #shortId as clickable task chips in task detail"
```

---

### Task 7: Wire up navigation — clicking a task reference opens that task

**Files:**
- Modify: `src/ui/views/AITaskDetail.tsx`
- Possibly: `src/ui/contexts/ai-automation.tsx`

**Step 1: Examine how task navigation works**

Look at how `selectTask(taskId)` works in the AI automation context — this is likely the function to call when a task chip is clicked.

**Step 2: Pass navigation callback to TaskDetailsCard**

Pass a callback like `onTaskClick={(taskId) => selectTask(taskId)}` to TaskDetailsCard.

**Step 3: Commit**

```bash
git add src/ui/views/AITaskDetail.tsx src/ui/components/ai-automation/TaskDetailsCard.tsx
git commit -m "feat(F46): clicking task reference navigates to linked task"
```

---

### Task 8: Pass boardId and excludeTaskIds to MentionEditor in forms

**Files:**
- Modify: `src/ui/components/ai-automation/NewTaskDialog.tsx` — pass boardId, exclude nothing (new task has no ID yet)
- Modify: `src/ui/components/ai-automation/AmendmentForm.tsx` — pass boardId and current task ID as excluded
- Modify: `src/ui/views/AITaskDetail.tsx` — pass boardId and current task ID when editing description

**Step 1: Update NewTaskDialog**

Pass `boardId={selectedBoard}` and `excludeTaskIds={new Set()}` to the MentionEditor.

**Step 2: Update AmendmentForm**

Accept `taskId` and `boardId` as new props, pass `excludeTaskIds={new Set([taskId])}` and `boardId` to MentionEditor.

**Step 3: Update AITaskDetail edit mode**

When editing description, pass `boardId={task.boardId}` and `excludeTaskIds={new Set([task.id])}`.

**Step 4: Commit**

```bash
git add src/ui/components/ai-automation/NewTaskDialog.tsx src/ui/components/ai-automation/AmendmentForm.tsx src/ui/views/AITaskDetail.tsx
git commit -m "feat(F46): wire boardId and excludeTaskIds through all editor forms"
```

---

### Task 9: Manual verification

Since this project has no test suite, verify manually:

1. Create Task A with some description
2. Create Task B, type `#` in description — verify Task A appears in dropdown
3. Select Task A from dropdown — verify chip appears
4. Save Task B — verify `linkedTaskIds` contains Task A's UUID
5. Open Task B detail — verify `#shortId TaskA Title` renders as clickable chip
6. Click the chip — verify navigation to Task A
7. Start Task B in a pipeline phase — verify the agent prompt contains the "Related Tasks" section with Task A's info
8. Edit Task B description, remove the reference — verify `linkedTaskIds` updates
9. Add an amendment to Task B with a `#` reference — verify it gets parsed
