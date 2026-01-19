import { useState, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'

interface CopyButtonProps {
  text: string
  className?: string
}

export const CopyButton: FC<CopyButtonProps> = ({ text, className }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className={className}
      disabled={!text}
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  )
}
