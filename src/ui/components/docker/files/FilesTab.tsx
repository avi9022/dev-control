import { useState, useEffect, useCallback, useRef, type FC, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FolderIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  FileCodeIcon,
  FileJson2Icon,
  ChevronRight,
  Home,
  ArrowUp,
  RefreshCw,
  Upload,
  FolderPlus,
  Trash2,
  Download,
  Pencil,
  Copy,
  Loader2,
  FileArchiveIcon,
  FileVideoIcon,
  FileAudioIcon,
  LinkIcon,
  GripVertical,
} from 'lucide-react'

interface FilesTabProps {
  containerId: string
}

type FileEntry = DockerFileEntry
type FileContent = DockerFileContent

function getFileIcon(entry: FileEntry) {
  if (entry.type === 'directory') {
    return <FolderIcon className="h-4 w-4 text-amber-400 fill-amber-400/20" />
  }
  if (entry.type === 'symlink') {
    return <LinkIcon className="h-4 w-4 text-violet-400" />
  }

  const ext = entry.name.split('.').pop()?.toLowerCase() || ''

  // Code files
  const codeExts = ['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'rb', 'php', 'swift', 'kt']
  if (codeExts.includes(ext)) return <FileCodeIcon className="h-4 w-4 text-emerald-400" />

  // Config/data
  if (ext === 'json') return <FileJson2Icon className="h-4 w-4 text-yellow-400" />
  if (['yaml', 'yml', 'toml', 'ini', 'conf', 'env'].includes(ext)) return <FileCodeIcon className="h-4 w-4 text-orange-400" />

  // Images
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) {
    return <ImageIcon className="h-4 w-4 text-pink-400" />
  }

  // Archives
  if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext)) {
    return <FileArchiveIcon className="h-4 w-4 text-amber-500" />
  }

  // Media
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return <FileVideoIcon className="h-4 w-4 text-purple-400" />
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return <FileAudioIcon className="h-4 w-4 text-cyan-400" />

  // Text
  if (['txt', 'md', 'log', 'sh', 'bash'].includes(ext)) return <FileTextIcon className="h-4 w-4 text-slate-400" />

  return <FileIcon className="h-4 w-4 text-slate-500" />
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
  if (diffHours < 48) return 'Yesterday'

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export const FilesTab: FC<FilesTabProps> = ({ containerId }) => {
  const [currentPath, setCurrentPath] = useState('/')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<FileEntry | null>(null)
  const [preview, setPreview] = useState<FileContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Dialog states
  const [newFolderDialog, setNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameDialog, setRenameDialog] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null)

  const dragCounterRef = useRef(0)

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electron.dockerListDirectory(containerId, path)
      setEntries(result)
      setCurrentPath(path)
      setSelectedEntry(null)
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory')
    } finally {
      setLoading(false)
    }
  }, [containerId])

  const loadPreview = useCallback(async (entry: FileEntry) => {
    if (entry.type === 'directory') return

    setPreviewLoading(true)
    try {
      const content = await window.electron.dockerReadFile(containerId, entry.path)
      setPreview(content)
    } catch (err) {
      setPreview({
        content: `Error: ${err instanceof Error ? err.message : 'Failed to load'}`,
        truncated: false,
        mimeType: 'text/plain',
        size: 0,
        encoding: 'utf8',
      })
    } finally {
      setPreviewLoading(false)
    }
  }, [containerId])

  useEffect(() => {
    loadDirectory('/')
  }, [loadDirectory])

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleEntryClick = (entry: FileEntry) => {
    setSelectedEntry(entry)
    if (entry.type !== 'directory') {
      loadPreview(entry)
    } else {
      setPreview(null)
    }
  }

  const handleEntryDoubleClick = (entry: FileEntry) => {
    if (entry.type === 'directory') {
      loadDirectory(entry.path)
    }
  }

  const navigateUp = () => {
    if (currentPath === '/') return
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/'
    loadDirectory(parentPath)
  }

  const navigateHome = () => {
    loadDirectory('/')
  }

  const handleDownload = async (entry: FileEntry) => {
    try {
      await window.electron.dockerDownloadFile(containerId, entry.path, entry.type === 'directory')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    }
  }

  const handleUpload = async () => {
    try {
      setUploading(true)
      const targetPath = currentPath === '/' ? '/' : currentPath + '/'
      const count = await window.electron.dockerUploadFileDialog(containerId, targetPath)
      if (count > 0) {
        loadDirectory(currentPath)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      const folderPath = currentPath.endsWith('/')
        ? `${currentPath}${newFolderName}`
        : `${currentPath}/${newFolderName}`
      await window.electron.dockerCreateDirectory(containerId, folderPath)
      setNewFolderDialog(false)
      setNewFolderName('')
      loadDirectory(currentPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder')
    }
  }

  const handleRename = async () => {
    if (!selectedEntry || !renameValue.trim()) return
    try {
      const newPath = currentPath.endsWith('/')
        ? `${currentPath}${renameValue}`
        : `${currentPath}/${renameValue}`
      await window.electron.dockerRenamePath(containerId, selectedEntry.path, newPath)
      setRenameDialog(false)
      setRenameValue('')
      loadDirectory(currentPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await window.electron.dockerDeletePath(
        containerId,
        deleteTarget.path,
        deleteTarget.type === 'directory'
      )
      setDeleteDialog(false)
      setDeleteTarget(null)
      if (selectedEntry?.path === deleteTarget.path) {
        setSelectedEntry(null)
        setPreview(null)
      }
      loadDirectory(currentPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleCopyPath = (entry: FileEntry) => {
    navigator.clipboard.writeText(entry.path)
  }

  // Drag and drop handlers - Electron provides file.path on dropped files
  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length === 0) return

    // In Electron, File objects have a 'path' property
    const filePaths: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i] as File & { path?: string }
      if (file.path) {
        filePaths.push(file.path)
      }
    }

    if (filePaths.length === 0) {
      setError('Could not get file paths. Try using the Upload button.')
      return
    }

    try {
      setUploading(true)
      const targetPath = currentPath === '/' ? '/' : currentPath + '/'
      const count = await window.electron.dockerUploadFiles(containerId, filePaths, targetPath)
      if (count > 0) {
        await loadDirectory(currentPath)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // State for drag preparation
  const [draggingEntry, setDraggingEntry] = useState<string | null>(null)

  // Handle native drag out - downloads and starts OS drag
  const handleStartNativeDrag = async (entry: FileEntry) => {
    try {
      setDraggingEntry(entry.path)
      // Downloads to temp and starts native OS drag operation
      // User can then drop anywhere on their computer
      await window.electron.dockerStartDrag(containerId, entry.path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Drag failed')
    } finally {
      setDraggingEntry(null)
    }
  }

  const breadcrumbs = currentPath.split('/').filter(Boolean)

  return (
    <div
      className="relative flex flex-col h-full bg-gradient-to-b from-background to-muted/20"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-background/80 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md hover:bg-muted"
          onClick={navigateHome}
          title="Go to root"
        >
          <Home className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md hover:bg-muted"
          onClick={navigateUp}
          disabled={currentPath === '/'}
          title="Go up"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Breadcrumbs */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 text-sm font-mono">
          <button
            onClick={() => loadDirectory('/')}
            className="text-muted-foreground hover:text-foreground transition-colors px-1 rounded hover:bg-muted"
          >
            /
          </button>
          {breadcrumbs.map((segment, index) => (
            <span key={index} className="flex items-center">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <button
                onClick={() => loadDirectory('/' + breadcrumbs.slice(0, index + 1).join('/'))}
                className="text-muted-foreground hover:text-foreground transition-colors px-1 rounded hover:bg-muted truncate max-w-[120px]"
                title={segment}
              >
                {segment}
              </button>
            </span>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md hover:bg-muted"
          onClick={() => loadDirectory(currentPath)}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="hover:underline">Dismiss</button>
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg m-2 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload className="h-12 w-12 text-primary mx-auto mb-2 animate-bounce" />
            <p className="text-lg font-semibold text-primary">Drop files here</p>
            <p className="text-sm text-muted-foreground">Files will be uploaded to {currentPath}</p>
          </div>
        </div>
      )}

      {/* Upload overlay */}
      {uploading && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-10 w-10 text-primary mx-auto mb-2 animate-spin" />
            <p className="text-sm font-medium">Uploading...</p>
          </div>
        </div>
      )}

      {/* Drag out overlay */}
      {draggingEntry && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Loader2 className="h-10 w-10 text-primary mx-auto mb-2 animate-spin" />
            <p className="text-sm font-medium">Preparing for drag...</p>
            <p className="text-xs text-muted-foreground mt-1">Drop anywhere on your computer</p>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* File list */}
        <div className="w-1/2 border-r flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 h-0">
            {loading && entries.length === 0 ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <FolderIcon className="h-12 w-12 mb-2 opacity-20" />
                <p className="text-sm">Empty directory</p>
              </div>
            ) : (
              <div className="p-1">
                {entries.map((entry) => (
                  <ContextMenu key={entry.path}>
                    <ContextMenuTrigger>
                      <div
                        className={`
                          group flex items-center gap-2 px-2 py-1.5 mx-1 rounded-md cursor-pointer text-sm
                          transition-all duration-150 ease-out
                          ${selectedEntry?.path === entry.path
                            ? 'bg-primary/15 text-primary shadow-sm'
                            : 'hover:bg-muted/80'
                          }
                        `}
                        onClick={() => handleEntryClick(entry)}
                        onDoubleClick={() => handleEntryDoubleClick(entry)}
                      >
                        {/* Drag handle - click and hold to drag out */}
                        <button
                          className={`
                            shrink-0 p-0.5 -ml-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100
                            hover:bg-muted transition-all cursor-grab active:cursor-grabbing
                            ${draggingEntry === entry.path ? 'opacity-100 animate-pulse' : ''}
                          `}
                          onMouseDown={() => handleStartNativeDrag(entry)}
                          title="Drag to Finder"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>
                        <span className="shrink-0">{getFileIcon(entry)}</span>
                        <span className="flex-1 truncate font-medium">{entry.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                          {entry.type === 'directory' ? '' : formatSize(entry.size)}
                        </span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      {entry.type === 'directory' ? (
                        <ContextMenuItem onClick={() => loadDirectory(entry.path)}>
                          <FolderIcon className="h-4 w-4 mr-2" />
                          Open
                        </ContextMenuItem>
                      ) : null}
                      <ContextMenuItem onClick={() => handleDownload(entry)}>
                        <Download className="h-4 w-4 mr-2" />
                        Download {entry.type === 'directory' ? 'Folder' : 'File'}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleStartNativeDrag(entry)}>
                        <GripVertical className="h-4 w-4 mr-2" />
                        Drag Out
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => {
                        setSelectedEntry(entry)
                        setRenameValue(entry.name)
                        setRenameDialog(true)
                      }}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => handleCopyPath(entry)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Path
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setDeleteTarget(entry)
                          setDeleteDialog(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Preview pane */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-muted/30">
          {selectedEntry ? (
            <>
              <div className="p-3 border-b bg-background/50">
                <div className="flex items-center gap-2">
                  {getFileIcon(selectedEntry)}
                  <span className="font-semibold truncate">{selectedEntry.name}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div>Size: <span className="text-foreground font-mono">{formatSize(selectedEntry.size)}</span></div>
                  <div>Modified: <span className="text-foreground">{formatDate(selectedEntry.modifiedAt)}</span></div>
                  <div>Permissions: <span className="text-foreground font-mono">{selectedEntry.permissions}</span></div>
                  <div>Owner: <span className="text-foreground font-mono">{selectedEntry.owner}:{selectedEntry.group}</span></div>
                  {selectedEntry.linkTarget && (
                    <div className="col-span-2">Links to: <span className="text-foreground font-mono">{selectedEntry.linkTarget}</span></div>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1 h-0">
                {previewLoading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : preview ? (
                  <div className="p-3">
                    {preview.encoding === 'base64' && preview.mimeType.startsWith('image/') ? (
                      <div className="flex items-center justify-center bg-[repeating-conic-gradient(#80808015_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] rounded-lg p-4">
                        <img
                          src={`data:${preview.mimeType};base64,${preview.content}`}
                          alt={selectedEntry.name}
                          className="max-w-full h-auto max-h-[400px] object-contain rounded shadow-lg"
                        />
                      </div>
                    ) : (
                      <>
                        {preview.truncated && (
                          <div className="mb-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600 dark:text-amber-400">
                            File truncated (showing first {formatSize(preview.content.length)})
                          </div>
                        )}
                        <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-all text-foreground/90 bg-background/50 rounded-lg p-3 border">
                          {preview.content}
                        </pre>
                      </>
                    )}
                  </div>
                ) : selectedEntry.type === 'directory' ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                    <FolderIcon className="h-16 w-16 mb-3 text-amber-400/50" />
                    <p className="text-sm">Double-click to open</p>
                  </div>
                ) : null}
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
              <FileIcon className="h-16 w-16 mb-3 opacity-20" />
              <p className="text-sm">Select a file to preview</p>
              <p className="text-xs mt-1 opacity-60">or drag files here to upload</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-t bg-background/80 backdrop-blur-sm relative z-10 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={handleUpload}
          disabled={uploading}
        >
          <Upload className="h-3 w-3" />
          Upload
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setNewFolderDialog(true)}
        >
          <FolderPlus className="h-3 w-3" />
          New Folder
        </Button>
        {selectedEntry && (
          <>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => handleDownload(selectedEntry)}
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              onClick={() => {
                setDeleteTarget(selectedEntry)
                setDeleteDialog(true)
              }}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </>
        )}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground font-mono">
          {entries.length} items
        </span>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialog} onOpenChange={setNewFolderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              Create a new folder in <code className="text-xs bg-muted px-1 py-0.5 rounded">{currentPath}</code>
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialog} onOpenChange={setRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>
              Enter a new name for <code className="text-xs bg-muted px-1 py-0.5 rounded">{selectedEntry?.name}</code>
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="New name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete {deleteTarget?.type === 'directory' ? 'Folder' : 'File'}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <code className="text-xs bg-muted px-1 py-0.5 rounded">{deleteTarget?.name}</code>?
              {deleteTarget?.type === 'directory' && (
                <span className="block mt-1 text-destructive">This will delete all contents recursively.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
