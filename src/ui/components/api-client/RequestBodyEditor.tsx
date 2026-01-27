import type { FC } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { KeyValueTable } from './KeyValueTable'

interface RequestBodyEditorProps {
  body: ApiRequestBody
  onChange: (body: ApiRequestBody) => void
}

const BODY_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'raw', label: 'Text' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'x-www-form-urlencoded', label: 'URL Encoded' },
  { value: 'graphql', label: 'GraphQL' },
] as const

export const RequestBodyEditor: FC<RequestBodyEditorProps> = ({
  body,
  onChange,
}) => {
  const handleTypeChange = (type: string) => {
    onChange({ ...body, type: type as ApiRequestBody['type'] })
  }

  const handleContentChange = (content: string) => {
    onChange({ ...body, content })
  }

  const handleFormDataChange = (formData: ApiKeyValue[]) => {
    onChange({ ...body, formData })
  }

  const handleGraphqlChange = (field: 'query' | 'variables', value: string) => {
    onChange({
      ...body,
      graphql: {
        query: body.graphql?.query ?? '',
        variables: body.graphql?.variables ?? '',
        [field]: value,
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Body Type</Label>
        <Select value={body.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BODY_TYPES.map((bt) => (
              <SelectItem key={bt.value} value={bt.value}>
                {bt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {body.type === 'none' && (
        <p className="text-sm text-muted-foreground">
          This request does not have a body.
        </p>
      )}

      {(body.type === 'json' || body.type === 'raw') && (
        <Textarea
          placeholder={
            body.type === 'json'
              ? '{\n  "key": "value"\n}'
              : 'Enter raw text...'
          }
          value={body.content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="min-h-48 font-mono text-sm"
        />
      )}

      {body.type === 'form-data' && (
        <KeyValueTable
          items={body.formData ?? []}
          onChange={handleFormDataChange}
          showDescription
        />
      )}

      {body.type === 'x-www-form-urlencoded' && (
        <KeyValueTable
          items={body.formData ?? []}
          onChange={handleFormDataChange}
        />
      )}

      {body.type === 'graphql' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Query</Label>
            <Textarea
              placeholder={'query {\n  users {\n    id\n    name\n  }\n}'}
              value={body.graphql?.query ?? ''}
              onChange={(e) => handleGraphqlChange('query', e.target.value)}
              className="min-h-40 font-mono text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Variables (JSON)
            </Label>
            <Textarea
              placeholder={'{\n  "id": "1"\n}'}
              value={body.graphql?.variables ?? ''}
              onChange={(e) =>
                handleGraphqlChange('variables', e.target.value)
              }
              className="min-h-24 font-mono text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
