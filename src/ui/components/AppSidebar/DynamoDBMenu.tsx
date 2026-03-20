import { Button } from "@/components/ui/button"
import { RefreshCw, Database } from "lucide-react"
import { useState, type FC } from "react"
import { useDynamoDB } from "@/ui/contexts/dynamodb"
import { cn } from "@/lib/utils"
import { DynamoDBConnectionSelector } from "@/ui/components/dynamodb/DynamoDBConnectionSelector"
import { DynamoDBEmptyState } from "@/ui/components/dynamodb/DynamoDBEmptyState"
import { SearchInput } from "../Inputs/SearchInput"
import { SidebarPanel } from "./SidebarPanel"

export const DynamoDBMenu: FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const { tables, loading, isConnected, refreshTables, selectTable, selectedTable } = useDynamoDB()

  const filteredTables = tables.filter((table) =>
    table.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <SidebarPanel
      header={
        <div className="space-y-2">
          <DynamoDBConnectionSelector />
          {isConnected && (
            <SearchInput
              placeholder="Search tables..."
              value={searchTerm}
              onChange={(ev) => setSearchTerm(ev.target.value)}
              onClear={() => setSearchTerm('')}
            />
          )}
        </div>
      }
      footer={isConnected ? (
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshTables}
            disabled={loading}
            className="h-7 flex items-center gap-2 text-[11px]"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <span className="text-xs text-muted-foreground">
            {tables.length} table{tables.length !== 1 ? 's' : ''}
          </span>
        </div>
      ) : undefined}
    >
      {!isConnected && <DynamoDBEmptyState />}

      {isConnected && (
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
      )}
    </SidebarPanel>
  )
}
