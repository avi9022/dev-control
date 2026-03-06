import { useState, type FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAIAutomation } from '@/ui/contexts/ai-automation'

interface NewTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const NewTaskDialog: FC<NewTaskDialogProps> = ({ open, onOpenChange }) => {
  const { createTask, settings } = useAIAutomation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [gitStrategy, setGitStrategy] = useState<AIGitStrategy>(settings?.defaultGitStrategy ?? 'branch')
  const [maxReviewCycles, setMaxReviewCycles] = useState(settings?.defaultMaxReviewCycles ?? 3)

  const handleCreate = async () => {
    if (!title.trim()) return
    await createTask(title.trim(), description.trim(), gitStrategy, maxReviewCycles)
    setTitle('')
    setDescription('')
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
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe what needs to be done..."
              className="mt-1"
              rows={4}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Git Strategy</Label>
              <Select value={gitStrategy} onValueChange={(v) => setGitStrategy(v as AIGitStrategy)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="branch">Branch</SelectItem>
                  <SelectItem value="worktree">Worktree</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>Max Review Cycles</Label>
              <Input
                type="number"
                value={maxReviewCycles}
                onChange={e => setMaxReviewCycles(Number(e.target.value))}
                min={1}
                max={10}
                className="mt-1"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>Create Task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
