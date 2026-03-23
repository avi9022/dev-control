import crypto from 'node:crypto'
import { BrowserWindow } from 'electron'
import { store } from '../storage/store.js'
import { ipcWebContentsSend } from '../utils/ipc-handle.js'
import {
  findItemInTree,
  addItemToTree,
  updateItemInTree,
  renameItemInTree,
  deepCloneItem,
  insertAfterItem,
  deleteItemFromTree,
  insertItemAtPosition,
} from './collection-tree.js'

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

  reorderCollection(
    workspaceId: string,
    collectionId: string,
    targetCollectionId: string | null,
    position: 'before' | 'after'
  ): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w

      const collection = w.collections.find(c => c.id === collectionId)
      if (!collection) return w

      // Remove the collection from its current position
      const collectionsWithoutMoved = w.collections.filter(c => c.id !== collectionId)

      // If no target, add at the end
      if (!targetCollectionId) {
        return {
          ...w,
          collections: [...collectionsWithoutMoved, collection],
          updatedAt: now,
        }
      }

      // Insert at the target position
      const newCollections: ApiCollection[] = []
      for (const c of collectionsWithoutMoved) {
        if (c.id === targetCollectionId) {
          if (position === 'before') {
            newCollections.push(collection)
            newCollections.push(c)
          } else {
            newCollections.push(c)
            newCollections.push(collection)
          }
        } else {
          newCollections.push(c)
        }
      }

      return {
        ...w,
        collections: newCollections,
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

  moveItem(
    workspaceId: string,
    sourceCollectionId: string,
    itemId: string,
    targetCollectionId: string,
    targetId: string | null,
    position: 'before' | 'after' | 'inside'
  ): void {
    const now = Date.now()
    let movedItem: ApiCollectionItem | null = null

    // First, find and extract the item from source collection
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w

      // Find the item first
      const sourceCollection = w.collections.find(c => c.id === sourceCollectionId)
      if (sourceCollection) {
        movedItem = findItemInTree(sourceCollection.items, itemId)
      }

      return {
        ...w,
        collections: w.collections.map((c) => {
          if (c.id !== sourceCollectionId) return c
          return {
            ...c,
            items: deleteItemFromTree(c.items, itemId),
            updatedAt: now,
          }
        }),
        updatedAt: now,
      }
    })

    if (!movedItem) return

    // Then insert at target position
    const finalWorkspaces = workspaces.map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: w.collections.map((c) => {
          if (c.id !== targetCollectionId) return c
          return {
            ...c,
            items: insertItemAtPosition(c.items, movedItem!, targetId, position),
            updatedAt: now,
          }
        }),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', finalWorkspaces)
    this.emitWorkspaces(finalWorkspaces)
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

  // ─── Auth Management ───

  updateFolderAuth(
    workspaceId: string,
    collectionId: string,
    folderId: string,
    auth: ApiAuth
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
            items: this.updateFolderAuthInTree(c.items, folderId, auth),
            updatedAt: now,
          }
        }),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  private updateFolderAuthInTree(
    items: ApiCollectionItem[],
    folderId: string,
    auth: ApiAuth
  ): ApiCollectionItem[] {
    return items.map((item) => {
      if (item.id === folderId && item.type === 'folder') {
        return { ...item, auth }
      }
      if (item.items) {
        return {
          ...item,
          items: this.updateFolderAuthInTree(item.items, folderId, auth),
        }
      }
      return item
    })
  }

  updateCollectionAuth(
    workspaceId: string,
    collectionId: string,
    auth: ApiAuth
  ): void {
    const now = Date.now()
    const workspaces = this.getWorkspaces().map((w) => {
      if (w.id !== workspaceId) return w
      return {
        ...w,
        collections: w.collections.map((c) => {
          if (c.id !== collectionId) return c
          return { ...c, auth, updatedAt: now }
        }),
        updatedAt: now,
      }
    })

    store.set('apiWorkspaces', workspaces)
    this.emitWorkspaces(workspaces)
  }

  getResolvedAuth(
    workspaceId: string,
    collectionId: string,
    requestId: string
  ): ResolvedAuthInfo | null {
    const workspace = this.getWorkspaces().find((w) => w.id === workspaceId)
    if (!workspace) return null

    const collection = workspace.collections.find((c) => c.id === collectionId)
    if (!collection) return null

    const path = this.findItemPath(collection.items, requestId)
    if (!path) return null

    const request = path[path.length - 1]
    if (!request || request.type !== 'request') return null

    // Check request's own auth first (if not inherit)
    if (request.request?.auth && request.request.auth.type !== 'inherit' && request.request.auth.type !== 'none') {
      return {
        auth: request.request.auth,
        source: 'request',
        sourceId: request.id,
        sourceName: request.name,
      }
    }

    // Walk up through folders (reverse order, skip the request itself)
    const folders = path.slice(0, -1).reverse()
    for (const folder of folders) {
      if (folder.auth && folder.auth.type !== 'inherit' && folder.auth.type !== 'none') {
        return {
          auth: folder.auth,
          source: 'folder',
          sourceId: folder.id,
          sourceName: folder.name,
        }
      }
    }

    // Check collection auth
    if (collection.auth && collection.auth.type !== 'inherit' && collection.auth.type !== 'none') {
      return {
        auth: collection.auth,
        source: 'collection',
        sourceId: collection.id,
        sourceName: collection.name,
      }
    }

    return null
  }

  private findItemPath(
    items: ApiCollectionItem[],
    targetId: string,
    path: ApiCollectionItem[] = []
  ): ApiCollectionItem[] | null {
    for (const item of items) {
      if (item.id === targetId) {
        return [...path, item]
      }
      if (item.type === 'folder' && item.items) {
        const found = this.findItemPath(item.items, targetId, [...path, item])
        if (found) return found
      }
    }
    return null
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
