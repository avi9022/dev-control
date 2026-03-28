/**
 * Docker container file system operations: list, read, download, upload, drag.
 */

import { dockerCli } from './docker-cli.js'
import { validateContainerId } from './docker-utils.js'
import { app, dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'

interface CliOptions {
  context: string
}

function detectMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.js': 'text/javascript',
    '.ts': 'text/typescript',
    '.tsx': 'text/typescript',
    '.jsx': 'text/javascript',
    '.json': 'application/json',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.xml': 'text/xml',
    '.html': 'text/html',
    '.css': 'text/css',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.log': 'text/plain',
    '.sh': 'text/x-sh',
    '.bash': 'text/x-sh',
    '.py': 'text/x-python',
    '.go': 'text/x-go',
    '.rs': 'text/x-rust',
    '.java': 'text/x-java',
    '.c': 'text/x-c',
    '.cpp': 'text/x-c++',
    '.h': 'text/x-c',
    '.env': 'text/plain',
    '.toml': 'text/toml',
    '.ini': 'text/ini',
    '.conf': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

function isBinaryMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('audio/') ||
    mimeType.startsWith('video/') ||
    mimeType === 'application/octet-stream'
  )
}

function parseLsOutput(output: string, basePath: string, isBusyBox: boolean = false): DockerFileEntry[] {
  const lines = output.split('\n').filter((line) => line.trim())
  const entries: DockerFileEntry[] = []

  for (const line of lines) {
    if (line.startsWith('total ') || !line.trim()) continue

    let match: RegExpMatchArray | null = null
    let permissions: string
    let owner: string
    let group: string
    let sizeStr: string
    let date: string
    let time: string
    let nameWithLink: string

    if (isBusyBox) {
      match = line.match(
        /^([drwxlst-]{10})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(.+)$/
      )
      if (!match) continue
      ;[, permissions, owner, group, sizeStr, date, time, nameWithLink] = match
    } else {
      match = line.match(
        /^([drwxlst-]{10})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+([+-]\d{4})\s+(.+)$/
      )
      if (!match) continue
      ;[, permissions, owner, group, sizeStr, date, time, , nameWithLink] = match
    }

    const size = parseInt(sizeStr, 10)

    let name = nameWithLink
    let linkTarget: string | undefined
    const symlinkMatch = nameWithLink.match(/^(.+?)\s+->\s+(.+)$/)
    if (symlinkMatch) {
      name = symlinkMatch[1]
      linkTarget = symlinkMatch[2]
    }

    if (name === '.' || name === '..') continue

    const type: 'file' | 'directory' | 'symlink' =
      permissions.startsWith('d') ? 'directory' :
      permissions.startsWith('l') ? 'symlink' : 'file'

    const entryPath = basePath.endsWith('/') ? `${basePath}${name}` : `${basePath}/${name}`

    entries.push({
      name,
      path: entryPath,
      type,
      size,
      permissions: permissions.slice(1),
      owner,
      group,
      modifiedAt: `${date}T${time}`,
      linkTarget,
    })
  }

  return entries.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1
    if (a.type !== 'directory' && b.type === 'directory') return 1
    return a.name.localeCompare(b.name)
  })
}

export async function listDirectory(
  containerId: string,
  dirPath: string,
  opts: CliOptions
): Promise<DockerFileEntry[]> {
  const safeId = validateContainerId(containerId)

  try {
    let output: string
    let isBusyBox = false

    try {
      const lsCmd = `ls -la --time-style=full-iso "${dirPath}"`
      output = await dockerCli.execSafe(
        ['exec', '-u', 'root', safeId, 'sh', '-c', lsCmd],
        opts
      )
    } catch {
      const lsCmd = `ls -la --full-time "${dirPath}"`
      output = await dockerCli.execSafe(
        ['exec', '-u', 'root', safeId, 'sh', '-c', lsCmd],
        opts
      )
      isBusyBox = true
    }

    return parseLsOutput(output, dirPath, isBusyBox)
  } catch (error) {
    throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function readFile(
  containerId: string,
  filePath: string,
  maxSize: number = 1024 * 1024,
  opts: CliOptions
): Promise<DockerFileContent> {
  const safeId = validateContainerId(containerId)

  let size: number
  try {
    const statCmd = `stat -c '%s' "${filePath}"`
    const statOutput = await dockerCli.execSafe(
      ['exec', '-u', 'root', safeId, 'sh', '-c', statCmd],
      opts
    )
    size = parseInt(statOutput.trim(), 10)
  } catch {
    const wcCmd = `wc -c < "${filePath}"`
    const wcOutput = await dockerCli.execSafe(
      ['exec', '-u', 'root', safeId, 'sh', '-c', wcCmd],
      opts
    )
    size = parseInt(wcOutput.trim(), 10)
  }

  const mimeType = detectMimeType(filePath)
  const isImage = mimeType.startsWith('image/')
  const isBinary = isImage || isBinaryMimeType(mimeType)

  let content: string
  let truncated = false
  let encoding: 'utf8' | 'base64' = 'utf8'

  if (isBinary) {
    if (size > maxSize * 5) {
      throw new Error(`File too large: ${size} bytes (max ${maxSize * 5} for binary)`)
    }
    const base64Cmd = `base64 "${filePath}"`
    const base64Output = await dockerCli.execSafe(
      ['exec', '-u', 'root', safeId, 'sh', '-c', base64Cmd],
      { ...opts, timeout: 30000 }
    )
    content = base64Output.replace(/\s/g, '')
    encoding = 'base64'
  } else {
    if (size > maxSize) {
      const headCmd = `head -c ${maxSize} "${filePath}"`
      const headOutput = await dockerCli.execSafe(
        ['exec', '-u', 'root', safeId, 'sh', '-c', headCmd],
        opts
      )
      content = headOutput
      truncated = true
    } else {
      const catCmd = `cat "${filePath}"`
      content = await dockerCli.execSafe(
        ['exec', '-u', 'root', safeId, 'sh', '-c', catCmd],
        opts
      )
    }
  }

  return { content, truncated, mimeType, size, encoding }
}

export async function downloadFile(
  containerId: string,
  remotePath: string,
  isDirectory: boolean = false,
  opts: CliOptions
): Promise<string> {
  const safeId = validateContainerId(containerId)
  const fileName = path.basename(remotePath)

  if (isDirectory) {
    const result = await dialog.showOpenDialog({
      title: 'Select destination folder',
      properties: ['openDirectory', 'createDirectory'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return ''
    }

    const destPath = path.join(result.filePaths[0], fileName)
    await dockerCli.execSafe(
      ['cp', `${safeId}:${remotePath}`, destPath],
      { ...opts, timeout: 120000 }
    )
    return destPath
  }

  const result = await dialog.showSaveDialog({
    defaultPath: fileName,
    title: 'Save file from container',
  })

  if (!result.filePath) {
    return ''
  }

  await dockerCli.execSafe(
    ['cp', `${safeId}:${remotePath}`, result.filePath],
    opts
  )

  return result.filePath
}

export async function uploadFile(
  containerId: string,
  localPath: string,
  remotePath: string,
  opts: CliOptions
): Promise<void> {
  const safeId = validateContainerId(containerId)
  await dockerCli.execSafe(
    ['cp', localPath, `${safeId}:${remotePath}`],
    { ...opts, timeout: 120000 }
  )
}

export async function uploadFiles(
  containerId: string,
  localPaths: string[],
  remotePath: string,
  opts: CliOptions
): Promise<number> {
  let uploaded = 0
  for (const localPath of localPaths) {
    const fileName = path.basename(localPath)
    const targetPath = remotePath.endsWith('/') ? `${remotePath}${fileName}` : `${remotePath}/${fileName}`
    await uploadFile(containerId, localPath, targetPath, opts)
    uploaded++
  }
  return uploaded
}

export async function uploadFileDialog(
  containerId: string,
  remotePath: string,
  opts: CliOptions
): Promise<number> {
  const result = await dialog.showOpenDialog({
    title: 'Select files or folders to upload',
    properties: ['openFile', 'openDirectory', 'multiSelections'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return 0
  }

  return uploadFiles(containerId, result.filePaths, remotePath, opts)
}

export async function createDirectory(
  containerId: string,
  dirPath: string,
  opts: CliOptions
): Promise<void> {
  const safeId = validateContainerId(containerId)
  const mkdirCmd = `mkdir -p "${dirPath}"`
  await dockerCli.execSafe(
    ['exec', '-u', 'root', safeId, 'sh', '-c', mkdirCmd],
    opts
  )
}

export async function deletePath(
  containerId: string,
  targetPath: string,
  recursive: boolean = false,
  opts: CliOptions
): Promise<void> {
  const safeId = validateContainerId(containerId)
  const rmCmd = recursive ? `rm -rf "${targetPath}"` : `rm "${targetPath}"`
  await dockerCli.execSafe(
    ['exec', '-u', 'root', safeId, 'sh', '-c', rmCmd],
    opts
  )
}

export async function renamePath(
  containerId: string,
  oldPath: string,
  newPath: string,
  opts: CliOptions
): Promise<void> {
  const safeId = validateContainerId(containerId)
  const mvCmd = `mv "${oldPath}" "${newPath}"`
  await dockerCli.execSafe(
    ['exec', '-u', 'root', safeId, 'sh', '-c', mvCmd],
    opts
  )
}

export async function startDrag(
  mainWindow: BrowserWindow,
  containerId: string,
  remotePath: string,
  opts: CliOptions
): Promise<void> {
  const safeId = validateContainerId(containerId)
  const fileName = path.basename(remotePath)
  const tempDir = path.join(app.getPath('temp'), `docker-drag-${Date.now()}`)
  const tempPath = path.join(tempDir, fileName)

  await fs.mkdir(tempDir, { recursive: true })

  await dockerCli.execSafe(
    ['cp', `${safeId}:${remotePath}`, tempPath],
    { ...opts, timeout: 120000 }
  )

  const iconPath = path.join(tempDir, 'drag-icon.png')
  const transparentPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  )
  await fs.writeFile(iconPath, transparentPng)

  mainWindow.webContents.startDrag({
    file: tempPath,
    icon: iconPath,
  })

  setTimeout(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }, 60000)
}
