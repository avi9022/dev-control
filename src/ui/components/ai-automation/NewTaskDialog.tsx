import { useState, useRef, useEffect, type FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { FolderOpen, X } from 'lucide-react'

interface NewTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const NewTaskDialog: FC<NewTaskDialogProps> = ({ open, onOpenChange }) => {
  const { createTask, settings } = useAIAutomation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [gitStrategy, setGitStrategy] = useState<AIGitStrategy>(settings?.defaultGitStrategy === 'none' ? 'none' : 'worktree')
  const [baseBranch, setBaseBranch] = useState(settings?.defaultBaseBranch ?? 'main')
  const [customBranchName, setCustomBranchName] = useState('')
  const [taggedProjects, setTaggedProjects] = useState<DirectorySettings[]>([])

  // @-mention state
  const [directories, setDirectories] = useState<DirectorySettings[]>([])
  const [showMention, setShowMention] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionStartPos, setMentionStartPos] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      window.electron.getDirectories().then(setDirectories)
      // Sync defaults from settings when dialog opens
      if (settings) {
        setGitStrategy(settings.defaultGitStrategy === 'none' ? 'none' : 'worktree')
        setBaseBranch(settings.defaultBaseBranch)
      }
    }
  }, [open, settings])

  const filteredDirs = directories.filter(d => {
    const label = d.customLabel || d.name
    return label.toLowerCase().includes(mentionFilter.toLowerCase()) &&
      !taggedProjects.some(tp => tp.id === d.id)
  })

  // Scan text for @mentions and auto-tag matching projects
  const autoTagFromText = (text: string) => {
    const mentions: string[] = []
    const re = /@([^\n@]+?)(?=\s+\w|$|\n|,)/g
    let m = re.exec(text) // eslint-disable-line -- RegExp.exec, not child_process
    while (m !== null) {
      mentions.push(m[1].trim().toLowerCase())
      m = re.exec(text)
    }

    for (const mentionText of mentions) {
      if (!mentionText) continue
      const matched = directories.find(d => {
        const label = (d.customLabel || d.name).toLowerCase()
        return label === mentionText || label.includes(mentionText) || mentionText.includes(label)
      })
      if (matched && !taggedProjects.some(tp => tp.id === matched.id)) {
        setTaggedProjects(prev =>
          prev.some(tp => tp.id === matched.id) ? prev : [...prev, matched]
        )
      }
    }
  }

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart
    setDescription(value)

    // Auto-tag any @mentions found in the full text
    autoTagFromText(value)

    // Check if we just typed @ or are continuing a mention query (for dropdown)
    const textBeforeCursor = value.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
      // Only show menu if @ is at start or preceded by whitespace, and no space in the query
      const charBeforeAt = lastAtIndex > 0 ? value[lastAtIndex - 1] : ' '
      if ((charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) && !textAfterAt.includes(' ')) {
        setShowMention(true)
        setMentionFilter(textAfterAt)
        setMentionStartPos(lastAtIndex)
        setMentionIndex(0)
        return
      }
    }

    setShowMention(false)
  }

  const insertMention = (dir: DirectorySettings) => {
    const label = dir.customLabel || dir.name
    const before = description.slice(0, mentionStartPos)
    const after = description.slice(textareaRef.current?.selectionStart ?? mentionStartPos)
    setDescription(`${before}@${label}${after} `)
    setShowMention(false)
    setMentionFilter('')

    if (!taggedProjects.some(tp => tp.id === dir.id)) {
      setTaggedProjects(prev => [...prev, dir])
    }

    // Refocus textarea
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const removeTaggedProject = (id: string) => {
    setTaggedProjects(prev => prev.filter(p => p.id !== id))
  }

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMention || filteredDirs.length === 0) return

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
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    const projectPaths = taggedProjects.map(p => p.path)
    const branch = gitStrategy === 'worktree' ? baseBranch.trim() || undefined : undefined
    const branchName = gitStrategy === 'worktree' ? customBranchName.trim() || undefined : undefined
    await createTask(title.trim(), description.trim(), gitStrategy, projectPaths.length > 0 ? projectPaths : undefined, branch, branchName)
    setTitle('')
    setDescription('')
    setCustomBranchName('')
    setTaggedProjects([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
            <textarea
              ref={textareaRef}
              value={description}
              onChange={handleDescriptionChange}
              onKeyDown={handleDescriptionKeyDown}
              placeholder="Describe what needs to be done... Type @ to tag a project"
              className="mt-1 w-full min-h-[100px] rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-y"
              rows={4}
            />
            {/* @-mention dropdown */}
            {showMention && filteredDirs.length > 0 && (
              <div
                ref={menuRef}
                className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto rounded-md border border-neutral-700 bg-neutral-800 shadow-lg"
              >
                {filteredDirs.map((dir, i) => (
                  <button
                    key={dir.id}
                    onClick={() => insertMention(dir)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                      i === mentionIndex ? 'bg-neutral-700 text-white' : 'text-neutral-300 hover:bg-neutral-700/50'
                    }`}
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-neutral-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{dir.customLabel || dir.name}</p>
                      <p className="truncate text-[11px] text-neutral-500">{dir.path}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Tagged projects */}
          {taggedProjects.length > 0 && (
            <div>
              <Label className="text-neutral-400 text-xs">Tagged Projects</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {taggedProjects.map(p => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/50 text-xs text-blue-300"
                  >
                    <FolderOpen className="h-3 w-3" />
                    {p.customLabel || p.name}
                    <button onClick={() => removeTaggedProject(p.id)} className="hover:text-white">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label>Git Strategy</Label>
            <Select value={gitStrategy} onValueChange={(v) => setGitStrategy(v as AIGitStrategy)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="worktree">Worktree</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {gitStrategy === 'worktree' && (
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Branch Name <span className="text-neutral-500 font-normal">(optional)</span></Label>
                <Input
                  value={customBranchName}
                  onChange={e => setCustomBranchName(e.target.value)}
                  placeholder="Auto-generated from task title"
                  className="mt-1"
                />
              </div>
              <div className="flex-1">
                <Label>Base Branch</Label>
                <Input
                  value={baseBranch}
                  onChange={e => setBaseBranch(e.target.value)}
                  placeholder="main"
                  className="mt-1"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
