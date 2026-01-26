import { useEffect, useState, useCallback } from 'react'
import { TodoList } from './TodoList'
import { TodoInput } from './TodoInput'
import { ImportantValuesList } from './ImportantValuesList'
import { DateNav } from './DateNav'
import { Settings } from './Settings'
import { Settings as SettingsIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const getToday = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const OverlayApp = () => {
  const [todos, setTodos] = useState<Todo[]>([])
  const [importantValues, setImportantValues] = useState<ImportantValue[]>([])
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [activeTab, setActiveTab] = useState<'todos' | 'values'>('todos')
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingValues, setIsLoadingValues] = useState(true)
  const [availableDates, setAvailableDates] = useState<string[]>([])

  const loadTodos = useCallback(async (date: string) => {
    setIsLoading(true)
    try {
      const loaded = await window.electron.getTodosForDate(date)
      setTodos(loaded)
    } catch (error) {
      console.error('Failed to load todos:', error)
      setTodos([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadAvailableDates = useCallback(async () => {
    try {
      const dates = await window.electron.getAvailableDates()
      setAvailableDates(dates)
    } catch (error) {
      console.error('Failed to load available dates:', error)
    }
  }, [])

  const loadImportantValues = useCallback(async () => {
    setIsLoadingValues(true)
    try {
      const loaded = await window.electron.getImportantValues()
      setImportantValues(loaded)
    } catch (error) {
      console.error('Failed to load important values:', error)
      setImportantValues([])
    } finally {
      setIsLoadingValues(false)
    }
  }, [])

  const saveImportantValues = useCallback(async (newValues: ImportantValue[]) => {
    setImportantValues(newValues)
    try {
      await window.electron.saveImportantValues(newValues)
    } catch (error) {
      console.error('Failed to save important values:', error)
    }
  }, [])

  useEffect(() => {
    loadTodos(selectedDate)
    loadAvailableDates()
    loadImportantValues()
  }, [selectedDate, loadTodos, loadAvailableDates, loadImportantValues])

  const saveTodos = useCallback(async (newTodos: Todo[]) => {
    setTodos(newTodos)
    try {
      await window.electron.saveTodosForDate(selectedDate, newTodos)
    } catch (error) {
      console.error('Failed to save todos:', error)
    }
  }, [selectedDate])

  const addTodo = useCallback((text: string, priority: TodoPriority = 'none') => {
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text,
      completed: false,
      createdAt: new Date().toISOString(),
      priority
    }
    saveTodos([...todos, newTodo])
  }, [todos, saveTodos])

  const toggleTodo = useCallback((id: string) => {
    const newTodos = todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    )
    saveTodos(newTodos)
  }, [todos, saveTodos])

  const deleteTodo = useCallback((id: string) => {
    const newTodos = todos.filter(todo => todo.id !== id)
    saveTodos(newTodos)
  }, [todos, saveTodos])

  const updateTodoPriority = useCallback((id: string, priority: TodoPriority) => {
    const newTodos = todos.map(todo =>
      todo.id === id ? { ...todo, priority } : todo
    )
    saveTodos(newTodos)
  }, [todos, saveTodos])

  const updateTodoText = useCallback((id: string, text: string) => {
    const newTodos = todos.map(todo =>
      todo.id === id ? { ...todo, text } : todo
    )
    saveTodos(newTodos)
  }, [todos, saveTodos])

  // Handle escape key to close overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electron.hideOverlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Subscribe to file changes and reload when current date's file changes
  useEffect(() => {
    const unsubscribeTodos = window.electron.subscribeTodosFileChanged(({ date }) => {
      if (date === selectedDate) {
        loadTodos(selectedDate)
      }
      // Also reload available dates in case a new file was created
      loadAvailableDates()
    })
    return unsubscribeTodos
  }, [selectedDate, loadTodos, loadAvailableDates])

  // Subscribe to important values file changes
  useEffect(() => {
    const unsubscribeValues = window.electron.subscribeImportantValuesFileChanged(() => {
      loadImportantValues()
    })
    return unsubscribeValues
  }, [loadImportantValues])

  const isToday = selectedDate === getToday()

  // Get incomplete todos from previous day for carry-over section
  const [previousDayIncomplete, setPreviousDayIncomplete] = useState<Todo[]>([])

  useEffect(() => {
    const loadPreviousDayIncomplete = async () => {
      if (!isToday || availableDates.length === 0) {
        setPreviousDayIncomplete([])
        return
      }

      // Find the most recent date before today
      const previousDates = availableDates.filter(d => d < selectedDate)
      if (previousDates.length === 0) {
        setPreviousDayIncomplete([])
        return
      }

      const previousDate = previousDates[0] // Most recent since sorted desc
      try {
        const prevTodos = await window.electron.getTodosForDate(previousDate)
        const incomplete = prevTodos.filter(t => !t.completed)
        // Filter out items already in today's list (by matching text)
        const todayTexts = new Set(todos.map(t => t.text))
        const notYetAdded = incomplete.filter(t => !todayTexts.has(t.text))
        setPreviousDayIncomplete(notYetAdded)
      } catch {
        setPreviousDayIncomplete([])
      }
    }

    loadPreviousDayIncomplete()
  }, [isToday, selectedDate, availableDates, todos])

  const carryOverTodo = useCallback((todo: Todo) => {
    // Add to today's todos
    const newTodo: Todo = {
      ...todo,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }
    saveTodos([...todos, newTodo])
    // Remove from previous day incomplete list
    setPreviousDayIncomplete(prev => prev.filter(t => t.id !== todo.id))
  }, [todos, saveTodos])

  const addImportantValue = useCallback(() => {
    const newValue: ImportantValue = {
      id: crypto.randomUUID(),
      key: '',
      value: ''
    }
    saveImportantValues([...importantValues, newValue])
  }, [importantValues, saveImportantValues])

  const deleteImportantValue = useCallback((id: string) => {
    const newValues = importantValues.filter(v => v.id !== id)
    saveImportantValues(newValues)
  }, [importantValues, saveImportantValues])

  const updateImportantValueKey = useCallback((id: string, key: string) => {
    const newValues = importantValues.map(v =>
      v.id === id ? { ...v, key } : v
    )
    saveImportantValues(newValues)
  }, [importantValues, saveImportantValues])

  const updateImportantValueValue = useCallback((id: string, value: string) => {
    const newValues = importantValues.map(v =>
      v.id === id ? { ...v, value } : v
    )
    saveImportantValues(newValues)
  }, [importantValues, saveImportantValues])

  if (showSettings) {
    return <Settings onBack={() => setShowSettings(false)} />
  }

  return (
    <div className="h-screen flex flex-col bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 shadow-2xl overflow-hidden">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'todos' | 'values')}>
          <TabsList className="bg-neutral-800/50 border border-neutral-700/50">
            <TabsTrigger 
              value="todos" 
              className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400"
            >
              Todos
            </TabsTrigger>
            <TabsTrigger 
              value="values"
              className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400"
            >
              Important Values
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-md hover:bg-white/10 transition-colors text-neutral-400 hover:text-white"
        >
          <SettingsIcon size={16} />
        </button>
      </div>

      {/* Date picker - only for Todos tab */}
      {activeTab === 'todos' && (
        <div className="px-4 py-2 border-b border-white/10 bg-white/5">
          <DateNav
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </div>
      )}

      {/* Content */}
      {activeTab === 'todos' ? (
        <>
          {/* Carry-over section */}
          {isToday && previousDayIncomplete.length > 0 && (
            <div className="px-4 py-2 bg-amber-900/20 border-b border-amber-700/30">
              <p className="text-xs text-amber-400/80 mb-2">Incomplete from yesterday:</p>
              <div className="space-y-1">
                {previousDayIncomplete.slice(0, 3).map(todo => (
                  <div key={todo.id} className="flex items-center gap-2 text-sm">
                    <span className="text-neutral-400 flex-1 truncate">{todo.text}</span>
                    <button
                      onClick={() => carryOverTodo(todo)}
                      className="text-xs text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded bg-amber-900/30 hover:bg-amber-900/50 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                ))}
                {previousDayIncomplete.length > 3 && (
                  <p className="text-xs text-amber-400/60">+{previousDayIncomplete.length - 3} more</p>
                )}
              </div>
            </div>
          )}

          {/* Todo Input - only show for today */}
          {isToday && (
            <div className="px-4 py-3 border-b border-white/10">
              <TodoInput onAdd={addTodo} autoFocus />
            </div>
          )}

          {/* Todo List */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-neutral-500 text-sm">Loading...</div>
              </div>
            ) : todos.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-neutral-500 text-sm">
                  {isToday ? 'No todos yet. Add one above!' : 'No todos for this day'}
                </div>
              </div>
            ) : (
              <TodoList
                todos={todos}
                onToggle={toggleTodo}
                onDelete={isToday ? deleteTodo : undefined}
                onPriorityChange={isToday ? updateTodoPriority : undefined}
                onTextChange={isToday ? updateTodoText : undefined}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-white/10 bg-white/5">
            <p className="text-xs text-neutral-500 text-center">
              {todos.filter(t => t.completed).length}/{todos.length} completed
            </p>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden px-4 py-2">
          {isLoadingValues ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-neutral-500 text-sm">Loading...</div>
            </div>
          ) : (
            <ImportantValuesList
              values={importantValues}
              onAdd={addImportantValue}
              onDelete={deleteImportantValue}
              onKeyChange={updateImportantValueKey}
              onValueChange={updateImportantValueValue}
            />
          )}
        </div>
      )}
    </div>
  )
}
