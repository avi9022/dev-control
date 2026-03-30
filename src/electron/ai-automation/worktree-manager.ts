import { execFileSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { getWorktreesDir } from './task-dir-manager.js'
import { getSettings } from './task-manager.js'
import { SHORT_ID_LENGTH } from '../../shared/constants.js'

const GIT_COMMAND_TIMEOUT_MS = 30_000
const BRANCH_SLUG_MAX_LENGTH = 40
const MAX_DIFF_FILE_SIZE = 500_000

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', timeout: GIT_COMMAND_TIMEOUT_MS }).trim()
}

function resolveBaseBranch(projectPath: string, baseBranch?: string): string {
  if (baseBranch) {
    try {
      git(['rev-parse', '--verify', baseBranch], projectPath)
      return baseBranch
    } catch {
      console.warn(`[worktree] Base branch '${baseBranch}' not found, falling back to detection`)
    }
  }

  const settingsBaseBranch = getSettings().defaultBaseBranch
  if (settingsBaseBranch) {
    try {
      git(['rev-parse', '--verify', settingsBaseBranch], projectPath)
      return settingsBaseBranch
    } catch { }
  }

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

function ensureBaseBranchUpToDate(projectPath: string, base: string): void {
  try {
    // Fetch latest from remote for the base branch
    git(['fetch', 'origin', base], projectPath)
    console.log(`[worktree] Fetched latest for ${base} from origin`)

    // Fast-forward local base branch to match remote (if it exists locally)
    try {
      const localRef = git(['rev-parse', base], projectPath)
      const remoteRef = git(['rev-parse', `origin/${base}`], projectPath)
      if (localRef !== remoteRef) {
        // Update local branch ref without checkout
        git(['update-ref', `refs/heads/${base}`, remoteRef], projectPath)
        console.log(`[worktree] Updated local ${base} to match origin/${base}`)
      }
    } catch {
      // Local branch might not exist or no remote tracking — that's fine
    }
  } catch (err) {
    console.warn(`[worktree] Could not fetch ${base} from origin (offline or no remote):`, err instanceof Error ? err.message : String(err))
  }
}

export function createWorktree(taskId: string, projectPath: string, branchName: string, baseBranch?: string): string {
  const worktreesBase = getWorktreesDir(taskId)
  const repoName = path.basename(projectPath)
  const worktreePath = path.join(worktreesBase, repoName)

  if (fs.existsSync(worktreePath)) {
    return worktreePath
  }

  const base = resolveBaseBranch(projectPath, baseBranch)

  // Ensure base branch is up to date with remote before branching
  ensureBaseBranchUpToDate(projectPath, base)

  try {
    git(['worktree', 'add', '-b', branchName, worktreePath, base], projectPath)
  } catch {
    try {
      git(['worktree', 'add', worktreePath, branchName], projectPath)
    } catch (err) {
      console.error(`[worktree] Failed to create worktree for ${branchName}:`, err instanceof Error ? err.message : String(err))
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
    console.error(`[worktree] Failed to cleanup worktree ${worktreePath}:`, err instanceof Error ? err.message : String(err))
    // Try manual removal as fallback
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true })
      git(['worktree', 'prune'], projectPath)
    } catch {
      // Best effort
    }
  }
}

export function getWorktreeHead(worktreePath: string): string {
  return git(['rev-parse', 'HEAD'], worktreePath)
}

export function getDiffFromBaseline(projectPath: string, baseline: string): string {
  try {
    const diff = git(['diff', `${baseline}..HEAD`], projectPath)
    if (diff.length > MAX_DIFF_FILE_SIZE) {
      return diff.slice(0, MAX_DIFF_FILE_SIZE) + '\n\n[Diff truncated — exceeded size limit]'
    }
    return diff
  } catch {
    return ''
  }
}

export function getDiff(projectPath: string, branchName?: string, baseBranch?: string): string {
  const base = resolveBaseBranch(projectPath, baseBranch)

  // Try to use the remote ref for comparison — it's more up-to-date after rebases
  let diffBase = base
  try {
    git(['rev-parse', '--verify', `origin/${base}`], projectPath)
    diffBase = `origin/${base}`
  } catch {
    // No remote ref, use local
  }

  // Get all changes: committed + staged + unstaged compared to base
  // Use HEAD diff for committed, then add uncommitted on top
  let allDiff = ''

  if (branchName) {
    try {
      // Committed changes: everything between base and branch tip
      allDiff = git(['diff', `${diffBase}...${branchName}`], projectPath)
    } catch {
      // Fall through
    }
  }

  // Add uncommitted changes (staged + unstaged relative to HEAD)
  try {
    // Single diff: HEAD vs working tree (includes both staged and unstaged)
    const uncommitted = git(['diff', 'HEAD'], projectPath)
    if (uncommitted) {
      // If there are committed diffs, merge; otherwise use uncommitted alone
      if (allDiff) {
        allDiff += '\n' + uncommitted
      } else {
        allDiff = uncommitted
      }
    }

    // Untracked files (not captured by any diff command)
    const untracked = git(['ls-files', '--others', '--exclude-standard'], projectPath)
    if (untracked) {
      for (const file of untracked.split('\n').filter(Boolean)) {
        try {
          const filePath = path.join(projectPath, file)
          const stat = fs.statSync(filePath)
          if (stat.size > MAX_DIFF_FILE_SIZE) continue // skip large files
          const content = fs.readFileSync(filePath, 'utf-8')
          if (content.includes('\0')) continue // skip binary
          allDiff += `\ndiff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n`
          const lines = content.split('\n')
          allDiff += `@@ -0,0 +1,${lines.length} @@\n`
          allDiff += lines.map(l => `+${l}`).join('\n') + '\n'
        } catch {
          // Skip binary or unreadable files
        }
      }
    }
  } catch {
    // Best effort
  }

  return allDiff
}

export function generateBranchName(taskId: string, taskTitle: string): string {
  const slug = taskTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, BRANCH_SLUG_MAX_LENGTH)
  const shortId = taskId.slice(0, SHORT_ID_LENGTH)
  return `ai/${shortId}-${slug}`
}
