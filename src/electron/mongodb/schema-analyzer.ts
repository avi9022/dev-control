import { mongoManager } from './mongo-manager.js'

interface FieldTracker {
  types: Map<string, number>
  total: number
}

export async function analyzeSchema(
  database: string,
  collection: string,
  sampleSize: number = 1000
): Promise<MongoSchemaField[]> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)

    const documents = await coll
      .aggregate([{ $sample: { size: sampleSize } }])
      .toArray()

    if (documents.length === 0) {
      return []
    }

    const totalDocs = documents.length
    const fieldMap: Map<string, FieldTracker> = new Map()

    for (const doc of documents) {
      traverseDocument(doc as Record<string, unknown>, '', fieldMap)
    }

    return buildSchemaTree(fieldMap, totalDocs)
  } catch (error) {
    throw new Error(
      `Failed to analyze schema for "${database}.${collection}": ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

function traverseDocument(
  obj: Record<string, unknown>,
  prefix: string,
  fieldMap: Map<string, FieldTracker>
): void {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    const typeName = getTypeName(value)

    const tracker = fieldMap.get(path) || { types: new Map(), total: 0 }
    const currentTypeCount = tracker.types.get(typeName) || 0

    const updatedTypes = new Map(tracker.types)
    updatedTypes.set(typeName, currentTypeCount + 1)

    fieldMap.set(path, {
      types: updatedTypes,
      total: tracker.total + 1
    })

    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      traverseDocument(value as Record<string, unknown>, path, fieldMap)
    }
  }
}

function getTypeName(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'array'
  if (value instanceof Date) return 'date'

  const valueObj = value as Record<string, unknown>
  if (typeof value === 'object' && valueObj._bsontype === 'ObjectId') return 'objectId'
  if (typeof value === 'object' && valueObj._bsontype === 'Decimal128') return 'decimal128'
  if (typeof value === 'object' && valueObj._bsontype === 'Binary') return 'binary'

  return typeof value
}

function buildSchemaTree(
  fieldMap: Map<string, FieldTracker>,
  totalDocs: number
): MongoSchemaField[] {
  const rootFields: MongoSchemaField[] = []
  const sortedPaths = Array.from(fieldMap.keys()).sort()

  const processedPaths = new Set<string>()

  for (const path of sortedPaths) {
    const parts = path.split('.')
    if (parts.length === 1) {
      const field = buildFieldFromTracker(path, path, fieldMap, totalDocs, sortedPaths)
      rootFields.push(field)
      processedPaths.add(path)
    }
  }

  return rootFields
}

function buildFieldFromTracker(
  name: string,
  path: string,
  fieldMap: Map<string, FieldTracker>,
  totalDocs: number,
  allPaths: string[]
): MongoSchemaField {
  const tracker = fieldMap.get(path)
  if (!tracker) {
    return {
      name,
      path,
      types: [],
      probability: 0,
      count: 0,
      hasNestedFields: false
    }
  }

  const types: MongoFieldType[] = Array.from(tracker.types.entries()).map(
    ([typeName, count]) => ({
      name: typeName,
      count,
      probability: count / tracker.total
    })
  )

  const childPrefix = `${path}.`
  const directChildren = allPaths.filter(p => {
    if (!p.startsWith(childPrefix)) return false
    const remainder = p.slice(childPrefix.length)
    return !remainder.includes('.')
  })

  const hasNestedFields = directChildren.length > 0
  const nestedFields = hasNestedFields
    ? directChildren.map(childPath => {
        const childName = childPath.slice(childPrefix.length)
        return buildFieldFromTracker(childName, childPath, fieldMap, totalDocs, allPaths)
      })
    : undefined

  return {
    name,
    path,
    types,
    probability: tracker.total / totalDocs,
    count: tracker.total,
    hasNestedFields,
    nestedFields
  }
}
