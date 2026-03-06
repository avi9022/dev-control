import { type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { AgentTerminal } from '@/ui/components/ai-automation/AgentTerminal'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Square, CheckCircle, XCircle } from 'lucide-react'

interface AITaskDetailProps {
  taskId: string
  onBack: () => void
}

export const AITaskDetail: FC<AITaskDetailProps> = ({ taskId, onBack }) => {
  const { tasks, stopTask, moveTaskPhase } = useAIAutomation()
  const task = tasks.find(t => t.id === taskId)

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-500">
        Task not found
      </div>
    )
  }

  const isAgentRunning = !!task.activeProcessPid
  const isHumanReview = task.phase === 'HUMAN_REVIEW'

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-base font-semibold text-white">{task.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">{task.phase.replace(/_/g, ' ')}</span>
              {task.currentAgentRole && (
                <span className="text-xs text-neutral-500">{task.currentAgentRole} agent</span>
              )}
              {task.branchName && (
                <span className="text-xs text-neutral-500">{task.branchName}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAgentRunning && (
            <Button variant="destructive" size="sm" onClick={() => stopTask(task.id)}>
              <Square className="h-3 w-3 mr-1" />
              Stop
            </Button>
          )}
          {isHumanReview && (
            <>
              <Button variant="outline" size="sm" onClick={() => moveTaskPhase(task.id, 'IN_PROGRESS')}>
                <XCircle className="h-3 w-3 mr-1" />
                Request Changes
              </Button>
              <Button size="sm" onClick={() => moveTaskPhase(task.id, 'DONE')}>
                <CheckCircle className="h-3 w-3 mr-1" />
                Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="terminal" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 w-fit">
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
          <TabsTrigger value="plan" disabled={!task.plan}>Plan</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="terminal" className="flex-1 min-h-0 m-0 p-4">
          <AgentTerminal taskId={task.id} needsUserInput={task.needsUserInput} />
        </TabsContent>

        <TabsContent value="plan" className="flex-1 min-h-0 overflow-y-auto p-4">
          {task.plan ? (
            <pre className="whitespace-pre-wrap text-sm text-neutral-300 font-mono bg-neutral-900 p-4 rounded border border-neutral-800">
              {task.plan}
            </pre>
          ) : (
            <p className="text-neutral-500 text-sm">No plan yet -- will be generated during the planning phase.</p>
          )}
        </TabsContent>

        <TabsContent value="history" className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="space-y-2">
            {task.phaseHistory.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-neutral-500 w-[160px] text-xs font-mono">
                  {new Date(entry.enteredAt).toLocaleString()}
                </span>
                <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-xs">
                  {entry.phase.replace(/_/g, ' ')}
                </span>
                {entry.exitedAt && (
                  <span className="text-neutral-600 text-xs">
                    exited {new Date(entry.exitedAt).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
            {task.reviewCycleCount > 0 && (
              <div className="mt-4 text-xs text-neutral-500">
                Review cycles: {task.reviewCycleCount}/{task.maxReviewCycles}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
