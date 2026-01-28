import { resolveRequestConfig } from './variable-resolver.js'

let activeAbortController: AbortController | null = null

export async function executeRequest(
  workspaceId: string,
  config: ApiRequestConfig
): Promise<ApiResponse> {
  cancelActiveRequest()

  activeAbortController = new AbortController()

  // Resolve {{variables}} from active environment and collection variables
  const { config: resolvedConfig } = resolveRequestConfig(config, workspaceId)

  const url = buildUrl(resolvedConfig.url, resolvedConfig.params)
  const headers = buildHeaders(resolvedConfig.headers, resolvedConfig.auth)
  const body = buildBody(resolvedConfig.body, headers)

  const startTime = performance.now()

  try {
    const response = await fetch(url, {
      method: resolvedConfig.method,
      headers: headers.resolved,
      body: resolvedConfig.method !== 'GET' && resolvedConfig.method !== 'HEAD' ? body : undefined,
      signal: activeAbortController.signal,
      // @ts-expect-error - Electron supports this for local dev self-signed certs
      rejectUnauthorized: false,
    })

    const endTime = performance.now()
    const responseBody = await response.text()

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    activeAbortController = null

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      size: new TextEncoder().encode(responseBody).length,
      time: Math.round(endTime - startTime),
    }
  } catch (error) {
    activeAbortController = null

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request was cancelled')
    }

    throw new Error(
      `Request failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export function cancelActiveRequest(): void {
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
  }
}

function buildUrl(
  baseUrl: string,
  params: ApiKeyValue[]
): string {
  const enabledParams = params.filter((p) => p.enabled && p.key)

  if (enabledParams.length === 0) {
    return baseUrl
  }

  const url = new URL(baseUrl)

  for (const param of enabledParams) {
    url.searchParams.append(param.key, param.value)
  }

  return url.toString()
}

interface HeadersBuildResult {
  resolved: Record<string, string>
}

function buildHeaders(
  headers: ApiKeyValue[],
  auth?: ApiAuth
): HeadersBuildResult {
  const resolved: Record<string, string> = {}

  const enabledHeaders = headers.filter((h) => h.enabled && h.key)
  for (const header of enabledHeaders) {
    resolved[header.key] = header.value
  }

  if (auth) {
    const authHeaders = buildAuthHeaders(auth)
    for (const [key, value] of Object.entries(authHeaders)) {
      resolved[key] = value
    }
  }

  return { resolved }
}

function buildAuthHeaders(auth: ApiAuth): Record<string, string> {
  switch (auth.type) {
    case 'bearer': {
      if (auth.bearer?.token) {
        return { Authorization: `Bearer ${auth.bearer.token}` }
      }
      return {}
    }
    case 'basic': {
      if (auth.basic?.username !== undefined) {
        const credentials = `${auth.basic.username}:${auth.basic.password ?? ''}`
        const encoded = Buffer.from(credentials).toString('base64')
        return { Authorization: `Basic ${encoded}` }
      }
      return {}
    }
    case 'api-key': {
      if (auth.apiKey?.key && auth.apiKey.addTo === 'header') {
        return { [auth.apiKey.key]: auth.apiKey.value }
      }
      return {}
    }
    case 'oauth2': {
      if (auth.oauth2?.accessToken) {
        return { Authorization: `Bearer ${auth.oauth2.accessToken}` }
      }
      return {}
    }
    default:
      return {}
  }
}

function buildBody(
  body: ApiRequestBody | undefined,
  headers: HeadersBuildResult
): string | URLSearchParams | FormData | undefined {
  if (!body || body.type === 'none') {
    return undefined
  }

  switch (body.type) {
    case 'json': {
      if (!headers.resolved['Content-Type'] && !headers.resolved['content-type']) {
        headers.resolved['Content-Type'] = 'application/json'
      }
      return body.content
    }
    case 'raw': {
      return body.content
    }
    case 'x-www-form-urlencoded': {
      if (!headers.resolved['Content-Type'] && !headers.resolved['content-type']) {
        headers.resolved['Content-Type'] = 'application/x-www-form-urlencoded'
      }
      const params = new URLSearchParams()
      const enabledFields = (body.formData ?? []).filter((f) => f.enabled && f.key)
      for (const field of enabledFields) {
        params.append(field.key, field.value)
      }
      return params
    }
    case 'form-data': {
      const formData = new FormData()
      const enabledFields = (body.formData ?? []).filter((f) => f.enabled && f.key)
      for (const field of enabledFields) {
        formData.append(field.key, field.value)
      }
      return formData
    }
    case 'graphql': {
      if (!headers.resolved['Content-Type'] && !headers.resolved['content-type']) {
        headers.resolved['Content-Type'] = 'application/json'
      }
      const graphqlBody: Record<string, string> = {
        query: body.graphql?.query ?? '',
      }
      if (body.graphql?.variables) {
        return JSON.stringify({ ...graphqlBody, variables: body.graphql.variables })
      }
      return JSON.stringify(graphqlBody)
    }
    default:
      return undefined
  }
}
