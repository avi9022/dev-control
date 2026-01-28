import { dialog } from 'electron'
import { writeFile } from 'fs/promises'

interface PostmanExportCollection {
  info: {
    _postman_id: string
    name: string
    description: string
    schema: string
  }
  item: PostmanExportItem[]
  variable: PostmanExportVariable[]
}

interface PostmanExportItem {
  name: string
  item?: PostmanExportItem[]
  request?: PostmanExportRequest
}

interface PostmanExportRequest {
  method: string
  header: PostmanExportHeader[]
  url: { raw: string; query: PostmanExportQuery[] }
  body?: PostmanExportBody
  auth?: PostmanExportAuth
}

interface PostmanExportHeader {
  key: string
  value: string
  description?: string
  disabled?: boolean
}

interface PostmanExportQuery {
  key: string
  value: string
  description?: string
  disabled?: boolean
}

interface PostmanExportBody {
  mode: string
  raw?: string
  options?: { raw?: { language?: string } }
  urlencoded?: PostmanExportFormParam[]
  formdata?: PostmanExportFormParam[]
  graphql?: { query?: string; variables?: string }
}

interface PostmanExportFormParam {
  key: string
  value: string
  description?: string
  disabled?: boolean
}

interface PostmanExportAuth {
  type: string
  bearer?: { key: string; value: string; type: string }[]
  basic?: { key: string; value: string; type: string }[]
  apikey?: { key: string; value: string; type: string }[]
}

interface PostmanExportVariable {
  key: string
  value: string
  type: string
  enabled: boolean
}

function mapItemsToPostman(items: ApiCollectionItem[]): PostmanExportItem[] {
  return items.map((item) => {
    if (item.type === 'folder') {
      return {
        name: item.name,
        item: mapItemsToPostman(item.items ?? []),
      }
    }

    return {
      name: item.name,
      request: item.request ? mapRequestToPostman(item.request) : undefined,
    }
  })
}

function mapRequestToPostman(req: ApiRequestConfig): PostmanExportRequest {
  const result: PostmanExportRequest = {
    method: req.method,
    header: req.headers.map((h) => ({
      key: h.key,
      value: h.value,
      description: h.description,
      disabled: !h.enabled,
    })),
    url: {
      raw: req.url,
      query: req.params.map((p) => ({
        key: p.key,
        value: p.value,
        description: p.description,
        disabled: !p.enabled,
      })),
    },
  }

  if (req.body && req.body.type !== 'none') {
    result.body = mapBodyToPostman(req.body)
  }

  if (req.auth && req.auth.type !== 'none') {
    result.auth = mapAuthToPostman(req.auth)
  }

  return result
}

function mapBodyToPostman(body: ApiRequestBody): PostmanExportBody {
  switch (body.type) {
    case 'json':
      return { mode: 'raw', raw: body.content, options: { raw: { language: 'json' } } }
    case 'raw':
      return { mode: 'raw', raw: body.content }
    case 'x-www-form-urlencoded':
      return {
        mode: 'urlencoded',
        urlencoded: (body.formData ?? []).map((f) => ({
          key: f.key, value: f.value, description: f.description, disabled: !f.enabled,
        })),
      }
    case 'form-data':
      return {
        mode: 'formdata',
        formdata: (body.formData ?? []).map((f) => ({
          key: f.key, value: f.value, description: f.description, disabled: !f.enabled,
        })),
      }
    case 'graphql':
      return {
        mode: 'graphql',
        graphql: { query: body.graphql?.query ?? '', variables: body.graphql?.variables ?? '' },
      }
    default:
      return { mode: 'raw', raw: '' }
  }
}

function mapAuthToPostman(auth: ApiAuth): PostmanExportAuth {
  switch (auth.type) {
    case 'bearer':
      return {
        type: 'bearer',
        bearer: [{ key: 'token', value: auth.bearer?.token ?? '', type: 'string' }],
      }
    case 'basic':
      return {
        type: 'basic',
        basic: [
          { key: 'username', value: auth.basic?.username ?? '', type: 'string' },
          { key: 'password', value: auth.basic?.password ?? '', type: 'string' },
        ],
      }
    case 'api-key':
      return {
        type: 'apikey',
        apikey: [
          { key: 'key', value: auth.apiKey?.key ?? '', type: 'string' },
          { key: 'value', value: auth.apiKey?.value ?? '', type: 'string' },
          { key: 'in', value: auth.apiKey?.addTo ?? 'header', type: 'string' },
        ],
      }
    default:
      return { type: 'noauth' }
  }
}

function mapVariablesToPostman(vars: ApiVariable[]): PostmanExportVariable[] {
  return vars.map((v) => ({
    key: v.key,
    value: v.value,
    type: v.type === 'secret' ? 'secret' : 'default',
    enabled: v.enabled,
  }))
}

export async function exportPostmanCollection(collection: ApiCollection): Promise<void> {
  const postmanCollection: PostmanExportCollection = {
    info: {
      _postman_id: collection.id,
      name: collection.name,
      description: collection.description ?? '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: mapItemsToPostman(collection.items),
    variable: mapVariablesToPostman(collection.variables ?? []),
  }

  const result = await dialog.showSaveDialog({
    defaultPath: `${collection.name}.postman_collection.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
    title: 'Export Postman Collection',
  })

  if (result.canceled || !result.filePath) return

  await writeFile(result.filePath, JSON.stringify(postmanCollection, null, 2), 'utf-8')
}
