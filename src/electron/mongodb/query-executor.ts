import { mongoManager } from './mongo-manager.js'

export async function explainQuery(
  database: string,
  collection: string,
  options: MongoQueryOptions
): Promise<MongoExplainResult> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)

    const filter = options.filter || {}
    const cursor = coll.find(filter)

    if (options.projection) {
      cursor.project(options.projection)
    }
    if (options.sort) {
      cursor.sort(options.sort)
    }
    if (options.skip !== undefined) {
      cursor.skip(options.skip)
    }
    if (options.limit !== undefined) {
      cursor.limit(options.limit)
    }

    const explanation = await cursor.explain('executionStats') as Record<string, unknown>

    const executionStats = (explanation.executionStats || {}) as Record<string, unknown>

    return {
      queryPlanner: (explanation.queryPlanner || {}) as Record<string, unknown>,
      executionStats: {
        nReturned: (executionStats.nReturned as number) || 0,
        executionTimeMillis: (executionStats.executionTimeMillis as number) || 0,
        totalKeysExamined: (executionStats.totalKeysExamined as number) || 0,
        totalDocsExamined: (executionStats.totalDocsExamined as number) || 0,
        indexUsed: extractIndexUsed(explanation)
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to explain query: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

function extractIndexUsed(explanation: Record<string, unknown>): string | undefined {
  const queryPlanner = explanation.queryPlanner as Record<string, unknown> | undefined
  if (!queryPlanner) return undefined

  const winningPlan = queryPlanner.winningPlan as Record<string, unknown> | undefined
  if (!winningPlan) return undefined

  const inputStage = winningPlan.inputStage as Record<string, unknown> | undefined
  if (inputStage?.indexName) {
    return inputStage.indexName as string
  }

  return undefined
}

export async function runAggregation(
  database: string,
  collection: string,
  stages: MongoAggregationStage[]
): Promise<MongoAggregationResult> {
  try {
    const db = mongoManager.getDb(database)
    const coll = db.collection(collection)

    const enabledStages = stages.filter(s => s.enabled)
    const pipeline = enabledStages.map(stage => ({
      [stage.operator]: stage.definition
    }))

    const startTime = performance.now()
    const documents = await coll.aggregate(pipeline).toArray()
    const executionTime = performance.now() - startTime

    return {
      documents: documents as MongoDocument[],
      executionTime,
      stages: enabledStages.length
    }
  } catch (error) {
    throw new Error(
      `Failed to run aggregation: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
