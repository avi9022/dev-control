import oracledb from 'oracledb'
import { sqlManager } from './sql-manager.js'

// Track running queries for cancellation
const runningQueries = new Map<string, oracledb.Connection>()

function detectStatementType(sql: string): SQLQueryResult['type'] {
  const trimmed = sql.trim().toUpperCase()
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) return 'SELECT'
  if (trimmed.startsWith('INSERT')) return 'INSERT'
  if (trimmed.startsWith('UPDATE')) return 'UPDATE'
  if (trimmed.startsWith('DELETE')) return 'DELETE'
  if (trimmed.startsWith('CREATE') || trimmed.startsWith('ALTER') || trimmed.startsWith('DROP') || trimmed.startsWith('TRUNCATE')) return 'DDL'
  if (trimmed.startsWith('BEGIN') || trimmed.startsWith('DECLARE')) return 'PLSQL'
  return 'OTHER'
}

function mapOracleType(dbType: oracledb.DbType | undefined): string {
  if (!dbType) return 'UNKNOWN'
  const typeMap = new Map<oracledb.DbType, string>([
    [oracledb.DB_TYPE_VARCHAR, 'VARCHAR2'],
    [oracledb.DB_TYPE_NUMBER, 'NUMBER'],
    [oracledb.DB_TYPE_DATE, 'DATE'],
    [oracledb.DB_TYPE_TIMESTAMP, 'TIMESTAMP'],
    [oracledb.DB_TYPE_TIMESTAMP_TZ, 'TIMESTAMP WITH TIME ZONE'],
    [oracledb.DB_TYPE_CLOB, 'CLOB'],
    [oracledb.DB_TYPE_BLOB, 'BLOB'],
    [oracledb.DB_TYPE_CHAR, 'CHAR'],
    [oracledb.DB_TYPE_NVARCHAR, 'NVARCHAR2'],
    [oracledb.DB_TYPE_NCHAR, 'NCHAR'],
    [oracledb.DB_TYPE_NCLOB, 'NCLOB'],
    [oracledb.DB_TYPE_RAW, 'RAW'],
    [oracledb.DB_TYPE_LONG, 'LONG'],
    [oracledb.DB_TYPE_LONG_RAW, 'LONG RAW'],
    [oracledb.DB_TYPE_BINARY_FLOAT, 'BINARY_FLOAT'],
    [oracledb.DB_TYPE_BINARY_DOUBLE, 'BINARY_DOUBLE'],
    [oracledb.DB_TYPE_ROWID, 'ROWID'],
    [oracledb.DB_TYPE_BOOLEAN, 'BOOLEAN'],
    [oracledb.DB_TYPE_INTERVAL_YM, 'INTERVAL YEAR TO MONTH'],
    [oracledb.DB_TYPE_INTERVAL_DS, 'INTERVAL DAY TO SECOND'],
    [oracledb.DB_TYPE_JSON, 'JSON'],
  ])
  return typeMap.get(dbType) ?? 'UNKNOWN'
}

export async function executeQuery(sql: string, params?: unknown[]): Promise<SQLQueryResult> {
  const conn = sqlManager.getConnection()
  const queryId = crypto.randomUUID()
  const startTime = Date.now()

  // Oracle oracledb driver does not accept trailing semicolons.
  // Strip them for non-PL/SQL statements (PL/SQL needs internal semicolons preserved).
  let cleanSql = sql.trim()
  const stmtType = detectStatementType(cleanSql)
  if (stmtType !== 'PLSQL') {
    cleanSql = cleanSql.replace(/;\s*$/, '')
  }

  runningQueries.set(queryId, conn)

  try {
    if (stmtType === 'SELECT') {
      const result = await conn.execute(cleanSql, params ?? [], {
        outFormat: oracledb.OUT_FORMAT_ARRAY,
        maxRows: 10000,
        fetchArraySize: 200,
      })

      const columns: SQLColumn[] = (result.metaData ?? []).map((meta: oracledb.Metadata<unknown>) => ({
        name: meta.name,
        type: mapOracleType(meta.dbType),
        nullable: meta.nullable ?? true,
        precision: meta.precision,
        scale: meta.scale,
        maxSize: meta.byteSize,
      }))

      const rows = (result.rows ?? []) as unknown[][]

      // Convert Date objects and LOBs to strings for serialization
      const serializedRows = rows.map((row) =>
        row.map((cell) => {
          if (cell === null || cell === undefined) return null
          if (cell instanceof Date) return cell.toISOString()
          if (typeof cell === 'object' && 'getData' in cell) return '[LOB]'
          return cell
        })
      )

      return {
        queryId,
        columns,
        rows: serializedRows,
        rowCount: serializedRows.length,
        executionTime: Date.now() - startTime,
        statement: sql,
        type: stmtType,
      }
    }

    // DML / DDL / PL/SQL
    const result = await conn.execute(cleanSql, params ?? [], { autoCommit: false })

    return {
      queryId,
      columns: [],
      rows: [],
      rowCount: 0,
      affectedRows: result.rowsAffected ?? 0,
      executionTime: Date.now() - startTime,
      statement: sql,
      type: stmtType,
    }
  } finally {
    runningQueries.delete(queryId)
  }
}

export async function executeScript(sql: string): Promise<SQLScriptResult> {
  const statements = splitStatements(sql)
  const results: SQLQueryResult[] = []
  const totalStart = Date.now()

  for (const stmt of statements) {
    const trimmed = stmt.trim()
    if (!trimmed) continue
    try {
      const result = await executeQuery(trimmed)
      results.push(result)
    } catch (error) {
      results.push({
        queryId: crypto.randomUUID(),
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        statement: trimmed,
        type: 'OTHER',
        warnings: [error instanceof Error ? error.message : 'Unknown error'],
      })
    }
  }

  return { results, totalTime: Date.now() - totalStart }
}

export async function cancelQuery(queryId: string): Promise<void> {
  const conn = runningQueries.get(queryId)
  if (conn) {
    try { conn.break() } catch { /* ignore */ }
    runningQueries.delete(queryId)
  }
}

export async function commit(): Promise<void> {
  const conn = sqlManager.getConnection()
  await conn.commit()
}

export async function rollback(): Promise<void> {
  const conn = sqlManager.getConnection()
  await conn.rollback()
}

export async function explainPlan(sql: string): Promise<SQLExplainPlan> {
  const conn = sqlManager.getConnection()
  const cleanSql = sql.trim().replace(/;\s*$/, '')

  // Use EXPLAIN PLAN
  const planId = `plan_${Date.now()}`
  await conn.execute(`EXPLAIN PLAN SET STATEMENT_ID = '${planId}' FOR ${cleanSql}`)

  const result = await conn.execute<unknown[]>(
    `SELECT id, parent_id, operation, options, object_name,
            cost, cardinality, bytes, cpu_cost, io_cost, depth
     FROM plan_table
     WHERE statement_id = :id
     ORDER BY id`,
    [planId],
    { outFormat: oracledb.OUT_FORMAT_ARRAY }
  )

  const nodes: SQLPlanNode[] = (result.rows ?? []).map((row) => ({
    id: row[0] as number,
    parentId: row[1] as number | undefined,
    operation: row[2] as string,
    options: row[3] as string | undefined,
    objectName: row[4] as string | undefined,
    cost: row[5] as number | undefined,
    cardinality: row[6] as number | undefined,
    bytes: row[7] as number | undefined,
    cpuCost: row[8] as number | undefined,
    ioCost: row[9] as number | undefined,
    depth: row[10] as number,
  }))

  // Clean up
  await conn.execute(`DELETE FROM plan_table WHERE statement_id = :id`, [planId])

  const totalCost = nodes.reduce((max, n) => Math.max(max, n.cost ?? 0), 0)

  return { nodes, totalCost }
}

export async function enableDbmsOutput(): Promise<void> {
  const conn = sqlManager.getConnection()
  await conn.execute('BEGIN DBMS_OUTPUT.ENABLE(NULL); END;')
}

export async function getDbmsOutput(): Promise<string[]> {
  const conn = sqlManager.getConnection()
  const lines: string[] = []

  const result = await conn.execute<{ LINE: string; STATUS: number }>(
    `BEGIN
       LOOP
         DBMS_OUTPUT.GET_LINE(:line, :status);
         EXIT WHEN :status != 0;
       END LOOP;
     END;`,
    {
      line: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32767 },
      status: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    }
  )

  if (result.outBinds) {
    const binds = result.outBinds as { line?: string; status?: number }
    if (binds.line) {
      lines.push(binds.line)
    }
  }

  return lines
}

function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inString = false
  let stringChar = ''
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    const next = sql[i + 1]

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false
      }
      current += ch
      continue
    }

    if (inBlockComment) {
      current += ch
      if (ch === '*' && next === '/') {
        current += '/'
        i++
        inBlockComment = false
      }
      continue
    }

    if (inString) {
      current += ch
      if (ch === stringChar) {
        inString = false
      }
      continue
    }

    if (ch === '-' && next === '-') {
      inLineComment = true
      current += ch
      continue
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true
      current += ch
      continue
    }

    if (ch === "'" || ch === '"') {
      inString = true
      stringChar = ch
      current += ch
      continue
    }

    if (ch === ';') {
      const trimmed = current.trim()
      if (trimmed) {
        statements.push(trimmed)
      }
      current = ''
      continue
    }

    // Handle PL/SQL blocks ending with /
    if (ch === '/' && (i === 0 || sql[i - 1] === '\n') && (i === sql.length - 1 || next === '\n' || next === undefined)) {
      const trimmed = current.trim()
      if (trimmed) {
        statements.push(trimmed)
      }
      current = ''
      continue
    }

    current += ch
  }

  const trimmed = current.trim()
  if (trimmed) {
    statements.push(trimmed)
  }

  return statements
}
