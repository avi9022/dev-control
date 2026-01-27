import type { FC } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

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
    <div className="flex flex-col gap-1">
      <div className="grid gap-2 text-xs font-medium text-muted-foreground px-1 pb-1"
        style={{
          gridTemplateColumns: showDescription
            ? '28px 1fr 1fr 1fr 28px'
            : '28px 1fr 1fr 28px',
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
          className="grid gap-2 items-center"
          style={{
            gridTemplateColumns: showDescription
              ? '28px 1fr 1fr 1fr 28px'
              : '28px 1fr 1fr 28px',
          }}
        >
          <Checkbox
            checked={item.enabled}
            onCheckedChange={(checked) =>
              handleToggle(index, checked === true)
            }
          />
          <Input
            placeholder="Key"
            value={item.key}
            onChange={(e) => handleChange(index, 'key', e.target.value)}
            className="h-8 text-sm"
          />
          <Input
            placeholder="Value"
            value={item.value}
            onChange={(e) => handleChange(index, 'value', e.target.value)}
            className="h-8 text-sm"
          />
          {showDescription && (
            <Input
              placeholder="Description"
              value={item.description ?? ''}
              onChange={(e) =>
                handleChange(index, 'description', e.target.value)
              }
              className="h-8 text-sm"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={() => handleDelete(index)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="w-fit mt-1 text-muted-foreground"
        onClick={handleAdd}
      >
        <Plus className="size-3.5" />
        Add
      </Button>
    </div>
  )
}
