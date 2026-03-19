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

  // 5. Task context with directory boundary
  let taskContext = `## Task\n\n**Title:** ${task.title}\n\n**Description:** ${task.description}`
  if (task.worktrees.length > 0) {
    taskContext += `\n\n**Working Directory:** ${task.worktrees[0].worktreePath}`
    if (task.worktrees.length > 1) {
      taskContext += `\n**Additional worktrees:**`
      for (const wt of task.worktrees.slice(1)) {
        taskContext += `\n- ${wt.worktreePath} (branch: ${wt.branchName})`
      }
    }
    taskContext += `\n\nThese are git worktrees. Do NOT modify the original project directories.`
  } else if (task.projects.length > 0) {
    taskContext += `\n\n**Working Directory:** ${task.projects[0].path}`
  }
  // Git branch info
  const projectsWithBranches = task.projects.filter(p => p.baseBranch || p.customBranchName)
  if (projectsWithBranches.length > 0) {
    taskContext += `\n\n**Git Branch Info:**`
    for (const p of projectsWithBranches) {
      taskContext += `\n- ${p.label}: branch \`${p.customBranchName || 'auto'}\``
      if (p.baseBranch) taskContext += ` → base \`${p.baseBranch}\``
    }
  }
  // Read-only projects
  const readOnlyProjects = task.projects.filter(p => p.gitStrategy === 'none')
  if (readOnlyProjects.length > 0) {
    taskContext += `\n\n**Read-only reference projects:** ${readOnlyProjects.map(p => `${p.label} (${p.path})`).join(', ')}\nYou may read files in these directories but MUST NOT modify them.`
  }
  if (task.taskDirPath) {
    const writablePaths = task.worktrees.map(wt => wt.worktreePath)
    taskContext += `\n\n## Security Boundary\n\nYou may modify files in: ${task.taskDirPath}${writablePaths.length > 0 ? ' (includes worktrees: ' + writablePaths.join(', ') + ')' : ''}`
    if (readOnlyProjects.length > 0) {
      taskContext += `\nYou may read files in: ${readOnlyProjects.map(p => p.path).join(', ')}`
    }
    taskContext += `\nAttempts to write outside the task directory or read outside allowed directories will be blocked.`
  }
  parts.push(taskContext)

  // 5b. Amendments (new requirements added after initial implementation)
  const activeAmendments = (task.amendments || []).filter(a => !a.hidden)
  if (activeAmendments.length > 0) {
    let amendSection = `## Amendments\n\nThe following requirements were added after the initial task was created. Your existing work already addresses the original task description — focus on these additions:\n`
    for (const amendment of activeAmendments) {
      const date = new Date(amendment.createdAt).toLocaleDateString()
      amendSection += `\n### Amendment (${date})\n\n${amendment.text}\n`
    }
    parts.push(amendSection)
  }

  // 6. Task directory context (filtered by exclusions)
  if (task.taskDirPath) {
    const agentDir = path.join(task.taskDirPath, 'agent')
    const allFiles = listTaskDirFiles(task.id)
    const files = allFiles.filter(f => !excluded.includes(`agent/${f}`))
    const excludedAgentFiles = allFiles.filter(f => excluded.includes(`agent/${f}`))

    if (files.length > 0 || excludedAgentFiles.length > 0) {
      let dirContext = `## Task Directory\n\nPath: ${agentDir}\n\n`
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
      dirContext += `\nYou MUST save all files (plans, reviews, notes) to this directory: ${agentDir}`
      parts.push(dirContext)
    } else {
      parts.push(`## Task Directory\n\nPath: ${agentDir}\n\nThis directory is empty. You MUST write all files (plans, reviews, notes) to this directory: ${agentDir}`)
    }
  }

  // 7. User attachments (filtered by exclusions)
  const allAttachments = listAttachments(task.id)
  const attachments = allAttachments.filter(f => !excluded.includes(`attachments/${f}`))
  if (attachments.length > 0) {
    const attachDir = getAttachmentsDir(task.id)
    let attachContext = `## User Attachments\n\nThe user has attached these files to the task:\n`
    const BINARY_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.wav', '.avi', '.mov'])
    for (const file of attachments) {
      attachContext += `- ${file}\n`
      const ext = path.extname(file).toLowerCase()
      if (BINARY_EXTENSIONS.has(ext)) {
        attachContext += `  (binary file — not included in prompt, available at: ${path.join(attachDir, file)})\n`
        continue
      }
      try {
        const content = fs.readFileSync(path.join(attachDir, file), 'utf-8')
        // Skip files with null bytes (binary files with wrong extension)
        if (content.includes('\0')) {
          attachContext += `  (binary file — not included in prompt, available at: ${path.join(attachDir, file)})\n`
          continue
        }
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

  // 8. Human review comments (only unresolved)
  if (task.humanComments && task.humanComments.length > 0) {
    const unresolved = task.humanComments.filter(c => !c.resolved)
    if (unresolved.length > 0) {
      const general = unresolved.filter(c => !c.file)
      const lineSpecific = unresolved.filter(c => !!c.file)
      const commentLines: string[] = []
      if (general.length > 0) {
        commentLines.push('General feedback:')
        for (const c of general) commentLines.push(`- [${c.id}] ${c.comment}`)
      }
      if (lineSpecific.length > 0) {
        if (general.length > 0) commentLines.push('\nFile-specific comments:')
        for (const c of lineSpecific) commentLines.push(`- [${c.id}] ${c.file}:${c.line}: ${c.comment}`)
      }
      commentLines.push('\nAfter addressing a comment, use the `resolve_comment` MCP tool with the task ID and comment ID (shown in brackets) to mark it as resolved.')
      parts.push(`## Human Review Comments to Address\n\nTask ID: ${task.id}\n\n${commentLines.join('\n')}`)
    }
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
