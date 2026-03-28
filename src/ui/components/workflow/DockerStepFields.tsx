import { type FC, useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { X, Plus, Search, Container, Keyboard, FolderOpen } from 'lucide-react'
import { useDocker } from '@/ui/contexts/docker'

interface DockerStepFieldsProps {
  containerIds: string[]
  containerNames: string[]
  composeProject?: string
  dockerContext?: string
  onContainersChange: (ids: string[], names: string[]) => void
  onComposeProjectChange: (project: string | undefined) => void
  onDockerContextChange: (ctx: string | undefined) => void
}

type InputMode = 'compose' | 'container' | 'manual'

export const DockerStepFields: FC<DockerStepFieldsProps> = ({
  containerIds,
  containerNames,
  composeProject,
  dockerContext,
  onContainersChange,
  onComposeProjectChange,
  onDockerContextChange,
}) => {
  const initial: InputMode = composeProject ? 'compose' : containerIds.length > 0 ? 'container' : 'compose'
  const [mode, setMode] = useState<InputMode>(initial)
  const [containerSearch, setContainerSearch] = useState('')
  const [composeSearch, setComposeSearch] = useState('')
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const { containers, composeProjects, isAvailable, refreshComposeProjects, refreshContainers } = useDocker()

  useEffect(() => {
    refreshContainers()
    refreshComposeProjects()
  }, [refreshContainers, refreshComposeProjects])

  const alreadySelected = new Set(containerIds)

  const filteredContainers = containers.filter((c) => {
    if (alreadySelected.has(c.id) || alreadySelected.has(c.name)) return false
    const term = containerSearch.toLowerCase()
    return (
      c.name.toLowerCase().includes(term) ||
      c.id.toLowerCase().includes(term) ||
      c.image.toLowerCase().includes(term)
    )
  })

  const filteredProjects = composeProjects.filter((p) =>
    p.name.toLowerCase().includes(composeSearch.toLowerCase())
  )

  const handleSelectContainer = (container: DockerContainer) => {
    onContainersChange(
      [...containerIds, container.id],
      [...containerNames, container.name]
    )
    if (!dockerContext && container.dockerContext) {
      onDockerContextChange(container.dockerContext)
    }
    setContainerSearch('')
  }

  const handleSelectCompose = (project: DockerComposeProject) => {
    onComposeProjectChange(project.name)
    // Find live containers belonging to this compose project by matching composeProject property
    const projectContainers = containers.filter((c) => c.composeProject === project.name)
    onContainersChange(
      projectContainers.map((c) => c.id),
      projectContainers.map((c) => c.name)
    )
    onDockerContextChange(projectContainers[0]?.dockerContext)
    setComposeSearch('')
  }

  const handleClearCompose = () => {
    onComposeProjectChange(undefined)
    onDockerContextChange(undefined)
    onContainersChange([], [])
  }

  const handleManualAdd = () => {
    if (!newId.trim()) return
    onContainersChange(
      [...containerIds, newId.trim()],
      [...containerNames, newName.trim() || newId.trim()]
    )
    setNewId('')
    setNewName('')
  }

  const handleRemove = (index: number) => {
    onContainersChange(
      containerIds.filter((_, i) => i !== index),
      containerNames.filter((_, i) => i !== index)
    )
  }

  const handleModeChange = (newMode: InputMode) => {
    setMode(newMode)
    if (newMode === 'compose') {
      onContainersChange([], [])
    } else {
      onComposeProjectChange(undefined)
    }
  }

  const stateColor = (state: string) => {
    switch (state) {
      case 'running': return 'text-green-500'
      case 'exited': case 'stopped': return 'text-zinc-400'
      case 'paused': case 'partial': return 'text-yellow-500'
      default: return 'text-muted-foreground'
    }
  }

  const selectedProject = composeProjects.find((p) => p.name === composeProject)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Docker</Label>
        <div className="flex gap-1">
          <Button
            variant={mode === 'compose' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => handleModeChange('compose')}
          >
            <FolderOpen className="h-3 w-3 mr-1" />
            Compose
          </Button>
          <Button
            variant={mode === 'container' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => handleModeChange('container')}
          >
            <Search className="h-3 w-3 mr-1" />
            Container
          </Button>
          <Button
            variant={mode === 'manual' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => handleModeChange('manual')}
          >
            <Keyboard className="h-3 w-3 mr-1" />
            Manual
          </Button>
        </div>
      </div>

      {mode === 'compose' && (
        <>
          {selectedProject ? (
            <div className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">{selectedProject.name}</span>
                  <span className={`text-[10px] ${stateColor(selectedProject.status)}`}>
                    {selectedProject.status}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleClearCompose}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {selectedProject.services.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 pl-4">
                    <Container className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="text-xs truncate">{s.name}</span>
                    <span className={`text-[10px] ml-auto ${stateColor(s.state)}`}>{s.state}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Starts/stops all containers in this compose project
              </p>
            </div>
          ) : (
            <div className="border rounded-md">
              <div className="p-2 border-b">
                <Input
                  placeholder="Search compose projects..."
                  value={composeSearch}
                  onChange={(e) => setComposeSearch(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div className="max-h-[200px] overflow-auto">
                {filteredProjects.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    {!isAvailable
                      ? 'Docker is not available'
                      : composeProjects.length === 0
                        ? 'No compose projects found'
                        : 'No matching projects'}
                  </div>
                ) : (
                  filteredProjects.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left transition-colors"
                      onClick={() => handleSelectCompose(p)}
                    >
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {p.services.length} service{p.services.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <span className={`text-[10px] ${stateColor(p.status)}`}>{p.status}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'container' && (
        <>
          {containerIds.map((id, index) => (
            <div key={id} className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
                <Container className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-xs font-mono truncate">{containerNames[index] || id}</span>
                {containerNames[index] && containerNames[index] !== id && (
                  <span className="text-xs text-muted-foreground truncate">({id.slice(0, 12)})</span>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleRemove(index)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="border rounded-md">
            <div className="p-2 border-b">
              <Input
                placeholder="Search by name, ID, or image..."
                value={containerSearch}
                onChange={(e) => setContainerSearch(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="max-h-[200px] overflow-auto">
              {filteredContainers.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground">
                  {!isAvailable
                    ? 'Docker is not available'
                    : containers.length === 0
                      ? 'No containers found'
                      : 'No matching containers'}
                </div>
              ) : (
                filteredContainers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left transition-colors"
                    onClick={() => handleSelectContainer(c)}
                  >
                    <Container className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {c.image} &middot; {c.id.slice(0, 12)}
                      </div>
                    </div>
                    <span className={`text-[10px] ${stateColor(c.state)}`}>{c.state}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {mode === 'manual' && (
        <>
          {containerIds.map((id, index) => (
            <div key={id} className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
                <Container className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-xs font-mono truncate">{containerNames[index] || id}</span>
                {containerNames[index] && containerNames[index] !== id && (
                  <span className="text-xs text-muted-foreground truncate">({id.slice(0, 12)})</span>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleRemove(index)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder="Container ID"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="text-xs font-mono"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleManualAdd()
                }
              }}
            />
            <Input
              placeholder="Display Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleManualAdd()
                }
              }}
            />
            <Button variant="outline" size="sm" onClick={handleManualAdd} disabled={!newId.trim()}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
