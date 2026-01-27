import { useState, type FC } from 'react'
import { useMongoDB } from '../contexts/mongodb'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentList } from '../components/mongodb/DocumentList'
import { SchemaView } from '../components/mongodb/SchemaView'
import { IndexList } from '../components/mongodb/IndexList'
import { AggregationBuilder } from '../components/mongodb/AggregationBuilder'
import { QueryBar } from '../components/mongodb/QueryBar'

interface MongoDBViewProps {
  itemId: string | null
}

export const MongoDBView: FC<MongoDBViewProps> = ({ itemId }) => {
  const { isConnected, selectedDatabase, activeConnectionId, connections } = useMongoDB()
  const [activeTab, setActiveTab] = useState('documents')
  const [queryOptions, setQueryOptions] = useState<MongoQueryOptions>({
    filter: {},
    limit: 50
  })

  const activeConnection = connections.find((c) => c.id === activeConnectionId)

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">Not connected</p>
          <p className="text-sm mt-1">Connect to a MongoDB instance to get started</p>
        </div>
      </div>
    )
  }

  if (!itemId || !selectedDatabase) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">Select a collection</p>
          <p className="text-sm mt-1">Choose a collection from the sidebar to browse documents</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb */}
      <div className="flex-shrink-0 px-6 pt-3 pb-1">
        <p className="text-sm text-muted-foreground">
          {activeConnection?.name ?? 'connection'}
          <span className="mx-1.5">&gt;</span>
          {selectedDatabase}
          <span className="mx-1.5">&gt;</span>
          <span className="text-foreground font-medium">{itemId}</span>
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex-shrink-0 px-6">
          <TabsList>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
            <TabsTrigger value="indexes">Indexes</TabsTrigger>
            <TabsTrigger value="aggregation">Aggregation</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {/* Query Bar */}
          <div className="flex-shrink-0 px-6 py-2">
            <QueryBar options={queryOptions} onChange={setQueryOptions} />
          </div>
          {/* Document List */}
          <div className="flex-1 min-h-0 overflow-auto">
            <DocumentList
              database={selectedDatabase}
              collection={itemId}
              queryOptions={queryOptions}
            />
          </div>
        </TabsContent>

        <TabsContent value="schema" className="flex-1 min-h-0 overflow-auto">
          <SchemaView database={selectedDatabase} collection={itemId} />
        </TabsContent>

        <TabsContent value="indexes" className="flex-1 min-h-0 overflow-auto">
          <IndexList database={selectedDatabase} collection={itemId} />
        </TabsContent>

        <TabsContent value="aggregation" className="flex-1 min-h-0 overflow-auto">
          <AggregationBuilder database={selectedDatabase} collection={itemId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
