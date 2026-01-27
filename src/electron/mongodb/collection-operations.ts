import { mongoManager } from './mongo-manager.js'

export async function getCollections(database: string): Promise<MongoCollection[]> {
  try {
    const db = mongoManager.getDb(database)
    const collections = await db.listCollections().toArray()

    const results: MongoCollection[] = await Promise.all(
      collections.map(async (coll: { name: string; type?: string }) => {
        let documentCount = 0
        let avgDocumentSize = 0
        let totalSize = 0
        let indexCount = 0
        let capped = false

        try {
          const stats = await db.command({ collStats: coll.name })
          documentCount = stats.count || 0
          avgDocumentSize = stats.avgObjSize || 0
          totalSize = stats.totalSize || stats.size || 0
          indexCount = stats.nindexes || 0
          capped = stats.capped || false
        } catch {
          // Stats may not be available for views or system collections
        }

        return {
          name: coll.name,
          database,
          type: (coll.type === 'view' ? 'view' : coll.type === 'timeseries' ? 'timeseries' : 'collection') as MongoCollection['type'],
          documentCount,
          avgDocumentSize,
          totalSize,
          indexCount,
          capped: capped || undefined
        }
      })
    )

    return results
  } catch (error) {
    throw new Error(
      `Failed to list collections for "${database}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function createCollection(database: string, name: string): Promise<void> {
  try {
    const db = mongoManager.getDb(database)
    await db.createCollection(name)
  } catch (error) {
    throw new Error(
      `Failed to create collection "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function dropCollection(database: string, name: string): Promise<void> {
  try {
    const db = mongoManager.getDb(database)
    const collection = db.collection(name)
    await collection.drop()
  } catch (error) {
    throw new Error(
      `Failed to drop collection "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function renameCollection(
  database: string,
  oldName: string,
  newName: string
): Promise<void> {
  try {
    const db = mongoManager.getDb(database)
    const collection = db.collection(oldName)
    await collection.rename(newName)
  } catch (error) {
    throw new Error(
      `Failed to rename collection "${oldName}" to "${newName}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function getCollectionStats(
  database: string,
  collection: string
): Promise<MongoCollectionStats> {
  try {
    const db = mongoManager.getDb(database)
    const stats = await db.command({ collStats: collection })

    return {
      namespace: stats.ns || `${database}.${collection}`,
      documentCount: stats.count || 0,
      avgDocumentSize: stats.avgObjSize || 0,
      totalDataSize: stats.size || 0,
      totalIndexSize: stats.totalIndexSize || 0,
      indexSizes: stats.indexSizes || {},
      storageSize: stats.storageSize || 0,
      freeStorageSize: stats.freeStorageSize || 0
    }
  } catch (error) {
    throw new Error(
      `Failed to get stats for "${database}.${collection}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
