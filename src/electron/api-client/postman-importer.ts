import { dialog } from 'electron'
import { readFile } from 'fs/promises'
import crypto from 'node:crypto'

// --- Postman format types (input) ---

interface PostmanCollection {
  info: {
    _postman_id?: string
    name?: string
    description?: string
    schema?: string
  }
  item: PostmanItem[]
  variable?: PostmanVariable[]
  auth?: PostmanAuth
}

interface PostmanItem {
  name: string
  item?: PostmanItem[]
  request?: PostmanRequest
  response?: unknown[]
  auth?: PostmanAuth
}

interface PostmanRequest {
  method: string
  header?: PostmanHeader[]
  url: PostmanUrl | string
  body?: PostmanBody
  auth?: PostmanAuth
}

interface PostmanUrl {
  raw: string
  host?: string[]
  path?: string[]
  query?: PostmanQueryParam[]
}

interface PostmanHeader {
  key: string
  value: string
  description?: string
  disabled?: boolean
}

interface PostmanQueryParam {
  key: string
  value: string
  description?: string
  disabled?: boolean
}

interface PostmanBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'graphql'
  raw?: string
  options?: { raw?: { language?: string } }
  urlencoded?: PostmanFormParam[]
  formdata?: PostmanFormParam[]
  graphql?: { query?: string; variables?: string }
}

interface PostmanFormParam {
  key: string
  value: string
  description?: string
  disabled?: boolean
}

interface PostmanAuth {
  type: string
  bearer?: PostmanAuthParam[]
  basic?: PostmanAuthParam[]
  apikey?: PostmanAuthParam[]
  oauth2?: PostmanAuthParam[]
  digest?: PostmanAuthParam[]
  hawk?: PostmanAuthParam[]
  awsv4?: PostmanAuthParam[]
  ntlm?: PostmanAuthParam[]
}

interface PostmanAuthParam {
  key: string
  value: string
  type?: string
}

interface PostmanVariable {
  key: string
  value: string
  type?: string
  enabled?: boolean
}

interface PostmanEnvironment {
  name: string
  values: PostmanEnvironmentValue[]
}

interface PostmanEnvironmentValue {
  key: string
  value: string
  type?: string
  enabled?: boolean
}

// --- Pure mapping functions ---

function mapPostmanItems(items: PostmanItem[]): ApiCollectionItem[] {
  return items.map((item) => {
    // Folders have a nested `item` array
    if (Array.isArray(item.item)) {
      return {
        id: crypto.randomUUID(),
        type: 'folder' as const,
        name: item.name || 'Unnamed Folder',
        items: mapPostmanItems(item.item),
        auth: item.auth ? mapPostmanAuth(item.auth) : undefined,
      }
    }

    return {
      id: crypto.randomUUID(),
      type: 'request' as const,
      name: item.name || 'Unnamed Request',
      request: item.request ? mapPostmanRequest(item.request) : {
        method: 'GET' as ApiHttpMethod,
        url: '',
        headers: [],
        params: [],
        body: { type: 'none', content: '' },
        auth: { type: 'none' },
      },
    }
  })
}

function mapPostmanRequest(req: PostmanRequest): ApiRequestConfig {
  const url = !req.url ? '' : typeof req.url === 'string' ? req.url : (req.url.raw ?? '')
  const query = !req.url || typeof req.url === 'string' ? [] : (req.url.query ?? [])

  return {
    method: (req.method || 'GET').toUpperCase() as ApiHttpMethod,
    url,
    headers: mapPostmanHeaders(req.header ?? []),
    params: mapPostmanQueryParams(query),
    auth: req.auth ? mapPostmanAuth(req.auth) : undefined,
    body: req.body ? mapPostmanBody(req.body) : undefined,
  }
}

function mapPostmanHeaders(headers: PostmanHeader[]): ApiKeyValue[] {
  return headers.map((header) => ({
    key: header.key,
    value: header.value,
    description: header.description,
    enabled: !header.disabled,
  }))
}

function mapPostmanQueryParams(params: PostmanQueryParam[]): ApiKeyValue[] {
  return params.map((param) => ({
    key: param.key,
    value: param.value,
    description: param.description,
    enabled: !param.disabled,
  }))
}

function mapPostmanAuth(auth: PostmanAuth): ApiAuth {
  switch (auth.type) {
    case 'bearer': {
      const tokenParam = (auth.bearer ?? []).find((p) => p.key === 'token')
      return {
        type: 'bearer',
        bearer: { token: tokenParam?.value ?? '' },
      }
    }
    case 'basic': {
      const params = auth.basic ?? []
      const username = params.find((p) => p.key === 'username')
      const password = params.find((p) => p.key === 'password')
      return {
        type: 'basic',
        basic: {
          username: username?.value ?? '',
          password: password?.value ?? '',
        },
      }
    }
    case 'apikey': {
      const params = auth.apikey ?? []
      const keyParam = params.find((p) => p.key === 'key')
      const valueParam = params.find((p) => p.key === 'value')
      const inParam = params.find((p) => p.key === 'in')
      return {
        type: 'api-key',
        apiKey: {
          key: keyParam?.value ?? '',
          value: valueParam?.value ?? '',
          addTo: (inParam?.value === 'query' ? 'query' : 'header') as 'header' | 'query',
        },
      }
    }
    case 'oauth2': {
      const params = auth.oauth2 ?? []
      const accessToken = params.find((p) => p.key === 'accessToken')
      const tokenUrl = params.find((p) => p.key === 'accessTokenUrl')
      const clientId = params.find((p) => p.key === 'clientId')
      const clientSecret = params.find((p) => p.key === 'clientSecret')
      const grantType = params.find((p) => p.key === 'grant_type')
      const scope = params.find((p) => p.key === 'scope')
      return {
        type: 'oauth2',
        oauth2: {
          accessToken: accessToken?.value ?? '',
          tokenUrl: tokenUrl?.value,
          clientId: clientId?.value,
          clientSecret: clientSecret?.value,
          grantType: grantType?.value,
          scope: scope?.value,
        },
      }
    }
    case 'digest': {
      const params = auth.digest ?? []
      const username = params.find((p) => p.key === 'username')
      const password = params.find((p) => p.key === 'password')
      const realm = params.find((p) => p.key === 'realm')
      const algorithm = params.find((p) => p.key === 'algorithm')
      return {
        type: 'digest',
        digest: {
          username: username?.value ?? '',
          password: password?.value ?? '',
          realm: realm?.value,
          algorithm: (algorithm?.value === 'SHA-256' ? 'SHA-256' : 'MD5') as 'MD5' | 'SHA-256',
        },
      }
    }
    case 'hawk': {
      const params = auth.hawk ?? []
      const authId = params.find((p) => p.key === 'authId')
      const authKey = params.find((p) => p.key === 'authKey')
      const algorithm = params.find((p) => p.key === 'algorithm')
      return {
        type: 'hawk',
        hawk: {
          authId: authId?.value ?? '',
          authKey: authKey?.value ?? '',
          algorithm: (algorithm?.value === 'sha1' ? 'sha1' : 'sha256') as 'sha256' | 'sha1',
        },
      }
    }
    case 'awsv4': {
      const params = auth.awsv4 ?? []
      const accessKey = params.find((p) => p.key === 'accessKey')
      const secretKey = params.find((p) => p.key === 'secretKey')
      const region = params.find((p) => p.key === 'region')
      const service = params.find((p) => p.key === 'service')
      const sessionToken = params.find((p) => p.key === 'sessionToken')
      return {
        type: 'aws-sig-v4',
        awsSigV4: {
          accessKey: accessKey?.value ?? '',
          secretKey: secretKey?.value ?? '',
          region: region?.value ?? '',
          service: service?.value ?? '',
          sessionToken: sessionToken?.value,
        },
      }
    }
    case 'ntlm': {
      const params = auth.ntlm ?? []
      const username = params.find((p) => p.key === 'username')
      const password = params.find((p) => p.key === 'password')
      const domain = params.find((p) => p.key === 'domain')
      return {
        type: 'ntlm',
        ntlm: {
          username: username?.value ?? '',
          password: password?.value ?? '',
          domain: domain?.value,
        },
      }
    }
    default:
      return { type: 'none' }
  }
}

function mapPostmanBody(body: PostmanBody): ApiRequestBody {
  switch (body.mode) {
    case 'raw': {
      const isJson = body.options?.raw?.language === 'json'
      return {
        type: isJson ? 'json' : 'raw',
        content: body.raw ?? '',
      }
    }
    case 'urlencoded':
      return {
        type: 'x-www-form-urlencoded',
        content: '',
        formData: mapPostmanFormParams(body.urlencoded ?? []),
      }
    case 'formdata':
      return {
        type: 'form-data',
        content: '',
        formData: mapPostmanFormParams(body.formdata ?? []),
      }
    case 'graphql':
      return {
        type: 'graphql',
        content: '',
        graphql: {
          query: body.graphql?.query ?? '',
          variables: body.graphql?.variables ?? '',
        },
      }
    default:
      return { type: 'none', content: '' }
  }
}

function mapPostmanFormParams(params: PostmanFormParam[]): ApiKeyValue[] {
  return params.map((param) => ({
    key: param.key,
    value: param.value,
    description: param.description,
    enabled: !param.disabled,
  }))
}

function mapPostmanVariables(vars: PostmanVariable[]): ApiVariable[] {
  return vars.map((v) => ({
    key: v.key,
    value: v.value,
    type: v.type === 'secret' ? 'secret' as const : 'default' as const,
    enabled: v.enabled !== false,
  }))
}

function mapPostmanEnvironmentValues(values: PostmanEnvironmentValue[]): ApiVariable[] {
  return values.map((v) => ({
    key: v.key,
    value: v.value,
    type: v.type === 'secret' ? 'secret' as const : 'default' as const,
    enabled: v.enabled !== false,
  }))
}

// --- Public API ---

function parsePostmanCollection(data: PostmanCollection): ApiCollection {
  if (!data.info || !data.item) {
    throw new Error('Invalid Postman Collection format: missing "info" or "item" fields')
  }

  return {
    id: crypto.randomUUID(),
    name: data.info.name || 'Imported Collection',
    description: data.info.description || undefined,
    items: mapPostmanItems(data.item),
    variables: mapPostmanVariables(data.variable ?? []),
    auth: data.auth ? mapPostmanAuth(data.auth) : undefined,
    importedFrom: 'postman',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export async function importPostmanCollection(workspaceId: string): Promise<ApiCollection | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
    title: 'Import Postman Collection',
  })

  if (result.canceled || !result.filePaths[0]) {
    return null
  }

  const content = await readFile(result.filePaths[0], 'utf-8')
  const data = JSON.parse(content)

  // Support both Postman collection format and raw JSON
  if (data.info && Array.isArray(data.item)) {
    return parsePostmanCollection(data as PostmanCollection)
  }

  // If it's a JSON object but not a Postman collection, wrap it as a single-request collection
  throw new Error('Invalid format: expected a Postman collection JSON with "info" and "item" fields')
}

export async function importPostmanCollectionFromPath(filePath: string): Promise<ApiCollection> {
  const content = await readFile(filePath, 'utf-8')
  const data = JSON.parse(content)

  if (data.info && Array.isArray(data.item)) {
    return parsePostmanCollection(data as PostmanCollection)
  }

  throw new Error('File is not a valid Postman collection format. Expected "info" and "item" fields.')
}

export async function importPostmanEnvironment(workspaceId: string): Promise<ApiEnvironment | null> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
    title: 'Import Postman Environment',
  })

  if (result.canceled || !result.filePaths[0]) {
    return null
  }

  const content = await readFile(result.filePaths[0], 'utf-8')
  const data: PostmanEnvironment = JSON.parse(content)

  if (!data.values || !Array.isArray(data.values)) {
    throw new Error('Invalid Postman Environment format: missing "values" array')
  }

  return {
    id: crypto.randomUUID(),
    name: data.name || 'Imported Environment',
    variables: mapPostmanEnvironmentValues(data.values),
    isActive: false,
  }
}
