import { useState, useMemo, type FC } from 'react'
import { ToolLayout } from './shared'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface StatusCode {
  code: number
  name: string
  description: string
  category: 'info' | 'success' | 'redirect' | 'client' | 'server'
}

const HTTP_STATUS_CODES: StatusCode[] = [
  { code: 100, name: 'Continue', description: 'The server has received the request headers and the client should proceed to send the request body.', category: 'info' },
  { code: 101, name: 'Switching Protocols', description: 'The requester has asked the server to switch protocols and the server has agreed to do so.', category: 'info' },
  { code: 102, name: 'Processing', description: 'The server has received and is processing the request, but no response is available yet.', category: 'info' },
  { code: 103, name: 'Early Hints', description: 'Used to return some response headers before final HTTP message.', category: 'info' },

  { code: 200, name: 'OK', description: 'The request has succeeded. The meaning of the success depends on the HTTP method used.', category: 'success' },
  { code: 201, name: 'Created', description: 'The request has succeeded and a new resource has been created as a result.', category: 'success' },
  { code: 202, name: 'Accepted', description: 'The request has been received but not yet acted upon. It is non-committal.', category: 'success' },
  { code: 203, name: 'Non-Authoritative Information', description: 'The returned metadata is not exactly the same as available from the origin server.', category: 'success' },
  { code: 204, name: 'No Content', description: 'There is no content to send for this request, but the headers may be useful.', category: 'success' },
  { code: 205, name: 'Reset Content', description: 'Tells the user agent to reset the document which sent this request.', category: 'success' },
  { code: 206, name: 'Partial Content', description: 'This response code is used when the Range header is sent from the client to request only part of a resource.', category: 'success' },

  { code: 300, name: 'Multiple Choices', description: 'The request has more than one possible response. The user agent should choose one of them.', category: 'redirect' },
  { code: 301, name: 'Moved Permanently', description: 'The URL of the requested resource has been changed permanently. The new URL is given in the response.', category: 'redirect' },
  { code: 302, name: 'Found', description: 'The URI of requested resource has been changed temporarily. Further changes might be made in the future.', category: 'redirect' },
  { code: 303, name: 'See Other', description: 'The server sent this response to direct the client to get the requested resource at another URI with a GET request.', category: 'redirect' },
  { code: 304, name: 'Not Modified', description: 'This is used for caching purposes. It tells the client that the response has not been modified.', category: 'redirect' },
  { code: 307, name: 'Temporary Redirect', description: 'The server sends this response to direct the client to get the requested resource at another URI with the same method.', category: 'redirect' },
  { code: 308, name: 'Permanent Redirect', description: 'The resource is now permanently located at another URI, specified by the Location header.', category: 'redirect' },

  { code: 400, name: 'Bad Request', description: 'The server could not understand the request due to invalid syntax.', category: 'client' },
  { code: 401, name: 'Unauthorized', description: 'The client must authenticate itself to get the requested response.', category: 'client' },
  { code: 402, name: 'Payment Required', description: 'Reserved for future use. Originally created for digital payment systems.', category: 'client' },
  { code: 403, name: 'Forbidden', description: 'The client does not have access rights to the content; the server is refusing to give the requested resource.', category: 'client' },
  { code: 404, name: 'Not Found', description: 'The server cannot find the requested resource. This can also mean the endpoint is valid but the resource does not exist.', category: 'client' },
  { code: 405, name: 'Method Not Allowed', description: 'The request method is known by the server but is not supported by the target resource.', category: 'client' },
  { code: 406, name: 'Not Acceptable', description: 'The server cannot produce a response matching the list of acceptable values defined in the request headers.', category: 'client' },
  { code: 407, name: 'Proxy Authentication Required', description: 'Similar to 401 but authentication is needed to be done by a proxy.', category: 'client' },
  { code: 408, name: 'Request Timeout', description: 'The server would like to shut down this unused connection. It is sent on an idle connection by some servers.', category: 'client' },
  { code: 409, name: 'Conflict', description: 'This response is sent when a request conflicts with the current state of the server.', category: 'client' },
  { code: 410, name: 'Gone', description: 'The content has been permanently deleted from server, with no forwarding address.', category: 'client' },
  { code: 411, name: 'Length Required', description: 'Server rejected the request because the Content-Length header field is not defined and the server requires it.', category: 'client' },
  { code: 412, name: 'Precondition Failed', description: 'The client has indicated preconditions in its headers which the server does not meet.', category: 'client' },
  { code: 413, name: 'Payload Too Large', description: 'Request entity is larger than limits defined by server.', category: 'client' },
  { code: 414, name: 'URI Too Long', description: 'The URI requested by the client is longer than the server is willing to interpret.', category: 'client' },
  { code: 415, name: 'Unsupported Media Type', description: 'The media format of the requested data is not supported by the server.', category: 'client' },
  { code: 416, name: 'Range Not Satisfiable', description: 'The range specified by the Range header field in the request cannot be fulfilled.', category: 'client' },
  { code: 417, name: 'Expectation Failed', description: 'The expectation indicated by the Expect request header field cannot be met by the server.', category: 'client' },
  { code: 418, name: "I'm a teapot", description: 'The server refuses the attempt to brew coffee with a teapot.', category: 'client' },
  { code: 422, name: 'Unprocessable Entity', description: 'The request was well-formed but was unable to be followed due to semantic errors.', category: 'client' },
  { code: 425, name: 'Too Early', description: 'Indicates that the server is unwilling to risk processing a request that might be replayed.', category: 'client' },
  { code: 426, name: 'Upgrade Required', description: 'The server refuses to perform the request using the current protocol but might be willing to do so after the client upgrades.', category: 'client' },
  { code: 428, name: 'Precondition Required', description: 'The origin server requires the request to be conditional.', category: 'client' },
  { code: 429, name: 'Too Many Requests', description: 'The user has sent too many requests in a given amount of time (rate limiting).', category: 'client' },
  { code: 431, name: 'Request Header Fields Too Large', description: 'The server is unwilling to process the request because its header fields are too large.', category: 'client' },
  { code: 451, name: 'Unavailable For Legal Reasons', description: 'The user agent requested a resource that cannot legally be provided.', category: 'client' },

  { code: 500, name: 'Internal Server Error', description: 'The server has encountered a situation it does not know how to handle.', category: 'server' },
  { code: 501, name: 'Not Implemented', description: 'The request method is not supported by the server and cannot be handled.', category: 'server' },
  { code: 502, name: 'Bad Gateway', description: 'The server, while working as a gateway, got an invalid response from the upstream server.', category: 'server' },
  { code: 503, name: 'Service Unavailable', description: 'The server is not ready to handle the request. Common causes are a server that is down for maintenance or is overloaded.', category: 'server' },
  { code: 504, name: 'Gateway Timeout', description: 'The server is acting as a gateway and cannot get a response in time.', category: 'server' },
  { code: 505, name: 'HTTP Version Not Supported', description: 'The HTTP version used in the request is not supported by the server.', category: 'server' },
  { code: 506, name: 'Variant Also Negotiates', description: 'The server has an internal configuration error.', category: 'server' },
  { code: 507, name: 'Insufficient Storage', description: 'The server is unable to store the representation needed to complete the request.', category: 'server' },
  { code: 508, name: 'Loop Detected', description: 'The server detected an infinite loop while processing the request.', category: 'server' },
  { code: 510, name: 'Not Extended', description: 'Further extensions to the request are required for the server to fulfill it.', category: 'server' },
  { code: 511, name: 'Network Authentication Required', description: 'The client needs to authenticate to gain network access.', category: 'server' },
]

const CATEGORY_COLORS: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  success: 'bg-green-500/10 text-green-600 border-green-500/20',
  redirect: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  client: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  server: 'bg-red-500/10 text-red-600 border-red-500/20',
}

const CATEGORY_LABELS: Record<string, string> = {
  info: '1xx Informational',
  success: '2xx Success',
  redirect: '3xx Redirection',
  client: '4xx Client Error',
  server: '5xx Server Error',
}

export const HttpStatusCodes: FC = () => {
  const [search, setSearch] = useState('')

  const filteredCodes = useMemo(() => {
    if (!search.trim()) return HTTP_STATUS_CODES

    const query = search.toLowerCase()
    return HTTP_STATUS_CODES.filter(
      (code) =>
        code.code.toString().includes(query) ||
        code.name.toLowerCase().includes(query) ||
        code.description.toLowerCase().includes(query)
    )
  }, [search])

  const groupedCodes = useMemo(() => {
    const groups: Record<string, StatusCode[]> = {
      info: [],
      success: [],
      redirect: [],
      client: [],
      server: [],
    }
    for (const code of filteredCodes) {
      groups[code.category].push(code)
    }
    return groups
  }, [filteredCodes])

  return (
    <ToolLayout
      title="HTTP Status Codes"
      description="Reference guide for HTTP response status codes"
    >
      <div className="space-y-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by code, name, or description..."
        />

        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="space-y-6 pr-4">
            {(['info', 'success', 'redirect', 'client', 'server'] as const).map((category) => {
              const codes = groupedCodes[category]
              if (codes.length === 0) return null

              return (
                <div key={category}>
                  <h3 className={`text-sm font-semibold mb-2 px-2 py-1 rounded ${CATEGORY_COLORS[category]}`}>
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <div className="space-y-2">
                    {codes.map((code) => (
                      <div key={code.code} className="bg-muted/50 p-3 rounded-md">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className={`font-mono font-bold ${CATEGORY_COLORS[code.category].split(' ')[1]}`}>
                            {code.code}
                          </span>
                          <span className="font-medium">{code.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{code.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    </ToolLayout>
  )
}
