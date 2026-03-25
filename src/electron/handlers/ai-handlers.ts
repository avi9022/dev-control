import { dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { ipcMainHandle } from '../utils/ipc-handle.js'
import { store } from '../storage/store.js'
import { stopProcess } from '../functions/run-service.js'
import { randomUUID } from 'crypto'
import { getTasks, getTaskById, createTask as aiCreateTask, updateTask as aiUpdateTask, deleteTask as aiDeleteTask, moveTaskPhase, getSettings as getAISettings, updateSettings as updateAISettings, getBoardPipeline } from '../ai-automation/task-manager.js'
import { stopAgent, sendInput, enqueueTask, getTaskOutputHistory, getAgentStats } from '../ai-automation/agent-runner.js'
import { getDiff as getAITaskDiff, cleanupWorktree } from '../ai-automation/worktree-manager.js'
import { listTaskDirFiles, readTaskDirFile, attachFiles, deleteAttachment, deleteAgentFile, listAttachments, getOrCreateTaskDir } from '../ai-automation/task-dir-manager.js'
import { generateKnowledgeDoc } from '../ai-automation/knowledge-generator.js'
import { getBranchInfo, renameBranch, editCommitMessage, editMultipleCommitMessages, squashCommits } from '../ai-automation/git-operations.js'
import { getNotifications, markAllRead } from '../ai-automation/notification-manager.js'
import { sendPlannerMessage } from '../ai-automation/planner-runner.js'
import { savePlannerConversation, listPlannerConversations, readPlannerConversation, deletePlannerConversation } from '../ai-automation/mcp-tools/save-planner-conversation.js'
import { resolveProjectCreation } from '../ai-automation/mcp-tools/request-project-creation.js'
import { resolveTaskCreationStepper, resetTaskStepperTimeout } from '../ai-automation/mcp-tools/create-tasks.js'
import { getAllProjectProfiles, getProjectKnowledge, saveProjectProfile, saveProjectKnowledge, deleteProjectKnowledge } from '../ai-automation/project-knowledge-manager.js'
import { generateProjectKnowledge } from '../ai-automation/project-knowledge-generator.js'

export function registerAIHandlers(): void {
  ipcMainHandle('aiGetTasks', async () => {
    return getTasks()
  })

  ipcMainHandle('aiCreateTask', async (_event, title, description, projects, boardId) => {
    return aiCreateTask(title, description, projects, boardId)
  })

  ipcMainHandle('aiSelectDirectory', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Worktree Directory'
    })
    if (!result.canceled && result.filePaths[0]) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMainHandle('aiUpdateTask', async (_event, id, updates) => {
    aiUpdateTask(id, updates)
  })

  ipcMainHandle('aiDeleteTask', async (_event, id) => {
    // Clean up any temporary worktree services
    const directories = store.get('directories')
    const prefix = `wt-${id}-`
    const toRemove = directories.filter(d => d.id.startsWith(prefix))
    for (const dir of toRemove) {
      try { stopProcess(dir.id) } catch { /* not running */ }
    }
    if (toRemove.length > 0) {
      store.set('directories', directories.filter(d => !d.id.startsWith(prefix)))
    }
    aiDeleteTask(id)
  })

  ipcMainHandle('aiMoveTaskPhase', async (_event, id, targetPhase) => {
    moveTaskPhase(id, targetPhase)
    if (targetPhase !== 'BACKLOG' && targetPhase !== 'DONE') {
      const task = getTaskById(id)
      const pipeline = task ? getBoardPipeline(task.boardId) : []
      const phaseConfig = pipeline.find(p => p.id === targetPhase)
      if (phaseConfig?.type === 'agent') {
        enqueueTask(id)
      }
    }
  })

  ipcMainHandle('aiStopTask', async (_event, id) => {
    await stopAgent(id)
  })

  ipcMainHandle('aiSendTaskInput', async (_event, taskId, input) => {
    sendInput(taskId, input)
  })

  ipcMainHandle('aiGetTaskOutputHistory', async (_event, taskId) => {
    return getTaskOutputHistory(taskId)
  })

  ipcMainHandle('aiReadContextHistory', async (_event, contextHistoryPath: string) => {
    let prompt = ''
    let events = '[]'
    try { prompt = fs.readFileSync(path.join(contextHistoryPath, 'prompt.md'), 'utf-8') } catch { /* */ }
    try { events = fs.readFileSync(path.join(contextHistoryPath, 'events.json'), 'utf-8') } catch { /* */ }
    return { prompt, events }
  })

  ipcMainHandle('aiGetAgentStats', async (_event, taskId) => {
    return getAgentStats(taskId)
  })

  ipcMainHandle('aiGetNotifications', async () => {
    return getNotifications()
  })

  ipcMainHandle('aiMarkNotificationsRead', async () => {
    markAllRead()
  })

  ipcMainHandle('aiGetTaskDiff', async (_event, taskId) => {
    const task = getTasks().find(t => t.id === taskId)
    if (!task) return []

    const results: AIProjectDiff[] = []

    // Collect diffs from all worktrees
    for (const wt of (task.worktrees || [])) {
      try {
        const project = task.projects?.find(p => p.path === wt.projectPath)
        const diff = getAITaskDiff(wt.worktreePath, wt.branchName, project?.baseBranch)
        if (diff) {
          results.push({
            project: project?.label || wt.projectPath.split('/').pop() || wt.projectPath,
            path: wt.projectPath,
            diff
          })
        }
      } catch {
        // Skip failed diffs
      }
    }

    // Fallback: if no worktrees, try first project
    if (results.length === 0 && task.projects?.length > 0) {
      try {
        const diff = getAITaskDiff(task.projects[0].path)
        if (diff) {
          results.push({
            project: task.projects[0].label,
            path: task.projects[0].path,
            diff
          })
        }
      } catch {
        // Skip
      }
    }

    return results
  })

  ipcMainHandle('aiOpenTaskDir', async (_event, taskId) => {
    const taskDir = getOrCreateTaskDir(taskId)
    shell.openPath(taskDir)
  })

  ipcMainHandle('aiCreateTaskServices', async (_event, taskId) => {
    const task = getTasks().find(t => t.id === taskId)
    if (!task?.worktrees?.length) return []

    // Clean up any stale entries from previous runs first
    const prefix = `wt-${taskId}-`
    const directories = store.get('directories').filter(d => !d.id.startsWith(prefix))
    const created: DirectorySettings[] = []

    for (const wt of task.worktrees) {
      // Use the last path segment as unique suffix (project folder name)
      const projectSlug = wt.projectPath.split('/').pop() || 'unknown'
      const tempId = `wt-${taskId}-${projectSlug}`

      // Find original directory config by project path
      const original = directories.find(d => d.path === wt.projectPath)
      const label = task.projects?.find(p => p.path === wt.projectPath)?.label || projectSlug

      // If no node_modules in worktree, prepend npm install
      let runCommand = original?.runCommand
      if (runCommand && !fs.existsSync(path.join(wt.worktreePath, 'node_modules'))) {
        runCommand = `npm install -f && ${runCommand}`
      }

      const tempDir: DirectorySettings = {
        id: tempId,
        path: wt.worktreePath,
        name: label,
        customLabel: `${label} (worktree)`,
        runCommand,
        port: original?.port,
        packageJsonExists: original?.packageJsonExists ?? true,
        isFrontendProj: original?.isFrontendProj ?? false,
      }
      directories.push(tempDir)
      created.push(tempDir)
    }

    store.set('directories', directories)
    return created
  })

  ipcMainHandle('aiCleanupTaskServices', async (_event, taskId) => {
    const directories = store.get('directories')
    const prefix = `wt-${taskId}-`
    const toRemove = directories.filter(d => d.id.startsWith(prefix))

    // Stop any running processes
    for (const dir of toRemove) {
      try { stopProcess(dir.id) } catch { /* not running */ }
    }

    const remaining = directories.filter(d => !d.id.startsWith(prefix))
    store.set('directories', remaining)
  })

  ipcMainHandle('aiRemoveWorktree', async (_event, taskId) => {
    const task = getTasks().find(t => t.id === taskId)
    if (!task?.worktrees?.length) return
    for (const wt of task.worktrees) {
      cleanupWorktree(wt.projectPath, wt.worktreePath)
    }
    aiUpdateTask(taskId, { worktrees: [] })
  })

  ipcMainHandle('aiAttachTaskFiles', async (_event, taskId, filePaths) => {
    return attachFiles(taskId, filePaths)
  })

  ipcMainHandle('aiDeleteTaskAttachment', async (_event, taskId, filename) => {
    deleteAttachment(taskId, filename)
  })

  ipcMainHandle('aiDeleteAgentFile', async (_event, taskId, filename) => {
    deleteAgentFile(taskId, filename)
  })

  ipcMainHandle('aiToggleFileExclusion', async (_event, taskId, filename) => {
    const task = getTasks().find(t => t.id === taskId)
    if (!task) return
    const excluded = task.excludedFiles || []
    const isExcluded = excluded.includes(filename)
    const updated = isExcluded ? excluded.filter(f => f !== filename) : [...excluded, filename]
    aiUpdateTask(taskId, { excludedFiles: updated })
  })

  ipcMainHandle('aiListTaskAttachments', async (_event, taskId) => {
    return listAttachments(taskId)
  })

  ipcMainHandle('aiSelectFiles', async () => {
    const { dialog } = await import('electron')
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: 'Select Files to Attach'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths
    }
    return null
  })

  ipcMainHandle('aiGetTaskFiles', async (_event, taskId) => {
    return listTaskDirFiles(taskId)
  })

  ipcMainHandle('aiReadTaskFile', async (_event, taskId, filename) => {
    return readTaskDirFile(taskId, filename)
  })

  ipcMainHandle('aiSendPlannerMessage', async (_event, conversation, cwd) => {
    return sendPlannerMessage(conversation, cwd)
  })

  ipcMainHandle('aiSavePlannerConversation', async (_event, sessionId, messages, debugEvents) => {
    return savePlannerConversation(sessionId, messages, debugEvents)
  })

  ipcMainHandle('aiListPlannerConversations', async () => {
    return listPlannerConversations()
  })

  ipcMainHandle('aiLoadPlannerConversation', async (_event, filename) => {
    return readPlannerConversation(filename)
  })

  ipcMainHandle('aiDeletePlannerConversation', async (_event, filename) => {
    return deletePlannerConversation(filename)
  })

  ipcMainHandle('aiGetSettings', async () => {
    return getAISettings()
  })

  ipcMainHandle('aiUpdateSettings', async (_event, updates) => {
    updateAISettings(updates)
  })

  ipcMainHandle('aiGenerateKnowledgeDoc', async (_event, projectPath) => {
    const settings = getAISettings()
    const now = new Date().toISOString()
    const projectName = projectPath.split('/').pop() || 'Unknown Project'
    const existingIndex = settings.knowledgeDocs.findIndex(d => d.sourcePath === projectPath)

    // Create or update the doc immediately with generating status
    const docId = existingIndex >= 0 ? settings.knowledgeDocs[existingIndex].id : randomUUID()
    const placeholderDoc: AIKnowledgeDoc = {
      id: docId,
      title: projectName,
      content: existingIndex >= 0 ? settings.knowledgeDocs[existingIndex].content : '',
      sourcePath: projectPath,
      generatingStatus: 'Starting...',
      createdAt: existingIndex >= 0 ? settings.knowledgeDocs[existingIndex].createdAt : now,
      updatedAt: now,
      autoGenerated: true
    }

    const initialDocs = [...settings.knowledgeDocs]
    if (existingIndex >= 0) {
      initialDocs[existingIndex] = placeholderDoc
    } else {
      initialDocs.push(placeholderDoc)
    }
    updateAISettings({ knowledgeDocs: initialDocs })

    // Helper to update the doc's generating status
    const updateDocStatus = (status: string) => {
      const current = getAISettings()
      const docs = current.knowledgeDocs.map(d =>
        d.id === docId ? { ...d, generatingStatus: status || undefined } : d
      )
      updateAISettings({ knowledgeDocs: docs })
    }

    try {
      const content = await generateKnowledgeDoc(projectPath, updateDocStatus)

      // Final update: set content, clear generating status
      const current = getAISettings()
      const docs = current.knowledgeDocs.map(d =>
        d.id === docId ? { ...d, content, generatingStatus: undefined, updatedAt: new Date().toISOString() } : d
      )
      updateAISettings({ knowledgeDocs: docs })
      return docs.find(d => d.id === docId)!
    } catch (err) {
      // Mark as failed
      const current = getAISettings()
      const docs = current.knowledgeDocs.map(d =>
        d.id === docId ? { ...d, generatingStatus: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}` } : d
      )
      updateAISettings({ knowledgeDocs: docs })
      throw err
    }
  })

  // Git operations
  ipcMainHandle('aiGetBranchInfo', async (_event, taskId) => {
    return getBranchInfo(taskId)
  })

  ipcMainHandle('aiRenameBranch', async (_event, taskId, worktreePath, newBranchName, pushToRemote) => {
    renameBranch(taskId, worktreePath, newBranchName, pushToRemote)
  })

  ipcMainHandle('aiEditCommitMessage', async (_event, worktreePath, commitHash, newMessage, pushToRemote) => {
    editCommitMessage(worktreePath, commitHash, newMessage, pushToRemote)
  })

  ipcMainHandle('aiEditMultipleCommitMessages', async (_event, worktreePath, edits, pushToRemote) => {
    editMultipleCommitMessages(worktreePath, edits, pushToRemote)
  })

  ipcMainHandle('aiSquashCommits', async (_event, worktreePath, baseBranch, newMessage, pushToRemote) => {
    squashCommits(worktreePath, baseBranch, newMessage, pushToRemote)
  })

  ipcMainHandle('aiProjectCreationResult', async (_event, { requestId, result }) => {
    resolveProjectCreation(requestId, result)
  })

  ipcMainHandle('aiTaskCreationStepperResult', async (_event, { requestId, result }) => {
    resolveTaskCreationStepper(requestId, result)
  })

  ipcMainHandle('aiTaskStepperActivity', async (_event, { requestId }) => {
    resetTaskStepperTimeout(requestId)
  })

  ipcMainHandle('aiPickDirectory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMainHandle('aiGetProjectProfiles', async () => {
    return getAllProjectProfiles()
  })

  ipcMainHandle('aiGetProjectKnowledge', async (_event, projectPath) => {
    return getProjectKnowledge(projectPath)
  })

  ipcMainHandle('aiGenerateProjectKnowledge', async (_event, projectPath) => {
    try {
      const { profile, knowledgeMarkdown } = await generateProjectKnowledge(projectPath)
      saveProjectProfile(profile)
      saveProjectKnowledge(projectPath, knowledgeMarkdown)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Generation failed' }
    }
  })

  ipcMainHandle('aiSaveProjectProfile', async (_event, profile) => {
    saveProjectProfile(profile)
  })

  ipcMainHandle('aiDeleteProjectKnowledge', async (_event, projectPath) => {
    deleteProjectKnowledge(projectPath)
  })
}
