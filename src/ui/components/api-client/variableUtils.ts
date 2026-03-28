import { useApiClient } from '@/ui/contexts/api-client'

export function useVariableMap(): { vars: Map<string, string>; envName: string | undefined } {
  const { activeWorkspace } = useApiClient()

  const vars = new Map<string, string>()
  if (activeWorkspace) {
    const activeEnv = activeWorkspace.environments.find(
      (e) => e.id === activeWorkspace.activeEnvironmentId
    )
    if (activeEnv) {
      for (const v of activeEnv.variables) {
        if (v.enabled) vars.set(v.key, v.value)
      }
    }
    for (const col of activeWorkspace.collections) {
      if (col.variables) {
        for (const v of col.variables) {
          if (v.enabled && !vars.has(v.key)) {
            vars.set(v.key, v.value)
          }
        }
      }
    }
  }

  const envName = activeWorkspace?.environments.find(
    (e) => e.id === activeWorkspace?.activeEnvironmentId
  )?.name

  return { vars, envName }
}

interface TextSegment {
  type: 'text' | 'variable'
  text: string
  varName?: string
  resolved?: boolean
}

export function parseTextSegments(text: string, vars: Map<string, string>): TextSegment[] {
  const segments: TextSegment[] = []
  let lastIndex = 0
  const regex = /\{\{([^}]+)\}\}/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) })
    }
    const varName = match[1].trim()
    segments.push({
      type: 'variable',
      text: match[0],
      varName,
      resolved: vars.has(varName),
    })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) })
  }

  return segments
}

export function textHasVariables(text: string): boolean {
  return /\{\{[^}]+\}\}/.test(text)
}
