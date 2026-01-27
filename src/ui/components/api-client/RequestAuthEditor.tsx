import type { FC } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RequestAuthEditorProps {
  auth: ApiAuth
  onChange: (auth: ApiAuth) => void
}

const AUTH_TYPES = [
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api-key', label: 'API Key' },
] as const

export const RequestAuthEditor: FC<RequestAuthEditorProps> = ({
  auth,
  onChange,
}) => {
  const handleTypeChange = (type: string) => {
    onChange({ ...auth, type: type as ApiAuth['type'] })
  }

  const handleBasicChange = (field: 'username' | 'password', value: string) => {
    onChange({
      ...auth,
      basic: {
        username: auth.basic?.username ?? '',
        password: auth.basic?.password ?? '',
        [field]: value,
      },
    })
  }

  const handleBearerChange = (token: string) => {
    onChange({
      ...auth,
      bearer: { token },
    })
  }

  const handleApiKeyChange = (
    field: 'key' | 'value' | 'addTo',
    fieldValue: string
  ) => {
    onChange({
      ...auth,
      apiKey: {
        key: auth.apiKey?.key ?? '',
        value: auth.apiKey?.value ?? '',
        addTo: auth.apiKey?.addTo ?? 'header',
        [field]: fieldValue,
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Auth Type</Label>
        <Select value={auth.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTH_TYPES.map((authType) => (
              <SelectItem key={authType.value} value={authType.value}>
                {authType.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {auth.type === 'none' && (
        <p className="text-sm text-muted-foreground">
          This request does not use any authentication.
        </p>
      )}

      {auth.type === 'basic' && (
        <div className="flex flex-col gap-3 max-w-md">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Username</Label>
            <Input
              placeholder="Username"
              value={auth.basic?.username ?? ''}
              onChange={(e) => handleBasicChange('username', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Password</Label>
            <Input
              type="password"
              placeholder="Password"
              value={auth.basic?.password ?? ''}
              onChange={(e) => handleBasicChange('password', e.target.value)}
            />
          </div>
        </div>
      )}

      {auth.type === 'bearer' && (
        <div className="flex flex-col gap-1.5 max-w-md">
          <Label className="text-xs text-muted-foreground">Token</Label>
          <Input
            placeholder="Bearer token"
            value={auth.bearer?.token ?? ''}
            onChange={(e) => handleBearerChange(e.target.value)}
          />
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="flex flex-col gap-3 max-w-md">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Key</Label>
            <Input
              placeholder="Header or query param name"
              value={auth.apiKey?.key ?? ''}
              onChange={(e) => handleApiKeyChange('key', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Value</Label>
            <Input
              placeholder="API key value"
              value={auth.apiKey?.value ?? ''}
              onChange={(e) => handleApiKeyChange('value', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Add to</Label>
            <Select
              value={auth.apiKey?.addTo ?? 'header'}
              onValueChange={(v) => handleApiKeyChange('addTo', v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Header</SelectItem>
                <SelectItem value="query">Query Params</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}
