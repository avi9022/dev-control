import { execFileSync } from 'child_process'
import { writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { getTasks, updateTask } from './task-manager.js'

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', timeout: 30000 }).trim()
}

function gh(args: string[], cwd: string): string {
  return execFileSync('gh', args, { cwd, encoding: 'utf-8', timeout: 15000 }).trim()
}

function resolveBaseBranch(projectPath: string, baseBranch?: string): string {
  if (baseBranch) {
    try {
      git(['rev-parse', '--verify', baseBranch], projectPath)
      return baseBranch
    } catch { /* fall through */ }
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

export function getBranchInfo(taskId: string): AIBranchInfo[] {
  const task = getTasks().find(t => t.id === taskId)
  if (!task?.worktrees?.length) return []

  const results: AIBranchInfo[] = []

  for (const wt of task.worktrees) {
    const project = task.projects?.find(p => p.path === wt.projectPath)
    const baseBranch = resolveBaseBranch(wt.worktreePath, project?.baseBranch)

    // Get commits on branch since base
    let commits: AIBranchCommit[] = []
    try {
      const log = git(
        ['log', `${baseBranch}..HEAD`, '--format=%H|||%h|||%s', '--reverse'],
        wt.worktreePath
      )
      if (log) {
        commits = log.split('\n').filter(Boolean).map(line => {
          const [hash, shortHash, message] = line.split('|||')
          return { hash, shortHash, message }
        })
      }
    } catch {
      // No commits or branch issue
    }

    // Check remote tracking
    let hasRemote = false
    try {
      git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], wt.worktreePath)
      hasRemote = true
    } catch {
      // No upstream
    }

    // Check for PR via gh CLI
    let prNumber: number | null = null
    let prUrl: string | null = null
    try {
      const prJson = gh(
        ['pr', 'list', '--head', wt.branchName, '--json', 'number,url', '--limit', '1'],
        wt.worktreePath
      )
      const prs = JSON.parse(prJson)
      if (prs.length > 0) {
        prNumber = prs[0].number
        prUrl = prs[0].url
      }
    } catch {
      // gh CLI not available or no PR
    }

    results.push({
      worktreePath: wt.worktreePath,
      projectPath: wt.projectPath,
      projectLabel: project?.label || wt.projectPath.split('/').pop() || wt.projectPath,
      branchName: wt.branchName,
      hasRemote,
      prNumber,
      prUrl,
      commits,
    })
  }

  return results
}

export function renameBranch(taskId: string, worktreePath: string, newBranchName: string, pushToRemote: boolean): void {
  const task = getTasks().find(t => t.id === taskId)
  if (!task) throw new Error(`Task ${taskId} not found`)

  const wt = task.worktrees?.find(w => w.worktreePath === worktreePath)
  if (!wt) throw new Error('Worktree not found')

  const oldBranchName = wt.branchName

  // Rename local branch
  git(['branch', '-m', oldBranchName, newBranchName], worktreePath)

  if (pushToRemote) {
    // Push new branch name
    git(['push', 'origin', newBranchName], worktreePath)
    // Set upstream
    git(['branch', '--set-upstream-to', `origin/${newBranchName}`], worktreePath)
    // Delete old remote branch
    try {
      git(['push', 'origin', '--delete', oldBranchName], worktreePath)
    } catch {
      // Old remote branch might not exist
    }
    // Update PR head branch if PR exists
    try {
      gh(['pr', 'edit', '--head', newBranchName], worktreePath)
    } catch {
      // No PR or gh CLI issue
    }
  }

  // Update stored worktree info
  const updatedWorktrees = (task.worktrees || []).map(w =>
    w.worktreePath === worktreePath ? { ...w, branchName: newBranchName } : w
  )
  updateTask(taskId, { worktrees: updatedWorktrees })
}

export function editCommitMessage(worktreePath: string, commitHash: string, newMessage: string, pushToRemote: boolean): void {
  editMultipleCommitMessages(worktreePath, [{ hash: commitHash, newMessage }], pushToRemote)
}

export function editMultipleCommitMessages(worktreePath: string, edits: { hash: string; newMessage: string }[], pushToRemote: boolean): void {
  if (edits.length === 0) return

  // Check if ALL edits are just the HEAD commit
  const headHash = git(['rev-parse', 'HEAD'], worktreePath)
  if (edits.length === 1) {
    const only = edits[0]
    if (headHash.startsWith(only.hash) || only.hash.startsWith(headHash.slice(0, only.hash.length))) {
      git(['commit', '--amend', '--no-verify', '-m', only.newMessage], worktreePath)
      if (pushToRemote) git(['push', '--force-with-lease'], worktreePath)
      return
    }
  }

  // Find the earliest commit to rebase from
  // Get all commits in order (oldest first)
  const allCommits = git(['log', '--format=%H', '--reverse', 'HEAD'], worktreePath).split('\n').filter(Boolean)

  let earliestIdx = allCommits.length
  for (const edit of edits) {
    const idx = allCommits.findIndex(h => h.startsWith(edit.hash) || edit.hash.startsWith(h.slice(0, edit.hash.length)))
    if (idx >= 0 && idx < earliestIdx) earliestIdx = idx
  }

  if (earliestIdx >= allCommits.length) {
    throw new Error('Could not find commits to edit')
  }

  // Build sed commands to mark all target commits for reword
  const sedParts = edits.map(e => {
    const short = e.hash.slice(0, 7)
    return `s/^pick ${short}/reword ${short}/`
  }).join(';')

  // Write a temp editor script that uses a counter to deliver messages in order.
  // Git calls the editor once per reworded commit.
  const tmpDir = mkdtempSync(join(tmpdir(), 'git-reword-'))
  const messagesFile = join(tmpDir, 'messages.json')
  const counterFile = join(tmpDir, 'counter')

  // Order edits by their position in commit history (oldest first)
  const orderedEdits = edits
    .map(e => {
      const idx = allCommits.findIndex(h => h.startsWith(e.hash) || e.hash.startsWith(h.slice(0, e.hash.length)))
      return { ...e, idx }
    })
    .filter(e => e.idx >= 0)
    .sort((a, b) => a.idx - b.idx)

  writeFileSync(messagesFile, JSON.stringify(orderedEdits.map(e => e.newMessage)))
  writeFileSync(counterFile, '0')

  // Editor script: read counter, get message at that index, write to file, increment counter
  const editorScript = join(tmpDir, 'editor.sh')
  writeFileSync(editorScript, [
    '#!/bin/sh',
    `COUNTER=$(cat "${counterFile}")`,
    `MSG=$(node -e "const m=JSON.parse(require('fs').readFileSync('${messagesFile}','utf8'));process.stdout.write(m[$COUNTER]||'')")`,
    `printf '%s' "$MSG" > "$1"`,
    `echo $(($COUNTER + 1)) > "${counterFile}"`,
  ].join('\n'), { mode: 0o755 })

  try {
    const rebaseTarget = earliestIdx === 0 ? '--root' : `${allCommits[earliestIdx]}~1`
    const env = {
      ...process.env,
      GIT_SEQUENCE_EDITOR: `sed -i.bak '${sedParts}'`,
      GIT_EDITOR: editorScript,
    }
    const args = ['-c', 'core.hooksPath=/dev/null', 'rebase', '-i']
    if (rebaseTarget === '--root') args.push('--root')
    else args.push(rebaseTarget)

    execFileSync('git', args, {
      cwd: worktreePath,
      encoding: 'utf-8',
      timeout: 30000,
      env,
    })
  } finally {
    try { unlinkSync(editorScript) } catch { /* */ }
    try { unlinkSync(messagesFile) } catch { /* */ }
    try { unlinkSync(counterFile) } catch { /* */ }
    try { rmdirSync(tmpDir) } catch { /* */ }
  }

  if (pushToRemote) {
    git(['push', '--force-with-lease'], worktreePath)
  }
}

export function squashCommits(worktreePath: string, baseBranch: string, newMessage: string, pushToRemote: boolean): void {
  const base = resolveBaseBranch(worktreePath, baseBranch)

  // Find the merge base
  const mergeBase = git(['merge-base', base, 'HEAD'], worktreePath)

  // Soft reset to merge base (keeps all changes staged)
  git(['reset', '--soft', mergeBase], worktreePath)

  // Create single commit with new message (skip hooks — only message changed)
  git(['commit', '--no-verify', '-m', newMessage], worktreePath)

  if (pushToRemote) {
    git(['push', '--force-with-lease'], worktreePath)
  }
}
