import { useCallback, useRef, useEffect } from 'react'

/**
 * Parse URL and extract query params (without encoding)
 */
export function parseQueryParams(fullUrl: string): ApiKeyValue[] {
  try {
    const queryIndex = fullUrl.indexOf('?')
    if (queryIndex < 0) return []

    const queryString = fullUrl.substring(queryIndex + 1)
    if (!queryString) return []

    const params: ApiKeyValue[] = []
    const pairs = queryString.split('&')

    for (const pair of pairs) {
      const eqIndex = pair.indexOf('=')
      if (eqIndex >= 0) {
        // Decode the values to show plain text
        const key = decodeURIComponent(pair.substring(0, eqIndex))
        const value = decodeURIComponent(pair.substring(eqIndex + 1))
        params.push({ key, value, enabled: true, description: '' })
      } else if (pair) {
        params.push({ key: decodeURIComponent(pair), value: '', enabled: true, description: '' })
      }
    }

    return params
  } catch {
    return []
  }
}

/**
 * Get base URL without query string
 */
export function getBaseUrl(fullUrl: string): string {
  const queryIndex = fullUrl.indexOf('?')
  return queryIndex >= 0 ? fullUrl.substring(0, queryIndex) : fullUrl
}

/**
 * Build full URL from base URL + params (without encoding - keep plain text)
 */
export function buildUrlWithParams(baseUrl: string, params: ApiKeyValue[]): string {
  const enabledParams = params.filter(p => p.enabled && p.key.trim())

  if (enabledParams.length === 0) {
    return baseUrl
  }

  // Don't encode - keep as plain text for readability
  const queryString = enabledParams
    .map(p => `${p.key}=${p.value}`)
    .join('&')

  return `${baseUrl}?${queryString}`
}

/**
 * Hook for bidirectional URL-Params sync
 */
export function useUrlParamsSync(
  url: string,
  _params: ApiKeyValue[],
  setUrl: (url: string) => void,
  setParams: (params: ApiKeyValue[]) => void
) {
  const isUpdatingFromParams = useRef(false)
  const lastUrlRef = useRef(url)

  // Keep lastUrlRef in sync when URL changes externally (e.g., loading a request)
  useEffect(() => {
    if (!isUpdatingFromParams.current) {
      lastUrlRef.current = url
    }
  }, [url])

  /**
   * Handle URL change - extract params and sync to Params tab
   */
  const handleUrlChange = useCallback((newUrl: string) => {
    // If this change came from params update, just set the URL
    if (isUpdatingFromParams.current) {
      isUpdatingFromParams.current = false
      setUrl(newUrl)
      lastUrlRef.current = newUrl
      return
    }

    // Update URL
    setUrl(newUrl)
    lastUrlRef.current = newUrl

    // Extract and sync params from URL
    const extractedParams = parseQueryParams(newUrl)

    // Always sync params from URL (even if empty - to clear old params)
    if (newUrl.includes('?') || extractedParams.length > 0) {
      setParams(extractedParams)
    }
  }, [setUrl, setParams])

  /**
   * Handle params change - rebuild URL
   */
  const handleParamsChange = useCallback((newParams: ApiKeyValue[]) => {
    isUpdatingFromParams.current = true

    // Update params
    setParams(newParams)

    // Rebuild URL with new params
    const baseUrl = getBaseUrl(lastUrlRef.current)
    const newUrl = buildUrlWithParams(baseUrl, newParams)
    setUrl(newUrl)
    lastUrlRef.current = newUrl
  }, [setUrl, setParams])

  return {
    handleUrlChange,
    handleParamsChange,
  }
}
