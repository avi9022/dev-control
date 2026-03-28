import { execFileSync } from 'child_process'

let resolvedClaudePath: string | null = null

/**
 * Resolve the absolute path to the `claude` CLI binary.
 * Falls back to the bare command name if `which` fails.
 * The result is cached after the first successful lookup.
 */
export function getClaudePath(): string {
  if (resolvedClaudePath) return resolvedClaudePath
  try {
    resolvedClaudePath = execFileSync('which', ['claude'], { encoding: 'utf-8' }).trim()
  } catch {
    resolvedClaudePath = 'claude'
  }
  return resolvedClaudePath
}
