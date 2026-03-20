import oracledb from 'oracledb'
import { sqlManager } from './sql-manager.js'

function query<T>(sql: string, params: Record<string, string | number | null> = {}): Promise<T[]> {
  const conn = sqlManager.getConnection()
  return conn.execute<T>(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT })
    .then((result) => (result.rows ?? []) as T[])
}

const SYSTEM_SCHEMAS = new Set([
  'SYS', 'SYSTEM', 'DBSNMP', 'OUTLN', 'MDSYS', 'CTXSYS', 'XDB', 'WMSYS',
  'APEX_PUBLIC_USER', 'FLOWS_FILES', 'APPQOSSYS', 'DBSFWUSER',
  'REMOTE_SCHEDULER_AGENT', 'SYSBACKUP', 'SYSDG', 'SYSKM', 'SYSRAC',
  'AUDSYS', 'GGSYS', 'GSMADMIN_INTERNAL', 'GSMCATUSER', 'GSMUSER', 'DIP',
  'ORACLE_OCM', 'ORDPLUGINS', 'ORDDATA', 'SI_INFORMTN_SCHEMA', 'OJVMSYS',
  'ORDSYS', 'LBACSYS', 'DVSYS', 'DVF', 'XS$NULL', 'ANONYMOUS',
  'APEX_040000', 'APEX_050000', 'APEX_230100',
])

export async function getSchemas(includeSystem = false): Promise<string[]> {
  // Only return schemas that have accessible objects (like SQL Developer)
  const rows = await query<{ OWNER: string }>(
    `SELECT DISTINCT owner FROM all_objects
     WHERE object_type IN ('TABLE', 'VIEW', 'PACKAGE', 'PROCEDURE', 'FUNCTION', 'SEQUENCE')
     ORDER BY owner`
  )
  const all = rows.map((r) => r.OWNER)
  if (includeSystem) return all
  return all.filter((s) => !SYSTEM_SCHEMAS.has(s))
}

export async function getTables(schema: string): Promise<SQLTableInfo[]> {
  const rows = await query<{
    TABLE_NAME: string; OWNER: string; TABLESPACE_NAME: string; NUM_ROWS: number; COMMENTS: string
  }>(
    `SELECT t.table_name, t.owner, t.tablespace_name, t.num_rows,
            c.comments
     FROM all_tables t
     LEFT JOIN all_tab_comments c ON c.owner = t.owner AND c.table_name = t.table_name
     WHERE t.owner = :schema
     ORDER BY t.table_name`,
    { schema: schema.toUpperCase() }
  )

  return rows.map((r) => ({
    name: r.TABLE_NAME,
    schema: r.OWNER,
    rowCount: r.NUM_ROWS ?? undefined,
    tablespace: r.TABLESPACE_NAME ?? undefined,
    comments: r.COMMENTS ?? undefined,
  }))
}

export async function getViews(schema: string): Promise<SQLViewInfo[]> {
  const rows = await query<{ VIEW_NAME: string; OWNER: string; READ_ONLY: string }>(
    `SELECT view_name, owner, read_only
     FROM all_views
     WHERE owner = :schema
     ORDER BY view_name`,
    { schema: schema.toUpperCase() }
  )

  return rows.map((r) => ({
    name: r.VIEW_NAME,
    schema: r.OWNER,
    isReadOnly: r.READ_ONLY === 'Y',
  }))
}

export async function getSequences(schema: string): Promise<SQLSequenceInfo[]> {
  const rows = await query<{
    SEQUENCE_NAME: string; SEQUENCE_OWNER: string; LAST_NUMBER: number;
    INCREMENT_BY: number; MIN_VALUE: number; MAX_VALUE: number
  }>(
    `SELECT sequence_name, sequence_owner, last_number, increment_by, min_value, max_value
     FROM all_sequences
     WHERE sequence_owner = :schema
     ORDER BY sequence_name`,
    { schema: schema.toUpperCase() }
  )

  return rows.map((r) => ({
    name: r.SEQUENCE_NAME,
    schema: r.SEQUENCE_OWNER,
    currentValue: r.LAST_NUMBER,
    increment: r.INCREMENT_BY,
    minValue: r.MIN_VALUE,
    maxValue: r.MAX_VALUE,
  }))
}

export async function getProcedures(schema: string): Promise<SQLProcedureInfo[]> {
  const rows = await query<{ OBJECT_NAME: string; OWNER: string; STATUS: string }>(
    `SELECT object_name, owner, status
     FROM all_objects
     WHERE owner = :schema AND object_type = 'PROCEDURE'
     ORDER BY object_name`,
    { schema: schema.toUpperCase() }
  )

  return rows.map((r) => ({
    name: r.OBJECT_NAME,
    schema: r.OWNER,
    status: r.STATUS as 'VALID' | 'INVALID',
  }))
}

export async function getFunctions(schema: string): Promise<SQLFunctionInfo[]> {
  const rows = await query<{ OBJECT_NAME: string; OWNER: string; STATUS: string }>(
    `SELECT object_name, owner, status
     FROM all_objects
     WHERE owner = :schema AND object_type = 'FUNCTION'
     ORDER BY object_name`,
    { schema: schema.toUpperCase() }
  )

  return rows.map((r) => ({
    name: r.OBJECT_NAME,
    schema: r.OWNER,
    status: r.STATUS as 'VALID' | 'INVALID',
    returnType: 'UNKNOWN',
  }))
}

export async function getPackages(schema: string): Promise<SQLPackageInfo[]> {
  const rows = await query<{ OBJECT_NAME: string; OWNER: string; STATUS: string }>(
    `SELECT object_name, owner, status
     FROM all_objects
     WHERE owner = :schema AND object_type = 'PACKAGE'
     ORDER BY object_name`,
    { schema: schema.toUpperCase() }
  )

  return rows.map((r) => ({
    name: r.OBJECT_NAME,
    schema: r.OWNER,
    status: r.STATUS as 'VALID' | 'INVALID',
  }))
}

export async function getTriggers(schema: string): Promise<SQLTriggerInfo[]> {
  const rows = await query<{
    TRIGGER_NAME: string; OWNER: string; STATUS: string;
    TRIGGERING_EVENT: string; TABLE_NAME: string
  }>(
    `SELECT trigger_name, owner, status, triggering_event, table_name
     FROM all_triggers
     WHERE owner = :schema
     ORDER BY trigger_name`,
    { schema: schema.toUpperCase() }
  )

  return rows.map((r) => ({
    name: r.TRIGGER_NAME,
    schema: r.OWNER,
    status: r.STATUS as 'ENABLED' | 'DISABLED',
    event: r.TRIGGERING_EVENT,
    table: r.TABLE_NAME ?? undefined,
  }))
}

export async function getTableColumns(schema: string, table: string): Promise<SQLColumnDetail[]> {
  const rows = await query<{
    COLUMN_NAME: string; DATA_TYPE: string; NULLABLE: string;
    DATA_DEFAULT: string; DATA_PRECISION: number; DATA_SCALE: number;
    DATA_LENGTH: number; COMMENTS: string; IS_PK: number
  }>(
    `SELECT c.column_name, c.data_type, c.nullable,
            c.data_default, c.data_precision, c.data_scale, c.data_length,
            cc.comments,
            CASE WHEN pk.column_name IS NOT NULL THEN 1 ELSE 0 END AS is_pk
     FROM all_tab_columns c
     LEFT JOIN all_col_comments cc
       ON cc.owner = c.owner AND cc.table_name = c.table_name AND cc.column_name = c.column_name
     LEFT JOIN (
       SELECT acc.owner, acc.table_name, acc.column_name
       FROM all_cons_columns acc
       JOIN all_constraints ac ON ac.owner = acc.owner AND ac.constraint_name = acc.constraint_name
       WHERE ac.constraint_type = 'P'
     ) pk ON pk.owner = c.owner AND pk.table_name = c.table_name AND pk.column_name = c.column_name
     WHERE c.owner = :schema AND c.table_name = :tbl
     ORDER BY c.column_id`,
    { schema: schema.toUpperCase(), tbl: table.toUpperCase() }
  )

  return rows.map((r) => ({
    name: r.COLUMN_NAME,
    type: r.DATA_TYPE,
    nullable: r.NULLABLE === 'Y',
    defaultValue: r.DATA_DEFAULT ?? undefined,
    precision: r.DATA_PRECISION ?? undefined,
    scale: r.DATA_SCALE ?? undefined,
    maxLength: r.DATA_LENGTH ?? undefined,
    isPrimaryKey: r.IS_PK === 1,
    comments: r.COMMENTS ?? undefined,
  }))
}

export async function getTableConstraints(schema: string, table: string): Promise<SQLConstraint[]> {
  const rows = await query<{
    CONSTRAINT_NAME: string; CONSTRAINT_TYPE: string; STATUS: string;
    DELETE_RULE: string; R_TABLE: string; COLUMNS: string; R_COLUMNS: string
  }>(
    `SELECT ac.constraint_name, ac.constraint_type, ac.status, ac.delete_rule,
            (SELECT at2.table_name FROM all_constraints at2
             WHERE at2.owner = ac.r_owner AND at2.constraint_name = ac.r_constraint_name) AS r_table,
            (SELECT LISTAGG(acc.column_name, ',') WITHIN GROUP (ORDER BY acc.position)
             FROM all_cons_columns acc
             WHERE acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name) AS columns,
            (SELECT LISTAGG(acc2.column_name, ',') WITHIN GROUP (ORDER BY acc2.position)
             FROM all_cons_columns acc2
             WHERE acc2.owner = ac.r_owner AND acc2.constraint_name = ac.r_constraint_name) AS r_columns
     FROM all_constraints ac
     WHERE ac.owner = :schema AND ac.table_name = :tbl
     ORDER BY DECODE(ac.constraint_type, 'P', 1, 'U', 2, 'R', 3, 'C', 4, 5), ac.constraint_name`,
    { schema: schema.toUpperCase(), tbl: table.toUpperCase() }
  )

  const typeMap: Record<string, SQLConstraint['type']> = {
    P: 'PRIMARY', U: 'UNIQUE', R: 'FOREIGN_KEY', C: 'CHECK',
  }

  return rows.map((r) => ({
    name: r.CONSTRAINT_NAME,
    type: typeMap[r.CONSTRAINT_TYPE] ?? 'CHECK',
    columns: r.COLUMNS ? r.COLUMNS.split(',') : [],
    refTable: r.R_TABLE ?? undefined,
    refColumns: r.R_COLUMNS ? r.R_COLUMNS.split(',') : undefined,
    deleteRule: r.DELETE_RULE ?? undefined,
    status: r.STATUS as 'ENABLED' | 'DISABLED',
  }))
}

export async function getTableIndexes(schema: string, table: string): Promise<SQLIndex[]> {
  const rows = await query<{
    INDEX_NAME: string; UNIQUENESS: string; INDEX_TYPE: string;
    TABLESPACE_NAME: string; STATUS: string; COLUMNS: string
  }>(
    `SELECT ai.index_name, ai.uniqueness, ai.index_type,
            ai.tablespace_name, ai.status,
            (SELECT LISTAGG(aic.column_name, ',') WITHIN GROUP (ORDER BY aic.column_position)
             FROM all_ind_columns aic
             WHERE aic.index_owner = ai.owner AND aic.index_name = ai.index_name) AS columns
     FROM all_indexes ai
     WHERE ai.table_owner = :schema AND ai.table_name = :tbl
     ORDER BY ai.index_name`,
    { schema: schema.toUpperCase(), tbl: table.toUpperCase() }
  )

  return rows.map((r) => ({
    name: r.INDEX_NAME,
    columns: r.COLUMNS ? r.COLUMNS.split(',') : [],
    isUnique: r.UNIQUENESS === 'UNIQUE',
    type: r.INDEX_TYPE,
    tablespace: r.TABLESPACE_NAME ?? undefined,
    status: r.STATUS as 'VALID' | 'UNUSABLE',
  }))
}

export async function getTableTriggers(schema: string, table: string): Promise<SQLTriggerInfo[]> {
  const rows = await query<{
    TRIGGER_NAME: string; OWNER: string; STATUS: string;
    TRIGGERING_EVENT: string; TABLE_NAME: string
  }>(
    `SELECT trigger_name, owner, status, triggering_event, table_name
     FROM all_triggers
     WHERE owner = :schema AND table_name = :tbl
     ORDER BY trigger_name`,
    { schema: schema.toUpperCase(), tbl: table.toUpperCase() }
  )

  return rows.map((r) => ({
    name: r.TRIGGER_NAME,
    schema: r.OWNER,
    status: r.STATUS as 'ENABLED' | 'DISABLED',
    event: r.TRIGGERING_EVENT,
    table: r.TABLE_NAME ?? undefined,
  }))
}

export async function getObjectDDL(schema: string, objectName: string, objectType: string): Promise<string> {
  const conn = sqlManager.getConnection()
  const result = await conn.execute<[string]>(
    `SELECT DBMS_METADATA.GET_DDL(:objType, :objName, :schema) FROM DUAL`,
    { objType: objectType.toUpperCase(), objName: objectName.toUpperCase(), schema: schema.toUpperCase() }
  )

  const val = result.rows?.[0]?.[0]
  if (typeof val === 'string') return val
  if (val && typeof val === 'object' && 'getData' in val) {
    return await (val as { getData(): Promise<string> }).getData()
  }
  return ''
}

export async function getTableRowCount(schema: string, table: string): Promise<number> {
  const conn = sqlManager.getConnection()
  const result = await conn.execute<[number]>(
    `SELECT COUNT(*) FROM "${schema.toUpperCase()}"."${table.toUpperCase()}"`
  )
  return result.rows?.[0]?.[0] ?? 0
}

export async function getTableGrants(schema: string, table: string): Promise<SQLGrant[]> {
  const rows = await query<{ GRANTEE: string; PRIVILEGE: string; GRANTABLE: string }>(
    `SELECT grantee, privilege, grantable
     FROM all_tab_privs
     WHERE owner = :schema AND table_name = :tbl
     ORDER BY grantee, privilege`,
    { schema: schema.toUpperCase(), tbl: table.toUpperCase() }
  )

  return rows.map((r) => ({
    grantee: r.GRANTEE,
    privilege: r.PRIVILEGE,
    grantable: r.GRANTABLE === 'YES',
  }))
}

export async function getSchemaColumnMap(schema: string): Promise<Record<string, string[]>> {
  const rows = await query<{ TABLE_NAME: string; COLUMN_NAME: string }>(
    `SELECT table_name, column_name FROM all_tab_columns
     WHERE owner = :schema
     ORDER BY table_name, column_id`,
    { schema: schema.toUpperCase() }
  )

  const result: Record<string, string[]> = {}
  for (const r of rows) {
    const cols = result[r.TABLE_NAME] ?? []
    cols.push(r.COLUMN_NAME)
    result[r.TABLE_NAME] = cols
  }
  return result
}

export async function describeObject(schema: string, name: string): Promise<SQLObjectDescription> {
  const conn = sqlManager.getConnection()

  // Determine object type
  const typeResult = await conn.execute<{ OBJECT_TYPE: string }>(
    `SELECT object_type FROM all_objects WHERE owner = :schema AND object_name = :objName AND ROWNUM = 1`,
    { schema: schema.toUpperCase(), objName: name.toUpperCase() },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  )

  const objectType = (typeResult.rows as { OBJECT_TYPE: string }[])?.[0]?.OBJECT_TYPE ?? 'TABLE'

  const description: SQLObjectDescription = {
    name: name.toUpperCase(),
    schema: schema.toUpperCase(),
    type: objectType,
  }

  if (objectType === 'TABLE' || objectType === 'VIEW') {
    description.columns = await getTableColumns(schema, name)
    description.constraints = await getTableConstraints(schema, name)
    description.indexes = await getTableIndexes(schema, name)
  }

  try {
    description.ddl = await getObjectDDL(schema, name, objectType)
  } catch {
    // DDL generation may fail for some object types
  }

  return description
}
