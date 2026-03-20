import { useState, useMemo, type FC } from 'react'
import { ToolLayout, InputArea } from './shared'
import { CopyButton } from './shared/CopyButton'
import { AlertCircle, CheckCircle } from 'lucide-react'

interface JwtParts {
  header: Record<string, unknown> | null
  payload: Record<string, unknown> | null
  signature: string
  error?: string
}

function decodeJwt(token: string): JwtParts {
  const result: JwtParts = { header: null, payload: null, signature: '', error: undefined }

  if (!token.trim()) {
    return result
  }

  const parts = token.trim().split('.')
  if (parts.length !== 3) {
    return { ...result, error: 'Invalid JWT format: expected 3 parts separated by dots' }
  }

  try {
    const headerJson = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'))
    result.header = JSON.parse(headerJson)
  } catch {
    return { ...result, error: 'Failed to decode header' }
  }

  try {
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    result.payload = JSON.parse(payloadJson)
  } catch {
    return { ...result, error: 'Failed to decode payload' }
  }

  result.signature = parts[2]
  return result
}

function formatExpiry(payload: Record<string, unknown> | null): { text: string; isExpired: boolean } | null {
  if (!payload || typeof payload.exp !== 'number') return null

  const expDate = new Date(payload.exp * 1000)
  const now = new Date()
  const isExpired = expDate < now

  if (isExpired) {
    return { text: `Expired on ${expDate.toLocaleString()}`, isExpired: true }
  }

  const diffMs = expDate.getTime() - now.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  let timeStr = ''
  if (diffDays > 0) timeStr = `${diffDays} day${diffDays > 1 ? 's' : ''}`
  else if (diffHours > 0) timeStr = `${diffHours} hour${diffHours > 1 ? 's' : ''}`
  else timeStr = `${diffMins} minute${diffMins !== 1 ? 's' : ''}`

  return { text: `Expires in ${timeStr}`, isExpired: false }
}

const JsonPanel: FC<{ title: string; data: Record<string, unknown> | null; color: string }> = ({ title, data, color }) => (
  <div className="flex-1 min-w-0">
    <div className="flex justify-between items-center mb-2">
      <h3 className={`text-sm font-semibold ${color}`}>{title}</h3>
      {data && <CopyButton text={JSON.stringify(data, null, 2)} />}
    </div>
    <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-auto max-h-[300px] font-mono">
      {data ? JSON.stringify(data, null, 2) : '-'}
    </pre>
  </div>
)

export const JwtDecoder: FC = () => {
  const [input, setInput] = useState('')

  const decoded = useMemo(() => decodeJwt(input), [input])
  const expiry = useMemo(() => formatExpiry(decoded.payload), [decoded.payload])

  return (
    <ToolLayout title="JWT Decoder" description="Decode and inspect JSON Web Tokens">
      <div className="space-y-4">
        <InputArea
          value={input}
          onChange={setInput}
          label="JWT Token"
          placeholder="Paste your JWT token here..."
          rows={4}
        />

        {decoded.error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-md">
            <AlertCircle className="h-4 w-4" />
            {decoded.error}
          </div>
        )}

        {!decoded.error && decoded.header && (
          <>
            <div className="flex gap-4">
              <JsonPanel title="Header" data={decoded.header} color="text-blue-500" />
              <JsonPanel title="Payload" data={decoded.payload} color="text-status-green" />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-orange-500">Signature</h3>
                <CopyButton text={decoded.signature} />
              </div>
              <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-auto font-mono break-all">
                {decoded.signature}
              </pre>
            </div>

            {expiry && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-md ${
                expiry.isExpired ? 'bg-destructive/10 text-destructive' : 'bg-status-green-bg text-status-green'
              }`}>
                {expiry.isExpired ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                {expiry.text}
              </div>
            )}
          </>
        )}
      </div>
    </ToolLayout>
  )
}
