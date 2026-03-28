// DynamoDB types
interface DynamoDBTableInfo {
  tableName: string
  tableStatus: string
  itemCount: number
  tableSizeBytes: number
  creationDateTime?: Date
  keySchema: Array<{
    attributeName: string
    keyType: 'HASH' | 'RANGE'
  }>
  attributeDefinitions: Array<{
    attributeName: string
    attributeType: 'S' | 'N' | 'B'
  }>
  globalSecondaryIndexes?: Array<{
    indexName: string
    keySchema: Array<{
      attributeName: string
      keyType: 'HASH' | 'RANGE'
    }>
  }>
  localSecondaryIndexes?: Array<{
    indexName: string
    keySchema: Array<{
      attributeName: string
      keyType: 'HASH' | 'RANGE'
    }>
  }>
}

interface DynamoDBScanOptions {
  limit?: number
  exclusiveStartKey?: Record<string, unknown>
  filterExpression?: string
  expressionAttributeNames?: Record<string, string>
  expressionAttributeValues?: Record<string, unknown>
}

type DynamoDBSKOperator = '=' | '<' | '<=' | '>' | '>=' | 'begins_with' | 'between'

interface DynamoDBQueryOptions {
  indexName?: string
  pkValue: string | number
  pkName: string
  skName?: string
  skValue?: string | number
  skValue2?: string | number
  skOperator?: DynamoDBSKOperator
  limit?: number
  exclusiveStartKey?: Record<string, unknown>
  scanIndexForward?: boolean
  filterExpression?: string
  filterNames?: Record<string, string>
  filterValues?: Record<string, unknown>
}

interface DynamoDBScanResult {
  items: Record<string, unknown>[]
  lastEvaluatedKey?: Record<string, unknown>
  count: number
  scannedCount: number
}

// DynamoDB Connection Types
type DynamoDBConnectionMethod = 'custom-endpoint' | 'aws-credentials' | 'aws-profile'

interface DynamoDBConnectionConfig {
  id: string
  name: string
  connectionMethod: DynamoDBConnectionMethod
  region: string
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
  profileName?: string
}

interface DynamoDBConnectionState {
  connectionId: string
  isConnected: boolean
  lastError?: string
  lastChecked?: number
}
