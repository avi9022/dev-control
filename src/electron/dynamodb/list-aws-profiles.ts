import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// Section headers that exist in ~/.aws/config but are NOT credential profiles.
const NON_PROFILE_PREFIXES = ["sso-session ", "services "]

const credentialsFilePath = (): string =>
  process.env.AWS_SHARED_CREDENTIALS_FILE || join(homedir(), ".aws", "credentials")

const configFilePath = (): string =>
  process.env.AWS_CONFIG_FILE || join(homedir(), ".aws", "config")

// Extracts profile names from a single ini file. The credentials file uses
// `[name]`, while the config file prefixes non-default profiles as
// `[profile name]` (and SSO profiles live there too).
function parseProfiles(filePath: string): string[] {
  if (!existsSync(filePath)) return []

  let contents: string
  try {
    contents = readFileSync(filePath, "utf8")
  } catch {
    return []
  }

  const profiles: string[] = []
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*\[([^\]]+)\]\s*$/)
    if (!match) continue

    const section = match[1].trim()
    if (NON_PROFILE_PREFIXES.some((prefix) => section.startsWith(prefix))) continue

    if (section.startsWith("profile ")) {
      profiles.push(section.slice("profile ".length).trim())
    } else {
      profiles.push(section)
    }
  }
  return profiles
}

// Returns the de-duplicated, sorted union of profiles from both AWS shared
// files, so the UI can offer them for selection.
export function listAWSProfiles(): string[] {
  const all = [...parseProfiles(credentialsFilePath()), ...parseProfiles(configFilePath())]
  return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b))
}
