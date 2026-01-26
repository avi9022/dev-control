import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { store } from './store.js'

export interface Todo {
  id: string
  text: string
  completed: boolean
  createdAt: string
}

export interface TodoFile {
  date: string  // YYYY-MM-DD
  todos: Todo[]
}

const DEFAULT_TODO_FOLDER = path.join(app.getPath('documents'), 'clawdbot-access/TodoWidget')

export const getTodoFolderPath = (): string => {
  return store.get('todoFolderPath') || DEFAULT_TODO_FOLDER
}

export const setTodoFolderPath = (folderPath: string): void => {
  store.set('todoFolderPath', folderPath)
}

export const ensureTodoFolder = async (): Promise<void> => {
  const folderPath = getTodoFolderPath()
  try {
    await fs.mkdir(folderPath, { recursive: true })
  } catch {
    // Folder already exists
  }
}

const getTodoFilePath = (date: string): string => {
  const folderPath = getTodoFolderPath()
  return path.join(folderPath, `TODOS-${date}.json`)
}

export const getTodosForDate = async (date: string): Promise<Todo[]> => {
  await ensureTodoFolder()
  const filePath = getTodoFilePath(date)

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const data: TodoFile = JSON.parse(content)
    return data.todos
  } catch {
    // File doesn't exist or is invalid
    return []
  }
}

export const saveTodosForDate = async (date: string, todos: Todo[]): Promise<void> => {
  await ensureTodoFolder()
  const filePath = getTodoFilePath(date)

  const data: TodoFile = {
    date,
    todos
  }

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export const getAvailableDates = async (): Promise<string[]> => {
  await ensureTodoFolder()
  const folderPath = getTodoFolderPath()

  try {
    const files = await fs.readdir(folderPath)
    const todoFiles = files
      .filter(f => f.startsWith('TODOS-') && f.endsWith('.json'))
      .map(f => f.replace('TODOS-', '').replace('.json', ''))
      .sort()
      .reverse() // Most recent first

    return todoFiles
  } catch {
    return []
  }
}
