import { BrowserWindow } from 'electron'
import { ipcMainHandle } from '../utils/ipc-handle.js'
import { store } from '../storage/store.js'
import { mongoManager } from '../mongodb/mongo-manager.js'
import { getDatabases, createDatabase, dropDatabase } from '../mongodb/database-operations.js'
import { getCollections, createCollection as mongoCreateCol, dropCollection, renameCollection, getCollectionStats } from '../mongodb/collection-operations.js'
import { findDocuments, findDocumentById, insertDocument, updateDocument, deleteDocument as mongoDeleteDoc, insertMany, deleteMany } from '../mongodb/document-operations.js'
import { explainQuery, runAggregation } from '../mongodb/query-executor.js'
import { getIndexes, createIndex, dropIndex } from '../mongodb/index-operations.js'
import { analyzeSchema } from '../mongodb/schema-analyzer.js'

export function registerMongoDBHandlers(mainWindow: BrowserWindow): void {
  mongoManager.setMainWindow(mainWindow)
  mongoManager.autoReconnect()

  ipcMainHandle('mongoGetConnections', () => mongoManager.getConnections())
  ipcMainHandle('mongoGetActiveConnectionId', () => mongoManager.getActiveConnectionId())
  ipcMainHandle('mongoSaveConnection', (_event, config: MongoConnectionConfig) => mongoManager.saveConnection(config))
  ipcMainHandle('mongoDeleteConnection', (_event, id: string) => mongoManager.deleteConnection(id))
  ipcMainHandle('mongoTestConnection', (_event, id: string) => mongoManager.testConnection(id))
  ipcMainHandle('mongoSetActiveConnection', (_event, id: string) => mongoManager.setActiveConnection(id))
  ipcMainHandle('mongoDisconnect', () => mongoManager.disconnect())
  ipcMainHandle('mongoGetDatabases', async () => getDatabases())
  ipcMainHandle('mongoCreateDatabase', async (_event, dbName: string, collectionName: string) => createDatabase(dbName, collectionName))
  ipcMainHandle('mongoDropDatabase', async (_event, dbName: string) => dropDatabase(dbName))
  ipcMainHandle('mongoGetCollections', async (_event, database: string) => getCollections(database))
  ipcMainHandle('mongoCreateCollection', async (_event, database: string, name: string) => mongoCreateCol(database, name))
  ipcMainHandle('mongoDropCollection', async (_event, database: string, name: string) => dropCollection(database, name))
  ipcMainHandle('mongoRenameCollection', async (_event, database: string, oldName: string, newName: string) => renameCollection(database, oldName, newName))
  ipcMainHandle('mongoGetCollectionStats', async (_event, database: string, collection: string) => getCollectionStats(database, collection))
  ipcMainHandle('mongoFindDocuments', async (_event, database: string, collection: string, options: MongoQueryOptions) => findDocuments(database, collection, options))
  ipcMainHandle('mongoFindDocumentById', async (_event, database: string, collection: string, id: string) => findDocumentById(database, collection, id))
  ipcMainHandle('mongoInsertDocument', async (_event, database: string, collection: string, document: Record<string, unknown>) => insertDocument(database, collection, document))
  ipcMainHandle('mongoUpdateDocument', async (_event, database: string, collection: string, id: string, update: Record<string, unknown>) => updateDocument(database, collection, id, update))
  ipcMainHandle('mongoDeleteDocument', async (_event, database: string, collection: string, id: string) => mongoDeleteDoc(database, collection, id))
  ipcMainHandle('mongoInsertMany', async (_event, database: string, collection: string, documents: Record<string, unknown>[]) => insertMany(database, collection, documents))
  ipcMainHandle('mongoDeleteMany', async (_event, database: string, collection: string, filter: Record<string, unknown>) => deleteMany(database, collection, filter))
  ipcMainHandle('mongoExplainQuery', async (_event, database: string, collection: string, options: MongoQueryOptions) => explainQuery(database, collection, options))
  ipcMainHandle('mongoRunAggregation', async (_event, database: string, collection: string, pipeline: MongoAggregationStage[]) => runAggregation(database, collection, pipeline))
  ipcMainHandle('mongoAnalyzeSchema', async (_event, database: string, collection: string, sampleSize?: number) => analyzeSchema(database, collection, sampleSize))
  ipcMainHandle('mongoGetIndexes', async (_event, database: string, collection: string) => getIndexes(database, collection))
  ipcMainHandle('mongoCreateIndex', async (_event, database: string, collection: string, options: MongoCreateIndexOptions) => createIndex(database, collection, options))
  ipcMainHandle('mongoDropIndex', async (_event, database: string, collection: string, indexName: string) => dropIndex(database, collection, indexName))
  // TODO: Implement MongoDB validation rules, export/import functionality
  ipcMainHandle('mongoGetValidationRules', async () => null)
  ipcMainHandle('mongoSetValidationRules', async () => { })
  ipcMainHandle('mongoExportCollection', async () => { })
  ipcMainHandle('mongoImportDocuments', async () => 0)
  ipcMainHandle('mongoGetSavedQueries', () => store.get('mongoSavedQueries'))
  ipcMainHandle('mongoSaveQuery', (_event, query: MongoSavedQuery) => {
    const queries = store.get('mongoSavedQueries')
    const existing = queries.findIndex(q => q.id === query.id)
    if (existing >= 0) {
      store.set('mongoSavedQueries', queries.map((q, i) => i === existing ? query : q))
    } else {
      store.set('mongoSavedQueries', [...queries, query])
    }
  })
  ipcMainHandle('mongoDeleteSavedQuery', (_event, id: string) => {
    store.set('mongoSavedQueries', store.get('mongoSavedQueries').filter(q => q.id !== id))
  })
}
