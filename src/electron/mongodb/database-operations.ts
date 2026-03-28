import { mongoManager } from './mongo-manager.js'

export async function getDatabases(): Promise<MongoDatabase[]> {
  try {
    const client = mongoManager.getClient()
    const adminDb = client.db('admin')
    const result = await adminDb.command({ listDatabases: 1 })

    const databases: MongoDatabase[] = await Promise.all(
      (result.databases as Array<{ name: string; sizeOnDisk: number; empty: boolean }>).map(
        async (db) => {
          const collections: MongoDatabaseCollection[] = []
          try {
            const dbInstance = client.db(db.name)
            const colls = await dbInstance.listCollections().toArray()
            for (const col of colls) {
              let documentCount = 0
              try {
                documentCount = await dbInstance.collection(col.name).estimatedDocumentCount()
              } catch {
                // Ignore count errors
              }
              collections.push({ name: col.name, documentCount })
            }
          } catch {
            // Ignore errors when listing collections
          }

          return {
            name: db.name,
            sizeOnDisk: db.sizeOnDisk || 0,
            collections,
            isEmpty: db.empty ?? false
          }
        }
      )
    )

    return databases
  } catch (error) {
    throw new Error(
      `Failed to list databases: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function createDatabase(dbName: string, collectionName: string): Promise<void> {
  try {
    const client = mongoManager.getClient()
    const db = client.db(dbName)
    await db.createCollection(collectionName)
  } catch (error) {
    throw new Error(
      `Failed to create database "${dbName}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function dropDatabase(dbName: string): Promise<void> {
  try {
    const client = mongoManager.getClient()
    const db = client.db(dbName)
    await db.dropDatabase()
  } catch (error) {
    throw new Error(
      `Failed to drop database "${dbName}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
