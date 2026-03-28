import { useState, type FC } from 'react'
import { ToolLayout } from './shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { CopyButton } from './shared/CopyButton'
import { RefreshCw, Trash2 } from 'lucide-react'

interface PasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
}

function generatePassword(options: PasswordOptions): string {
  let chars = ''
  if (options.uppercase) chars += CHAR_SETS.uppercase
  if (options.lowercase) chars += CHAR_SETS.lowercase
  if (options.numbers) chars += CHAR_SETS.numbers
  if (options.symbols) chars += CHAR_SETS.symbols

  if (!chars) return ''

  const array = new Uint32Array(options.length)
  crypto.getRandomValues(array)

  return Array.from(array)
    .map((x) => chars[x % chars.length])
    .join('')
}

function calculateStrength(password: string, options: PasswordOptions): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: 'None', color: 'bg-muted' }

  let entropy = 0
  if (options.lowercase) entropy += 26
  if (options.uppercase) entropy += 26
  if (options.numbers) entropy += 10
  if (options.symbols) entropy += 32

  const bits = Math.log2(Math.pow(entropy, password.length))

  if (bits < 28) return { score: 1, label: 'Very Weak', color: 'bg-status-red' }
  if (bits < 36) return { score: 2, label: 'Weak', color: 'bg-orange-500' }
  if (bits < 60) return { score: 3, label: 'Moderate', color: 'bg-status-yellow' }
  if (bits < 128) return { score: 4, label: 'Strong', color: 'bg-status-green' }
  return { score: 5, label: 'Very Strong', color: 'bg-status-green' }
}

export const PasswordGenerator: FC = () => {
  const [passwords, setPasswords] = useState<string[]>([])
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  })

  const handleGenerate = () => {
    const newPassword = generatePassword(options)
    if (newPassword) {
      setPasswords((prev) => [newPassword, ...prev])
    }
  }

  const clearAll = () => {
    setPasswords([])
  }

  const removePassword = (index: number) => {
    setPasswords((prev) => prev.filter((_, i) => i !== index))
  }

  const hasAnyCharSet = options.uppercase || options.lowercase || options.numbers || options.symbols

  return (
    <ToolLayout
      title="Password Generator"
      description="Generate secure random passwords"
      actions={
        passwords.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm">Length:</span>
            <Input
              type="number"
              min={4}
              max={128}
              value={options.length}
              onChange={(e) => setOptions({ ...options, length: Math.min(128, Math.max(4, parseInt(e.target.value) || 16)) })}
              className="w-20"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {(['uppercase', 'lowercase', 'numbers', 'symbols'] as const).map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={options[key]}
                onCheckedChange={(checked) => setOptions({ ...options, [key]: checked === true })}
              />
              <span className="text-sm capitalize">{key}</span>
              <span className="text-xs text-muted-foreground font-mono">
                {key === 'uppercase' && 'A-Z'}
                {key === 'lowercase' && 'a-z'}
                {key === 'numbers' && '0-9'}
                {key === 'symbols' && '!@#$%'}
              </span>
            </label>
          ))}
        </div>

        <Button onClick={handleGenerate} disabled={!hasAnyCharSet} className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Generate Password
        </Button>

        {!hasAnyCharSet && (
          <p className="text-destructive text-sm text-center">
            Please select at least one character set
          </p>
        )}

        {passwords.length > 0 && (
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {passwords.map((password, index) => {
              const strength = calculateStrength(password, options)
              return (
                <div
                  key={`${password}-${index}`}
                  className="bg-muted/50 p-3 rounded-md group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <code className="font-mono text-sm select-all break-all">{password}</code>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CopyButton text={password} />
                      <Button variant="ghost" size="sm" onClick={() => removePassword(index)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${strength.color}`}
                        style={{ width: `${(strength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{strength.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {passwords.length === 0 && hasAnyCharSet && (
          <div className="text-center py-8 text-muted-foreground">
            Click generate to create a password
          </div>
        )}
      </div>
    </ToolLayout>
  )
}
