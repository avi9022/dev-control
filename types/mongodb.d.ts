// ─── MongoDB Types ───
interface MongoConnectionConfig {
  id: string
  name: string
  connectionString: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  authSource?: string
  replicaSet?: string
  ssl?: boolean
  createdAt: number
  updatedAt: number
}

interface MongoConnectionState {
  connectionId: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  error?: string
  serverVersion?: string
}

interface MongoDatabaseCollection {
  name: string
  documentCount: number
}

interface MongoDatabase {
  name: string
  sizeOnDisk: number
  collections: MongoDatabaseCollection[]
  isEmpty: boolean
}

interface MongoCollection {
  name: string
  database: string
  type: 'collection' | 'view' | 'timeseries'
  documentCount: number
  avgDocumentSize: number
  totalSize: number
  indexCount: number
  capped?: boolean
}

interface MongoCollectionStats {
  namespace: string
  documentCount: number
  avgDocumentSize: number
  totalDataSize: number
  totalIndexSize: number
  indexSizes: Record<string, number>
  storageSize: number
  freeStorageSize: number
}

interface MongoDocument {
  _id: unknown
  [key: string]: unknown
}

interface MongoQueryOptions {
  filter: Record<string, unknown>
  projection?: Record<string, 0 | 1>
  sort?: Record<string, 1 | -1>
  skip?: number
  limit?: number
  maxTimeMS?: number
}

interface MongoQueryResult {
  documents: MongoDocument[]
  totalCount: number
  executionTime: number
}

interface MongoExplainResult {
  queryPlanner: Record<string, unknown>
  executionStats: {
    nReturned: number
    executionTimeMillis: number
    totalKeysExamined: number
    totalDocsExamined: number
    indexUsed?: string
  }
}

interface MongoIndex {
  name: string
  key: Record<string, 1 | -1 | 'text' | '2dsphere' | 'hashed'>
  unique: boolean
  sparse: boolean
  expireAfterSeconds?: number
  partialFilterExpression?: Record<string, unknown>
  background: boolean
  size: number
  usage: {
    ops: number
    since: string
  }
}

interface MongoCreateIndexOptions {
  key: Record<string, 1 | -1 | 'text' | '2dsphere' | 'hashed'>
  name?: string
  unique?: boolean
  sparse?: boolean
  expireAfterSeconds?: number
  partialFilterExpression?: Record<string, unknown>
}

interface MongoAggregationStage {
  id: string
  operator: string
  definition: Record<string, unknown>
  enabled: boolean
}

interface MongoAggregationResult {
  documents: MongoDocument[]
  executionTime: number
  stages: number
}

interface MongoSchemaField {
  name: string
  path: string
  types: MongoFieldType[]
  probability: number
  count: number
  hasNestedFields: boolean
  nestedFields?: MongoSchemaField[]
}

interface MongoFieldType {
  name: string
  count: number
  probability: number
  values?: {
    distinct: number
    sample: unknown[]
  }
}

interface MongoValidationRules {
  validator: Record<string, unknown>
  validationLevel: 'off' | 'strict' | 'moderate'
  validationAction: 'error' | 'warn'
}

interface MongoSavedQuery {
  id: string
  connectionId: string
  database: string
  collection: string
  name: string
  type: 'find' | 'aggregation'
  query?: MongoQueryOptions
  pipeline?: MongoAggregationStage[]
  createdAt: number
  updatedAt: number
}
