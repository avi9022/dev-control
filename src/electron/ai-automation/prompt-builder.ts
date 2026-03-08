import { getSettings } from './task-manager.js'
import { listTaskDirFiles, readTaskDirFile, listAttachments, getAttachmentsDir } from './task-dir-manager.js'
import fs from 'fs'
import path from 'path'

export function buildPrompt(task: AITask, phaseConfig: AIPipelinePhase): string {
  const settings = getSettings()
  const parts: string[] = []

  // 1. Global rules
  if (settings.globalRules.trim()) {
    parts.push(`## Global Rules\n\n${settings.globalRules}`)
  }

  // 2. Phase-specific prompt
  if (phaseConfig.prompt) {
    parts.push(`## Agent Instructions\n\n${phaseConfig.prompt}`)
  }

  // 3. Knowledge docs
  if (settings.knowledgeDocs.length > 0) {
    const docs = settings.knowledgeDocs.map(d => `### ${d.title}\n\n${d.content}`).join('\n\n')
    parts.push(`## Project Knowledge\n\n${docs}`)
  }

  // 4. Task context
  let taskContext = `## Task\n\n**Title:** ${task.title}\n\n**Description:** ${task.description}`
  if (task.projectPaths && task.projectPaths.length > 0) {
    const workingDir = task.worktrees.length > 0 ? task.worktrees[0].worktreePath : task.projectPaths[0]
    taskContext += `\n\n**Working Directory:** ${workingDir}\n\nIMPORTANT: All file reads, writes, and modifications MUST use paths within ${workingDir}. Do NOT access or modify files in any other directory.`
    if (task.worktrees.length > 0) {
      taskContext += `\n\nThis is a git worktree. The original project is at ${task.projectPaths[0]} — do NOT modify files there.`
    }
    if (task.projectPaths.length > 1) {
      taskContext += `\nYou also have access to: ${task.projectPaths.slice(1).join(', ')}`
    }
  }
  parts.push(taskContext)

  // 5. Task directory context
  if (task.taskDirPath) {
    const files = listTaskDirFiles(task.id)
    if (files.length > 0) {
      let dirContext = `## Task Directory\n\nPath: ${task.taskDirPath}\n\nFiles available:\n`
      for (const file of files) {
        dirContext += `- ${file}\n`
        const content = readTaskDirFile(task.id, file)
        if (content && content.length < 10000) {
          dirContext += `\n\`\`\`\n${content}\n\`\`\`\n`
        }
      }
      dirContext += `\nYou can read and write files in this directory. Use it for plans, reviews, and other artifacts.`
      parts.push(dirContext)
    } else {
      parts.push(`## Task Directory\n\nPath: ${task.taskDirPath}\n\nThis directory is empty. You can write files here (plans, reviews, notes) for use in subsequent phases.`)
    }
  }

  // 5b. User attachments
  const attachments = listAttachments(task.id)
  if (attachments.length > 0) {
    const attachDir = getAttachmentsDir(task.id)
    let attachContext = `## User Attachments\n\nThe user has attached these files to the task:\n`
    for (const file of attachments) {
      attachContext += `- ${file}\n`
      try {
        const content = fs.readFileSync(path.join(attachDir, file), 'utf-8')
        if (content.length < 10000) {
          attachContext += `\n\`\`\`\n${content}\n\`\`\`\n`
        } else {
          attachContext += `\n\`\`\`\n${content.slice(0, 5000)}\n...(truncated, ${content.length} chars total)\n\`\`\`\n`
        }
      } catch {
        attachContext += `  (binary or unreadable)\n`
      }
    }
    parts.push(attachContext)
  }

  // 6. Human review comments
  if (task.humanComments && task.humanComments.length > 0) {
    const comments = task.humanComments.map(c =>
      `- ${c.file}:${c.line}: ${c.comment}`
    ).join('\n')
    parts.push(`## Human Review Comments to Address\n\n${comments}`)
  }

  // 7. Agent review comments
  if (task.reviewComments && task.reviewComments.length > 0) {
    const comments = task.reviewComments.map(c =>
      `- ${c.file}${c.line ? `:${c.line}` : ''} [${c.severity}]: ${c.comment}`
    ).join('\n')
    parts.push(`## Agent Review Comments to Address\n\n${comments}`)
  }

  return parts.join('\n\n---\n\n')
}
