export const ORACLE_TYPE_GROUPS: Record<string, string[]> = {
  String: ['VARCHAR2', 'NVARCHAR2', 'CHAR', 'NCHAR', 'CLOB', 'NCLOB', 'LONG'],
  Numeric: ['NUMBER', 'FLOAT', 'BINARY_FLOAT', 'BINARY_DOUBLE', 'INTEGER'],
  'Date/Time': ['DATE', 'TIMESTAMP', 'TIMESTAMP WITH TIME ZONE', 'TIMESTAMP WITH LOCAL TIME ZONE', 'INTERVAL YEAR TO MONTH', 'INTERVAL DAY TO SECOND'],
  Binary: ['BLOB', 'RAW', 'LONG RAW', 'BFILE'],
  Other: ['XMLTYPE', 'JSON', 'SDO_GEOMETRY', 'ROWID', 'UROWID'],
}

export const TYPES_REQUIRING_SIZE = new Set([
  'VARCHAR2', 'NVARCHAR2', 'CHAR', 'NCHAR', 'NUMBER', 'FLOAT', 'RAW', 'UROWID',
])

const ALL_TYPES = new Set(Object.values(ORACLE_TYPE_GROUPS).flat())

const typeToCategory = new Map<string, string>()
for (const [category, types] of Object.entries(ORACLE_TYPE_GROUPS)) {
  for (const t of types) typeToCategory.set(t, category)
}

export function getTypeCategory(type: string): string {
  const upper = type.toUpperCase()
  const exact = typeToCategory.get(upper)
  if (exact) return exact
  // Match parameterized variants like TIMESTAMP(6), INTERVAL DAY(2) TO SECOND(6)
  const base = upper.replace(/\(\d+\)/g, '').trim()
  return typeToCategory.get(base) ?? 'Other'
}

export function isTypeCategoryChange(oldType: string, newType: string): boolean {
  return getTypeCategory(oldType) !== getTypeCategory(newType)
}

export function formatSize(col: SQLColumnDetail): string {
  if (col.precision != null) return `${col.precision}${col.scale ? `,${col.scale}` : ''}`
  if (col.maxLength != null) return String(col.maxLength)
  return ''
}

function escapeIdentifier(id: string): string {
  return id.replace(/"/g, '""')
}

function validateSize(size: string): boolean {
  return /^\d+(\s*,\s*\d+)?$/.test(size.trim())
}

function validateType(type: string): boolean {
  if (ALL_TYPES.has(type.toUpperCase())) return true
  // Allow Oracle parameterized types like TIMESTAMP(6), INTERVAL DAY(2) TO SECOND(6)
  return /^[A-Z][A-Z0-9_ ]*(\(\d+\))?(\s+(WITH\s+(LOCAL\s+)?TIME\s+ZONE|TO\s+[A-Z]+(\(\d+\))?))?$/i.test(type.trim())
}

export function validateColumnName(name: string): string | null {
  if (!name) return 'Column name is required'
  if (name.length > 128) return 'Column name too long (max 128 characters)'
  if (/[";\n\r]/.test(name)) return 'Column name contains invalid characters'
  return null
}

export function buildRenameColumnSQL(schema: string, table: string, oldName: string, newName: string): string {
  return `ALTER TABLE "${escapeIdentifier(schema)}"."${escapeIdentifier(table)}" RENAME COLUMN "${escapeIdentifier(oldName)}" TO "${escapeIdentifier(newName)}"`
}

export function buildModifyTypeSQL(schema: string, table: string, column: string, newType: string, size?: string): string {
  if (!validateType(newType)) throw new Error(`Invalid Oracle type: ${newType}`)
  if (size && !validateSize(size)) throw new Error(`Invalid size: ${size}`)
  const typeExpr = size ? `${newType}(${size.trim()})` : newType
  return `ALTER TABLE "${escapeIdentifier(schema)}"."${escapeIdentifier(table)}" MODIFY ("${escapeIdentifier(column)}" ${typeExpr})`
}

export function buildModifyNullableSQL(schema: string, table: string, column: string, notNull: boolean): string {
  const constraint = notNull ? 'NOT NULL' : 'NULL'
  return `ALTER TABLE "${escapeIdentifier(schema)}"."${escapeIdentifier(table)}" MODIFY ("${escapeIdentifier(column)}" ${constraint})`
}

export function buildModifyDefaultSQL(schema: string, table: string, column: string, defaultValue: string): string {
  const expr = defaultValue.trim() === '' ? 'DEFAULT NULL' : `DEFAULT ${defaultValue}`
  return `ALTER TABLE "${escapeIdentifier(schema)}"."${escapeIdentifier(table)}" MODIFY ("${escapeIdentifier(column)}" ${expr})`
}

export function buildCommentSQL(schema: string, table: string, column: string, comment: string): string {
  const escaped = comment.replace(/'/g, "''")
  return `COMMENT ON COLUMN "${escapeIdentifier(schema)}"."${escapeIdentifier(table)}"."${escapeIdentifier(column)}" IS '${escaped}'`
}

export function buildAddColumnSQL(schema: string, table: string, name: string, type: string, size?: string, notNull?: boolean, defaultValue?: string): string {
  if (!validateType(type)) throw new Error(`Invalid Oracle type: ${type}`)
  if (size && !validateSize(size)) throw new Error(`Invalid size: ${size}`)
  let col = `"${escapeIdentifier(name)}" ${type}`
  if (size) col += `(${size.trim()})`
  if (defaultValue) col += ` DEFAULT ${defaultValue}`
  if (notNull) col += ' NOT NULL'
  return `ALTER TABLE "${escapeIdentifier(schema)}"."${escapeIdentifier(table)}" ADD (${col})`
}

export function buildDropColumnSQL(schema: string, table: string, column: string): string {
  return `ALTER TABLE "${escapeIdentifier(schema)}"."${escapeIdentifier(table)}" DROP COLUMN "${escapeIdentifier(column)}"`
}
