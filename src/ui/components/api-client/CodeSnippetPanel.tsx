import { useState, useMemo, useCallback, useEffect, type FC } from 'react'
import { X, Copy, Check, ChevronDown, Code2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { generators } from '@/ui/utils/code-generators'
import { useApiClient } from '@/ui/contexts/api-client'

interface CodeSnippetPanelProps {
  method: ApiHttpMethod
  url: string
  headers: ApiKeyValue[]
  params: ApiKeyValue[]
  body: ApiRequestBody
  auth?: ApiAuth
  requestId?: string
  collectionId?: string
  onClose: () => void
}

interface LanguageOption {
  id: string
  name: string
  clients: { id: string; name: string }[]
}

const LANGUAGES: LanguageOption[] = [
  {
    id: 'shell',
    name: 'cURL',
    clients: [
      { id: 'curl', name: 'cURL' },
      { id: 'httpie', name: 'HTTPie' },
    ],
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    clients: [
      { id: 'fetch', name: 'Fetch' },
      { id: 'axios', name: 'Axios' },
      { id: 'jquery', name: 'jQuery' },
    ],
  },
  {
    id: 'node',
    name: 'Node.js',
    clients: [
      { id: 'fetch', name: 'Fetch' },
      { id: 'axios', name: 'Axios' },
    ],
  },
  {
    id: 'python',
    name: 'Python',
    clients: [
      { id: 'requests', name: 'Requests' },
    ],
  },
  {
    id: 'java',
    name: 'Java',
    clients: [
      { id: 'okhttp', name: 'OkHttp' },
    ],
  },
  {
    id: 'go',
    name: 'Go',
    clients: [
      { id: 'native', name: 'Native' },
    ],
  },
  {
    id: 'php',
    name: 'PHP',
    clients: [
      { id: 'curl', name: 'cURL' },
    ],
  },
  {
    id: 'ruby',
    name: 'Ruby',
    clients: [
      { id: 'native', name: 'Net::HTTP' },
    ],
  },
  {
    id: 'csharp',
    name: 'C#',
    clients: [
      { id: 'httpclient', name: 'HttpClient' },
    ],
  },
  {
    id: 'swift',
    name: 'Swift',
    clients: [
      { id: 'urlsession', name: 'URLSession' },
    ],
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    clients: [
      { id: 'okhttp', name: 'OkHttp' },
    ],
  },
  {
    id: 'rust',
    name: 'Rust',
    clients: [
      { id: 'reqwest', name: 'Reqwest' },
    ],
  },
  {
    id: 'powershell',
    name: 'PowerShell',
    clients: [
      { id: 'webrequest', name: 'Invoke-WebRequest' },
    ],
  },
  {
    id: 'http',
    name: 'HTTP',
    clients: [
      { id: 'http1.1', name: 'HTTP/1.1' },
    ],
  },
]

// Helper to resolve variables in a string
const resolveVariables = (
  text: string,
  variables: Map<string, string>
): string => {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const value = variables.get(varName.trim())
    return value !== undefined ? value : match
  })
}

export const CodeSnippetPanel: FC<CodeSnippetPanelProps> = ({
  method,
  url,
  headers,
  params,
  body,
  auth,
  requestId,
  collectionId,
  onClose,
}) => {
  const { activeWorkspace } = useApiClient()
  const [selectedLanguage, setSelectedLanguage] = useState('shell')
  const [selectedClient, setSelectedClient] = useState('curl')
  const [copied, setCopied] = useState(false)
  const [resolvedAuth, setResolvedAuth] = useState<ApiAuth | null>(null)

  // Build variables map from active environment
  const variablesMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!activeWorkspace) return map

    // Add environment variables
    const activeEnv = activeWorkspace.environments.find(
      e => e.id === activeWorkspace.activeEnvironmentId
    )
    if (activeEnv) {
      activeEnv.variables.forEach(v => {
        if (v.enabled && v.key) {
          map.set(v.key, v.value)
        }
      })
    }

    return map
  }, [activeWorkspace])

  // Fetch resolved auth if auth is 'inherit'
  useEffect(() => {
    const fetchResolvedAuth = async () => {
      if (auth?.type === 'inherit' && requestId && collectionId && activeWorkspace) {
        try {
          const resolved = await window.electron.apiGetResolvedAuth(
            activeWorkspace.id,
            collectionId,
            requestId
          )
          if (resolved) {
            setResolvedAuth(resolved.auth)
          }
        } catch (error) {
          console.error('Failed to get resolved auth:', error)
        }
      } else if (auth?.type !== 'inherit') {
        setResolvedAuth(auth || null)
      }
    }

    fetchResolvedAuth()
  }, [auth, requestId, collectionId, activeWorkspace])

  // Build URL with query params and resolve variables
  const fullUrl = useMemo(() => {
    if (!url) return ''

    // Resolve variables in URL
    let resolvedUrl = resolveVariables(url, variablesMap)

    // Build query string manually to handle variables in params
    const enabledParams = params.filter(p => p.enabled && p.key)
    if (enabledParams.length > 0) {
      const queryParts = enabledParams.map(p => {
        const resolvedKey = resolveVariables(p.key, variablesMap)
        const resolvedValue = resolveVariables(p.value, variablesMap)
        return `${encodeURIComponent(resolvedKey)}=${encodeURIComponent(resolvedValue)}`
      })

      // Check if URL already has query string
      const separator = resolvedUrl.includes('?') ? '&' : '?'
      resolvedUrl = `${resolvedUrl}${separator}${queryParts.join('&')}`
    }

    return resolvedUrl
  }, [url, params, variablesMap])

  // Use resolved auth (either inherited or direct)
  const effectiveAuth = useMemo(() => {
    if (auth?.type === 'inherit') {
      return resolvedAuth
    }
    return auth
  }, [auth, resolvedAuth])

  // Prepare resolved data for snippet generation
  const resolvedData = useMemo(() => {
    // Resolve variables in headers
    const resolvedHeaders = headers.map(h => ({
      key: resolveVariables(h.key, variablesMap),
      value: resolveVariables(h.value, variablesMap),
      enabled: h.enabled,
    }))

    // Resolve variables in body
    const resolvedBody = body ? {
      type: body.type,
      content: resolveVariables(body.content || '', variablesMap),
    } : undefined

    // Resolve variables in auth
    let resolvedAuthData = undefined
    if (effectiveAuth && effectiveAuth.type !== 'none' && effectiveAuth.type !== 'inherit') {
      resolvedAuthData = {
        type: effectiveAuth.type,
        bearer: effectiveAuth.bearer ? {
          token: resolveVariables(effectiveAuth.bearer.token || '', variablesMap),
          prefix: effectiveAuth.bearer.prefix,
        } : undefined,
        basic: effectiveAuth.basic ? {
          username: resolveVariables(effectiveAuth.basic.username || '', variablesMap),
          password: resolveVariables(effectiveAuth.basic.password || '', variablesMap),
        } : undefined,
        apiKey: effectiveAuth.apiKey ? {
          key: resolveVariables(effectiveAuth.apiKey.key || '', variablesMap),
          value: resolveVariables(effectiveAuth.apiKey.value || '', variablesMap),
          addTo: effectiveAuth.apiKey.addTo,
        } : undefined,
      }
    }

    return { resolvedHeaders, resolvedBody, resolvedAuthData }
  }, [headers, body, effectiveAuth, variablesMap])

  // Generate actual snippet (for copying)
  const snippet = useMemo(() => {
    try {
      const generator = generators[selectedLanguage]?.[selectedClient]
      if (!generator) {
        return `// Generator not available for ${selectedLanguage}/${selectedClient}`
      }

      return generator({
        method,
        url: fullUrl || 'http://example.com',
        headers: resolvedData.resolvedHeaders,
        body: resolvedData.resolvedBody,
        auth: resolvedData.resolvedAuthData,
      })
    } catch (error) {
      console.error('Snippet generation error:', error)
      return `// Error generating snippet: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }, [method, fullUrl, resolvedData, selectedLanguage, selectedClient])

  // Generate display snippet (with masked auth values)
  const displaySnippet = useMemo(() => {
    try {
      const generator = generators[selectedLanguage]?.[selectedClient]
      if (!generator) {
        return `// Generator not available for ${selectedLanguage}/${selectedClient}`
      }

      // Create masked auth data for display
      let maskedAuthData = undefined
      if (resolvedData.resolvedAuthData) {
        const auth = resolvedData.resolvedAuthData
        maskedAuthData = {
          type: auth.type,
          bearer: auth.bearer ? {
            token: '**********',
            prefix: auth.bearer.prefix,
          } : undefined,
          basic: auth.basic ? {
            username: auth.basic.username,
            password: '**********',
          } : undefined,
          apiKey: auth.apiKey ? {
            key: auth.apiKey.key,
            value: '**********',
            addTo: auth.apiKey.addTo,
          } : undefined,
        }
      }

      return generator({
        method,
        url: fullUrl || 'http://example.com',
        headers: resolvedData.resolvedHeaders,
        body: resolvedData.resolvedBody,
        auth: maskedAuthData,
      })
    } catch (error) {
      return snippet // Fallback to actual snippet
    }
  }, [method, fullUrl, resolvedData, selectedLanguage, selectedClient, snippet])

  // Find current language info
  const currentLanguage = useMemo(() => {
    return LANGUAGES.find(l => l.id === selectedLanguage) || LANGUAGES[0]
  }, [selectedLanguage])

  const currentClient = useMemo(() => {
    return currentLanguage.clients.find(c => c.id === selectedClient) || currentLanguage.clients[0]
  }, [currentLanguage, selectedClient])

  // Handle language change
  const handleSelectLanguage = useCallback((langId: string, clientId: string) => {
    setSelectedLanguage(langId)
    setSelectedClient(clientId)
  }, [])

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [snippet])

  // Get display name
  const displayName = useMemo(() => {
    if (selectedLanguage === 'shell') {
      return currentClient.name
    }
    return `${currentLanguage.name} - ${currentClient.name}`
  }, [selectedLanguage, currentLanguage, currentClient])

  // Split code into lines for display (using masked version)
  const codeLines = useMemo(() => displaySnippet.split('\n'), [displaySnippet])

  return (
    <div className="flex flex-col h-full border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium">Code Snippet</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Language selector */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              {displayName}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
            {LANGUAGES.map((lang) => (
              lang.clients.length === 1 ? (
                <DropdownMenuItem
                  key={lang.id}
                  onClick={() => handleSelectLanguage(lang.id, lang.clients[0].id)}
                  className={cn(
                    "text-xs",
                    selectedLanguage === lang.id && selectedClient === lang.clients[0].id && "bg-accent"
                  )}
                >
                  {lang.name}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuSub key={lang.id}>
                  <DropdownMenuSubTrigger className="text-xs">
                    {lang.name}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {lang.clients.map((client) => (
                      <DropdownMenuItem
                        key={client.id}
                        onClick={() => handleSelectLanguage(lang.id, client.id)}
                        className={cn(
                          "text-xs",
                          selectedLanguage === lang.id && selectedClient === client.id && "bg-accent"
                        )}
                      >
                        {client.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Code display */}
      <div className="flex-1 min-h-0 overflow-auto">
        <pre className="p-3 text-[11px] font-mono leading-relaxed min-w-0">
          {codeLines.map((line, i) => (
            <div key={i} className="flex">
              <span className="select-none text-muted-foreground/50 w-8 text-right pr-3 flex-shrink-0">
                {i + 1}
              </span>
              <code className="text-foreground whitespace-pre-wrap break-words min-w-0">{line}</code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}
