// Code snippet generators for various languages
// These generate display strings only - no code execution

interface RequestData {
  method: string
  url: string
  headers: { key: string; value: string; enabled: boolean }[]
  body?: { type: string; content: string }
  auth?: {
    type: string
    bearer?: { token: string; prefix?: string }
    basic?: { username: string; password: string }
    apiKey?: { key: string; value: string; addTo: 'header' | 'query' }
  }
}

// Helper to escape string for shell display
const escapeShell = (str: string): string => {
  return str.replace(/'/g, "'\\''")
}

// Helper to escape string for JSON display
const escapeJson = (str: string): string => {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

// Get all headers including auth
const getAllHeaders = (data: RequestData): { key: string; value: string }[] => {
  const headers = data.headers
    .filter(h => h.enabled && h.key)
    .map(h => ({ key: h.key, value: h.value }))

  // Add auth headers
  if (data.auth?.type === 'bearer' && data.auth.bearer?.token) {
    const prefix = data.auth.bearer.prefix || 'Bearer'
    headers.push({ key: 'Authorization', value: `${prefix} ${data.auth.bearer.token}` })
  } else if (data.auth?.type === 'basic' && data.auth.basic) {
    const credentials = btoa(`${data.auth.basic.username}:${data.auth.basic.password}`)
    headers.push({ key: 'Authorization', value: `Basic ${credentials}` })
  } else if (data.auth?.type === 'api-key' && data.auth.apiKey?.addTo === 'header') {
    headers.push({ key: data.auth.apiKey.key, value: data.auth.apiKey.value })
  }

  // Add Content-Type if body exists and not already present
  if (data.body?.type && data.body.type !== 'none' && data.body.content) {
    const hasContentType = headers.some(h => h.key.toLowerCase() === 'content-type')
    if (!hasContentType) {
      const mimeType =
        data.body.type === 'json' ? 'application/json' :
        data.body.type === 'x-www-form-urlencoded' ? 'application/x-www-form-urlencoded' :
        data.body.type === 'form-data' ? 'multipart/form-data' :
        'text/plain'
      headers.push({ key: 'Content-Type', value: mimeType })
    }
  }

  return headers
}

// cURL generator - generates display string only
export const generateCurl = (data: RequestData): string => {
  const lines: string[] = []
  const headers = getAllHeaders(data)

  lines.push(`curl --location '${escapeShell(data.url)}'`)

  if (data.method !== 'GET') {
    lines.push(`  --request ${data.method}`)
  }

  for (const header of headers) {
    lines.push(`  --header '${escapeShell(header.key)}: ${escapeShell(header.value)}'`)
  }

  if (data.body?.content && data.body.type !== 'none') {
    lines.push(`  --data '${escapeShell(data.body.content)}'`)
  }

  return lines.join(' \\\n')
}

// HTTPie generator
export const generateHttpie = (data: RequestData): string => {
  const lines: string[] = []
  const headers = getAllHeaders(data)

  lines.push(`http ${data.method} '${data.url}'`)

  for (const header of headers) {
    lines.push(`  '${header.key}:${header.value}'`)
  }

  if (data.body?.content && data.body.type !== 'none') {
    if (data.body.type === 'json') {
      lines.push(`  --raw='${escapeShell(data.body.content)}'`)
    } else {
      lines.push(`  --raw='${escapeShell(data.body.content)}'`)
    }
  }

  return lines.join(' \\\n')
}

// JavaScript Fetch generator
export const generateJsFetch = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`const response = await fetch('${data.url}', {`)
  lines.push(`  method: '${data.method}',`)

  if (headers.length > 0) {
    lines.push(`  headers: {`)
    headers.forEach((h, i) => {
      const comma = i < headers.length - 1 ? ',' : ''
      lines.push(`    '${h.key}': '${escapeJson(h.value)}'${comma}`)
    })
    lines.push(`  },`)
  }

  if (data.body?.content && data.body.type !== 'none') {
    if (data.body.type === 'json') {
      lines.push(`  body: JSON.stringify(${data.body.content}),`)
    } else {
      lines.push(`  body: '${escapeJson(data.body.content)}',`)
    }
  }

  lines.push(`});`)
  lines.push(``)
  lines.push(`const data = await response.json();`)
  lines.push(`console.log(data);`)

  return lines.join('\n')
}

// JavaScript Axios generator
export const generateJsAxios = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`import axios from 'axios';`)
  lines.push(``)
  lines.push(`const response = await axios({`)
  lines.push(`  method: '${data.method.toLowerCase()}',`)
  lines.push(`  url: '${data.url}',`)

  if (headers.length > 0) {
    lines.push(`  headers: {`)
    headers.forEach((h, i) => {
      const comma = i < headers.length - 1 ? ',' : ''
      lines.push(`    '${h.key}': '${escapeJson(h.value)}'${comma}`)
    })
    lines.push(`  },`)
  }

  if (data.body?.content && data.body.type !== 'none') {
    if (data.body.type === 'json') {
      lines.push(`  data: ${data.body.content},`)
    } else {
      lines.push(`  data: '${escapeJson(data.body.content)}',`)
    }
  }

  lines.push(`});`)
  lines.push(``)
  lines.push(`console.log(response.data);`)

  return lines.join('\n')
}

// JavaScript jQuery generator
export const generateJsJquery = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`$.ajax({`)
  lines.push(`  url: '${data.url}',`)
  lines.push(`  method: '${data.method}',`)

  if (headers.length > 0) {
    lines.push(`  headers: {`)
    headers.forEach((h, i) => {
      const comma = i < headers.length - 1 ? ',' : ''
      lines.push(`    '${h.key}': '${escapeJson(h.value)}'${comma}`)
    })
    lines.push(`  },`)
  }

  if (data.body?.content && data.body.type !== 'none') {
    if (data.body.type === 'json') {
      lines.push(`  contentType: 'application/json',`)
      lines.push(`  data: JSON.stringify(${data.body.content}),`)
    } else {
      lines.push(`  data: '${escapeJson(data.body.content)}',`)
    }
  }

  lines.push(`  success: function(data) {`)
  lines.push(`    console.log(data);`)
  lines.push(`  },`)
  lines.push(`  error: function(xhr, status, error) {`)
  lines.push(`    console.error(error);`)
  lines.push(`  }`)
  lines.push(`});`)

  return lines.join('\n')
}

// Node.js Fetch generator
export const generateNodeFetch = (data: RequestData): string => {
  return generateJsFetch(data)
}

// Node.js Axios generator
export const generateNodeAxios = (data: RequestData): string => {
  return generateJsAxios(data)
}

// Python Requests generator
export const generatePythonRequests = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`import requests`)
  lines.push(``)

  if (headers.length > 0) {
    lines.push(`headers = {`)
    headers.forEach((h, i) => {
      const comma = i < headers.length - 1 ? ',' : ''
      lines.push(`    '${h.key}': '${h.value}'${comma}`)
    })
    lines.push(`}`)
    lines.push(``)
  }

  if (data.body?.content && data.body.type !== 'none') {
    if (data.body.type === 'json') {
      lines.push(`json_data = ${data.body.content}`)
      lines.push(``)
      lines.push(`response = requests.${data.method.toLowerCase()}(`)
      lines.push(`    '${data.url}',`)
      if (headers.length > 0) lines.push(`    headers=headers,`)
      lines.push(`    json=json_data`)
      lines.push(`)`)
    } else {
      lines.push(`data = '''${data.body.content}'''`)
      lines.push(``)
      lines.push(`response = requests.${data.method.toLowerCase()}(`)
      lines.push(`    '${data.url}',`)
      if (headers.length > 0) lines.push(`    headers=headers,`)
      lines.push(`    data=data`)
      lines.push(`)`)
    }
  } else {
    lines.push(`response = requests.${data.method.toLowerCase()}(`)
    lines.push(`    '${data.url}'${headers.length > 0 ? ',' : ''}`)
    if (headers.length > 0) lines.push(`    headers=headers`)
    lines.push(`)`)
  }

  lines.push(``)
  lines.push(`print(response.json())`)

  return lines.join('\n')
}

// Java OkHttp generator
export const generateJavaOkhttp = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`OkHttpClient client = new OkHttpClient();`)
  lines.push(``)

  if (data.body?.content && data.body.type !== 'none') {
    const mediaType = data.body.type === 'json' ? 'application/json' : 'text/plain'
    lines.push(`MediaType mediaType = MediaType.parse("${mediaType}");`)
    lines.push(`RequestBody body = RequestBody.create(mediaType, "${escapeJson(data.body.content)}");`)
    lines.push(``)
  }

  lines.push(`Request request = new Request.Builder()`)
  lines.push(`    .url("${data.url}")`)

  if (data.body?.content && data.body.type !== 'none') {
    lines.push(`    .${data.method.toLowerCase()}(body)`)
  } else if (data.method !== 'GET') {
    lines.push(`    .${data.method.toLowerCase()}(null)`)
  }

  for (const header of headers) {
    lines.push(`    .addHeader("${header.key}", "${escapeJson(header.value)}")`)
  }

  lines.push(`    .build();`)
  lines.push(``)
  lines.push(`Response response = client.newCall(request).execute();`)
  lines.push(`System.out.println(response.body().string());`)

  return lines.join('\n')
}

// Go Native generator
export const generateGoNative = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`package main`)
  lines.push(``)
  lines.push(`import (`)
  lines.push(`    "fmt"`)
  lines.push(`    "io"`)
  lines.push(`    "net/http"`)
  if (data.body?.content && data.body.type !== 'none') {
    lines.push(`    "strings"`)
  }
  lines.push(`)`)
  lines.push(``)
  lines.push(`func main() {`)

  if (data.body?.content && data.body.type !== 'none') {
    lines.push(`    body := strings.NewReader(\`${data.body.content}\`)`)
    lines.push(`    req, _ := http.NewRequest("${data.method}", "${data.url}", body)`)
  } else {
    lines.push(`    req, _ := http.NewRequest("${data.method}", "${data.url}", nil)`)
  }

  for (const header of headers) {
    lines.push(`    req.Header.Add("${header.key}", "${header.value}")`)
  }

  lines.push(``)
  lines.push(`    client := &http.Client{}`)
  lines.push(`    resp, _ := client.Do(req)`)
  lines.push(`    defer resp.Body.Close()`)
  lines.push(``)
  lines.push(`    respBody, _ := io.ReadAll(resp.Body)`)
  lines.push(`    fmt.Println(string(respBody))`)
  lines.push(`}`)

  return lines.join('\n')
}

// PHP cURL generator
export const generatePhpCurl = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`<?php`)
  lines.push(``)
  lines.push(`$curl = curl_init();`)
  lines.push(``)
  lines.push(`curl_setopt_array($curl, [`)
  lines.push(`    CURLOPT_URL => '${data.url}',`)
  lines.push(`    CURLOPT_RETURNTRANSFER => true,`)
  lines.push(`    CURLOPT_CUSTOMREQUEST => '${data.method}',`)

  if (headers.length > 0) {
    lines.push(`    CURLOPT_HTTPHEADER => [`)
    headers.forEach((h, i) => {
      const comma = i < headers.length - 1 ? ',' : ''
      lines.push(`        '${h.key}: ${h.value}'${comma}`)
    })
    lines.push(`    ],`)
  }

  if (data.body?.content && data.body.type !== 'none') {
    lines.push(`    CURLOPT_POSTFIELDS => '${escapeShell(data.body.content)}',`)
  }

  lines.push(`]);`)
  lines.push(``)
  lines.push(`$response = curl_exec($curl);`)
  lines.push(`curl_close($curl);`)
  lines.push(``)
  lines.push(`echo $response;`)

  return lines.join('\n')
}

// Ruby Net::HTTP generator
export const generateRubyNative = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`require 'net/http'`)
  lines.push(`require 'uri'`)
  lines.push(`require 'json'`)
  lines.push(``)
  lines.push(`uri = URI.parse('${data.url}')`)
  lines.push(`http = Net::HTTP.new(uri.host, uri.port)`)
  lines.push(`http.use_ssl = uri.scheme == 'https'`)
  lines.push(``)
  lines.push(`request = Net::HTTP::${data.method.charAt(0) + data.method.slice(1).toLowerCase()}.new(uri.request_uri)`)

  for (const header of headers) {
    lines.push(`request['${header.key}'] = '${header.value}'`)
  }

  if (data.body?.content && data.body.type !== 'none') {
    lines.push(`request.body = '${escapeShell(data.body.content)}'`)
  }

  lines.push(``)
  lines.push(`response = http.request(request)`)
  lines.push(`puts response.body`)

  return lines.join('\n')
}

// C# HttpClient generator
export const generateCsharpHttpclient = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`using System.Net.Http;`)
  lines.push(`using System.Text;`)
  lines.push(``)
  lines.push(`var client = new HttpClient();`)
  lines.push(``)
  lines.push(`var request = new HttpRequestMessage(HttpMethod.${data.method.charAt(0) + data.method.slice(1).toLowerCase()}, "${data.url}");`)

  for (const header of headers) {
    if (header.key.toLowerCase() !== 'content-type') {
      lines.push(`request.Headers.Add("${header.key}", "${header.value}");`)
    }
  }

  if (data.body?.content && data.body.type !== 'none') {
    const contentType = headers.find(h => h.key.toLowerCase() === 'content-type')?.value || 'text/plain'
    lines.push(`request.Content = new StringContent("${escapeJson(data.body.content)}", Encoding.UTF8, "${contentType}");`)
  }

  lines.push(``)
  lines.push(`var response = await client.SendAsync(request);`)
  lines.push(`var content = await response.Content.ReadAsStringAsync();`)
  lines.push(`Console.WriteLine(content);`)

  return lines.join('\n')
}

// Swift URLSession generator
export const generateSwiftUrlsession = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`import Foundation`)
  lines.push(``)
  lines.push(`let url = URL(string: "${data.url}")!`)
  lines.push(`var request = URLRequest(url: url)`)
  lines.push(`request.httpMethod = "${data.method}"`)

  for (const header of headers) {
    lines.push(`request.setValue("${header.value}", forHTTPHeaderField: "${header.key}")`)
  }

  if (data.body?.content && data.body.type !== 'none') {
    lines.push(`request.httpBody = """`)
    lines.push(`${data.body.content}`)
    lines.push(`""".data(using: .utf8)`)
  }

  lines.push(``)
  lines.push(`let task = URLSession.shared.dataTask(with: request) { data, response, error in`)
  lines.push(`    if let data = data {`)
  lines.push(`        print(String(data: data, encoding: .utf8) ?? "")`)
  lines.push(`    }`)
  lines.push(`}`)
  lines.push(`task.resume()`)

  return lines.join('\n')
}

// Kotlin OkHttp generator
export const generateKotlinOkhttp = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`import okhttp3.*`)
  lines.push(`import okhttp3.MediaType.Companion.toMediaType`)
  lines.push(`import okhttp3.RequestBody.Companion.toRequestBody`)
  lines.push(``)
  lines.push(`val client = OkHttpClient()`)
  lines.push(``)

  if (data.body?.content && data.body.type !== 'none') {
    const mediaType = data.body.type === 'json' ? 'application/json' : 'text/plain'
    lines.push(`val mediaType = "${mediaType}".toMediaType()`)
    lines.push(`val body = """${data.body.content}""".toRequestBody(mediaType)`)
    lines.push(``)
  }

  lines.push(`val request = Request.Builder()`)
  lines.push(`    .url("${data.url}")`)

  if (data.body?.content && data.body.type !== 'none') {
    lines.push(`    .${data.method.toLowerCase()}(body)`)
  } else if (data.method !== 'GET') {
    lines.push(`    .${data.method.toLowerCase()}(null)`)
  }

  for (const header of headers) {
    lines.push(`    .addHeader("${header.key}", "${header.value}")`)
  }

  lines.push(`    .build()`)
  lines.push(``)
  lines.push(`val response = client.newCall(request).execute()`)
  lines.push(`println(response.body?.string())`)

  return lines.join('\n')
}

// Rust Reqwest generator
export const generateRustReqwest = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  lines.push(`use reqwest;`)
  lines.push(``)
  lines.push(`#[tokio::main]`)
  lines.push(`async fn main() -> Result<(), Box<dyn std::error::Error>> {`)
  lines.push(`    let client = reqwest::Client::new();`)
  lines.push(``)
  lines.push(`    let response = client`)
  lines.push(`        .${data.method.toLowerCase()}("${data.url}")`)

  for (const header of headers) {
    lines.push(`        .header("${header.key}", "${header.value}")`)
  }

  if (data.body?.content && data.body.type !== 'none') {
    lines.push(`        .body(r#"${data.body.content}"#)`)
  }

  lines.push(`        .send()`)
  lines.push(`        .await?;`)
  lines.push(``)
  lines.push(`    println!("{}", response.text().await?);`)
  lines.push(`    Ok(())`)
  lines.push(`}`)

  return lines.join('\n')
}

// PowerShell Invoke-WebRequest generator
export const generatePowershellWebrequest = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  if (headers.length > 0) {
    lines.push(`$headers = @{`)
    headers.forEach((h) => {
      lines.push(`    '${h.key}' = '${h.value}'`)
    })
    lines.push(`}`)
    lines.push(``)
  }

  if (data.body?.content && data.body.type !== 'none') {
    lines.push(`$body = @'`)
    lines.push(data.body.content)
    lines.push(`'@`)
    lines.push(``)
  }

  lines.push(`$response = Invoke-WebRequest -Uri '${data.url}' -Method ${data.method}`)
  if (headers.length > 0) {
    lines.push(`    -Headers $headers`)
  }
  if (data.body?.content && data.body.type !== 'none') {
    lines.push(`    -Body $body`)
  }
  lines.push(``)
  lines.push(`$response.Content`)

  return lines.join('\n')
}

// HTTP/1.1 raw format
export const generateHttpRaw = (data: RequestData): string => {
  const headers = getAllHeaders(data)
  const lines: string[] = []

  try {
    const urlObj = new URL(data.url)
    lines.push(`${data.method} ${urlObj.pathname}${urlObj.search} HTTP/1.1`)
    lines.push(`Host: ${urlObj.host}`)
  } catch {
    lines.push(`${data.method} / HTTP/1.1`)
    lines.push(`Host: ${data.url}`)
  }

  for (const header of headers) {
    lines.push(`${header.key}: ${header.value}`)
  }

  if (data.body?.content && data.body.type !== 'none') {
    lines.push(``)
    lines.push(data.body.content)
  }

  return lines.join('\n')
}

// Map of all generators
export const generators: Record<string, Record<string, (data: RequestData) => string>> = {
  shell: {
    curl: generateCurl,
    httpie: generateHttpie,
  },
  javascript: {
    fetch: generateJsFetch,
    axios: generateJsAxios,
    jquery: generateJsJquery,
  },
  node: {
    fetch: generateNodeFetch,
    axios: generateNodeAxios,
  },
  python: {
    requests: generatePythonRequests,
  },
  java: {
    okhttp: generateJavaOkhttp,
  },
  go: {
    native: generateGoNative,
  },
  php: {
    curl: generatePhpCurl,
  },
  ruby: {
    native: generateRubyNative,
  },
  csharp: {
    httpclient: generateCsharpHttpclient,
  },
  swift: {
    urlsession: generateSwiftUrlsession,
  },
  kotlin: {
    okhttp: generateKotlinOkhttp,
  },
  rust: {
    reqwest: generateRustReqwest,
  },
  powershell: {
    webrequest: generatePowershellWebrequest,
  },
  http: {
    'http1.1': generateHttpRaw,
  },
}
