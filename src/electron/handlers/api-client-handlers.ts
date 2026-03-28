import { BrowserWindow } from 'electron'
import { ipcMainHandle } from '../utils/ipc-handle.js'
import { store } from '../storage/store.js'
import { apiClientManager } from '../api-client/api-client-manager.js'
import { executeRequest, cancelActiveRequest } from '../api-client/request-executor.js'
import { importPostmanCollection, importPostmanEnvironment, importPostmanCollectionFromPath } from '../api-client/postman-importer.js'
import { exportPostmanCollection } from '../api-client/postman-exporter.js'

export function registerApiClientHandlers(mainWindow: BrowserWindow): void {
  apiClientManager.setMainWindow(mainWindow)

  ipcMainHandle('apiGetWorkspaces', () => apiClientManager.getWorkspaces())
  ipcMainHandle('apiCreateWorkspace', (_event, name: string) => apiClientManager.createWorkspace(name))
  ipcMainHandle('apiDeleteWorkspace', (_event, id: string) => apiClientManager.deleteWorkspace(id))
  ipcMainHandle('apiSetActiveWorkspace', (_event, id: string) => apiClientManager.setActiveWorkspace(id))
  ipcMainHandle('apiGetActiveWorkspaceId', () => store.get('activeApiWorkspaceId') ?? null)
  ipcMainHandle('apiImportPostmanCollection', async (_event, workspaceId: string) => {
    const collections = await importPostmanCollection()
    for (const collection of collections) {
      apiClientManager.addCollectionToWorkspace(workspaceId, collection)
    }
    return collections
  })
  ipcMainHandle('apiImportPostmanEnvironment', async (_event, workspaceId: string) => {
    const environments = await importPostmanEnvironment()
    for (const env of environments) {
      apiClientManager.addEnvironmentToWorkspace(workspaceId, env)
    }
    return environments
  })
  ipcMainHandle('apiCreateCollection', (_event, workspaceId: string, name: string) => apiClientManager.createCollection(workspaceId, name))
  ipcMainHandle('apiDeleteCollection', (_event, workspaceId: string, collectionId: string) => apiClientManager.deleteCollection(workspaceId, collectionId))
  ipcMainHandle('apiUpdateCollection', (_event, workspaceId: string, collectionId: string, data: Partial<ApiCollection>) => apiClientManager.updateCollection(workspaceId, collectionId, data))
  ipcMainHandle('apiReorderCollection', (_event, workspaceId: string, collectionId: string, targetCollectionId: string | null, position: 'before' | 'after') => apiClientManager.reorderCollection(workspaceId, collectionId, targetCollectionId, position))
  ipcMainHandle('apiAddRequest', (_event, workspaceId: string, collectionId: string, parentFolderId: string | null, config: ApiRequestConfig) => apiClientManager.addRequest(workspaceId, collectionId, parentFolderId, config))
  ipcMainHandle('apiAddFolder', (_event, workspaceId: string, collectionId: string, parentFolderId: string | null, name: string) => apiClientManager.addFolder(workspaceId, collectionId, parentFolderId, name))
  ipcMainHandle('apiUpdateRequest', (_event, workspaceId: string, collectionId: string, itemId: string, config: ApiRequestConfig) => apiClientManager.updateRequest(workspaceId, collectionId, itemId, config))
  ipcMainHandle('apiRenameItem', (_event, workspaceId: string, collectionId: string, itemId: string, name: string) => apiClientManager.renameItem(workspaceId, collectionId, itemId, name))
  ipcMainHandle('apiDuplicateItem', (_event, workspaceId: string, collectionId: string, itemId: string) => apiClientManager.duplicateItem(workspaceId, collectionId, itemId))
  ipcMainHandle('apiDeleteItem', (_event, workspaceId: string, collectionId: string, itemId: string) => apiClientManager.deleteItem(workspaceId, collectionId, itemId))
  ipcMainHandle('apiMoveItem', (_event, workspaceId: string, sourceCollectionId: string, itemId: string, targetCollectionId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => apiClientManager.moveItem(workspaceId, sourceCollectionId, itemId, targetCollectionId, targetId, position))
  ipcMainHandle('apiUpdateFolderAuth', (_event, workspaceId: string, collectionId: string, folderId: string, auth: ApiAuth) => apiClientManager.updateFolderAuth(workspaceId, collectionId, folderId, auth))
  ipcMainHandle('apiUpdateCollectionAuth', (_event, workspaceId: string, collectionId: string, auth: ApiAuth) => apiClientManager.updateCollectionAuth(workspaceId, collectionId, auth))
  ipcMainHandle('apiGetResolvedAuth', (_event, workspaceId: string, collectionId: string, requestId: string) => apiClientManager.getResolvedAuth(workspaceId, collectionId, requestId))
  ipcMainHandle('apiGetEnvironments', (_event, workspaceId: string) => apiClientManager.getEnvironments(workspaceId))
  ipcMainHandle('apiCreateEnvironment', (_event, workspaceId: string, name: string) => apiClientManager.createEnvironment(workspaceId, name))
  ipcMainHandle('apiUpdateEnvironment', (_event, workspaceId: string, envId: string, env: ApiEnvironment) => apiClientManager.updateEnvironment(workspaceId, envId, env))
  ipcMainHandle('apiDeleteEnvironment', (_event, workspaceId: string, envId: string) => apiClientManager.deleteEnvironment(workspaceId, envId))
  ipcMainHandle('apiSetActiveEnvironment', (_event, workspaceId: string, envId: string | null) => apiClientManager.setActiveEnvironment(workspaceId, envId))
  ipcMainHandle('apiSendRequest', async (_event, workspaceId: string, config: ApiRequestConfig, requestId?: string, collectionId?: string) => {
    // Resolve inherited auth if type is 'inherit'
    let finalConfig = config
    if (config.auth?.type === 'inherit' && requestId && collectionId) {
      const resolvedAuthInfo = apiClientManager.getResolvedAuth(workspaceId, collectionId, requestId)
      if (resolvedAuthInfo) {
        finalConfig = { ...config, auth: resolvedAuthInfo.auth }
      }
    }
    const response = await executeRequest(workspaceId, finalConfig)
    apiClientManager.addHistory(workspaceId, config, response)
    return response
  })
  ipcMainHandle('apiCancelRequest', () => cancelActiveRequest())
  ipcMainHandle('apiGetHistory', (_event, workspaceId: string) => apiClientManager.getHistory(workspaceId))
  ipcMainHandle('apiClearHistory', (_event, workspaceId: string) => apiClientManager.clearHistory(workspaceId))
  ipcMainHandle('apiImportPostmanCollectionFromPath', async (_event, workspaceId: string, filePath: string) => {
    const collection = await importPostmanCollectionFromPath(filePath)
    apiClientManager.addCollectionToWorkspace(workspaceId, collection)
    return collection
  })
  ipcMainHandle('apiExportPostmanCollection', (_event, workspaceId: string, collectionId: string) => {
    const workspaces = apiClientManager.getWorkspaces()
    const workspace = workspaces.find((w) => w.id === workspaceId)
    const collection = workspace?.collections.find((c) => c.id === collectionId)
    if (!collection) throw new Error('Collection not found')
    return exportPostmanCollection(collection)
  })
}
