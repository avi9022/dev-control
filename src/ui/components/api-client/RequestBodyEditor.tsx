import type { FC } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { KeyValueTable } from './KeyValueTable'
import { VariableTextarea } from './VariableTextarea'
import { JsonEditor } from './JsonEditor'

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
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex flex-col gap-1 flex-shrink-0">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</Label>
        <Select value={body.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-40 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BODY_TYPES.map((bt) => (
              <SelectItem key={bt.value} value={bt.value} className="text-xs">
                {bt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {body.type === 'none' && (
        <p className="text-xs text-muted-foreground">
          No body will be sent with this request.
        </p>
      )}

      {body.type === 'json' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <JsonEditor
            value={body.content}
            onChange={handleContentChange}
          />
        </div>
      )}

      {body.type === 'raw' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <VariableTextarea
            placeholder="Enter raw text..."
            value={body.content}
            onChange={handleContentChange}
            className="text-xs flex-1 min-h-0 resize-none"
          />
        </div>
      )}

      {body.type === 'form-data' && (
        <div className="flex-1 min-h-0 overflow-auto">
          <KeyValueTable
            items={body.formData ?? []}
            onChange={handleFormDataChange}
            showDescription
          />
        </div>
      )}

      {body.type === 'x-www-form-urlencoded' && (
        <div className="flex-1 min-h-0 overflow-auto">
          <KeyValueTable
            items={body.formData ?? []}
            onChange={handleFormDataChange}
          />
        </div>
      )}

      {body.type === 'graphql' && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex flex-col gap-1 flex-1 min-h-0">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex-shrink-0">Query</Label>
            <VariableTextarea
              placeholder={'query {\n  users {\n    id\n    name\n  }\n}'}
              value={body.graphql?.query ?? ''}
              onChange={(val) => handleGraphqlChange('query', val)}
              className="text-xs flex-1 min-h-0 resize-none"
            />
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0" style={{ maxHeight: '30%' }}>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Variables (JSON)
            </Label>
            <JsonEditor
              value={body.graphql?.variables ?? ''}
              onChange={(val) => handleGraphqlChange('variables', val)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
