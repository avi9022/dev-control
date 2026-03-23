// ─── SQL Developer types ───

interface SQLConnectionConfig {
  id: string
  name: string
  host: string
  port: number
  sid?: string
  serviceName?: string
  username: string
  password: string
  color?: string
  createdAt: number
  updatedAt: number
}

interface SQLConnectionState {
  connectionId: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  error?: string
  serverVersion?: string
  currentSchema?: string
}

interface SQLQueryResult {
  queryId: string
  columns: SQLColumn[]
  rows: unknown[][]
  rowCount: number
  affectedRows?: number
  executionTime: number
  statement: string
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL' | 'PLSQL' | 'OTHER'
  warnings?: string[]
}

interface SQLScriptResult {
  results: SQLQueryResult[]
  totalTime: number
}

interface SQLColumn {
  name: string
  type: string
  nullable: boolean
  precision?: number
  scale?: number
  maxSize?: number
}

interface SQLTableInfo {
  name: string
  schema: string
  rowCount?: number
  tablespace?: string
  comments?: string
}

interface SQLViewInfo {
  name: string
  schema: string
  isReadOnly: boolean
}

interface SQLSequenceInfo {
  name: string
  schema: string
  currentValue: number
  increment: number
  minValue: number
  maxValue: number
}

interface SQLProcedureInfo {
  name: string
  schema: string
  status: 'VALID' | 'INVALID'
}

interface SQLFunctionInfo {
  name: string
  schema: string
  status: 'VALID' | 'INVALID'
  returnType: string
}

interface SQLPackageInfo {
  name: string
  schema: string
  status: 'VALID' | 'INVALID'
}

interface SQLTriggerInfo {
  name: string
  schema: string
  status: 'ENABLED' | 'DISABLED'
  event: string
  table?: string
}

interface SQLColumnDetail {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string
  precision?: number
  scale?: number
  maxLength?: number
  isPrimaryKey: boolean
  comments?: string
}

interface SQLConstraint {
  name: string
  type: 'PRIMARY' | 'UNIQUE' | 'FOREIGN_KEY' | 'CHECK' | 'NOT_NULL'
  columns: string[]
  refTable?: string
  refColumns?: string[]
  deleteRule?: string
  status: 'ENABLED' | 'DISABLED'
}

interface SQLIndex {
  name: string
  columns: string[]
  isUnique: boolean
  type: string
  tablespace?: string
  status: 'VALID' | 'UNUSABLE'
}

interface SQLExplainPlan {
  nodes: SQLPlanNode[]
  totalCost: number
  executionTime?: number
}

interface SQLPlanNode {
  id: number
  parentId?: number
  operation: string
  options?: string
  objectName?: string
  cost?: number
  cardinality?: number
  bytes?: number
  cpuCost?: number
  ioCost?: number
  depth: number
}

interface SQLSavedQuery {
  id: string
  connectionId: string
  name: string
  sql: string
  createdAt: number
  updatedAt: number
}

interface SQLHistoryEntry {
  id: string
  connectionId: string
  sql: string
  executionTime: number
  rowCount: number
  status: 'success' | 'error'
  error?: string
  executedAt: number
}

interface SQLWorksheet {
  id: string
  name: string
  sql: string
  connectionId?: string
  lastExecutedSql?: string
  createdAt: number
  updatedAt: number
}

interface SQLMessage {
  id: string
  type: 'info' | 'error' | 'warning' | 'success'
  text: string
  timestamp: number
}

interface SQLWorksheetState {
  executing: boolean
  lastResult: SQLQueryResult | null
  scriptResult: SQLScriptResult | null
  explainResult: SQLExplainPlan | null
  messages: SQLMessage[]
  dbmsOutput: string[]
}

interface SQLObjectDescription {
  name: string
  schema: string
  type: string
  columns?: SQLColumnDetail[]
  constraints?: SQLConstraint[]
  indexes?: SQLIndex[]
  ddl?: string
}

interface SQLGrant {
  grantee: string
  privilege: string
  grantable: boolean
}
