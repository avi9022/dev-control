import { useState, useRef, useEffect, useCallback, type FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { FolderOpen, X, Paperclip, GitBranch, Eye, Hash } from 'lucide-react'
import { GIT_STRATEGY, SHORT_ID_LENGTH } from '@/shared/constants'

const DEFAULT_BASE_BRANCH = 'main'

interface NewTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MENTION_ATTR = 'data-mention-id'
const TASK_MENTION_ATTR = 'data-task-id'

function getPlainText(el: HTMLElement): string {
  let text = ''
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    } else if (node instanceof HTMLElement) {
      if (node.hasAttribute(MENTION_ATTR)) {
        text += `@${node.textContent || ''}`
      } else if (node.hasAttribute(TASK_MENTION_ATTR)) {
        const taskId = node.getAttribute(TASK_MENTION_ATTR) || ''
        text += `#${taskId.slice(0, SHORT_ID_LENGTH)}`
      } else {
        text += getPlainText(node)
      }
    }
  }
  return text
}

function placeCursorAfter(node: Node) {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function clearEditor(el: HTMLElement) {
  while (el.firstChild) {
    el.removeChild(el.firstChild)
  }
}

export const NewTaskDialog: FC<NewTaskDialogProps> = ({ open, onOpenChange }) => {
  const { createTask, settings } = useAIAutomation()
  const [title, setTitle] = useState('')
  const [taggedProjects, setTaggedProjects] = useState<DirectorySettings[]>([])
  const [projectConfigs, setProjectConfigs] = useState<Record<string, { gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>>({})
  const [pendingFiles, setPendingFiles] = useState<{ name: string; path: string }[]>([])

  // @-mention state
  const [directories, setDirectories] = useState<DirectorySettings[]>([])
  const [showMention, setShowMention] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const editorRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // #-task mention state
  const [allTasks, setAllTasks] = useState<AITask[]>([])
  const [showTaskMention, setShowTaskMention] = useState(false)
  const [taskMentionFilter, setTaskMentionFilter] = useState('')
  const [taskMentionIndex, setTaskMentionIndex] = useState(0)
  const taskMenuRef = useRef<HTMLDivElement>(null)

  // Auto-scroll dropdown to keep highlighted item visible
  useEffect(() => {
    if (!showMention || !menuRef.current) return
    const activeItem = menuRef.current.children[mentionIndex]
    if (activeItem instanceof HTMLElement) {
      activeItem.scrollIntoView({ block: 'nearest' })
    }
  }, [mentionIndex, showMention])

  // Auto-scroll task dropdown
  useEffect(() => {
    if (!showTaskMention || !taskMenuRef.current) return
    const activeItem = taskMenuRef.current.children[taskMentionIndex]
    if (activeItem instanceof HTMLElement) activeItem.scrollIntoView({ block: 'nearest' })
  }, [taskMentionIndex, showTaskMention])

  useEffect(() => {
    if (open) {
      window.electron.getDirectories().then(setDirectories)
      window.electron.aiGetTasks().then(tasks => {
        setAllTasks(settings?.activeBoardId ? tasks.filter(t => t.boardId === settings.activeBoardId) : tasks)
      })
    }
  }, [open, settings?.activeBoardId])

  const filteredDirs = directories.filter(d => {
    const label = d.customLabel || d.name
    return label.toLowerCase().includes(mentionFilter.toLowerCase()) &&
      !taggedProjects.some(tp => tp.id === d.id)
  })

  const filteredTasks = allTasks.filter(t => {
    const shortId = t.id.slice(0, SHORT_ID_LENGTH)
    const query = taskMentionFilter.toLowerCase()
    return t.title.toLowerCase().includes(query) || shortId.includes(query)
  })

  // Sync taggedProjects from chips currently in the editor
  const syncTagsFromEditor = useCallback(() => {
    if (!editorRef.current) return
    const chips = editorRef.current.querySelectorAll(`[${MENTION_ATTR}]`)
    const chipIds = new Set<string>()
    chips.forEach(chip => chipIds.add(chip.getAttribute(MENTION_ATTR) || ''))
    setTaggedProjects(prev => prev.filter(p => chipIds.has(p.id)))
  }, [])

  const createChipElement = (dir: DirectorySettings): HTMLSpanElement => {
    const chip = document.createElement('span')
    chip.setAttribute(MENTION_ATTR, dir.id)
    chip.setAttribute('contenteditable', 'false')
    chip.className = 'inline-flex items-center gap-0.5 px-1.5 py-0 rounded border text-xs mx-0.5 align-baseline cursor-default select-none'
    chip.style.background = 'var(--ai-accent-subtle)'
    chip.style.borderColor = 'var(--ai-accent)'
    chip.style.color = 'var(--ai-accent)'
    chip.textContent = dir.customLabel || dir.name
    return chip
  }

  const createTaskChipElement = (taskId: string, taskTitle: string): HTMLSpanElement => {
    const chip = document.createElement('span')
    chip.setAttribute(TASK_MENTION_ATTR, taskId)
    chip.setAttribute('contenteditable', 'false')
    chip.className = 'inline-flex items-center gap-0.5 px-1.5 py-0 rounded border text-xs mx-0.5 align-baseline cursor-default select-none'
    chip.style.background = 'var(--ai-warning-subtle)'
    chip.style.borderColor = 'var(--ai-warning)'
    chip.style.color = 'var(--ai-warning)'
    chip.textContent = taskTitle
    return chip
  }

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
    } else {
      placeCursorAfter(chip)
    }

    setShowTaskMention(false)
    setTaskMentionFilter('')
    setTimeout(() => editor.focus(), 0)
  }

  const insertMention = (dir: DirectorySettings) => {
    const editor = editorRef.current
    if (!editor) return

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    // Find the @ character and text after it to replace
    const range = sel.getRangeAt(0)
    const textNode = range.startContainer
    if (textNode.nodeType !== Node.TEXT_NODE) return

    const text = textNode.textContent || ''
    const cursorOffset = range.startOffset
    const textBefore = text.slice(0, cursorOffset)
    const atIndex = textBefore.lastIndexOf('@')
    if (atIndex === -1) return

    // Split the text node: before @, chip, after cursor
    const beforeText = text.slice(0, atIndex)
    const afterText = text.slice(cursorOffset)

    const chip = createChipElement(dir)
    const parent = textNode.parentNode!

    // Replace text node with: beforeText + chip + space + afterText
    const beforeNode = document.createTextNode(beforeText)
    const afterNode = document.createTextNode('\u00A0' + afterText) // nbsp + rest

    parent.insertBefore(beforeNode, textNode)
    parent.insertBefore(chip, textNode)
    parent.insertBefore(afterNode, textNode)
    parent.removeChild(textNode)

    // Place cursor after the nbsp
    if (afterNode.textContent && afterNode.textContent.length > 0) {
      const newSel = window.getSelection()
      if (newSel) {
        const newRange = document.createRange()
        newRange.setStart(afterNode, 1) // after the nbsp
        newRange.collapse(true)
        newSel.removeAllRanges()
        newSel.addRange(newRange)
      }
    } else {
      placeCursorAfter(chip)
    }

    setShowMention(false)
    setMentionFilter('')

    if (!taggedProjects.some(tp => tp.id === dir.id)) {
      setTaggedProjects(prev => [...prev, dir])
      setProjectConfigs(prev => ({
        ...prev,
        [dir.id]: {
          gitStrategy: settings?.defaultGitStrategy === GIT_STRATEGY.NONE ? GIT_STRATEGY.NONE : GIT_STRATEGY.WORKTREE,
          branchName: '',
          baseBranch: settings?.defaultBaseBranch ?? DEFAULT_BASE_BRANCH
        }
      }))
    }

    setTimeout(() => editor.focus(), 0)
  }

  const removeTaggedProject = (id: string) => {
    // Remove chip from editor
    if (editorRef.current) {
      const chip = editorRef.current.querySelector(`[${MENTION_ATTR}="${id}"]`)
      if (chip) chip.remove()
    }
    setTaggedProjects(prev => prev.filter(p => p.id !== id))
    setProjectConfigs(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleEditorInput = () => {
    const editor = editorRef.current
    if (!editor) return

    // Sync tags (detect deleted chips)
    syncTagsFromEditor()

    // Check for @ mention trigger
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    const textNode = range.startContainer
    if (textNode.nodeType !== Node.TEXT_NODE) {
      setShowMention(false)
      return
    }

    const text = textNode.textContent || ''
    const cursorOffset = range.startOffset
    const textBefore = text.slice(0, cursorOffset)

    // Check for @ project mention
    const atIndex = textBefore.lastIndexOf('@')
    if (atIndex !== -1) {
      const query = textBefore.slice(atIndex + 1)
      const charBeforeAt = atIndex > 0 ? text[atIndex - 1] : ' '
      if ((charBeforeAt === ' ' || charBeforeAt === '\u00A0' || charBeforeAt === '\n' || atIndex === 0) && !query.includes(' ')) {
        setShowMention(true)
        setMentionFilter(query)
        setMentionIndex(0)
        setShowTaskMention(false)
        return
      }
    }

    // Check for # task mention
    const hashIndex = textBefore.lastIndexOf('#')
    if (hashIndex !== -1) {
      const query = textBefore.slice(hashIndex + 1)
      const charBeforeHash = hashIndex > 0 ? text[hashIndex - 1] : ' '
      if ((charBeforeHash === ' ' || charBeforeHash === '\u00A0' || charBeforeHash === '\n' || hashIndex === 0) && !query.includes(' ')) {
        setShowTaskMention(true)
        setTaskMentionFilter(query)
        setTaskMentionIndex(0)
        setShowMention(false)
        return
      }
    }

    setShowMention(false)
    setShowTaskMention(false)
  }

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Task mention keyboard nav
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

    // Project mention keyboard nav
    if (showMention && filteredDirs.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex(prev => (prev + 1) % filteredDirs.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex(prev => (prev - 1 + filteredDirs.length) % filteredDirs.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredDirs[mentionIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowMention(false)
      }
      return
    }

    // Handle backspace into a chip — delete the whole chip
    if (e.key === 'Backspace') {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return

      const range = sel.getRangeAt(0)
      if (!range.collapsed) return

      const node = range.startContainer
      const offset = range.startOffset

      // If cursor is at start of a text node, check if previous sibling is a chip
      if (node.nodeType === Node.TEXT_NODE && offset === 0) {
        const prev = node.previousSibling
        if (prev instanceof HTMLElement && prev.hasAttribute(MENTION_ATTR)) {
          e.preventDefault()
          prev.remove()
          syncTagsFromEditor()
          return
        }
        if (prev instanceof HTMLElement && prev.hasAttribute(TASK_MENTION_ATTR)) {
          e.preventDefault()
          prev.remove()
          return
        }
      }

      // If cursor is in the editor div itself, check child at offset
      if (node === editorRef.current && offset > 0) {
        const prev = node.childNodes[offset - 1]
        if (prev instanceof HTMLElement && prev.hasAttribute(MENTION_ATTR)) {
          e.preventDefault()
          prev.remove()
          syncTagsFromEditor()
          return
        }
        if (prev instanceof HTMLElement && prev.hasAttribute(TASK_MENTION_ATTR)) {
          e.preventDefault()
          prev.remove()
          return
        }
      }
    }
  }

  // Prevent pasting HTML — only allow plain text
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const getDescription = (): string => {
    if (!editorRef.current) return ''
    return getPlainText(editorRef.current).trim()
  }

  const updateProjectConfig = (id: string, updates: Partial<{ gitStrategy: AIGitStrategy; branchName: string; baseBranch: string }>) => {
    setProjectConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }))
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    const description = getDescription()
    const projects: AITaskProject[] = taggedProjects.map(p => {
      const config = projectConfigs[p.id] || { gitStrategy: GIT_STRATEGY.WORKTREE, branchName: '', baseBranch: DEFAULT_BASE_BRANCH }
      return {
        path: p.path,
        label: p.customLabel || p.name,
        gitStrategy: config.gitStrategy,
        ...(config.gitStrategy === GIT_STRATEGY.WORKTREE ? {
          baseBranch: config.baseBranch.trim() || DEFAULT_BASE_BRANCH,
          customBranchName: config.branchName.trim() || undefined
        } : {})
      }
    })
    const task = await createTask(title.trim(), description, projects, settings?.activeBoardId)
    if (pendingFiles.length > 0) {
      await window.electron.aiAttachTaskFiles(task.id, pendingFiles.map(f => f.path))
    }
    setTitle('')
    if (editorRef.current) clearEditor(editorRef.current)
    setTaggedProjects([])
    setProjectConfigs({})
    setPendingFiles([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`!max-w-[95vw] h-[85vh] flex flex-col`} style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title"
              className="mt-1"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleCreate() }}
            />
          </div>
          <div className="relative">
            <Label>Description</Label>
            <div
              ref={editorRef}
              contentEditable
              onInput={handleEditorInput}
              onKeyDown={handleEditorKeyDown}
              onPaste={handlePaste}
              data-placeholder="Describe what needs to be done... Type @ to tag a project, # to reference a task"
              className="mt-1 w-full min-h-[100px] rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:pointer-events-none"
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-2)', color: 'var(--ai-text-primary)', '--tw-ring-color': 'var(--ai-border)' } as React.CSSProperties}
              data-empty-color="var(--ai-text-tertiary)"
            />
            {/* #-task mention dropdown */}
            {showTaskMention && filteredTasks.length > 0 && (
              <div
                ref={taskMenuRef}
                className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto rounded-md border shadow-lg"
                style={{ borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-2)' }}
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
                        #{task.id.slice(0, SHORT_ID_LENGTH)} · {task.currentPhaseName || task.phase}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {/* @-mention dropdown */}
            {showMention && filteredDirs.length > 0 && (
              <div
                ref={menuRef}
                className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto rounded-md border shadow-lg"
                style={{ borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-2)' }}
              >
                {filteredDirs.map((dir, i) => (
                  <button
                    key={dir.id}
                    onMouseDown={e => { e.preventDefault(); insertMention(dir) }}
                    className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                    style={{
                      background: i === mentionIndex ? 'var(--ai-surface-3)' : undefined,
                      color: i === mentionIndex ? 'var(--ai-text-primary)' : 'var(--ai-text-secondary)',
                    }}
                  >
                    <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{dir.customLabel || dir.name}</p>
                      <p className="truncate text-[11px]" style={{ color: 'var(--ai-text-tertiary)' }}>{dir.path}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Tagged projects with per-project config */}
          {taggedProjects.length > 0 && (
            <div>
              <Label className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>Project Workspaces</Label>
              <p className="text-[11px] mt-0.5 mb-1.5" style={{ color: 'var(--ai-text-tertiary)' }}>
                Projects set to &quot;Worktree&quot; get an isolated git branch for changes. &quot;Read Only&quot; projects can be referenced but not modified.
              </p>
              <div className="space-y-2">
                {taggedProjects.map(p => {
                  const config = projectConfigs[p.id] || { gitStrategy: GIT_STRATEGY.WORKTREE, branchName: '', baseBranch: DEFAULT_BASE_BRANCH }
                  return (
                    <div key={p.id} className="rounded-md border p-2.5" style={{ borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-2)' }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-accent)' }} />
                            <span className="text-sm truncate" style={{ color: 'var(--ai-accent)' }}>{p.customLabel || p.name}</span>
                          </div>
                          <p className="text-[11px] truncate ml-5" style={{ color: 'var(--ai-text-tertiary)' }}>{p.path}</p>
                        </div>
                        <button onClick={() => removeTaggedProject(p.id)} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--ai-text-tertiary)' }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-end gap-2">
                          <div className="flex-shrink-0">
                            <span className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>Strategy</span>
                            <Select value={config.gitStrategy} onValueChange={v => {
                              if (v === GIT_STRATEGY.WORKTREE || v === GIT_STRATEGY.NONE) {
                                updateProjectConfig(p.id, { gitStrategy: v })
                              }
                            }}>
                              <SelectTrigger className="h-7 w-[130px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={GIT_STRATEGY.WORKTREE}>
                                  <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> Worktree</span>
                                </SelectItem>
                                <SelectItem value={GIT_STRATEGY.NONE}>
                                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Read Only</span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {config.gitStrategy === GIT_STRATEGY.WORKTREE && (
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>Base Branch</span>
                              <Input
                                value={config.baseBranch}
                                onChange={e => updateProjectConfig(p.id, { baseBranch: e.target.value })}
                                placeholder="main"
                                className="h-7 text-xs"
                              />
                            </div>
                          )}
                          {config.gitStrategy === GIT_STRATEGY.NONE && (
                            <span className="text-[11px] italic" style={{ color: 'var(--ai-text-tertiary)' }}>Agent can read but not modify this project</span>
                          )}
                        </div>
                        {config.gitStrategy === GIT_STRATEGY.WORKTREE && (
                          <div>
                            <span className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--ai-text-tertiary)' }}>Branch Name</span>
                            <Input
                              value={config.branchName}
                              onChange={e => updateProjectConfig(p.id, { branchName: e.target.value })}
                              placeholder="Auto-generated from task title"
                              className="h-7 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {/* Attachments */}
          <div>
            <Label>Attachments <span className="font-normal" style={{ color: 'var(--ai-text-tertiary)' }}>(optional)</span></Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {pendingFiles.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs"
                  style={{ background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)', color: 'var(--ai-text-secondary)' }}
                >
                  <Paperclip className="h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
                  {f.name}
                  <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} style={{ color: 'var(--ai-pink)' }}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={async () => {
                  const selected = await window.electron.aiSelectFiles()
                  if (selected) {
                    const newFiles = selected
                      .filter(p => !pendingFiles.some(f => f.path === p))
                      .map(p => ({ name: p.split('/').pop() || p, path: p }))
                    setPendingFiles(prev => [...prev, ...newFiles])
                  }
                }}
              >
                <Paperclip className="h-3 w-3 mr-1" /> Add Files
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
