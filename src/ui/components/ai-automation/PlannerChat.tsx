import { useState, useRef, useEffect, useCallback, type FC } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ProjectCreationModal } from '@/ui/components/ai-automation/ProjectCreationModal'
import { TaskCreationStepper } from '@/ui/components/ai-automation/TaskCreationStepper'
import { type MentionEditorHandle } from '@/ui/components/ai-automation/MentionEditor'
import { PLANNER_GREETING, DIALOG_MAX_WIDTH, DIALOG_HEIGHT } from '@/ui/components/ai-automation/planner-constants'
import { PlannerSidebar } from '@/ui/components/ai-automation/PlannerSidebar'
import { PlannerMessageList } from '@/ui/components/ai-automation/PlannerMessageList'
import { PlannerInput } from '@/ui/components/ai-automation/PlannerInput'

interface PlannerChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const PlannerChat: FC<PlannerChatProps> = ({ open, onOpenChange }) => {
  const [messages, setMessages] = useState<PlannerChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [debugEvents, setDebugEvents] = useState<PlannerDebugEvent[]>([])
  const [allExpanded, setAllExpanded] = useState(false)
  const [preserveEvents, setPreserveEvents] = useState(false)
  const [projectCreationRequest, setProjectCreationRequest] = useState<ProjectCreationRequest | null>(null)
  const [taskStepperRequest, setTaskStepperRequest] = useState<TaskStepperRequest | null>(null)
  const [pendingFiles, setPendingFiles] = useState<{ name: string; path: string }[]>([])
  const [taggedProjects, setTaggedProjects] = useState<Map<string, string>>(new Map())
  const [conversationList, setConversationList] = useState<PlannerConversationListItem[]>([])
  const [sidebarTab, setPlannerSidebarTab] = useState<PlannerSidebarTab>('conversations')
  const sessionIdRef = useRef<string>(Date.now().toString())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const debugEndRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MentionEditorHandle>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    debugEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [debugEvents])

  useEffect(() => {
    if (messages.length > 1) {
      window.electron.aiSavePlannerConversation(sessionIdRef.current, messages, debugEvents)
    }
  }, [messages, debugEvents])

  const handleProjectTagged = useCallback((dir: DirectorySettings) => {
    setTaggedProjects(prev => new Map(prev).set(dir.customLabel || dir.name, dir.path))
  }, [])

  const handleProjectRemoved = useCallback((label: string) => {
    setTaggedProjects(prev => {
      const next = new Map(prev)
      next.delete(label)
      return next
    })
  }, [])

  const handleSubmitMessage = useCallback(async () => {
    const text = editorRef.current?.getPlainText().trim() || ''
    if (!text && pendingFiles.length === 0) return

    let content = text

    if (taggedProjects.size > 0) {
      const projectLines = Array.from(taggedProjects.entries())
        .map(([name, projectPath]) => `- ${name}: ${projectPath}`)
        .join('\n')
      content += `\n\n[Referenced projects:\n${projectLines}]`
    }

    if (pendingFiles.length > 0) {
      const fileLines = pendingFiles.map(f => `- ${f.name}: ${f.path}`).join('\n')
      content += `\n\n[Attached files:\n${fileLines}]`
    }

    const userMessage: PlannerChatMessage = { role: 'user', content }
    const newConversation = [...messages, userMessage]
    setMessages(newConversation)
    editorRef.current?.clear()
    setPendingFiles([])
    setTaggedProjects(new Map())
    setIsLoading(true)
    if (!preserveEvents) setDebugEvents([])

    try {
      const response = await window.electron.aiSendPlannerMessage(
        newConversation,
        '/'
      )
      setMessages([...newConversation, { role: 'assistant', content: response }])
    } catch (err) {
      setMessages([...newConversation, { role: 'assistant', content: `Error: ${err}` }])
    } finally {
      setIsLoading(false)
    }
  }, [messages, pendingFiles, taggedProjects, preserveEvents])

  const handleAddFiles = useCallback(async () => {
    const selected = await window.electron.aiSelectFiles()
    if (selected) {
      const newFiles = selected
        .filter(p => !pendingFiles.some(f => f.path === p))
        .map(p => ({ name: p.split('/').pop() || p, path: p }))
      setPendingFiles(prev => [...prev, ...newFiles])
    }
  }, [pendingFiles])

  const loadConversationList = useCallback(async () => {
    const list = await window.electron.aiListPlannerConversations()
    setConversationList(list)
  }, [])

  const handleLoadConversation = useCallback(async (sessionId: string) => {
    const filename = `planner-${sessionId}.json`
    const data = await window.electron.aiLoadPlannerConversation(filename)
    if (data) {
      const loadedMessages: PlannerChatMessage[] = data.messages.map(m => ({ role: m.role, content: m.content }))
      const loadedEvents: PlannerDebugEvent[] = data.debugEvents.map(e => {
        if ('type' in e && typeof e.type === 'string') return e
        return { type: 'unknown' }
      })
      setMessages(loadedMessages)
      setDebugEvents(loadedEvents)
      sessionIdRef.current = sessionId
    }
  }, [])

  const handleNewConversation = useCallback(() => {
    sessionIdRef.current = Date.now().toString()
    setMessages([{ role: 'assistant', content: PLANNER_GREETING }])
    setDebugEvents([])
    setPendingFiles([])
    setTaggedProjects(new Map())
  }, [])

  const handleDeleteConversation = useCallback(async (sessionId: string) => {
    const filename = `planner-${sessionId}.json`
    await window.electron.aiDeletePlannerConversation(filename)
    setConversationList(prev => prev.filter(c => c.sessionId !== sessionId))
    if (sessionIdRef.current === sessionId) {
      handleNewConversation()
    }
  }, [handleNewConversation])

  const submitRef = useRef(handleSubmitMessage)
  submitRef.current = handleSubmitMessage

  useEffect(() => {
    if (open) {
      if (messagesRef.current.length === 0) {
        sessionIdRef.current = Date.now().toString()
        setMessages([{ role: 'assistant', content: PLANNER_GREETING }])
      }
      loadConversationList()
    }
  }, [open, loadConversationList])

  useEffect(() => {
    if (sidebarTab === 'conversations') {
      loadConversationList()
    }
  }, [sidebarTab, loadConversationList])

  useEffect(() => {
    const unsubDebug = window.electron.subscribeAIPlannerDebug((event) => {
      if (typeof event === 'object' && event !== null && 'type' in event && typeof event.type === 'string') {
        const debugEvent: PlannerDebugEvent = { ...event, type: event.type }
        setDebugEvents(prev => [...prev, debugEvent])
      }
    })
    const unsubShowModal = window.electron.subscribeAIProjectCreationModal((request: ProjectCreationRequest) => {
      setProjectCreationRequest(request)
    })
    const unsubCloseModal = window.electron.subscribeAICloseProjectCreationModal(() => {
      setProjectCreationRequest(null)
    })
    const unsubShowStepper = window.electron.subscribeAITaskCreationStepper((request: TaskStepperRequest) => {
      setTaskStepperRequest(request)
    })
    const unsubCloseStepper = window.electron.subscribeAICloseTaskCreationStepper(() => {
      setTaskStepperRequest(null)
    })
    return () => { unsubDebug(); unsubShowModal(); unsubCloseModal(); unsubShowStepper(); unsubCloseStepper() }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!p-0 overflow-hidden flex flex-row"
        style={{
          background: 'var(--ai-surface-0)',
          borderColor: 'var(--ai-border-subtle)',
          height: DIALOG_HEIGHT,
          maxWidth: DIALOG_MAX_WIDTH,
        }}
      >
        <PlannerSidebar
          sidebarTab={sidebarTab}
          onTabChange={setPlannerSidebarTab}
          conversations={conversationList}
          currentSessionId={sessionIdRef.current}
          onLoadConversation={handleLoadConversation}
          onDeleteConversation={handleDeleteConversation}
          onNewConversation={handleNewConversation}
          isLoading={isLoading}
          debugEvents={debugEvents}
          allExpanded={allExpanded}
          onToggleExpanded={() => setAllExpanded(!allExpanded)}
          preserveEvents={preserveEvents}
          onPreserveChange={setPreserveEvents}
          debugEndRef={debugEndRef}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <PlannerMessageList
            messages={messages}
            isLoading={isLoading}
            messagesEndRef={messagesEndRef}
          />
          <PlannerInput
            editorRef={editorRef}
            pendingFiles={pendingFiles}
            onFilesChange={setPendingFiles}
            onAddFiles={handleAddFiles}
            onSubmit={handleSubmitMessage}
            onProjectTagged={handleProjectTagged}
            onProjectRemoved={handleProjectRemoved}
            isLoading={isLoading}
          />
        </div>
      </DialogContent>
      {projectCreationRequest && (
        <ProjectCreationModal
          request={projectCreationRequest}
          onComplete={() => setProjectCreationRequest(null)}
        />
      )}
      {taskStepperRequest && (
        <TaskCreationStepper
          request={taskStepperRequest}
          onComplete={() => setTaskStepperRequest(null)}
        />
      )}
    </Dialog>
  )
}
