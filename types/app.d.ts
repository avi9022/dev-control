interface UpdateNotificationSettings {
  hasUpdates: boolean
  userWasPrompted: boolean
  userRefusedUpdates: boolean
}

type TodoPriority = 'none' | 'low' | 'medium' | 'high'

interface Todo {
  id: string
  text: string
  completed: boolean
  createdAt: string
  priority?: TodoPriority
}

interface TodoSettings {
  autoHide: boolean
  opacity: number
  bgColor: string
  shortcut: string
}

interface ImportantValue {
  id: string
  key: string
  value: string
}
