import { useState, useEffect, useMemo, type FC } from 'react'
import { useDirectories } from '@/ui/contexts/directories'
import { Terminal } from '@/ui/components/terminal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, Play, Square, Loader2, Layers, FolderOpen } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'

interface TaskDevControlProps {
  taskId: string
}

const ServiceTab: FC<{
  dir: DirectorySettings
  isSelected: boolean
  state: string
  onSelect: () => void
  onRun: () => void
  onStop: () => void
  isTaskService?: boolean
}> = ({ dir, isSelected, state, onSelect, onRun, onStop, isTaskService }) => {
  const isRunning = state === 'RUNNING'
  const isInitializing = state === 'INITIALIZING'

  return (
    <div
      onClick={onSelect}
      className="px-3 py-4 flex justify-between cursor-pointer"
      style={{ background: isSelected ? 'var(--ai-surface-3)' : undefined, color: isSelected ? 'var(--ai-text-primary)' : undefined }}
    >
      <div className="w-full flex gap-1 justify-start">
        <div>
          <div className="flex w-[180px] justify-between items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 max-w-[150px]">
                  {isTaskService && (
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--ai-accent)' }} />
                  )}
                  <p className="font-bold text-sm truncate overflow-hidden whitespace-nowrap capitalize">
                    {dir.name}
                  </p>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="capitalize">{dir.name?.replace('-', ' ')}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={`font-semibold ${
                  isRunning ? 'bg-success' : isInitializing ? 'bg-yellow-600' : 'bg-destructive'
                } h-4 w-4 rounded-full`} />
              </TooltipTrigger>
              <TooltipContent>
                <p className="capitalize font-bold">{state}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>{dir.runCommand}</p>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        {dir.isFrontendProj && !isInitializing && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className=""
                disabled={!isRunning}
                style={!isRunning ? { pointerEvents: 'auto', cursor: 'auto' } : {}}
                onClick={ev => {
                  ev.stopPropagation()
                  window.electron.openProjectInBrowser(dir.id)
                }}
                size="sm"
              >
                <ExternalLink />
              </Button>
            </TooltipTrigger>
            {!isRunning ? (
              <TooltipContent><p>Project is not running</p></TooltipContent>
            ) : (
              <TooltipContent><p>Open in browser</p></TooltipContent>
            )}
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={ev => {
                ev.stopPropagation()
                if (isRunning || isInitializing) onStop()
                else onRun()
              }}
              className={`${isRunning || isInitializing ? 'bg-destructive hover:bg-destructive/80' : 'bg-success hover:bg-success/80'}`}
              size="sm"
            >
              {isInitializing
                ? <Loader2 className="h-5 w-5 animate-spin text-white" />
                : isRunning
                  ? <Square fill="white" color="white" />
                  : <Play fill="white" color="white" />
              }
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isInitializing ? 'Force stop' : isRunning ? 'Stop' : 'Start'}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export const TaskDevControl: FC<TaskDevControlProps> = ({ taskId }) => {
  const [serviceDirs, setServiceDirs] = useState<DirectorySettings[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const { directories, directoriesStateMap } = useDirectories()

  useEffect(() => {
    setLoading(true)
    window.electron.aiCreateTaskServices(taskId).then(dirs => {
      setServiceDirs(dirs)
      if (dirs.length > 0) setSelectedId(dirs[0].id)
      setLoading(false)
    })
  }, [taskId])

  // Keep serviceDirs in sync with store updates, preserving original order
  useEffect(() => {
    if (serviceDirs.length === 0) return
    const dirMap = new Map(directories.map(d => [d.id, d]))
    const updated = serviceDirs.map(d => dirMap.get(d.id)).filter(Boolean) as DirectorySettings[]
    if (updated.length > 0) setServiceDirs(updated)
  }, [directories])

  // Other services: non-worktree, non-task services with a runCommand
  const otherServices = useMemo(() => {
    if (!showAll) return []
    return directories.filter(d => !d.id.startsWith('wt-') && d.runCommand)
  }, [showAll, directories])

  if (loading) {
    return <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--ai-text-tertiary)' }}>Setting up services...</div>
  }

  if (serviceDirs.length === 0) {
    return <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--ai-text-tertiary)' }}>No worktrees available for this task</div>
  }

  return (
    <div className="h-full flex min-h-0">
      {/* Sidebar */}
      <div className="w-[300px] shrink-0 overflow-y-auto flex flex-col" style={{ borderRight: '1px solid var(--ai-border-subtle)' }}>
        {/* Toggle */}
        <div className="px-3 py-2 flex items-center gap-1.5" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
          <button
            onClick={() => setShowAll(false)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: !showAll ? 'var(--ai-accent-subtle)' : 'transparent',
              color: !showAll ? 'var(--ai-accent)' : 'var(--ai-text-tertiary)',
            }}
          >
            <FolderOpen className="h-3 w-3" />
            Task
          </button>
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: showAll ? 'var(--ai-accent-subtle)' : 'transparent',
              color: showAll ? 'var(--ai-accent)' : 'var(--ai-text-tertiary)',
            }}
          >
            <Layers className="h-3 w-3" />
            All Services
          </button>
        </div>

        {/* Task services */}
        <div className="flex-1 overflow-y-auto">
          {showAll && (
            <div className="px-3 pt-2 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ai-text-tertiary)' }}>
                Task Services
              </span>
            </div>
          )}
          {serviceDirs.map((dir, i) => {
            const state = directoriesStateMap[dir.id] || 'UNKNOWN'
            return (
              <div key={dir.id}>
                <ServiceTab
                  dir={dir}
                  isSelected={selectedId === dir.id}
                  state={state}
                  onSelect={() => setSelectedId(dir.id)}
                  onRun={() => window.electron.runService(dir.id)}
                  onStop={() => window.electron.stopService(dir.id)}
                  isTaskService
                />
                {i < serviceDirs.length - 1 && <Separator />}
              </div>
            )
          })}

          {/* Other services */}
          {showAll && otherServices.length > 0 && (
            <>
              <Separator />
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ai-text-tertiary)' }}>
                  Other Services
                </span>
              </div>
              {otherServices.map((dir, i) => {
                const state = directoriesStateMap[dir.id] || 'UNKNOWN'
                return (
                  <div key={dir.id}>
                    <ServiceTab
                      dir={dir}
                      isSelected={selectedId === dir.id}
                      state={state}
                      onSelect={() => setSelectedId(dir.id)}
                      onRun={() => window.electron.runService(dir.id)}
                      onStop={() => window.electron.stopService(dir.id)}
                    />
                    {i < otherServices.length - 1 && <Separator />}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 min-h-0 min-w-0">
        {selectedId ? (
          <Terminal id={selectedId} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--ai-text-tertiary)' }}>
            Select a service
          </div>
        )}
      </div>
    </div>
  )
}
