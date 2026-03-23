// Pure utility functions for diff parsing — no JSX, no React dependencies.

export const LARGE_DIFF_THRESHOLD = 200 // lines changed

export interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'header'
  content: string
  oldLineNum?: number
  newLineNum?: number
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface DiffFile {
  oldPath: string
  newPath: string
  isNew: boolean
  isDeleted: boolean
  hunks: DiffHunk[]
}

export function parseDiff(raw: string): DiffFile[] {
  const files: DiffFile[] = []
  const lines = raw.split('\n')
  let i = 0

  while (i < lines.length) {
    if (!lines[i].startsWith('diff --git')) { i++; continue }

    const diffLine = lines[i]
    const pathMatch = diffLine.match(/diff --git a\/(.+?) b\/(.+)/)
    const oldPath = pathMatch?.[1] ?? ''
    const newPath = pathMatch?.[2] ?? ''
    i++

    let isNew = false
    let isDeleted = false

    while (i < lines.length && !lines[i].startsWith('diff --git') && !lines[i].startsWith('---') && !lines[i].startsWith('@@')) {
      if (lines[i].startsWith('new file')) isNew = true
      if (lines[i].startsWith('deleted file')) isDeleted = true
      i++
    }

    if (i < lines.length && lines[i].startsWith('---')) i++
    if (i < lines.length && lines[i].startsWith('+++')) i++

    const hunks: DiffHunk[] = []

    while (i < lines.length && !lines[i].startsWith('diff --git')) {
      if (lines[i].startsWith('@@')) {
        const header = lines[i]
        const hunkMatch = header.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
        let oldLine = hunkMatch ? parseInt(hunkMatch[1]) : 1
        let newLine = hunkMatch ? parseInt(hunkMatch[2]) : 1
        i++

        const hunkLines: DiffLine[] = []
        while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('diff --git')) {
          const line = lines[i]
          if (line.startsWith('+')) {
            hunkLines.push({ type: 'added', content: line.slice(1), newLineNum: newLine })
            newLine++
          } else if (line.startsWith('-')) {
            hunkLines.push({ type: 'removed', content: line.slice(1), oldLineNum: oldLine })
            oldLine++
          } else if (line.startsWith(' ') || line === '') {
            hunkLines.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line, oldLineNum: oldLine, newLineNum: newLine })
            oldLine++
            newLine++
          } else {
            i++
            continue
          }
          i++
        }
        hunks.push({ header, lines: hunkLines })
      } else {
        i++
      }
    }

    // Merge with existing entry if same file path already parsed (e.g. committed + uncommitted diffs)
    const key = newPath || oldPath
    const existing = files.find(f => (f.newPath || f.oldPath) === key)
    if (existing) {
      existing.hunks.push(...hunks)
      if (isNew) existing.isNew = true
      if (isDeleted) existing.isDeleted = true
    } else {
      files.push({ oldPath, newPath, isNew, isDeleted, hunks })
    }
  }

  return files
}

export function getFileStats(file: DiffFile): { added: number; removed: number } {
  let added = 0, removed = 0
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'added') added++
      if (line.type === 'removed') removed++
    }
  }
  return { added, removed }
}

/** Qualify a file path with project name to avoid collisions across projects */
export function qualifyPath(project: string, filePath: string): string {
  return `${project}::${filePath}`
}

/** Comment key for looking up comments by file + line */
export function commentKey(file: string, line: number): string {
  return `${file}:${line}`
}

export function buildSplitPairs(lines: DiffLine[]): Array<{ left: DiffLine | null; right: DiffLine | null }> {
  const pairs: Array<{ left: DiffLine | null; right: DiffLine | null }> = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.type === 'context') {
      pairs.push({ left: line, right: line })
      i++
    } else if (line.type === 'removed') {
      const removed: DiffLine[] = []
      while (i < lines.length && lines[i].type === 'removed') {
        removed.push(lines[i])
        i++
      }
      const added: DiffLine[] = []
      while (i < lines.length && lines[i].type === 'added') {
        added.push(lines[i])
        i++
      }
      const max = Math.max(removed.length, added.length)
      for (let j = 0; j < max; j++) {
        pairs.push({
          left: j < removed.length ? removed[j] : null,
          right: j < added.length ? added[j] : null
        })
      }
    } else if (line.type === 'added') {
      pairs.push({ left: null, right: line })
      i++
    } else {
      i++
    }
  }
  return pairs
}
