interface ProjectCreationRequest {
  suggestedName: string
  requestId: string
}

type ProjectCreationBoardMode = 'new' | 'existing'

interface ProjectCreationFormData {
  projectName: string
  location: string
  gitInit: boolean
  boardMode: ProjectCreationBoardMode
  newBoardName?: string
  existingBoardId?: string
}

interface ProjectCreationResponse {
  cancelled?: boolean
  timedOut?: boolean
  formData?: ProjectCreationFormData
}

interface ProjectCreationToolResult {
  projectPath: string
  projectName: string
  projectId: string
  boardId: string
  boardName: string
}

interface TaskStepperProposedTask {
  title: string
  description: string
  projectPaths?: string
}

interface TaskStepperRequest {
  requestId: string
  boardId: string
  tasks: TaskStepperProposedTask[]
}

interface TaskStepperApprovedTask {
  title: string
  description: string
  projects: AITaskProject[]
  attachments: string[]
}

interface TaskStepperResponse {
  cancelled?: boolean
  timedOut?: boolean
  tasks?: TaskStepperApprovedTask[]
}

interface PlannerChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface PlannerAssistantContentBlock {
  type: string
  text?: string
  name?: string
}

interface PlannerAssistantMessage {
  content?: PlannerAssistantContentBlock[]
}

type PlannerDebugEvent =
  | { type: 'system'; subtype?: string }
  | { type: 'system_prompt'; content: string }
  | { type: 'assistant'; message?: PlannerAssistantMessage }
  | { type: 'user' }
  | { type: 'result' }
  | { type: 'rate_limit_event' }
  | { type: string }

interface PlannerConversationListItem {
  sessionId: string
  firstMessage: string
  updatedAt: string
}

type PlannerSidebarTab = 'conversations' | 'debug'
