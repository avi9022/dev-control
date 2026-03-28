// ─── API Client Types ───
type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

interface ApiWorkspace {
  id: string
  name: string
  collections: ApiCollection[]
  environments: ApiEnvironment[]
  activeEnvironmentId: string | null
  createdAt: number
  updatedAt: number
}

interface ApiCollection {
  id: string
  name: string
  description?: string
  items: ApiCollectionItem[]
  variables?: ApiVariable[]
  auth?: ApiAuth
  importedFrom?: 'postman' | 'insomnia' | 'manual'
  createdAt: number
  updatedAt: number
}

interface ApiCollectionItem {
  id: string
  type: 'folder' | 'request'
  name: string
  items?: ApiCollectionItem[]
  request?: ApiRequestConfig
  responses?: ApiSavedResponse[]
  auth?: ApiAuth
}

interface ApiRequestConfig {
  method: ApiHttpMethod
  url: string
  headers: ApiKeyValue[]
  params: ApiKeyValue[]
  auth?: ApiAuth
  body?: ApiRequestBody
}

interface ApiKeyValue {
  key: string
  value: string
  description?: string
  enabled: boolean
}

interface ApiRequestBody {
  type: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql'
  content: string
  formData?: ApiKeyValue[]
  graphql?: { query: string; variables: string }
}

type ApiAuthType =
  | 'inherit' | 'none' | 'bearer' | 'basic' | 'api-key'
  | 'oauth2' | 'digest' | 'hawk' | 'aws-sig-v4' | 'ntlm'

interface ApiAuth {
  type: ApiAuthType
  bearer?: { token: string; prefix?: string }
  basic?: { username: string; password: string }
  apiKey?: { key: string; value: string; addTo: 'header' | 'query' }
  oauth2?: {
    accessToken: string
    tokenUrl?: string
    clientId?: string
    clientSecret?: string
    grantType?: string
    scope?: string
  }
  digest?: {
    username: string
    password: string
    realm?: string
    algorithm?: 'MD5' | 'SHA-256'
  }
  hawk?: {
    authId: string
    authKey: string
    algorithm?: 'sha256' | 'sha1'
  }
  awsSigV4?: {
    accessKey: string
    secretKey: string
    region: string
    service: string
    sessionToken?: string
  }
  ntlm?: {
    username: string
    password: string
    domain?: string
  }
}

interface ResolvedAuthInfo {
  auth: ApiAuth
  source: 'request' | 'folder' | 'collection'
  sourceId: string
  sourceName: string
}

interface ApiEnvironment {
  id: string
  name: string
  variables: ApiVariable[]
  isActive: boolean
}

interface ApiVariable {
  key: string
  value: string
  type: 'default' | 'secret'
  enabled: boolean
}

interface ApiResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  size: number
  time: number
}

interface ApiSavedResponse {
  id: string
  name: string
  response: ApiResponse
  savedAt: number
}

interface ApiHistoryEntry {
  id: string
  workspaceId: string
  request: ApiRequestConfig
  response: ApiResponse
  timestamp: number
}
