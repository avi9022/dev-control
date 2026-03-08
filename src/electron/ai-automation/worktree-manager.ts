import { execFileSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const WORKTREES_DIR = 'ai-worktrees'

function getWorktreesBase(): string {
  const base = path.join(app.getPath('userData'), WORKTREES_DIR)
  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true })
  }
  return base
}

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', timeout: 30000 }).trim()
}

function resolveBaseBranch(projectPath: string, baseBranch?: string): string {
  if (baseBranch) {
    // Verify the specified branch exists
    try {
      git(['rev-parse', '--verify', baseBranch], projectPath)
      return baseBranch
    } catch {
      console.warn(`[worktree] Base branch '${baseBranch}' not found, falling back to detection`)
    }
  }
  // Auto-detect: try main, then master, then current HEAD
  try {
    git(['rev-parse', '--verify', 'main'], projectPath)
    return 'main'
  } catch {
    try {
      git(['rev-parse', '--verify', 'master'], projectPath)
      return 'master'
    } catch {
      return git(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath)
    }
  }
}

export function createBranch(projectPath: string, branchName: string, baseBranch?: string): string {
  const base = resolveBaseBranch(projectPath, baseBranch)
  // Create branch without checking it out — don't disrupt the user's working state
  try {
    git(['branch', branchName, base], projectPath)
  } catch {
    // Branch might already exist — that's fine
  }
  return branchName
}

export function createWorktree(projectPath: string, branchName: string, baseBranch?: string, worktreeDir?: string): string {
  const worktreesBase = worktreeDir || getWorktreesBase()
  if (!fs.existsSync(worktreesBase)) {
    fs.mkdirSync(worktreesBase, { recursive: true })
  }
  // Replace slashes in branch name for filesystem safety
  const safeName = branchName.replace(/\//g, '-')
  const worktreePath = path.join(worktreesBase, safeName)

  if (fs.existsSync(worktreePath)) {
    return worktreePath
  }

  const base = resolveBaseBranch(projectPath, baseBranch)

  try {
    git(['worktree', 'add', '-b', branchName, worktreePath, base], projectPath)
  } catch {
    try {
      git(['worktree', 'add', worktreePath, branchName], projectPath)
    } catch (err) {
      console.error(`[worktree] Failed to create worktree for ${branchName}:`, err)
      throw err
    }
  }

  return worktreePath
}

export function cleanupWorktree(projectPath: string, worktreePath: string): void {
  try {
    if (fs.existsSync(worktreePath)) {
      git(['worktree', 'remove', worktreePath, '--force'], projectPath)
    }
  } catch (err) {
    console.error(`[worktree] Failed to cleanup worktree ${worktreePath}:`, err)
    // Try manual removal as fallback
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true })
      git(['worktree', 'prune'], projectPath)
    } catch {
      // Best effort
    }
  }
}

export function getDiff(projectPath: string, branchName?: string, baseBranch?: string): string {
  const base = resolveBaseBranch(projectPath, baseBranch)

  let committedDiff = ''
  if (branchName) {
    try {
      committedDiff = git(['diff', `${base}...${branchName}`], projectPath)
    } catch {
      // Fall through to uncommitted diff
    }
  }

  // Get uncommitted changes (staged + unstaged) in the working directory
  try {
    const staged = git(['diff', '--cached'], projectPath)
    const unstaged = git(['diff'], projectPath)
    const untracked = git(['ls-files', '--others', '--exclude-standard'], projectPath)

    let diff = ''
    if (staged) diff += staged + '\n'
    if (unstaged) diff += unstaged + '\n'
    if (untracked) {
      // Show content of untracked files as new file diffs
      for (const file of untracked.split('\n').filter(Boolean)) {
        try {
          const content = fs.readFileSync(path.join(projectPath, file), 'utf-8')
          diff += `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n`
          const lines = content.split('\n')
          diff += `@@ -0,0 +1,${lines.length} @@\n`
          diff += lines.map(l => `+${l}`).join('\n') + '\n'
        } catch {
          // Skip binary or unreadable files
        }
      }
    }
    // Combine committed diff with any uncommitted changes
    if (committedDiff && diff) return committedDiff + '\n' + diff
    return committedDiff || diff
  } catch {
    return committedDiff
  }
}

export function generateBranchName(taskId: string, taskTitle: string): string {
  const slug = taskTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const shortId = taskId.slice(0, 8)
  return `ai/${shortId}-${slug}`
}
