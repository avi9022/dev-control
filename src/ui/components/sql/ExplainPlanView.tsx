import { useState, type FC } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ExplainPlanViewProps {
  plan: SQLExplainPlan | null
}

function getCostColor(cost: number | undefined, totalCost: number): string {
  if (cost === undefined || totalCost === 0) return 'text-muted-foreground'
  const ratio = cost / totalCost
  if (ratio > 0.5) return 'text-red-400'
  if (ratio > 0.2) return 'text-amber-400'
  return 'text-green-400'
}

function buildTree(nodes: SQLPlanNode[]): Map<number | undefined, SQLPlanNode[]> {
  const children = new Map<number | undefined, SQLPlanNode[]>()
  for (const node of nodes) {
    const parentId = node.parentId
    const existing = children.get(parentId) ?? []
    children.set(parentId, [...existing, node])
  }
  return children
}

const PlanNode: FC<{
  node: SQLPlanNode
  children: Map<number | undefined, SQLPlanNode[]>
  totalCost: number
  depth: number
}> = ({ node, children: childrenMap, totalCost, depth }) => {
  const [expanded, setExpanded] = useState(true)
  const nodeChildren = childrenMap.get(node.id) ?? []
  const hasChildren = nodeChildren.length > 0

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 hover:bg-[#1e1f23] rounded text-xs cursor-pointer',
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        <span className="font-medium text-[#56d4dd]">{node.operation}</span>
        {node.options && <span className="text-muted-foreground">{node.options}</span>}
        {node.objectName && <span className="text-amber-300 ml-1">{node.objectName}</span>}

        <div className="ml-auto flex items-center gap-3 text-[10px]">
          {node.cost !== undefined && (
            <span className={getCostColor(node.cost, totalCost)}>
              Cost: {node.cost}
            </span>
          )}
          {node.cardinality !== undefined && (
            <span className="text-muted-foreground">
              Rows: {node.cardinality}
            </span>
          )}
          {node.bytes !== undefined && (
            <span className="text-muted-foreground">
              Bytes: {node.bytes}
            </span>
          )}
        </div>
      </div>

      {expanded && nodeChildren.map((child) => (
        <PlanNode
          key={child.id}
          node={child}
          children={childrenMap}
          totalCost={totalCost}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

export const ExplainPlanView: FC<ExplainPlanViewProps> = ({ plan }) => {
  if (!plan || !plan.nodes.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No execution plan available. Select a query and click Explain Plan.
      </div>
    )
  }

  const childrenMap = buildTree(plan.nodes)
  const rootNodes = childrenMap.get(undefined) ?? childrenMap.get(0) ?? []

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-xs font-medium">Execution Plan</span>
          <span className="text-[10px] text-muted-foreground">
            Total Cost: {plan.totalCost}
            {plan.executionTime ? ` | Time: ${plan.executionTime}ms` : ''}
          </span>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-2 py-1 text-[10px] text-muted-foreground border-b border-border mb-1">
          <span className="flex-1">Operation</span>
          <span className="w-16 text-right">Cost</span>
          <span className="w-16 text-right">Rows</span>
          <span className="w-16 text-right">Bytes</span>
        </div>

        {rootNodes.map((node) => (
          <PlanNode
            key={node.id}
            node={node}
            children={childrenMap}
            totalCost={plan.totalCost}
            depth={0}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
