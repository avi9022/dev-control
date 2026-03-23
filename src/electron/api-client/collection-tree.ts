import crypto from 'node:crypto'

// ─── Recursive Tree Helpers ───

export function findItemInTree(
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

export function addItemToTree(
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

export function updateItemInTree(
  items: ApiCollectionItem[],
  itemId: string,
  config: ApiRequestConfig
): ApiCollectionItem[] {
  return items.map((item) => {
    if (item.id === itemId) {
      return {
        ...item,
        // Preserve existing name - use renameItem to change name
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

export function renameItemInTree(
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

export function deepCloneItem(
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

export function insertAfterItem(
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

export function deleteItemFromTree(
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

export function insertItemAtPosition(
  items: ApiCollectionItem[],
  newItem: ApiCollectionItem,
  targetId: string | null,
  position: 'before' | 'after' | 'inside'
): ApiCollectionItem[] {
  // If no target, insert at the end
  if (!targetId) {
    return [...items, newItem]
  }

  const result: ApiCollectionItem[] = []
  for (const item of items) {
    if (item.id === targetId) {
      if (position === 'before') {
        result.push(newItem)
        result.push(item)
      } else if (position === 'after') {
        result.push(item)
        result.push(newItem)
      } else if (position === 'inside' && item.type === 'folder') {
        result.push({
          ...item,
          items: [...(item.items || []), newItem],
        })
      } else {
        result.push(item)
      }
    } else if (item.items) {
      result.push({
        ...item,
        items: insertItemAtPosition(item.items, newItem, targetId, position),
      })
    } else {
      result.push(item)
    }
  }
  return result
}
