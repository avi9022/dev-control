import { useState, type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { Button } from '@/components/ui/button'
import { Plus, Settings, Zap, Sun, Moon, Cuboid, Wand2 } from 'lucide-react'
import { NotificationBell } from '@/ui/components/ai-automation/NotificationBell'
import { SplitScreenChoice } from '@/ui/components/SplitScreenChoice'
import { BoardSwitcher } from '@/ui/components/ai-automation/BoardSwitcher'
import { NewTaskDialog } from '@/ui/components/ai-automation/NewTaskDialog'
import { PlannerChat } from '@/ui/components/ai-automation/PlannerChat'
import { AISettings } from '@/ui/views/AISettings'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface AppTopBarProps {
  onNavigateToTask: (taskId: string) => void
  settingsOpen?: boolean
  onSettingsOpenChange?: (open: boolean) => void
  defaultSettingsTab?: string
  show3D?: boolean
  onToggle3D?: () => void
}

export const AppTopBar: FC<AppTopBarProps> = ({ onNavigateToTask, settingsOpen, onSettingsOpenChange, defaultSettingsTab, show3D, onToggle3D }) => {
  const { tasks, settings, updateSettings } = useAIAutomation()
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPlanner, setShowPlanner] = useState(false)
  const isSettingsOpen = settingsOpen ?? showSettings
  const setIsSettingsOpen = onSettingsOpenChange ?? setShowSettings

  const theme = settings?.theme || 'dark'
  const isLight = theme === 'light'

  const activeBoard = settings?.boards?.find(b => b.id === settings.activeBoardId)
  const pipeline = activeBoard?.pipeline || []

  const boardTasks = tasks.filter(t => t.boardId === settings?.activeBoardId)
  const agentPhaseIds = pipeline.filter(p => p.type === 'agent').map(p => p.id)
  const runningAgents = boardTasks.filter(t =>
    agentPhaseIds.includes(t.phase) && t.activeProcessPid
  ).length

  const toggleTheme = () => {
    updateSettings({ theme: isLight ? 'dark' : 'light' })
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--ai-accent-subtle)' }}>
              <Zap className="h-3 w-3" style={{ color: 'var(--ai-accent)' }} />
            </div>
            <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--ai-text-primary)' }}>
              DevControl
            </h2>
          </div>
          {settings && <BoardSwitcher settings={settings} updateSettings={updateSettings} />}
          {runningAgents > 0 && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg" style={{ background: 'var(--ai-success-subtle)' }}>
              <div className="ai-dot" style={{ background: 'var(--ai-success)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--ai-success)', fontFamily: 'var(--ai-mono)' }}>
                {runningAgents} agent{runningAgents > 1 ? 's' : ''} running
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onToggle3D && (
            <button
              onClick={onToggle3D}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{
                color: show3D ? 'var(--ai-accent)' : 'var(--ai-text-secondary)',
                background: show3D ? 'var(--ai-accent-subtle)' : 'var(--ai-surface-2)',
              }}
              title={show3D ? 'Back to board' : '3D View'}
            >
              <Cuboid className="h-3.5 w-3.5" />
            </button>
          )}
          <SplitScreenChoice />
          <NotificationBell onNavigateToTask={onNavigateToTask} />
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--ai-text-secondary)', background: 'var(--ai-surface-2)' }}
            title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            className="border-[var(--ai-border)] bg-transparent hover:bg-[var(--ai-surface-2)] text-[var(--ai-text-secondary)] hover:text-[var(--ai-text-primary)]"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Settings
          </Button>
          <Button
            size="sm"
            onClick={() => setShowPlanner(true)}
            variant="outline"
            className="border-[var(--ai-border)] bg-transparent hover:bg-[var(--ai-surface-2)] text-[var(--ai-text-secondary)] hover:text-[var(--ai-text-primary)]"
          >
            <Wand2 className="h-3.5 w-3.5 mr-1" />
            Plan
          </Button>
          <Button
            size="sm"
            onClick={() => setNewTaskOpen(true)}
            className="font-semibold"
            style={{ background: 'var(--ai-accent)', color: isLight ? '#FFFFFF' : 'var(--ai-surface-0)' }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Task
          </Button>
        </div>
      </div>

      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
      <PlannerChat open={showPlanner} onOpenChange={setShowPlanner} />
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="!max-w-[95vw] h-[85vh] flex flex-col" style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--ai-text-primary)' }}>DevControl Settings</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col">
            <AISettings defaultTab={defaultSettingsTab} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
