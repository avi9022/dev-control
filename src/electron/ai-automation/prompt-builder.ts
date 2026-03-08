import { getSettings } from './task-manager.js'
import { listTaskDirFiles, readTaskDirFile, listAttachments, getAttachmentsDir } from './task-dir-manager.js'
import fs from 'fs'
import path from 'path'

function getPhaseRunCount(task: AITask, phaseId: string): number {
  return task.phaseHistory.filter(h => h.phase === phaseId).length
}

export function buildPrompt(task: AITask, phaseConfig: AIPipelinePhase): string {
  const settings = getSettings()
  const parts: string[] = []
  const excluded = task.excludedFiles || []

  // 1. Global rules
  if (settings.globalRules.trim()) {
    parts.push(`## Global Rules\n\n${settings.globalRules}`)
  }

  // 2. Phase-specific prompt
  if (phaseConfig.prompt) {
    parts.push(`## Agent Instructions\n\n${phaseConfig.prompt}`)
  }

  // 3. Phase context
  const cycleCount = getPhaseRunCount(task, phaseConfig.id)
  let phaseContext = `## Phase Context\n\n**Current Phase:** ${phaseConfig.name}\n**Cycle:** ${cycleCount} (this phase has run ${cycleCount === 1 ? 'once before' : cycleCount > 1 ? `${cycleCount} times before` : 'never before'})`
  phaseContext += `\n\n### Task Directory File Rules\n\nIMPORTANT: NEVER overwrite existing files in the task directory. Always use numbered suffixes for new files (e.g., \`plan-1.md\`, \`review-2.md\`). Files with higher numbers are the latest versions — earlier versions are kept for history and should not be treated as the source of truth.`
  parts.push(phaseContext)

  // 4. Knowledge docs
  if (settings.knowledgeDocs.length > 0) {
    const docs = settings.knowledgeDocs.map(d => `### ${d.title}\n\n${d.content}`).join('\n\n')
    parts.push(`## Project Knowledge\n\n${docs}`)
  }

  // 5. Task context
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

  // 6. Task directory context (filtered by exclusions)
  if (task.taskDirPath) {
    const allFiles = listTaskDirFiles(task.id)
    const files = allFiles.filter(f => !excluded.includes(`agent/${f}`))
    const excludedAgentFiles = allFiles.filter(f => excluded.includes(`agent/${f}`))

    if (files.length > 0 || excludedAgentFiles.length > 0) {
      let dirContext = `## Task Directory\n\nPath: ${task.taskDirPath}\n\n`
      if (files.length > 0) {
        dirContext += `Files available:\n`
        for (const file of files) {
          dirContext += `- ${file}\n`
          const content = readTaskDirFile(task.id, file)
          if (content && content.length < 10000) {
            dirContext += `\n\`\`\`\n${content}\n\`\`\`\n`
          }
        }
      }
      if (excludedAgentFiles.length > 0) {
        dirContext += `\nExcluded files (exist but user chose not to include): ${excludedAgentFiles.join(', ')}\n`
      }
      dirContext += `\nYou can read and write files in this directory. Use it for plans, reviews, and other artifacts.`
      parts.push(dirContext)
    } else {
      parts.push(`## Task Directory\n\nPath: ${task.taskDirPath}\n\nThis directory is empty. You can write files here (plans, reviews, notes) for use in subsequent phases.`)
    }
  }

  // 7. User attachments (filtered by exclusions)
  const allAttachments = listAttachments(task.id)
  const attachments = allAttachments.filter(f => !excluded.includes(`attachments/${f}`))
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

  // 8. Human review comments
  if (task.humanComments && task.humanComments.length > 0) {
    const comments = task.humanComments.map(c =>
      `- ${c.file}:${c.line}: ${c.comment}`
    ).join('\n')
    parts.push(`## Human Review Comments to Address\n\n${comments}`)
  }

  // 9. Agent review comments
  if (task.reviewComments && task.reviewComments.length > 0) {
    const comments = task.reviewComments.map(c =>
      `- ${c.file}${c.line ? `:${c.line}` : ''} [${c.severity}]: ${c.comment}`
    ).join('\n')
    parts.push(`## Agent Review Comments to Address\n\n${comments}`)
  }

  return parts.join('\n\n---\n\n')
}
