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
    const isFolder = Array.isArray(item.item)

    if (isFolder) {
      return {
        id: crypto.randomUUID(),
        type: 'folder' as const,
        name: item.name,
        items: mapPostmanItems(item.item ?? []),
      }
    }

    return {
      id: crypto.randomUUID(),
      type: 'request' as const,
      name: item.name,
      request: item.request ? mapPostmanRequest(item.request) : undefined,
    }
  })
}

function mapPostmanRequest(req: PostmanRequest): ApiRequestConfig {
  const url = typeof req.url === 'string' ? req.url : req.url.raw
  const query = typeof req.url === 'string' ? [] : (req.url.query ?? [])

  return {
    method: (req.method || 'GET').toUpperCase() as ApiHttpMethod,
    url: url || '',
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

export async function importPostmanCollection(workspaceId: string): Promise<ApiCollection> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
    title: 'Import Postman Collection',
  })

  if (result.canceled || !result.filePaths[0]) {
    throw new Error('Import cancelled')
  }

  const content = await readFile(result.filePaths[0], 'utf-8')
  const data: PostmanCollection = JSON.parse(content)

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

export async function importPostmanEnvironment(workspaceId: string): Promise<ApiEnvironment> {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
    title: 'Import Postman Environment',
  })

  if (result.canceled || !result.filePaths[0]) {
    throw new Error('Import cancelled')
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
