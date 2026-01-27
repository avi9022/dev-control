import { mongoManager } from './mongo-manager.js'

export async function getIndexes(
  database: string,
  collection: string
): Promise<MongoIndex[]> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)

    const rawIndexes = await coll.listIndexes().toArray()

    let indexStats: Map<string, { ops: number; since: string }> = new Map()
    try {
      const statsResult = await coll.aggregate([{ $indexStats: {} }]).toArray()
      for (const stat of statsResult) {
        indexStats = new Map([
          ...indexStats,
          [
            stat.name as string,
            {
              ops: (stat.accesses as { ops: number })?.ops || 0,
              since: (stat.accesses as { since: Date })?.since?.toISOString() || ''
            }
          ]
        ])
      }
    } catch {
      // $indexStats may not be available on all server versions
    }

    return rawIndexes.map((idx: Record<string, unknown>) => {
      const stats = indexStats.get(idx.name as string) || { ops: 0, since: '' }

      return {
        name: idx.name as string,
        key: idx.key as MongoIndex['key'],
        unique: (idx.unique as boolean) || false,
        sparse: (idx.sparse as boolean) || false,
        expireAfterSeconds: idx.expireAfterSeconds as number | undefined,
        partialFilterExpression: idx.partialFilterExpression as Record<string, unknown> | undefined,
        background: (idx.background as boolean) || false,
        size: 0,
        usage: stats
      }
    })
  } catch (error) {
    throw new Error(
      `Failed to get indexes for "${database}.${collection}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function createIndex(
  database: string,
  collection: string,
  options: MongoCreateIndexOptions
): Promise<string> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)

    const indexOptions: Record<string, unknown> = {}
    if (options.name) {
      indexOptions.name = options.name
    }
    if (options.unique) {
      indexOptions.unique = options.unique
    }
    if (options.sparse) {
      indexOptions.sparse = options.sparse
    }
    if (options.expireAfterSeconds !== undefined) {
      indexOptions.expireAfterSeconds = options.expireAfterSeconds
    }
    if (options.partialFilterExpression) {
      indexOptions.partialFilterExpression = options.partialFilterExpression
    }

    const result = await coll.createIndex(options.key, indexOptions)
    return result
  } catch (error) {
    throw new Error(
      `Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function dropIndex(
  database: string,
  collection: string,
  indexName: string
): Promise<void> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)
    await coll.dropIndex(indexName)
  } catch (error) {
    throw new Error(
      `Failed to drop index "${indexName}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
