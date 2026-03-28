import type { FC } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { CopyButton } from './CopyButton'
import { Clipboard, X } from 'lucide-react'

interface InputAreaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  className?: string
  rows?: number
}

export const InputArea: FC<InputAreaProps> = ({
  value,
  onChange,
  placeholder = 'Enter input...',
  label,
  className,
  rows = 8,
}) => {
  const handlePaste = async () => {
    const text = await navigator.clipboard.readText()
    onChange(text)
  }

  const handleClear = () => {
    onChange('')
  }

  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium">{label}</label>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handlePaste} title="Paste from clipboard">
              <Clipboard className="h-4 w-4" />
            </Button>
            <CopyButton text={value} />
            <Button variant="ghost" size="sm" onClick={handleClear} title="Clear">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="font-mono text-sm resize-none"
      />
    </div>
  )
}
