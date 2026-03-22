import type { FC } from 'react'
import { Label } from '@/components/ui/label'
import { VariableInput } from './VariableInput'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronRight } from 'lucide-react'

interface RequestAuthEditorProps {
  auth: ApiAuth
  onChange: (auth: ApiAuth) => void
  showInheritOption?: boolean
  resolvedAuthInfo?: ResolvedAuthInfo | null
  onNavigateToSource?: (source: 'collection' | 'folder', sourceId: string) => void
}

const AUTH_TYPES: { value: ApiAuthType; label: string }[] = [
  { value: 'inherit', label: 'Inherit from parent' },
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api-key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'digest', label: 'Digest Auth' },
  { value: 'hawk', label: 'Hawk Authentication' },
  { value: 'aws-sig-v4', label: 'AWS Signature' },
  { value: 'ntlm', label: 'NTLM Authentication' },
]

export const RequestAuthEditor: FC<RequestAuthEditorProps> = ({
  auth,
  onChange,
  showInheritOption = true,
  resolvedAuthInfo,
  onNavigateToSource,
}) => {
  const handleTypeChange = (type: string) => {
    onChange({ ...auth, type: type as ApiAuthType })
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

  const handleBearerChange = (field: 'token' | 'prefix', value: string) => {
    onChange({
      ...auth,
      bearer: {
        token: auth.bearer?.token ?? '',
        prefix: auth.bearer?.prefix,
        [field]: value,
      },
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

  const handleOAuth2Change = (
    field: keyof NonNullable<ApiAuth['oauth2']>,
    value: string
  ) => {
    onChange({
      ...auth,
      oauth2: {
        accessToken: auth.oauth2?.accessToken ?? '',
        ...auth.oauth2,
        [field]: value,
      },
    })
  }

  const handleDigestChange = (
    field: keyof NonNullable<ApiAuth['digest']>,
    value: string
  ) => {
    onChange({
      ...auth,
      digest: {
        username: auth.digest?.username ?? '',
        password: auth.digest?.password ?? '',
        ...auth.digest,
        [field]: value,
      },
    })
  }

  const handleHawkChange = (
    field: keyof NonNullable<ApiAuth['hawk']>,
    value: string
  ) => {
    onChange({
      ...auth,
      hawk: {
        authId: auth.hawk?.authId ?? '',
        authKey: auth.hawk?.authKey ?? '',
        ...auth.hawk,
        [field]: value,
      },
    })
  }

  const handleAwsSigV4Change = (
    field: keyof NonNullable<ApiAuth['awsSigV4']>,
    value: string
  ) => {
    onChange({
      ...auth,
      awsSigV4: {
        accessKey: auth.awsSigV4?.accessKey ?? '',
        secretKey: auth.awsSigV4?.secretKey ?? '',
        region: auth.awsSigV4?.region ?? '',
        service: auth.awsSigV4?.service ?? '',
        ...auth.awsSigV4,
        [field]: value,
      },
    })
  }

  const handleNtlmChange = (
    field: keyof NonNullable<ApiAuth['ntlm']>,
    value: string
  ) => {
    onChange({
      ...auth,
      ntlm: {
        username: auth.ntlm?.username ?? '',
        password: auth.ntlm?.password ?? '',
        ...auth.ntlm,
        [field]: value,
      },
    })
  }

  const filteredAuthTypes = showInheritOption
    ? AUTH_TYPES
    : AUTH_TYPES.filter((t) => t.value !== 'inherit')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</Label>
        <Select value={auth.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-48 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filteredAuthTypes.map((authType) => (
              <SelectItem key={authType.value} value={authType.value} className="text-xs">
                {authType.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {auth.type === 'inherit' && (
        <div className="text-xs text-muted-foreground">
          {resolvedAuthInfo ? (
            <div className="flex flex-col gap-1">
              <p>
                Inheriting <span className="font-medium text-foreground">{resolvedAuthInfo.auth.type}</span> auth from{' '}
                <span className="font-medium text-foreground">{resolvedAuthInfo.sourceName}</span>
              </p>
              {onNavigateToSource && resolvedAuthInfo.source !== 'request' && (
                <button
                  onClick={() => onNavigateToSource(resolvedAuthInfo.source as 'collection' | 'folder', resolvedAuthInfo.sourceId)}
                  className="flex items-center gap-1 text-primary hover:underline w-fit"
                >
                  Edit in {resolvedAuthInfo.source}
                  <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          ) : (
            <p>No auth configured in parent collection or folders.</p>
          )}
        </div>
      )}

      {auth.type === 'none' && (
        <p className="text-xs text-muted-foreground">
          No authentication will be used for this request.
        </p>
      )}

      {auth.type === 'basic' && (
        <div className="flex flex-col gap-2 max-w-sm">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Username</Label>
            <VariableInput
              placeholder="Username"
              value={auth.basic?.username ?? ''}
              onChange={(val) => handleBasicChange('username', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Password</Label>
            <VariableInput
              placeholder="Password"
              value={auth.basic?.password ?? ''}
              onChange={(val) => handleBasicChange('password', val)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}

      {auth.type === 'bearer' && (
        <div className="flex flex-col gap-2 max-w-sm">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Token</Label>
            <VariableInput
              placeholder="Bearer token"
              value={auth.bearer?.token ?? ''}
              onChange={(val) => handleBearerChange('token', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Prefix <span className="text-muted-foreground/60">(default: Bearer)</span>
            </Label>
            <VariableInput
              placeholder="Bearer"
              value={auth.bearer?.prefix ?? ''}
              onChange={(val) => handleBearerChange('prefix', val)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="flex flex-col gap-2 max-w-sm">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Key</Label>
            <VariableInput
              placeholder="Header or query param name"
              value={auth.apiKey?.key ?? ''}
              onChange={(val) => handleApiKeyChange('key', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Value</Label>
            <VariableInput
              placeholder="API key value"
              value={auth.apiKey?.value ?? ''}
              onChange={(val) => handleApiKeyChange('value', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Add to</Label>
            <Select
              value={auth.apiKey?.addTo ?? 'header'}
              onValueChange={(v) => handleApiKeyChange('addTo', v)}
            >
              <SelectTrigger className="w-40 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header" className="text-xs">Header</SelectItem>
                <SelectItem value="query" className="text-xs">Query Params</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {auth.type === 'oauth2' && (
        <div className="flex flex-col gap-2 max-w-sm">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Access Token</Label>
            <VariableInput
              placeholder="Access token"
              value={auth.oauth2?.accessToken ?? ''}
              onChange={(val) => handleOAuth2Change('accessToken', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Token URL</Label>
            <VariableInput
              placeholder="https://example.com/oauth/token"
              value={auth.oauth2?.tokenUrl ?? ''}
              onChange={(val) => handleOAuth2Change('tokenUrl', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Client ID</Label>
            <VariableInput
              placeholder="Client ID"
              value={auth.oauth2?.clientId ?? ''}
              onChange={(val) => handleOAuth2Change('clientId', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Client Secret</Label>
            <VariableInput
              placeholder="Client secret"
              value={auth.oauth2?.clientSecret ?? ''}
              onChange={(val) => handleOAuth2Change('clientSecret', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Grant Type</Label>
            <Select
              value={auth.oauth2?.grantType ?? 'client_credentials'}
              onValueChange={(v) => handleOAuth2Change('grantType', v)}
            >
              <SelectTrigger className="w-48 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client_credentials" className="text-xs">Client Credentials</SelectItem>
                <SelectItem value="authorization_code" className="text-xs">Authorization Code</SelectItem>
                <SelectItem value="password" className="text-xs">Password</SelectItem>
                <SelectItem value="implicit" className="text-xs">Implicit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Scope</Label>
            <VariableInput
              placeholder="read write"
              value={auth.oauth2?.scope ?? ''}
              onChange={(val) => handleOAuth2Change('scope', val)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}

      {auth.type === 'digest' && (
        <div className="flex flex-col gap-2 max-w-sm">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Username</Label>
            <VariableInput
              placeholder="Username"
              value={auth.digest?.username ?? ''}
              onChange={(val) => handleDigestChange('username', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Password</Label>
            <VariableInput
              placeholder="Password"
              value={auth.digest?.password ?? ''}
              onChange={(val) => handleDigestChange('password', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Realm</Label>
            <VariableInput
              placeholder="Realm (optional)"
              value={auth.digest?.realm ?? ''}
              onChange={(val) => handleDigestChange('realm', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Algorithm</Label>
            <Select
              value={auth.digest?.algorithm ?? 'MD5'}
              onValueChange={(v) => handleDigestChange('algorithm', v)}
            >
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MD5" className="text-xs">MD5</SelectItem>
                <SelectItem value="SHA-256" className="text-xs">SHA-256</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {auth.type === 'hawk' && (
        <div className="flex flex-col gap-2 max-w-sm">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Auth ID</Label>
            <VariableInput
              placeholder="Hawk Auth ID"
              value={auth.hawk?.authId ?? ''}
              onChange={(val) => handleHawkChange('authId', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Auth Key</Label>
            <VariableInput
              placeholder="Hawk Auth Key"
              value={auth.hawk?.authKey ?? ''}
              onChange={(val) => handleHawkChange('authKey', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Algorithm</Label>
            <Select
              value={auth.hawk?.algorithm ?? 'sha256'}
              onValueChange={(v) => handleHawkChange('algorithm', v)}
            >
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sha256" className="text-xs">SHA-256</SelectItem>
                <SelectItem value="sha1" className="text-xs">SHA-1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {auth.type === 'aws-sig-v4' && (
        <div className="flex flex-col gap-2 max-w-sm">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Access Key</Label>
            <VariableInput
              placeholder="AWS Access Key ID"
              value={auth.awsSigV4?.accessKey ?? ''}
              onChange={(val) => handleAwsSigV4Change('accessKey', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Secret Key</Label>
            <VariableInput
              placeholder="AWS Secret Access Key"
              value={auth.awsSigV4?.secretKey ?? ''}
              onChange={(val) => handleAwsSigV4Change('secretKey', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Region</Label>
            <VariableInput
              placeholder="us-east-1"
              value={auth.awsSigV4?.region ?? ''}
              onChange={(val) => handleAwsSigV4Change('region', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Service</Label>
            <VariableInput
              placeholder="execute-api, s3, etc."
              value={auth.awsSigV4?.service ?? ''}
              onChange={(val) => handleAwsSigV4Change('service', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Session Token</Label>
            <VariableInput
              placeholder="Session token (optional)"
              value={auth.awsSigV4?.sessionToken ?? ''}
              onChange={(val) => handleAwsSigV4Change('sessionToken', val)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}

      {auth.type === 'ntlm' && (
        <div className="flex flex-col gap-2 max-w-sm">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Username</Label>
            <VariableInput
              placeholder="Username"
              value={auth.ntlm?.username ?? ''}
              onChange={(val) => handleNtlmChange('username', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Password</Label>
            <VariableInput
              placeholder="Password"
              value={auth.ntlm?.password ?? ''}
              onChange={(val) => handleNtlmChange('password', val)}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Domain</Label>
            <VariableInput
              placeholder="Domain (optional)"
              value={auth.ntlm?.domain ?? ''}
              onChange={(val) => handleNtlmChange('domain', val)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  )
}
