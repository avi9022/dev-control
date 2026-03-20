import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, CircleX, RefreshCw, Database } from "lucide-react"
import { useState, type FC } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDynamoDB } from "@/ui/contexts/dynamodb"
import { cn } from "@/lib/utils"
import { DynamoDBConnectionSelector } from "@/ui/components/dynamodb/DynamoDBConnectionSelector"
import { DynamoDBEmptyState } from "@/ui/components/dynamodb/DynamoDBEmptyState"

export const DynamoDBMenu: FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const { tables, loading, isConnected, refreshTables, selectTable, selectedTable } = useDynamoDB()

  const filteredTables = tables.filter((table) =>
    table.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
      <div className="mb-4">
        <DynamoDBConnectionSelector />
      </div>

      {!isConnected && <DynamoDBEmptyState />}

      {isConnected && (
        <>
          <div className="relative h-[35px] mb-4 px-5">
            <Search className="absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              className="pl-9"
              value={searchTerm}
              onChange={(ev) => setSearchTerm(ev.target.value)}
            />
            <Button
              onClick={() => setSearchTerm('')}
              className="absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 bg-transparent hover:bg-transparent text-muted-foreground"
            >
              <CircleX />
            </Button>
          </div>

          <ScrollArea className="h-[calc(100vh-80px-40px-80px-35px-20px-60px)]">
            <div className="px-2">
              {loading && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Loading tables...
                </div>
              )}

              {!loading && filteredTables.length === 0 && (
                <div className="px-3 py-8 text-sm text-muted-foreground text-center">
                  {searchTerm ? 'No tables match your search' : 'No tables found'}
                </div>
              )}

              {!loading && filteredTables.map((table) => (
                <button
                  key={table}
                  onClick={() => selectTable(table)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left",
                    selectedTable === table && "bg-accent"
                  )}
                >
                  <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{table}</span>
                </button>
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-between items-center px-4 gap-4 h-[80px] bg-muted">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshTables}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <span className="text-xs text-muted-foreground">
              {tables.length} table{tables.length !== 1 ? 's' : ''}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
