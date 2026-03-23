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
