import crypto from 'node:crypto'
import { resolveRequestConfig, resolveInheritedAuth } from './variable-resolver.js'

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
        const prefix = auth.bearer.prefix ?? 'Bearer'
        return { Authorization: `${prefix} ${auth.bearer.token}` }
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
    case 'digest': {
      // Digest auth requires a challenge-response flow
      // For initial request, we return empty headers
      // The actual digest header is computed after receiving 401 with WWW-Authenticate
      // This is a simplified implementation - full digest would require retry logic
      if (auth.digest?.username && auth.digest?.password) {
        // Basic initial header for servers that accept preemptive digest
        const algorithm = auth.digest.algorithm ?? 'MD5'
        const realm = auth.digest.realm ?? ''
        const nonce = crypto.randomBytes(16).toString('hex')
        const cnonce = crypto.randomBytes(16).toString('hex')
        const nc = '00000001'
        const qop = 'auth'
        const uri = '/'

        // HA1 = MD5(username:realm:password)
        const ha1 = crypto.createHash(algorithm === 'SHA-256' ? 'sha256' : 'md5')
          .update(`${auth.digest.username}:${realm}:${auth.digest.password}`)
          .digest('hex')

        // HA2 = MD5(method:uri) - method would need to be passed in for full implementation
        const ha2 = crypto.createHash(algorithm === 'SHA-256' ? 'sha256' : 'md5')
          .update(`GET:${uri}`)
          .digest('hex')

        // Response = MD5(HA1:nonce:nc:cnonce:qop:HA2)
        const response = crypto.createHash(algorithm === 'SHA-256' ? 'sha256' : 'md5')
          .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
          .digest('hex')

        return {
          Authorization: `Digest username="${auth.digest.username}", realm="${realm}", nonce="${nonce}", uri="${uri}", algorithm=${algorithm}, qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`
        }
      }
      return {}
    }
    case 'hawk': {
      // Hawk authentication header
      if (auth.hawk?.authId && auth.hawk?.authKey) {
        const timestamp = Math.floor(Date.now() / 1000)
        const nonce = crypto.randomBytes(6).toString('base64')
        const algorithm = auth.hawk.algorithm ?? 'sha256'

        // Simplified Hawk header - full implementation would include URI, method, etc.
        const mac = crypto.createHmac(algorithm, auth.hawk.authKey)
          .update(`hawk.1.header\n${timestamp}\n${nonce}\nGET\n/\nlocalhost\n80\n\n`)
          .digest('base64')

        return {
          Authorization: `Hawk id="${auth.hawk.authId}", ts="${timestamp}", nonce="${nonce}", mac="${mac}"`
        }
      }
      return {}
    }
    case 'aws-sig-v4': {
      // AWS Signature Version 4
      // This is a simplified implementation - full AWS SigV4 is complex
      if (auth.awsSigV4?.accessKey && auth.awsSigV4?.secretKey) {
        const now = new Date()
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
        const dateStamp = amzDate.slice(0, 8)
        const region = auth.awsSigV4.region
        const service = auth.awsSigV4.service
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`

        const headers: Record<string, string> = {
          'X-Amz-Date': amzDate,
          'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
          'X-Amz-Credential': `${auth.awsSigV4.accessKey}/${credentialScope}`,
        }

        if (auth.awsSigV4.sessionToken) {
          headers['X-Amz-Security-Token'] = auth.awsSigV4.sessionToken
        }

        return headers
      }
      return {}
    }
    case 'ntlm': {
      // NTLM authentication - simplified initial message
      // Full NTLM requires multi-step negotiation
      if (auth.ntlm?.username && auth.ntlm?.password) {
        // Type 1 message (Negotiate)
        const domain = auth.ntlm.domain ?? ''
        const negotiateFlags = Buffer.alloc(4)
        negotiateFlags.writeUInt32LE(0x00000001, 0) // NTLMSSP_NEGOTIATE_UNICODE

        // Build simplified NTLM Type 1 message
        const signature = Buffer.from('NTLMSSP\0')
        const messageType = Buffer.alloc(4)
        messageType.writeUInt32LE(1, 0) // Type 1

        const type1Message = Buffer.concat([signature, messageType, negotiateFlags])
        return {
          Authorization: `NTLM ${type1Message.toString('base64')}`
        }
      }
      return {}
    }
    case 'inherit':
    case 'none':
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
