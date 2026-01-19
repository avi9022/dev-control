import { useState, useEffect } from 'react'
import { ArrowLeft, FolderOpen } from 'lucide-react'

interface SettingsProps {
  onBack: () => void
}

export const Settings = ({ onBack }: SettingsProps) => {
  const [folderPath, setFolderPath] = useState('')
  const [autoHide, setAutoHide] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [path, settings] = await Promise.all([
          window.electron.getTodoFolderPath(),
          window.electron.getTodoSettings()
        ])
        setFolderPath(path)
        setAutoHide(settings.autoHide)
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSelectFolder = async () => {
    try {
      const newPath = await window.electron.selectTodoFolder()
      if (newPath) {
        setFolderPath(newPath)
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
    }
  }

  const handleAutoHideChange = async (checked: boolean) => {
    setAutoHide(checked)
    try {
      await window.electron.setTodoSettings({ autoHide: checked })
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-neutral-900/95 backdrop-blur-xl rounded-lg border border-neutral-700/50">
        <div className="text-neutral-500 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-neutral-900/95 backdrop-blur-xl rounded-lg border border-neutral-700/50 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-700/50 bg-neutral-800/50">
        <button
          onClick={onBack}
          className="p-1.5 rounded hover:bg-neutral-700/50 text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-sm font-medium text-white">Settings</h2>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Storage Location */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Storage Location
          </label>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 min-w-0 bg-neutral-800/50 border border-neutral-700/50 rounded-md px-3 py-2">
              <p className="text-sm text-neutral-300 truncate" title={folderPath}>
                {folderPath}
              </p>
            </div>
            <button
              onClick={handleSelectFolder}
              className="flex-shrink-0 p-2 rounded-md bg-neutral-700 hover:bg-neutral-600 text-white transition-colors"
            >
              <FolderOpen size={16} />
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            Todo files are stored as TODOS-YYYY-MM-DD.json
          </p>
        </div>

        {/* Behavior */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Behavior
          </label>

          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={autoHide}
                onChange={e => handleAutoHideChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-700 rounded-full peer-checked:bg-blue-600 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
            </div>
            <div>
              <p className="text-sm text-neutral-200 group-hover:text-white transition-colors">
                Auto-hide on blur
              </p>
              <p className="text-xs text-neutral-500">
                Hide overlay when clicking outside
              </p>
            </div>
          </label>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Keyboard Shortcuts
          </label>
          <div className="bg-neutral-800/30 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-300">Toggle Overlay</span>
              <kbd className="px-2 py-1 bg-neutral-700 rounded text-xs text-neutral-300 font-mono">
                {navigator.platform.includes('Mac') ? '⌘⇧T' : 'Ctrl+Shift+T'}
              </kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-300">Close Overlay</span>
              <kbd className="px-2 py-1 bg-neutral-700 rounded text-xs text-neutral-300 font-mono">
                Esc
              </kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-neutral-700/50 bg-neutral-800/30">
        <p className="text-xs text-neutral-500 text-center">
          Todo Widget v1.0
        </p>
      </div>
    </div>
  )
}
