import type { FC } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { VariableInput } from './VariableInput'

interface KeyValueTableProps {
  items: ApiKeyValue[]
  onChange: (items: ApiKeyValue[]) => void
  showDescription?: boolean
}

const createEmptyRow = (): ApiKeyValue => ({
  key: '',
  value: '',
  enabled: true,
  description: '',
})

export const KeyValueTable: FC<KeyValueTableProps> = ({
  items,
  onChange,
  showDescription = false,
}) => {
  const handleToggle = (index: number, checked: boolean) => {
    onChange(
      items.map((item, i) =>
        i === index ? { ...item, enabled: checked } : item
      )
    )
  }

  const handleChange = (
    index: number,
    field: 'key' | 'value' | 'description',
    fieldValue: string
  ) => {
    onChange(
      items.map((item, i) =>
        i === index ? { ...item, [field]: fieldValue } : item
      )
    )
  }

  const handleDelete = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  const handleAdd = () => {
    onChange([...items, createEmptyRow()])
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="grid gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-0.5 pb-1"
        style={{
          gridTemplateColumns: showDescription
            ? '20px 1fr 1fr 1fr 24px'
            : '20px 1fr 1fr 24px',
        }}
      >
        <span />
        <span>Key</span>
        <span>Value</span>
        {showDescription && <span>Description</span>}
        <span />
      </div>

      {items.map((item, index) => (
        <div
          key={index}
          className="grid gap-1.5 items-center"
          style={{
            gridTemplateColumns: showDescription
              ? '20px 1fr 1fr 1fr 24px'
              : '20px 1fr 1fr 24px',
          }}
        >
          <Checkbox
            checked={item.enabled}
            onCheckedChange={(checked) =>
              handleToggle(index, checked === true)
            }
            className="h-3.5 w-3.5"
          />
          <VariableInput
            placeholder="Key"
            value={item.key}
            onChange={(val) => handleChange(index, 'key', val)}
            className="[&_input]:h-7 [&_input]:text-xs [&>div]:h-7 [&>div]:text-xs"
          />
          <VariableInput
            placeholder="Value"
            value={item.value}
            onChange={(val) => handleChange(index, 'value', val)}
            className="[&_input]:h-7 [&_input]:text-xs [&>div]:h-7 [&>div]:text-xs"
          />
          {showDescription && (
            <VariableInput
              placeholder="Description"
              value={item.description ?? ''}
              onChange={(val) => handleChange(index, 'description', val)}
              className="[&_input]:h-7 [&_input]:text-xs [&>div]:h-7 [&>div]:text-xs"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-destructive"
            onClick={() => handleDelete(index)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="w-fit h-7 mt-0.5 text-xs text-muted-foreground"
        onClick={handleAdd}
      >
        <Plus className="size-3 mr-1" />
        Add
      </Button>
    </div>
  )
}
