import { BrowserWindow, shell } from 'electron'
import { ipcMainHandle } from '../utils/ipc-handle.js'
import { store } from '../storage/store.js'
import { addDirectoriesFromFolder } from '../functions/add-directories-from-folder.js'
import { updateDirectoryData } from '../functions/update-directory-data.js'
import { runService, stopProcess } from '../functions/run-service.js'
import { isServiceRunning } from '../functions/is-service-running.js'
import { removeDirectory } from '../functions/remove-directory.js'
import { openProjectInBrowser } from '../functions/open-project-in-browser.js'
import { spawnShell, writeShell, resizeShell, killShell } from '../shell/shell-manager.js'
import { openInIDE, getAvailableIDEs } from '../functions/open-in-ide.js'
import { readLogFile, clearLogFile, readLogFileChunk, readLogFileTail, getLogFileLineCount, searchLogFile, readLogFileRange } from '../utils/log-file-manager.js'
import { dynamoDBManager } from '../dynamodb/dynamodb-manager.js'
import { listTables } from '../dynamodb/list-tables.js'
import { describeTable } from '../dynamodb/describe-table.js'
import { scanTable } from '../dynamodb/scan-table.js'
import { queryTable, type QueryOptions } from '../dynamodb/query-table.js'
import { putItem } from '../dynamodb/put-item.js'
import { deleteItem } from '../dynamodb/delete-item.js'
import { getItem } from '../dynamodb/get-item.js'

export function registerServiceHandlers(mainWindow: BrowserWindow): void {
  ipcMainHandle('getDirectories', () => {
    const directories = store.get('directories')
    return directories
  })
  ipcMainHandle('addDirectoriesFromFolder', () => addDirectoriesFromFolder())
  ipcMainHandle('removeDirectory', async (_event, id: string | undefined) => {
    await removeDirectory(id)
  })
  ipcMainHandle('updateDirectory', (_event, id: string, data: DataToUpdate) => updateDirectoryData(id, data))
  ipcMainHandle('runService', (_event, id: string) => runService(id, mainWindow))
  ipcMainHandle('stopService', (_event, id: string) => stopProcess(id))
  ipcMainHandle('checkServiceState', (_event, id: string) => isServiceRunning(id))
  ipcMainHandle('openProjectInBrowser', (_event, id: string) => openProjectInBrowser(id))
  ipcMainHandle('openExternalUrl', (_event, url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
  })
  // Shell (interactive terminal)
  ipcMainHandle('shellSpawn', (_event, cwd: string) => spawnShell(cwd))
  ipcMainHandle('shellWrite', (_event, shellId: string, data: string) => writeShell(shellId, data))
  ipcMainHandle('shellResize', (_event, shellId: string, cols: number, rows: number) => resizeShell(shellId, cols, rows))
  ipcMainHandle('shellKill', (_event, shellId: string) => killShell(shellId))

  ipcMainHandle('openInIDE', (_event, id: string, cliCommand: string) => openInIDE(id, cliCommand))
  ipcMainHandle('getAvailableIDEs', () => getAvailableIDEs())
  ipcMainHandle('openInFinder', (_event, filePath: string) => shell.showItemInFolder(filePath))

  // Log file operations
  ipcMainHandle('getLogs', async (_event, dirId: string) => {
    return await readLogFile(dirId)
  })
  ipcMainHandle('clearLogs', async (_event, dirId: string) => {
    try {
      await clearLogFile(dirId)
      return true
    } catch (error) {
      console.error('Failed to clear logs:', error)
      return false
    }
  })

  // Pagination and search operations
  ipcMainHandle('getLogsChunk', async (_event, dirId: string, offset: number, limit: number) => {
    return await readLogFileChunk(dirId, offset, limit)
  })
  ipcMainHandle('getLogsTail', async (_event, dirId: string, limit: number) => {
    return await readLogFileTail(dirId, limit)
  })
  ipcMainHandle('getLogFileLineCount', async (_event, dirId: string) => {
    return await getLogFileLineCount(dirId)
  })
  ipcMainHandle('searchLogs', async (_event, dirId: string, searchTerm: string) => {
    return await searchLogFile(dirId, searchTerm)
  })
  ipcMainHandle('getLogsRange', async (_event, dirId: string, startLine: number, endLine: number) => {
    return await readLogFileRange(dirId, startLine, endLine)
  })

  // DynamoDB connection handlers
  ipcMainHandle('getDynamoDBConnections', () => dynamoDBManager.getConnections())
  ipcMainHandle('saveDynamoDBConnection', (_event, config: DynamoDBConnectionConfig) => dynamoDBManager.saveConnection(config))
  ipcMainHandle('deleteDynamoDBConnection', (_event, id: string) => dynamoDBManager.deleteConnection(id))
  ipcMainHandle('getActiveDynamoDBConnection', () => dynamoDBManager.getActiveConnectionId())
  ipcMainHandle('setActiveDynamoDBConnection', (_event, id: string) => dynamoDBManager.setActiveConnection(id))
  ipcMainHandle('testDynamoDBConnection', (_event, id: string) => dynamoDBManager.testConnection(id))

  // DynamoDB handlers
  ipcMainHandle('dynamodbListTables', async () => {
    return await listTables()
  })
  ipcMainHandle('dynamodbDescribeTable', async (_event, tableName: string) => {
    return await describeTable(tableName)
  })
  ipcMainHandle('dynamodbScanTable', async (_event, tableName: string, options: DynamoDBScanOptions) => {
    return await scanTable(tableName, options)
  })
  ipcMainHandle('dynamodbQueryTable', async (_event, tableName: string, options: QueryOptions) => {
    return await queryTable(tableName, options)
  })
  ipcMainHandle('dynamodbGetItem', async (_event, tableName: string, key: Record<string, unknown>) => {
    return await getItem(tableName, key)
  })
  ipcMainHandle('dynamodbPutItem', async (_event, tableName: string, item: Record<string, unknown>) => {
    return await putItem(tableName, item)
  })
  ipcMainHandle('dynamodbDeleteItem', async (_event, tableName: string, key: Record<string, unknown>) => {
    return await deleteItem(tableName, key)
  })
}
