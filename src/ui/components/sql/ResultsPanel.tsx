import { useState, type FC } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResultsGrid } from './ResultsGrid'
import { ExplainPlanView } from './ExplainPlanView'
import { DbmsOutputPanel } from './DbmsOutputPanel'
import { MessagesPanel } from './MessagesPanel'
import type { SQLMessage } from '@/ui/contexts/sql'

interface ResultsPanelProps {
  result: SQLQueryResult | null
  explainPlan: SQLExplainPlan | null
  dbmsOutput: string[]
  messages: SQLMessage[]
  onClearDbmsOutput: () => void
  onClearMessages: () => void
  editable?: boolean
  onCellEdit?: (rowIdx: number, colIdx: number, newValue: string | null) => Promise<void>
}

export const ResultsPanel: FC<ResultsPanelProps> = ({
  result,
  explainPlan,
  dbmsOutput,
  messages,
  onClearDbmsOutput,
  onClearMessages,
  editable,
  onCellEdit,
}) => {
  const [activeTab, setActiveTab] = useState('results')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
      <TabsList className="flex-shrink-0 h-7 px-2 bg-[#1e1f23] justify-start rounded-none border-b border-border">
        <TabsTrigger value="results" className="text-xs h-6 px-2 data-[state=active]:bg-[#1a1b1e]">
          Results {result?.rowCount !== undefined ? `(${result.rowCount})` : ''}
        </TabsTrigger>
        <TabsTrigger value="explain" className="text-xs h-6 px-2 data-[state=active]:bg-[#1a1b1e]">
          Explain Plan
        </TabsTrigger>
        <TabsTrigger value="dbms-output" className="text-xs h-6 px-2 data-[state=active]:bg-[#1a1b1e]">
          DBMS Output {dbmsOutput.length > 0 ? `(${dbmsOutput.length})` : ''}
        </TabsTrigger>
        <TabsTrigger value="messages" className="text-xs h-6 px-2 data-[state=active]:bg-[#1a1b1e]">
          Messages {messages.length > 0 ? `(${messages.length})` : ''}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="results" className="flex-1 min-h-0 overflow-hidden mt-0">
        <ResultsGrid result={result} editable={editable} onCellEdit={onCellEdit} />
      </TabsContent>

      <TabsContent value="explain" className="flex-1 min-h-0 overflow-hidden mt-0">
        <ExplainPlanView plan={explainPlan} />
      </TabsContent>

      <TabsContent value="dbms-output" className="flex-1 min-h-0 overflow-hidden mt-0">
        <DbmsOutputPanel output={dbmsOutput} onClear={onClearDbmsOutput} />
      </TabsContent>

      <TabsContent value="messages" className="flex-1 min-h-0 overflow-hidden mt-0">
        <MessagesPanel messages={messages} onClear={onClearMessages} />
      </TabsContent>
    </Tabs>
  )
}
