import fs from 'fs/promises'
import path from 'path'
import { getTodoFolderPath, ensureTodoFolder } from './todos.js'

export interface ImportantValue {
  id: string
  key: string
  value: string
}

const getImportantValuesFilePath = (): string => {
  const folderPath = getTodoFolderPath()
  return path.join(folderPath, 'IMPORTANT_VALUES.json')
}

export const getImportantValues = async (): Promise<ImportantValue[]> => {
  await ensureTodoFolder()
  const filePath = getImportantValuesFilePath()

  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const data: ImportantValue[] = JSON.parse(content)
    // Validate that it's an array
    if (Array.isArray(data)) {
      return data
    }
    return []
  } catch {
    // File doesn't exist or is invalid
    return []
  }
}

export const saveImportantValues = async (values: ImportantValue[]): Promise<void> => {
  await ensureTodoFolder()
  const filePath = getImportantValuesFilePath()

  await fs.writeFile(filePath, JSON.stringify(values, null, 2), 'utf-8')
}

