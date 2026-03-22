import { useState, useEffect, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Filter, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IndexInfo {
  name: string
  pkName: string
  pkType: 'S' | 'N' | 'B'
  skName?: string
  skType?: 'S' | 'N' | 'B'
}

interface FilterCondition {
  id: string
  attribute: string
  operator: string
  value: string
  value2?: string
}

interface QueryBuilderProps {
  tableInfo: DynamoDBTableInfo | null
  onQuery: (options: DynamoDBQueryOptions) => void
  onScan: (options: DynamoDBScanOptions) => void
  loading: boolean
}

const SK_OPERATORS: { value: DynamoDBSKOperator; label: string }[] = [
  { value: '=', label: 'Equals (=)' },
  { value: '<', label: 'Less than (<)' },
  { value: '<=', label: 'Less or equal (<=)' },
  { value: '>', label: 'Greater than (>)' },
  { value: '>=', label: 'Greater or equal (>=)' },
  { value: 'begins_with', label: 'Begins with' },
  { value: 'between', label: 'Between' },
]

const FILTER_OPERATORS = [
  { value: '=', label: 'Equals (=)' },
  { value: '<>', label: 'Not equals (<>)' },
  { value: '<', label: 'Less than (<)' },
  { value: '<=', label: 'Less or equal (<=)' },
  { value: '>', label: 'Greater than (>)' },
  { value: '>=', label: 'Greater or equal (>=)' },
  { value: 'begins_with', label: 'Begins with' },
  { value: 'contains', label: 'Contains' },
  { value: 'between', label: 'Between' },
]

export const QueryBuilder: FC<QueryBuilderProps> = ({
  tableInfo,
  onQuery,
  onScan,
  loading,
}) => {
  const [mode, setMode] = useState<'scan' | 'query'>('scan')
  const [selectedIndex, setSelectedIndex] = useState<string>('table')
  const [pkValue, setPkValue] = useState('')
  const [skOperator, setSkOperator] = useState<DynamoDBSKOperator>('=')
  const [skValue, setSkValue] = useState('')
  const [skValue2, setSkValue2] = useState('')
  const [sortAscending, setSortAscending] = useState(true)
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [showFilters, setShowFilters] = useState(false)

  // Build indexes list from table info
  const indexes: IndexInfo[] = []

  if (tableInfo) {
    // Primary table key
    const pk = tableInfo.keySchema.find(k => k.keyType === 'HASH')
    const sk = tableInfo.keySchema.find(k => k.keyType === 'RANGE')
    const pkDef = tableInfo.attributeDefinitions.find(a => a.attributeName === pk?.attributeName)
    const skDef = tableInfo.attributeDefinitions.find(a => a.attributeName === sk?.attributeName)

    indexes.push({
      name: 'table',
      pkName: pk?.attributeName || '',
      pkType: pkDef?.attributeType || 'S',
      skName: sk?.attributeName,
      skType: skDef?.attributeType,
    })

    // GSIs
    tableInfo.globalSecondaryIndexes?.forEach(gsi => {
      const gsiPk = gsi.keySchema.find(k => k.keyType === 'HASH')
      const gsiSk = gsi.keySchema.find(k => k.keyType === 'RANGE')
      const gsiPkDef = tableInfo.attributeDefinitions.find(a => a.attributeName === gsiPk?.attributeName)
      const gsiSkDef = tableInfo.attributeDefinitions.find(a => a.attributeName === gsiSk?.attributeName)

      indexes.push({
        name: gsi.indexName,
        pkName: gsiPk?.attributeName || '',
        pkType: gsiPkDef?.attributeType || 'S',
        skName: gsiSk?.attributeName,
        skType: gsiSkDef?.attributeType,
      })
    })

    // LSIs
    tableInfo.localSecondaryIndexes?.forEach(lsi => {
      const lsiPk = lsi.keySchema.find(k => k.keyType === 'HASH')
      const lsiSk = lsi.keySchema.find(k => k.keyType === 'RANGE')
      const lsiPkDef = tableInfo.attributeDefinitions.find(a => a.attributeName === lsiPk?.attributeName)
      const lsiSkDef = tableInfo.attributeDefinitions.find(a => a.attributeName === lsiSk?.attributeName)

      indexes.push({
        name: lsi.indexName,
        pkName: lsiPk?.attributeName || '',
        pkType: lsiPkDef?.attributeType || 'S',
        skName: lsiSk?.attributeName,
        skType: lsiSkDef?.attributeType,
      })
    })
  }

  const currentIndex = indexes.find(i => i.name === selectedIndex) || indexes[0]

  // Reset values when index changes
  useEffect(() => {
    setPkValue('')
    setSkValue('')
    setSkValue2('')
  }, [selectedIndex])

  const addFilter = () => {
    setFilters([...filters, {
      id: crypto.randomUUID(),
      attribute: '',
      operator: '=',
      value: '',
    }])
  }

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id))
  }

  const buildFilterExpression = (): { expression?: string; names?: Record<string, string>; values?: Record<string, unknown> } => {
    const validFilters = filters.filter(f => f.attribute && f.value)
    if (validFilters.length === 0) return {}

    const names: Record<string, string> = {}
    const values: Record<string, unknown> = {}
    const expressions: string[] = []

    validFilters.forEach((filter, idx) => {
      const nameKey = `#f${idx}`
      const valueKey = `:f${idx}`
      names[nameKey] = filter.attribute
      values[valueKey] = filter.value

      if (filter.operator === 'begins_with' || filter.operator === 'contains') {
        expressions.push(`${filter.operator}(${nameKey}, ${valueKey})`)
      } else if (filter.operator === 'between') {
        const value2Key = `:f${idx}b`
        values[value2Key] = filter.value2 || filter.value
        expressions.push(`${nameKey} BETWEEN ${valueKey} AND ${value2Key}`)
      } else {
        expressions.push(`${nameKey} ${filter.operator} ${valueKey}`)
      }
    })

    return {
      expression: expressions.join(' AND '),
      names,
      values,
    }
  }

  const handleExecute = () => {
    const filterData = buildFilterExpression()

    if (mode === 'scan') {
      onScan({
        limit: 50,
        filterExpression: filterData.expression,
        expressionAttributeNames: filterData.names,
        expressionAttributeValues: filterData.values,
      })
    } else {
      if (!pkValue || !currentIndex) return

      const queryOptions: DynamoDBQueryOptions = {
        pkName: currentIndex.pkName,
        pkValue: currentIndex.pkType === 'N' ? Number(pkValue) : pkValue,
        limit: 50,
        scanIndexForward: sortAscending,
      }

      if (selectedIndex !== 'table') {
        queryOptions.indexName = selectedIndex
      }

      if (currentIndex.skName && skValue) {
        queryOptions.skName = currentIndex.skName
        queryOptions.skValue = currentIndex.skType === 'N' ? Number(skValue) : skValue
        queryOptions.skOperator = skOperator
        if (skOperator === 'between' && skValue2) {
          queryOptions.skValue2 = currentIndex.skType === 'N' ? Number(skValue2) : skValue2
        }
      }

      if (filterData.expression) {
        queryOptions.filterExpression = filterData.expression
        queryOptions.filterNames = filterData.names
        queryOptions.filterValues = filterData.values
      }

      onQuery(queryOptions)
    }
  }

  if (!tableInfo) return null

  return (
    <div className="border-b bg-muted/30 p-3 space-y-3">
      {/* Mode Toggle */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Mode:</Label>
          <div className="flex rounded-md border bg-background">
            <button
              className={cn(
                "px-3 py-1 text-xs rounded-l-md transition-colors",
                mode === 'scan' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
              onClick={() => setMode('scan')}
            >
              Scan
            </button>
            <button
              className={cn(
                "px-3 py-1 text-xs rounded-r-md transition-colors",
                mode === 'query' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
              onClick={() => setMode('query')}
            >
              Query
            </button>
          </div>
        </div>

        {mode === 'query' && indexes.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs">Index:</Label>
            <Select value={selectedIndex} onValueChange={setSelectedIndex}>
              <SelectTrigger className="h-7 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {indexes.map(idx => (
                  <SelectItem key={idx.name} value={idx.name} className="text-xs">
                    {idx.name === 'table' ? 'Primary Table' : idx.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(showFilters && "bg-muted")}
        >
          <Filter className="h-3 w-3 mr-1" />
          Filters {filters.length > 0 && `(${filters.length})`}
        </Button>

        <Button
          size="sm"
          onClick={handleExecute}
          disabled={loading || (mode === 'query' && !pkValue)}
        >
          <Search className="h-3 w-3 mr-1" />
          {loading ? 'Loading...' : 'Execute'}
        </Button>
      </div>

      {/* Query Fields (only for query mode) */}
      {mode === 'query' && currentIndex && (
        <div className="flex items-stretch gap-4 flex-wrap">
          {/* Partition Key */}
          <div className="border rounded-md p-3 bg-background flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">Partition Key</span>
              <span className="text-xs text-muted-foreground">Required</span>
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-1">
                <Label className="text-sm font-medium">{currentIndex.pkName}</Label>
                <Input
                  className="h-8 w-[200px] text-sm"
                  placeholder={`Enter ${currentIndex.pkType === 'N' ? 'number' : 'value'}...`}
                  value={pkValue}
                  onChange={(e) => setPkValue(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Type: {currentIndex.pkType === 'N' ? 'Number' : 'String'}
              </p>
            </div>
          </div>

          {/* Sort Key */}
          {currentIndex.skName && (
            <div className="border rounded-md p-3 bg-background">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium bg-secondary/50 text-secondary-foreground px-1.5 py-0.5 rounded">Sort Key</span>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{currentIndex.skName}</Label>
                <div className="flex items-center gap-2">
                  <Select value={skOperator} onValueChange={(v) => setSkOperator(v as DynamoDBSKOperator)}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SK_OPERATORS.map(op => (
                        <SelectItem key={op.value} value={op.value} className="text-xs">
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-8 w-[140px] text-sm"
                    placeholder={`Enter ${currentIndex.skType === 'N' ? 'number' : 'value'}...`}
                    value={skValue}
                    onChange={(e) => setSkValue(e.target.value)}
                  />
                  {skOperator === 'between' && (
                    <>
                      <span className="text-xs text-muted-foreground">and</span>
                      <Input
                        className="h-8 w-[140px] text-sm"
                        placeholder={`Enter ${currentIndex.skType === 'N' ? 'number' : 'value'}...`}
                        value={skValue2}
                        onChange={(e) => setSkValue2(e.target.value)}
                      />
                    </>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Type: {currentIndex.skType === 'N' ? 'Number' : 'String'}
                </p>
              </div>
            </div>
          )}

          {/* Sort Direction */}
          <div className="border rounded-md p-3 bg-background">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground">Sort Order</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md border transition-colors",
                  sortAscending ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                )}
                onClick={() => setSortAscending(true)}
              >
                Ascending
              </button>
              <button
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md border transition-colors",
                  !sortAscending ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                )}
                onClick={() => setSortAscending(false)}
              >
                Descending
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="border rounded-md p-3 bg-background space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Filter Conditions</Label>
            <Button variant="ghost" size="sm" onClick={addFilter}>
              <Plus className="h-3 w-3 mr-1" />
              Add Filter
            </Button>
          </div>

          {filters.length === 0 && (
            <p className="text-xs text-muted-foreground">No filters. Click "Add Filter" to add conditions.</p>
          )}

          {filters.map((filter) => (
            <div key={filter.id} className="flex items-center gap-2">
              <Input
                className="h-7 w-[150px] text-xs"
                placeholder="Attribute name"
                value={filter.attribute}
                onChange={(e) => updateFilter(filter.id, { attribute: e.target.value })}
              />
              <Select
                value={filter.operator}
                onValueChange={(v) => updateFilter(filter.id, { operator: v })}
              >
                <SelectTrigger className="h-7 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPERATORS.map(op => (
                    <SelectItem key={op.value} value={op.value} className="text-xs">
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-7 w-[150px] text-xs"
                placeholder="Value"
                value={filter.value}
                onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
              />
              {filter.operator === 'between' && (
                <Input
                  className="h-7 w-[150px] text-xs"
                  placeholder="To value"
                  value={filter.value2 || ''}
                  onChange={(e) => updateFilter(filter.id, { value2: e.target.value })}
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => removeFilter(filter.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
