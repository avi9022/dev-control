import { BrowserWindow } from 'electron'
import { ipcMainHandle } from '../utils/ipc-handle.js'
import { store } from '../storage/store.js'
import { sqlManager } from '../sql/sql-manager.js'
import { executeQuery as sqlExecQuery, executeScript as sqlExecScript, cancelQuery as sqlCancel, explainPlan as sqlExplain, enableDbmsOutput as sqlEnableDbms, getDbmsOutput as sqlGetDbms } from '../sql/query-executor.js'
import { getSchemas as sqlGetSchemas, getTables as sqlGetTables, getViews as sqlGetViews, getSequences as sqlGetSequences, getProcedures as sqlGetProcedures, getFunctions as sqlGetFunctions, getPackages as sqlGetPackages, getTriggers as sqlGetTriggers, getTableColumns as sqlGetColumns, getTableConstraints as sqlGetConstraints, getTableIndexes as sqlGetIndexes, getTableTriggers as sqlGetTableTriggers, getObjectDDL as sqlGetDDL, getTableRowCount as sqlGetRowCount, describeObject as sqlDescribeObject, getTableGrants as sqlGetGrants, getSchemaColumnMap as sqlGetSchemaColumnMap } from '../sql/schema-inspector.js'

export function registerSQLHandlers(mainWindow: BrowserWindow): void {
  sqlManager.setMainWindow(mainWindow)
  ipcMainHandle('sqlGetConnections', () => sqlManager.getConnections())
  ipcMainHandle('sqlSaveConnection', (_event, config: SQLConnectionConfig) => sqlManager.saveConnection(config))
  ipcMainHandle('sqlDeleteConnection', (_event, id: string) => sqlManager.deleteConnection(id))
  ipcMainHandle('sqlTestConnection', (_event, id: string) => sqlManager.testConnection(id))
  ipcMainHandle('sqlSetActiveConnection', (_event, id: string) => sqlManager.setActiveConnection(id))
  ipcMainHandle('sqlDisconnect', () => sqlManager.disconnect())
  ipcMainHandle('sqlGetActiveConnectionId', () => sqlManager.getActiveConnectionId())
  ipcMainHandle('sqlExecuteQuery', async (_event, sql: string, params?: unknown[]) => {
    try {
      return await sqlExecQuery(sql, params)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Query execution failed'
      throw new Error(msg)
    }
  })
  ipcMainHandle('sqlExecuteScript', async (_event, sql: string) => {
    try {
      return await sqlExecScript(sql)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Script execution failed'
      throw new Error(msg)
    }
  })
  ipcMainHandle('sqlCancelQuery', (_event, queryId: string) => sqlCancel(queryId))
  ipcMainHandle('sqlExplainPlan', async (_event, sql: string) => {
    try {
      return await sqlExplain(sql)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Explain plan failed'
      throw new Error(msg)
    }
  })
  ipcMainHandle('sqlEnableDbmsOutput', () => sqlEnableDbms())
  ipcMainHandle('sqlGetDbmsOutput', () => sqlGetDbms())
  ipcMainHandle('sqlGetSchemas', (_event, includeSystem?: boolean) => sqlGetSchemas(includeSystem))
  ipcMainHandle('sqlGetTables', (_event, schema: string) => sqlGetTables(schema))
  ipcMainHandle('sqlGetViews', (_event, schema: string) => sqlGetViews(schema))
  ipcMainHandle('sqlGetSequences', (_event, schema: string) => sqlGetSequences(schema))
  ipcMainHandle('sqlGetProcedures', (_event, schema: string) => sqlGetProcedures(schema))
  ipcMainHandle('sqlGetFunctions', (_event, schema: string) => sqlGetFunctions(schema))
  ipcMainHandle('sqlGetPackages', (_event, schema: string) => sqlGetPackages(schema))
  ipcMainHandle('sqlGetTriggers', (_event, schema: string) => sqlGetTriggers(schema))
  ipcMainHandle('sqlGetTableColumns', (_event, schema: string, table: string) => sqlGetColumns(schema, table))
  ipcMainHandle('sqlGetTableConstraints', (_event, schema: string, table: string) => sqlGetConstraints(schema, table))
  ipcMainHandle('sqlGetTableIndexes', (_event, schema: string, table: string) => sqlGetIndexes(schema, table))
  ipcMainHandle('sqlGetTableTriggers', (_event, schema: string, table: string) => sqlGetTableTriggers(schema, table))
  ipcMainHandle('sqlGetObjectDDL', (_event, schema: string, objectName: string, objectType: string) => sqlGetDDL(schema, objectName, objectType))
  ipcMainHandle('sqlGetTableRowCount', (_event, schema: string, table: string) => sqlGetRowCount(schema, table))
  ipcMainHandle('sqlDescribeObject', (_event, schema: string, name: string) => sqlDescribeObject(schema, name))
  ipcMainHandle('sqlGetTableGrants', (_event, schema: string, table: string) => sqlGetGrants(schema, table))
  ipcMainHandle('sqlGetSchemaColumnMap', (_event, schema: string) => sqlGetSchemaColumnMap(schema))
  ipcMainHandle('sqlGetHistory', () => store.get('sqlHistory'))
  ipcMainHandle('sqlClearHistory', () => store.set('sqlHistory', []))
  ipcMainHandle('sqlGetSavedQueries', () => store.get('sqlSavedQueries'))
  ipcMainHandle('sqlSaveQuery', (_event, query: SQLSavedQuery) => {
    const queries = store.get('sqlSavedQueries')
    const idx = queries.findIndex((q) => q.id === query.id)
    if (idx >= 0) {
      const updated = [...queries]
      updated[idx] = query
      store.set('sqlSavedQueries', updated)
    } else {
      store.set('sqlSavedQueries', [...queries, query])
    }
  })
  ipcMainHandle('sqlDeleteSavedQuery', (_event, id: string) => {
    const queries = store.get('sqlSavedQueries')
    store.set('sqlSavedQueries', queries.filter((q) => q.id !== id))
  })
}
