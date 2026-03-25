import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const KNOWLEDGE_BASE_DIR = 'project-knowledge'
const PROFILE_FILE = 'profile.json'
const KNOWLEDGE_FILE = 'knowledge.md'

function getKnowledgeBaseDir(): string {
  return path.join(app.getPath('userData'), KNOWLEDGE_BASE_DIR)
}

function getProjectId(projectPath: string): string {
  return Buffer.from(projectPath).toString('base64')
}

function getProjectDir(projectPath: string): string {
  return path.join(getKnowledgeBaseDir(), getProjectId(projectPath))
}

export function getProjectProfile(projectPath: string): ProjectProfile | null {
  const profilePath = path.join(getProjectDir(projectPath), PROFILE_FILE)
  if (!fs.existsSync(profilePath)) {
    return null
  }
  const content = fs.readFileSync(profilePath, 'utf-8')
  return JSON.parse(content) as ProjectProfile
}

export function getAllProjectProfiles(): ProjectProfile[] {
  const baseDir = getKnowledgeBaseDir()
  if (!fs.existsSync(baseDir)) {
    return []
  }
  const entries = fs.readdirSync(baseDir, { withFileTypes: true })
  const profiles: ProjectProfile[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    const profilePath = path.join(baseDir, entry.name, PROFILE_FILE)
    if (!fs.existsSync(profilePath)) {
      continue
    }
    try {
      const content = fs.readFileSync(profilePath, 'utf-8')
      profiles.push(JSON.parse(content) as ProjectProfile)
    } catch {
      continue
    }
  }
  return profiles
}

export function saveProjectProfile(profile: ProjectProfile): void {
  const projectDir = getProjectDir(profile.projectPath)
  fs.mkdirSync(projectDir, { recursive: true })
  fs.writeFileSync(
    path.join(projectDir, PROFILE_FILE),
    JSON.stringify(profile, null, 2),
    'utf-8'
  )
}

export function getProjectKnowledge(projectPath: string): string | null {
  const knowledgePath = path.join(getProjectDir(projectPath), KNOWLEDGE_FILE)
  if (!fs.existsSync(knowledgePath)) {
    return null
  }
  return fs.readFileSync(knowledgePath, 'utf-8')
}

export function saveProjectKnowledge(projectPath: string, markdown: string): void {
  const projectDir = getProjectDir(projectPath)
  fs.mkdirSync(projectDir, { recursive: true })
  fs.writeFileSync(path.join(projectDir, KNOWLEDGE_FILE), markdown, 'utf-8')
}

export function deleteProjectKnowledge(projectPath: string): void {
  const projectDir = getProjectDir(projectPath)
  if (!fs.existsSync(projectDir)) {
    return
  }
  fs.rmSync(projectDir, { recursive: true, force: true })
}
