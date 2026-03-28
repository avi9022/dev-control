/**
 * Parses a cURL command string and extracts request configuration
 */

export interface ParsedCurl {
  method: ApiHttpMethod
  url: string
  headers: ApiKeyValue[]
  params: ApiKeyValue[]
  body?: ApiRequestBody
  auth?: ApiAuth
}

/**
 * Detects if a string looks like a cURL command
 */
export function isCurlCommand(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.startsWith('curl ') || trimmed.startsWith('curl\t') || trimmed === 'curl'
}

/**
 * Tokenizes a cURL command respecting quotes and escapes
 */
function tokenize(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let escape = false

  // Normalize line continuations (backslash + newline)
  const normalized = command
    .replace(/\\\r?\n\s*/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim()

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]

    if (escape) {
      current += char
      escape = false
      continue
    }

    if (char === '\\' && !inSingleQuote) {
      escape = true
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if ((char === ' ' || char === '\t') && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (current) {
    tokens.push(current)
  }

  return tokens
}

/**
 * Parses a cURL command and returns request configuration
 */
export function parseCurl(command: string): ParsedCurl | null {
  try {
    const tokens = tokenize(command)

    if (tokens.length === 0 || tokens[0] !== 'curl') {
      return null
    }

    let method: ApiHttpMethod = 'GET'
    let url = ''
    const headers: ApiKeyValue[] = []
    const params: ApiKeyValue[] = []
    let body: ApiRequestBody | undefined
    let auth: ApiAuth | undefined
    let contentType = ''

    let i = 1
    while (i < tokens.length) {
      const token = tokens[i]

      // Method flags
      if (token === '-X' || token === '--request') {
        const nextToken = tokens[++i]?.toUpperCase()
        if (nextToken && isValidMethod(nextToken)) {
          method = nextToken as ApiHttpMethod
        }
        i++
        continue
      }

      // Header flags
      if (token === '-H' || token === '--header') {
        const headerValue = tokens[++i]
        if (headerValue) {
          const colonIndex = headerValue.indexOf(':')
          if (colonIndex > 0) {
            const key = headerValue.substring(0, colonIndex).trim()
            const value = headerValue.substring(colonIndex + 1).trim()

            // Track content-type for body type detection
            if (key.toLowerCase() === 'content-type') {
              contentType = value.toLowerCase()
            }

            // Check for Authorization header
            if (key.toLowerCase() === 'authorization') {
              const authParsed = parseAuthorizationHeader(value)
              if (authParsed) {
                auth = authParsed
                i++
                continue
              }
            }

            headers.push({ key, value, enabled: true })
          }
        }
        i++
        continue
      }

      // Data flags
      if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
        const data = tokens[++i]
        if (data) {
          body = parseBody(data, contentType)
          if (method === 'GET') {
            method = 'POST'
          }
        }
        i++
        continue
      }

      // JSON data shorthand
      if (token === '--json') {
        const data = tokens[++i]
        if (data) {
          body = { type: 'json', content: data }
          contentType = 'application/json'
          if (method === 'GET') {
            method = 'POST'
          }
        }
        i++
        continue
      }

      // Form data
      if (token === '-F' || token === '--form') {
        const formField = tokens[++i]
        if (formField) {
          if (!body || body.type !== 'form-data') {
            body = { type: 'form-data', content: '', formData: [] }
          }
          const eqIndex = formField.indexOf('=')
          if (eqIndex > 0) {
            const key = formField.substring(0, eqIndex)
            const value = formField.substring(eqIndex + 1)
            body.formData = body.formData || []
            body.formData.push({ key, value, enabled: true })
          }
          if (method === 'GET') {
            method = 'POST'
          }
        }
        i++
        continue
      }

      // URL-encoded form data
      if (token === '--data-urlencode') {
        const formField = tokens[++i]
        if (formField) {
          if (!body || body.type !== 'x-www-form-urlencoded') {
            body = { type: 'x-www-form-urlencoded', content: '', formData: [] }
          }
          const eqIndex = formField.indexOf('=')
          if (eqIndex > 0) {
            const key = formField.substring(0, eqIndex)
            const value = formField.substring(eqIndex + 1)
            body.formData = body.formData || []
            body.formData.push({ key, value, enabled: true })
          }
          if (method === 'GET') {
            method = 'POST'
          }
        }
        i++
        continue
      }

      // Basic auth
      if (token === '-u' || token === '--user') {
        const credentials = tokens[++i]
        if (credentials) {
          const colonIndex = credentials.indexOf(':')
          if (colonIndex > 0) {
            auth = {
              type: 'basic',
              basic: {
                username: credentials.substring(0, colonIndex),
                password: credentials.substring(colonIndex + 1),
              },
            }
          } else {
            auth = {
              type: 'basic',
              basic: { username: credentials, password: '' },
            }
          }
        }
        i++
        continue
      }

      // Skip common flags we don't need
      if (
        token === '-i' || token === '--include' ||
        token === '-v' || token === '--verbose' ||
        token === '-s' || token === '--silent' ||
        token === '-S' || token === '--show-error' ||
        token === '-k' || token === '--insecure' ||
        token === '-L' || token === '--location' ||
        token === '-o' || token === '--output' ||
        token === '-O' || token === '--remote-name' ||
        token === '-w' || token === '--write-out' ||
        token === '-c' || token === '--cookie-jar' ||
        token === '-b' || token === '--cookie' ||
        token === '-A' || token === '--user-agent' ||
        token === '-e' || token === '--referer' ||
        token === '--compressed' ||
        token === '--http1.1' ||
        token === '--http2'
      ) {
        // Some flags take a value
        if (
          token === '-o' || token === '--output' ||
          token === '-O' || token === '--remote-name' ||
          token === '-w' || token === '--write-out' ||
          token === '-c' || token === '--cookie-jar' ||
          token === '-b' || token === '--cookie' ||
          token === '-A' || token === '--user-agent' ||
          token === '-e' || token === '--referer'
        ) {
          i++ // Skip the value
        }
        i++
        continue
      }

      // Timeout flags with values
      if (token === '-m' || token === '--max-time' || token === '--connect-timeout') {
        i += 2
        continue
      }

      // Explicit URL flag
      if (token === '--url') {
        const urlValue = tokens[++i]
        if (urlValue) {
          url = urlValue
        }
        i++
        continue
      }

      // If it's not a flag and looks like a URL, capture it
      if (!token.startsWith('-') && (token.startsWith('http://') || token.startsWith('https://') || token.includes('://'))) {
        url = token
        i++
        continue
      }

      // Bare URL without protocol (like localhost:3000/api or api.example.com)
      if (!token.startsWith('-') && !url) {
        // Check if it looks like a URL/hostname
        if (token.includes('.') || token.startsWith('localhost') || token.includes(':')) {
          url = token.startsWith('http') ? token : `https://${token}`
          i++
          continue
        }
      }

      i++
    }

    // Parse URL query params
    if (url) {
      try {
        const urlObj = new URL(url)
        urlObj.searchParams.forEach((value, key) => {
          params.push({ key, value, enabled: true })
        })
        // Remove query string from URL (we'll handle params separately)
        url = `${urlObj.origin}${urlObj.pathname}`
      } catch {
        // URL parsing failed, keep URL as-is
      }
    }

    return {
      method,
      url,
      headers,
      params,
      body,
      auth,
    }
  } catch {
    return null
  }
}

function isValidMethod(method: string): method is ApiHttpMethod {
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)
}

function parseBody(data: string, contentType: string): ApiRequestBody {
  // Detect JSON
  if (contentType.includes('application/json') || (data.startsWith('{') || data.startsWith('['))) {
    try {
      // Validate it's JSON
      JSON.parse(data)
      return { type: 'json', content: data }
    } catch {
      // Not valid JSON, treat as raw
    }
  }

  // Detect form-urlencoded
  if (contentType.includes('x-www-form-urlencoded') || (!contentType && data.includes('=') && !data.includes('{'))) {
    const formData: ApiKeyValue[] = []
    const pairs = data.split('&')
    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=')
      if (eqIndex > 0) {
        const key = decodeURIComponent(pair.substring(0, eqIndex))
        const value = decodeURIComponent(pair.substring(eqIndex + 1))
        formData.push({ key, value, enabled: true })
      }
    }
    if (formData.length > 0) {
      return { type: 'x-www-form-urlencoded', content: '', formData }
    }
  }

  // Default to raw
  return { type: 'raw', content: data }
}

function parseAuthorizationHeader(value: string): ApiAuth | null {
  const parts = value.split(' ')
  const scheme = parts[0]?.toLowerCase()
  const credentials = parts.slice(1).join(' ')

  if (scheme === 'bearer') {
    return {
      type: 'bearer',
      bearer: { token: credentials },
    }
  }

  if (scheme === 'basic') {
    try {
      const decoded = atob(credentials)
      const colonIndex = decoded.indexOf(':')
      if (colonIndex > 0) {
        return {
          type: 'basic',
          basic: {
            username: decoded.substring(0, colonIndex),
            password: decoded.substring(colonIndex + 1),
          },
        }
      }
    } catch {
      // Invalid base64
    }
  }

  return null
}
