import { useState, useEffect, useMemo, useRef, type FC } from 'react'
import { useDirectories } from '@/ui/contexts/directories'
import { Terminal } from '@/ui/components/terminal'
import { Layers, FolderOpen } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { ServiceRow } from '@/ui/components/ServiceRow'

interface TaskDevControlProps {
  taskId: string
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
  const serviceDirsRef = useRef(serviceDirs)
  serviceDirsRef.current = serviceDirs
  useEffect(() => {
    if (serviceDirsRef.current.length === 0) return
    const dirMap = new Map(directories.map(d => [d.id, d]))
    const updated = serviceDirsRef.current.map(d => dirMap.get(d.id)).filter(Boolean) as DirectorySettings[]
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
                <ServiceRow
                  dir={dir}
                  isSelected={selectedId === dir.id}
                  state={state}
                  onSelect={() => setSelectedId(dir.id)}
                  onRun={() => window.electron.runService(dir.id)}
                  onStop={() => window.electron.stopService(dir.id)}
                  accentDot
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
                    <ServiceRow
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
