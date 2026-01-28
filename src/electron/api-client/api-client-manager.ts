import crypto from 'node:crypto'
import { BrowserWindow } from 'electron'
import { store } from '../storage/store.js'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'

// ─── Recursive Tree Helpers ───

function findItemInTree(
  items: ApiCollectionItem[],
  itemId: string
): ApiCollectionItem | null {
  for (const item of items) {
    if (item.id === itemId) return item
    if (item.items) {
      const found = findItemInTree(item.items, itemId)
      if (found) return found
    }
  }
  return null
}

function addItemToTree(
  items: ApiCollectionItem[],
  parentFolderId: string | null,
  newItem: ApiCollectionItem
): ApiCollectionItem[] {
  if (!parentFolderId) {
    return [...items, newItem]
  }

  return items.map((item) => {
    if (item.id === parentFolderId && item.type === 'folder') {
      return {
        ...item,
        items: [...(item.items || []), newItem],
      }
    }
    if (item.items) {
      return {
        ...item,
        items: addItemToTree(item.items, parentFolderId, newItem),
      }
    }
    return item
  })
}

function updateItemInTree(
  items: ApiCollectionItem[],
  itemId: string,
  config: ApiRequestConfig
): ApiCollectionItem[] {
  return items.map((item) => {
    if (item.id === itemId) {
      return {
        ...item,
        name: config.url || item.name,
        request: config,
      }
    }
    if (item.items) {
      return {
        ...item,
        items: updateItemInTree(item.items, itemId, config),
      }
    }
    return item
  })
}

function renameItemInTree(
  items: ApiCollectionItem[],
  itemId: string,
  name: string
): ApiCollectionItem[] {
  return items.map((item) => {
    if (item.id === itemId) {
      return { ...item, name }
    }
    if (item.items) {
      return { ...item, items: renameItemInTree(item.items, itemId, name) }
    }
    return item
  })
}

function deepCloneItem(
  item: ApiCollectionItem,
  newName: string
): ApiCollectionItem {
  const cloned: ApiCollectionItem = {
    ...item,
    id: crypto.randomUUID(),
    name: newName,
    request: item.request ? { ...item.request } : undefined,
    items: item.items?.map((child) =>
      deepCloneItem(child, child.name)
    ),
  }
  return cloned
}

function insertAfterItem(
  items: ApiCollectionItem[],
  afterId: string,
  newItem: ApiCollectionItem
): ApiCollectionItem[] {
  const result: ApiCollectionItem[] = []
  for (const item of items) {
    if (item.items) {
      result.push({
        ...item,
        items: insertAfterItem(item.items, afterId, newItem),
      })
    } else {
      result.push(item)
    }
    if (item.id === afterId) {
      result.push(newItem)
    }
  }
  return result
}

function deleteItemFromTree(
  items: ApiCollectionItem[],
  itemId: string
): ApiCollectionItem[] {
  return items
    .filter((item) => item.id !== itemId)
    .map((item) => {
      if (item.items) {
        return {
          ...item,
          items: deleteItemFromTree(item.items, itemId),
        }
      }
      return item
    })
}

// ─── Manager ───

class ApiClientManager {
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  // ─── Workspace CRUD ───

  getWorkspaces(): ApiWorkspace[] {
    return store.get('apiWorkspaces') || []
  }

  createWorkspace(name: string): ApiWorkspace {
    const now = Date.now()
    const workspace: ApiWorkspace = {
      id: crypto.randomUUID(),
      name,
      collections: [],
      environments: [],
      activeEnvironmentId: null,
      createdAt: now,
      updatedAt: now,
    }

    const workspaces = [...this.getWorkspaces(), workspace]
    store.set('apiWorkspaces', workspaces)

    if (!store.get('activeApiWorkspaceId')) {
      store.set('activeApiWorkspaceId', workspace.id)
    }

    this.emitWorkspaces(workspaces)
    return workspace
  }

  deleteWorkspace(id: string): void {
    const workspaces = this.getWorkspaces().filter((w) => w.id !== id)
    store.set('apiWorkspaces', workspaces)

    if (store.get('activeApiWorkspaceId') === id) {
      store.set('activeApiWorkspaceId', workspaces[0]?.id || null)
    }

    this.emitWorkspaces(workspaces)
  }

  setActiveWorkspace(id: string): void {
    store.set('activeApiWorkspaceId', id)
    this.emitWorkspaces(this.getWorkspaces())
  }

  // ─── Collection CRUD ───

  createCollection(workspaceId: string, name: string): ApiCollection {
    const now = Date.now()
    const collection: ApiCollection = {
      id: crypto.randomUUID(),
      name,
      items: [],
      importedFrom: 'manual',
      createdAt: now,
      updatedAt: now,
    }

    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: [...w.collections, collection],
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
    return collection
  }

  addCollectionToWorkspace(workspaceId: string, collection: ApiCollection): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: [...w.collections, collection],
        updatedAt: now,
      }
    })
    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  addEnvironmentToWorkspace(workspaceId: string, env: ApiEnvironment): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        environments: [...w.environments, env],
        updatedAt: now,
      }
    })
    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  deleteCollection(workspaceId: string, collectionId: string): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: w.collections.filter((c) => c.id !== collectionId),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  updateCollection(
    workspaceId: string,
    collectionId: string,
    data: Partial<ApiCollection>
  ): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: w.collections.map((c) => {
          if (c.id !== collectionId) return c
          return { ...c, ...data, id: collectionId, updatedAt: now }
        }),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  // ─── Item CRUD ───

  addRequest(
    workspaceId: string,
    collectionId: string,
    parentFolderId: string | null,
    config: ApiRequestConfig
  ): ApiCollectionItem {
    const newItem: ApiCollectionItem = {
      id: crypto.randomUUID(),
      type: 'request',
      name: config.url || 'New Request',
      request: config,
    }

    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: w.collections.map((c) => {
          if (c.id !== collectionId) return c
          return {
            ...c,
            items: addItemToTree(c.items, parentFolderId, newItem),
            updatedAt: now,
          }
        }),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
    return newItem
  }

  addFolder(
    workspaceId: string,
    collectionId: string,
    parentFolderId: string | null,
    name: string
  ): ApiCollectionItem {
    const newItem: ApiCollectionItem = {
      id: crypto.randomUUID(),
      type: 'folder',
      name,
      items: [],
    }

    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: w.collections.map((c) => {
          if (c.id !== collectionId) return c
          return {
            ...c,
            items: addItemToTree(c.items, parentFolderId, newItem),
            updatedAt: now,
          }
        }),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
    return newItem
  }

  updateRequest(
    workspaceId: string,
    collectionId: string,
    itemId: string,
    config: ApiRequestConfig
  ): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: w.collections.map((c) => {
          if (c.id !== collectionId) return c
          return {
            ...c,
            items: updateItemInTree(c.items, itemId, config),
            updatedAt: now,
          }
        }),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  renameItem(
    workspaceId: string,
    collectionId: string,
    itemId: string,
    name: string
  ): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: w.collections.map((c) => {
          if (c.id !== collectionId) return c
          return {
            ...c,
            items: renameItemInTree(c.items, itemId, name),
            updatedAt: now,
          }
        }),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  duplicateItem(
    workspaceId: string,
    collectionId: string,
    itemId: string
  ): ApiCollectionItem | null {
    const workspace = this.getWorkspaces().find((w) => w.id === workspaceId)
    if (!workspace) return null
    const collection = workspace.collections.find((c) => c.id === collectionId)
    if (!collection) return null

    const original = findItemInTree(collection.items, itemId)
    if (!original) return null

    const cloned = deepCloneItem(original, `Copy of ${original.name}`)

    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: w.collections.map((c) => {
          if (c.id !== collectionId) return c
          return {
            ...c,
            items: insertAfterItem(c.items, itemId, cloned),
            updatedAt: now,
          }
        }),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
    return cloned
  }

  deleteItem(
    workspaceId: string,
    collectionId: string,
    itemId: string
  ): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: w.collections.map((c) => {
          if (c.id !== collectionId) return c
          return {
            ...c,
            items: deleteItemFromTree(c.items, itemId),
            updatedAt: now,
          }
        }),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  // ─── Environment CRUD ───

  getEnvironments(workspaceId: string): ApiEnvironment[] {
    const workspace = this.getWorkspaces().find((w) => w.id === workspaceId)
    return workspace?.environments || []
  }

  createEnvironment(workspaceId: string, name: string): ApiEnvironment {
    const env: ApiEnvironment = {
      id: crypto.randomUUID(),
      name,
      variables: [],
      isActive: false,
    }

    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        environments: [...w.environments, env],
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
    return env
  }

  updateEnvironment(
    workspaceId: string,
    envId: string,
    env: ApiEnvironment
  ): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        environments: w.environments.map((e) => {
          if (e.id !== envId) return e
          return { ...env, id: envId }
        }),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  deleteEnvironment(workspaceId: string, envId: string): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        environments: w.environments.filter((e) => e.id !== envId),
        activeEnvironmentId:
          w.activeEnvironmentId === envId ? null : w.activeEnvironmentId,
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  setActiveEnvironment(workspaceId: string, envId: string | null): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        activeEnvironmentId: envId,
        environments: w.environments.map((e) => ({
          ...e,
          isActive: e.id === envId,
        })),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  // ─── History ───

  getHistory(workspaceId: string): ApiHistoryEntry[] {
    const allHistory: ApiHistoryEntry[] = store.get('apiHistory') || []
    return allHistory.filter((h) => h.workspaceId === workspaceId)
  }

  addHistory(
    workspaceId: string,
    request: ApiRequestConfig,
    response: ApiResponse
  ): ApiHistoryEntry {
    const entry: ApiHistoryEntry = {
      id: crypto.randomUUID(),
      workspaceId,
      request,
      response,
      timestamp: Date.now(),
    }

    const allHistory: ApiHistoryEntry[] = store.get('apiHistory') || []
    const updatedHistory = [...allHistory, entry]
    store.set('apiHistory', updatedHistory)

    return entry
  }

  clearHistory(workspaceId: string): void {
    const allHistory: ApiHistoryEntry[] = store.get('apiHistory') || []
    const updatedHistory = allHistory.filter(
      (h) => h.workspaceId !== workspaceId
    )
    store.set('apiHistory', updatedHistory)
  }

  // ─── IPC Push ───

  private emitWorkspaces(workspaces: ApiWorkspace[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      ipcWebContentsSend(
        'subscribeApiWorkspaces',
        this.mainWindow.webContents,
        workspaces
      )
    }
  }
}

export const apiClientManager = new ApiClientManager()
