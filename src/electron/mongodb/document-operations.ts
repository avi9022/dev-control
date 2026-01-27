import { ObjectId, type Filter, type Document } from 'mongodb'
import { mongoManager } from './mongo-manager.js'

function toObjectIdFilter(id: string): Filter<Document> {
  const isObjectIdHex = /^[a-f\d]{24}$/i.test(id)
  return { _id: isObjectIdHex ? new ObjectId(id) : id } as Filter<Document>
}

export async function findDocuments(
  database: string,
  collection: string,
  options: MongoQueryOptions
): Promise<MongoQueryResult> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)
    const startTime = performance.now()

    const filter = options.filter || {}
    const findOptions: Record<string, unknown> = {}

    if (options.projection) {
      findOptions.projection = options.projection
    }
    if (options.sort) {
      findOptions.sort = options.sort
    }
    if (options.skip !== undefined) {
      findOptions.skip = options.skip
    }
    if (options.limit !== undefined) {
      findOptions.limit = options.limit
    }
    if (options.maxTimeMS !== undefined) {
      findOptions.maxTimeMS = options.maxTimeMS
    }

    const [documents, totalCount] = await Promise.all([
      coll.find(filter, findOptions).toArray(),
      coll.countDocuments(filter)
    ])

    const executionTime = performance.now() - startTime

    return {
      documents: documents as MongoDocument[],
      totalCount,
      executionTime
    }
  } catch (error) {
    throw new Error(
      `Failed to find documents in "${database}.${collection}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function findDocumentById(
  database: string,
  collection: string,
  id: string
): Promise<MongoDocument | null> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)
    const filter = toObjectIdFilter(id)
    const document = await coll.findOne(filter)
    return document as MongoDocument | null
  } catch (error) {
    throw new Error(
      `Failed to find document by ID "${id}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function insertDocument(
  database: string,
  collection: string,
  doc: Record<string, unknown>
): Promise<string> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)
    const result = await coll.insertOne(doc)
    return result.insertedId.toString()
  } catch (error) {
    throw new Error(
      `Failed to insert document: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function updateDocument(
  database: string,
  collection: string,
  id: string,
  update: Record<string, unknown>
): Promise<void> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)
    const filter = toObjectIdFilter(id)

    const { _id, ...updateWithoutId } = update
    await coll.replaceOne(filter, updateWithoutId)
  } catch (error) {
    throw new Error(
      `Failed to update document "${id}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function deleteDocument(
  database: string,
  collection: string,
  id: string
): Promise<void> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)
    const filter = toObjectIdFilter(id)
    await coll.deleteOne(filter)
  } catch (error) {
    throw new Error(
      `Failed to delete document "${id}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function insertMany(
  database: string,
  collection: string,
  docs: Record<string, unknown>[]
): Promise<number> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)
    const result = await coll.insertMany(docs)
    return result.insertedCount
  } catch (error) {
    throw new Error(
      `Failed to insert documents: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export async function deleteMany(
  database: string,
  collection: string,
  filter: Record<string, unknown>
): Promise<number> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)
    const result = await coll.deleteMany(filter)
    return result.deletedCount
  } catch (error) {
    throw new Error(
      `Failed to delete documents: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
