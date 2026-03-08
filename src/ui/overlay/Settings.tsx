import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, FolderOpen } from 'lucide-react'

interface SettingsProps {
  onBack: () => void
  onAppearanceChange: (opacity: number, bgColor: string) => void
}

export const Settings = ({ onBack, onAppearanceChange }: SettingsProps) => {
  const [folderPath, setFolderPath] = useState('')
  const [autoHide, setAutoHide] = useState(false)
  const [opacity, setOpacity] = useState(10)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [shortcut, setShortcut] = useState('CommandOrControl+Shift+T')
  const [isRecording, setIsRecording] = useState(false)
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
        setOpacity(settings.opacity ?? 10)
        setBgColor(settings.bgColor ?? '#ffffff')
        setShortcut(settings.shortcut ?? 'CommandOrControl+Shift+T')
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

  const saveSettings = async (updates: Partial<TodoSettings>) => {
    const merged = { autoHide, opacity, bgColor, shortcut, ...updates }
    onAppearanceChange(merged.opacity, merged.bgColor)
    try {
      await window.electron.setTodoSettings(merged)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const handleAutoHideChange = (checked: boolean) => {
    setAutoHide(checked)
    saveSettings({ autoHide: checked })
  }

  const handleOpacityChange = (value: number) => {
    setOpacity(value)
    saveSettings({ opacity: value })
  }

  const handleBgColorChange = (value: string) => {
    setBgColor(value)
    saveSettings({ bgColor: value })
  }

  const keyToElectron = (e: KeyboardEvent): string | null => {
    const parts: string[] = []
    if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
    if (e.altKey) parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')

    const key = e.key
    // Ignore standalone modifier presses
    if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) return null
    // Need at least one modifier
    if (parts.length === 0) return null

    // Map keys to Electron accelerator names
    const keyMap: Record<string, string> = {
      ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
      ' ': 'Space', Enter: 'Return', Backspace: 'Backspace', Delete: 'Delete',
      Escape: 'Escape', Tab: 'Tab',
    }
    const mapped = keyMap[key] ?? (key.length === 1 ? key.toUpperCase() : key)
    parts.push(mapped)
    return parts.join('+')
  }

  const formatShortcutDisplay = (accel: string): string => {
    const isMac = navigator.platform.includes('Mac')
    return accel
      .replace(/CommandOrControl/g, isMac ? '\u2318' : 'Ctrl')
      .replace(/Shift/g, isMac ? '\u21E7' : 'Shift')
      .replace(/Alt/g, isMac ? '\u2325' : 'Alt')
      .replace(/\+/g, isMac ? '' : '+')
  }

  const handleRecordShortcut = useCallback((e: KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const accel = keyToElectron(e)
    if (!accel) return
    setShortcut(accel)
    setIsRecording(false)
    saveSettings({ shortcut: accel })
  }, [autoHide, opacity, bgColor, shortcut])

  useEffect(() => {
    if (!isRecording) return
    window.addEventListener('keydown', handleRecordShortcut, true)
    return () => window.removeEventListener('keydown', handleRecordShortcut, true)
  }, [isRecording, handleRecordShortcut])

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

        {/* Appearance */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Appearance
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-200">Background color</p>
              <div className="relative">
                <input
                  type="color"
                  value={bgColor}
                  onChange={e => handleBgColorChange(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="w-6 h-6 rounded-md border border-neutral-600 cursor-pointer"
                  style={{ backgroundColor: bgColor }}
                />
              </div>
            </div>
            <div className="flex gap-1.5">
              {['#ffffff', '#000000', '#1e1e2e', '#1a1b26', '#282c34', '#2d2a2e', '#0d1117', '#1e3a5f'].map(color => (
                <button
                  key={color}
                  onClick={() => handleBgColorChange(color)}
                  className={`w-6 h-6 rounded-md border transition-all ${bgColor === color ? 'border-blue-500 scale-110' : 'border-neutral-600 hover:border-neutral-400'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-200">Background opacity</p>
              <span className="text-xs text-neutral-500 tabular-nums">{opacity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={opacity}
              onChange={e => handleOpacityChange(Number(e.target.value))}
              className="w-full h-1.5 bg-neutral-700 rounded-full appearance-none cursor-pointer accent-blue-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:hover:bg-blue-400 [&::-webkit-slider-thumb]:transition-colors"
            />
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Keyboard Shortcuts
          </label>
          <div className="bg-neutral-800/30 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-300">Toggle Overlay</span>
              <button
                onClick={() => setIsRecording(!isRecording)}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  isRecording
                    ? 'bg-blue-600 text-white animate-pulse'
                    : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
                }`}
              >
                {isRecording ? 'Press keys...' : formatShortcutDisplay(shortcut)}
              </button>
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
