import type { FC } from 'react'
import { CopyButton } from './CopyButton'

interface OutputAreaProps {
  value: string
  label?: string
  className?: string
  error?: string
}

export const OutputArea: FC<OutputAreaProps> = ({ value, label, className, error }) => {
  return (
    <div className={className}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium">{label}</label>
          <CopyButton text={value} />
        </div>
      )}
      <div
        className={`font-mono text-sm p-3 rounded-md border min-h-[200px] max-h-[400px] overflow-auto whitespace-pre-wrap break-all ${
          error ? 'border-destructive bg-destructive/10 text-destructive' : 'bg-muted/50'
        }`}
      >
        {error || value || <span className="text-muted-foreground">Output will appear here...</span>}
      </div>
    </div>
  )
}
