import { useState, type FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { FolderOpen } from 'lucide-react'

const BOARD_MODE_NEW = 'new' as const
const BOARD_MODE_EXISTING = 'existing' as const

interface ProjectCreationModalProps {
  request: ProjectCreationRequest
  onComplete: () => void
}

export const ProjectCreationModal: FC<ProjectCreationModalProps> = ({ request, onComplete }) => {
  const { settings } = useAIAutomation()
  const [projectName, setProjectName] = useState(request.suggestedName)
  const [location, setLocation] = useState('')
  const [gitInit, setGitInit] = useState(true)
  const [boardMode, setBoardMode] = useState<ProjectCreationBoardMode>(BOARD_MODE_NEW)
  const [newBoardName, setNewBoardName] = useState(request.suggestedName)
  const [existingBoardId, setExistingBoardId] = useState('')

  const boards = settings?.boards ?? []

  const handleBrowse = async () => {
    const selected = await window.electron.aiPickDirectory()
    if (selected) {
      setLocation(selected)
    }
  }

  const handleCreate = async () => {
    if (!projectName.trim() || !location.trim()) return

    const formData: ProjectCreationFormData = {
      projectName: projectName.trim(),
      location: location.trim(),
      gitInit,
      boardMode,
      ...(boardMode === BOARD_MODE_NEW ? { newBoardName: newBoardName.trim() || projectName.trim() } : {}),
      ...(boardMode === BOARD_MODE_EXISTING ? { existingBoardId } : {}),
    }

    await window.electron.aiProjectCreationResult(request.requestId, { formData })
    onComplete()
  }

  const handleCancel = async () => {
    await window.electron.aiProjectCreationResult(request.requestId, { cancelled: true })
    onComplete()
  }

  const isValid = projectName.trim().length > 0 && location.trim().length > 0 &&
    (boardMode === BOARD_MODE_NEW || existingBoardId.length > 0)

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) handleCancel() }}>
      <DialogContent
        className="!max-w-[500px] flex flex-col"
        style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--ai-text-primary)' }}>Create New Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label style={{ color: 'var(--ai-text-secondary)' }}>Project Name</Label>
            <Input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="Project name"
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label style={{ color: 'var(--ai-text-secondary)' }}>Parent Directory</Label>
            <p className="text-[11px] mt-0.5 mb-1" style={{ color: 'var(--ai-text-tertiary)' }}>
              A folder named <strong style={{ color: 'var(--ai-text-secondary)' }}>{projectName.trim() || '...'}</strong> will be created here
            </p>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 rounded-md border px-3 py-2 text-sm truncate min-h-[36px] flex items-center"
                style={{
                  borderColor: 'var(--ai-border-subtle)',
                  background: 'var(--ai-surface-2)',
                  color: location ? 'var(--ai-text-primary)' : 'var(--ai-text-tertiary)',
                }}
              >
                {location || 'Select a directory...'}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBrowse}
                className="flex-shrink-0"
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                Browse
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="git-init"
              checked={gitInit}
              onChange={e => setGitInit(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="git-init" className="cursor-pointer" style={{ color: 'var(--ai-text-secondary)' }}>
              Initialize git repository
            </Label>
          </div>

          <div>
            <Label style={{ color: 'var(--ai-text-secondary)' }}>Board</Label>
            <div className="flex gap-1 mt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setBoardMode(BOARD_MODE_NEW)}
                style={{
                  background: boardMode === BOARD_MODE_NEW ? 'var(--ai-accent-subtle)' : 'var(--ai-surface-2)',
                  borderColor: boardMode === BOARD_MODE_NEW ? 'var(--ai-accent)' : 'var(--ai-border-subtle)',
                  color: boardMode === BOARD_MODE_NEW ? 'var(--ai-accent)' : 'var(--ai-text-secondary)',
                }}
              >
                Create new board
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setBoardMode(BOARD_MODE_EXISTING)}
                style={{
                  background: boardMode === BOARD_MODE_EXISTING ? 'var(--ai-accent-subtle)' : 'var(--ai-surface-2)',
                  borderColor: boardMode === BOARD_MODE_EXISTING ? 'var(--ai-accent)' : 'var(--ai-border-subtle)',
                  color: boardMode === BOARD_MODE_EXISTING ? 'var(--ai-accent)' : 'var(--ai-text-secondary)',
                }}
              >
                Use existing board
              </Button>
            </div>

            {boardMode === BOARD_MODE_NEW && (
              <Input
                value={newBoardName}
                onChange={e => setNewBoardName(e.target.value)}
                placeholder="Board name"
                className="mt-2"
              />
            )}

            {boardMode === BOARD_MODE_EXISTING && (
              <Select value={existingBoardId} onValueChange={setExistingBoardId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select a board" />
                </SelectTrigger>
                <SelectContent>
                  {boards.map(board => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!isValid}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
