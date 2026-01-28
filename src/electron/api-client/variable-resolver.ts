import { store } from '../storage/store.js'

const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g
const MAX_RESOLUTION_DEPTH = 10

interface ResolvedResult {
  resolved: string
  unresolvedVars: string[]
}

// ─── Auth Inheritance Resolution ───

function findItemPath(
  items: ApiCollectionItem[],
  targetId: string,
  path: ApiCollectionItem[] = []
): ApiCollectionItem[] | null {
  for (const item of items) {
    if (item.id === targetId) {
      return [...path, item]
    }
    if (item.type === 'folder' && item.items) {
      const found = findItemPath(item.items, targetId, [...path, item])
      if (found) return found
    }
  }
  return null
}

export function resolveInheritedAuth(
  requestId: string,
  collectionId: string,
  workspaceId: string
): ResolvedAuthInfo | null {
  const workspaces = store.get('apiWorkspaces')
  const workspace = workspaces.find(w => w.id === workspaceId)
  if (!workspace) return null

  const collection = workspace.collections.find(c => c.id === collectionId)
  if (!collection) return null

  const path = findItemPath(collection.items, requestId)
  if (!path) return null

  const request = path[path.length - 1]
  if (!request || request.type !== 'request') return null

  // Check request's own auth first (if not inherit)
  if (request.request?.auth && request.request.auth.type !== 'inherit' && request.request.auth.type !== 'none') {
    return {
      auth: request.request.auth,
      source: 'request',
      sourceId: request.id,
      sourceName: request.name,
    }
  }

  // Walk up through folders (reverse order, skip the request itself)
  const folders = path.slice(0, -1).reverse()
  for (const folder of folders) {
    if (folder.auth && folder.auth.type !== 'inherit' && folder.auth.type !== 'none') {
      return {
        auth: folder.auth,
        source: 'folder',
        sourceId: folder.id,
        sourceName: folder.name,
      }
    }
  }

  // Check collection auth
  if (collection.auth && collection.auth.type !== 'inherit' && collection.auth.type !== 'none') {
    return {
      auth: collection.auth,
      source: 'collection',
      sourceId: collection.id,
      sourceName: collection.name,
    }
  }

  return null
}

export function resolveVariables(
  text: string,
  workspaceId: string
): ResolvedResult {
  const workspaces = store.get('apiWorkspaces')
  const workspace = workspaces.find(w => w.id === workspaceId)
  if (!workspace) {
    return { resolved: text, unresolvedVars: [] }
  }

  // Build variable map with priority:
  // 1. Collection variables (highest) -- not used here since we don't know collection context
  // 2. Active environment variables
  // 3. Global variables (lowest)
  const variableMap = new Map<string, string>()

  // Global variables first (lowest priority)
  const globalVars = store.get('apiGlobalVariables')
  for (const v of globalVars) {
    if (v.enabled) {
      variableMap.set(v.key, v.value)
    }
  }

  // Active environment variables override globals
  const activeEnv = workspace.environments.find(
    e => e.id === workspace.activeEnvironmentId
  )
  if (activeEnv) {
    for (const v of activeEnv.variables) {
      if (v.enabled) {
        variableMap.set(v.key, v.value)
      }
    }
  }

  return resolveText(text, variableMap)
}

export function resolveRequestConfig(
  config: ApiRequestConfig,
  workspaceId: string,
  collectionVariables?: ApiVariable[]
): { config: ApiRequestConfig; unresolvedVars: string[] } {
  const workspaces = store.get('apiWorkspaces')
  const workspace = workspaces.find(w => w.id === workspaceId)
  const variableMap = new Map<string, string>()
  const allUnresolved: string[] = []

  // Global variables (lowest priority)
  const globalVars = store.get('apiGlobalVariables')
  for (const v of globalVars) {
    if (v.enabled) variableMap.set(v.key, v.value)
  }

  // Active environment variables
  if (workspace) {
    const activeEnv = workspace.environments.find(
      e => e.id === workspace.activeEnvironmentId
    )
    if (activeEnv) {
      for (const v of activeEnv.variables) {
        if (v.enabled) variableMap.set(v.key, v.value)
      }
    }
  }

  // Collection variables (highest priority)
  // If not explicitly provided, gather from all collections in the workspace
  if (collectionVariables) {
    for (const v of collectionVariables) {
      if (v.enabled) variableMap.set(v.key, v.value)
    }
  } else if (workspace) {
    for (const col of workspace.collections) {
      if (col.variables) {
        for (const v of col.variables) {
          if (v.enabled && !variableMap.has(v.key)) {
            variableMap.set(v.key, v.value)
          }
        }
      }
    }
  }

  const resolve = (text: string): string => {
    const result = resolveText(text, variableMap)
    allUnresolved.push(...result.unresolvedVars)
    return result.resolved
  }

  const resolvedConfig: ApiRequestConfig = {
    method: config.method,
    url: resolve(config.url),
    headers: config.headers.map(h => ({
      ...h,
      key: resolve(h.key),
      value: resolve(h.value),
    })),
    params: config.params.map(p => ({
      ...p,
      key: resolve(p.key),
      value: resolve(p.value),
    })),
    auth: config.auth ? resolveAuth(config.auth, resolve) : undefined,
    body: config.body ? resolveBody(config.body, resolve) : undefined,
  }

  return {
    config: resolvedConfig,
    unresolvedVars: [...new Set(allUnresolved)],
  }
}

function resolveText(
  text: string,
  variables: Map<string, string>
): ResolvedResult {
  const unresolvedVars: string[] = []
  let result = text
  let depth = 0

  while (VARIABLE_PATTERN.test(result) && depth < MAX_RESOLUTION_DEPTH) {
    depth++
    result = result.replace(VARIABLE_PATTERN, (match, varName: string) => {
      const trimmed = varName.trim()
      const value = variables.get(trimmed)
      if (value === undefined) {
        unresolvedVars.push(trimmed)
        return match
      }
      return value
    })
  }

  return { resolved: result, unresolvedVars: [...new Set(unresolvedVars)] }
}

function resolveAuth(
  auth: ApiAuth,
  resolve: (t: string) => string
): ApiAuth {
  return {
    type: auth.type,
    bearer: auth.bearer
      ? {
          token: resolve(auth.bearer.token),
          prefix: auth.bearer.prefix,
        }
      : undefined,
    basic: auth.basic
      ? {
          username: resolve(auth.basic.username),
          password: resolve(auth.basic.password),
        }
      : undefined,
    apiKey: auth.apiKey
      ? {
          key: resolve(auth.apiKey.key),
          value: resolve(auth.apiKey.value),
          addTo: auth.apiKey.addTo,
        }
      : undefined,
    oauth2: auth.oauth2
      ? {
          accessToken: resolve(auth.oauth2.accessToken),
          tokenUrl: auth.oauth2.tokenUrl
            ? resolve(auth.oauth2.tokenUrl)
            : undefined,
          clientId: auth.oauth2.clientId
            ? resolve(auth.oauth2.clientId)
            : undefined,
          clientSecret: auth.oauth2.clientSecret
            ? resolve(auth.oauth2.clientSecret)
            : undefined,
          grantType: auth.oauth2.grantType,
          scope: auth.oauth2.scope
            ? resolve(auth.oauth2.scope)
            : undefined,
        }
      : undefined,
    digest: auth.digest
      ? {
          username: resolve(auth.digest.username),
          password: resolve(auth.digest.password),
          realm: auth.digest.realm
            ? resolve(auth.digest.realm)
            : undefined,
          algorithm: auth.digest.algorithm,
        }
      : undefined,
    hawk: auth.hawk
      ? {
          authId: resolve(auth.hawk.authId),
          authKey: resolve(auth.hawk.authKey),
          algorithm: auth.hawk.algorithm,
        }
      : undefined,
    awsSigV4: auth.awsSigV4
      ? {
          accessKey: resolve(auth.awsSigV4.accessKey),
          secretKey: resolve(auth.awsSigV4.secretKey),
          region: resolve(auth.awsSigV4.region),
          service: resolve(auth.awsSigV4.service),
          sessionToken: auth.awsSigV4.sessionToken
            ? resolve(auth.awsSigV4.sessionToken)
            : undefined,
        }
      : undefined,
    ntlm: auth.ntlm
      ? {
          username: resolve(auth.ntlm.username),
          password: resolve(auth.ntlm.password),
          domain: auth.ntlm.domain
            ? resolve(auth.ntlm.domain)
            : undefined,
        }
      : undefined,
  }
}

function resolveBody(
  body: ApiRequestBody,
  resolve: (t: string) => string
): ApiRequestBody {
  return {
    type: body.type,
    content: resolve(body.content),
    formData: body.formData?.map(f => ({
      ...f,
      key: resolve(f.key),
      value: resolve(f.value),
    })),
    graphql: body.graphql
      ? {
          query: resolve(body.graphql.query),
          variables: resolve(body.graphql.variables),
        }
      : undefined,
  }
}
