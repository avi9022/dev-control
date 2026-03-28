import { useState, type FC } from 'react'
import { ToolLayout } from './shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CopyButton } from './shared/CopyButton'
import { RefreshCw, Trash2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

export const UuidGenerator: FC = () => {
  const [uuids, setUuids] = useState<string[]>([])
  const [count, setCount] = useState(1)

  const generateUuids = () => {
    const newUuids: string[] = []
    for (let i = 0; i < count; i++) {
      newUuids.push(uuidv4())
    }
    setUuids((prev) => [...newUuids, ...prev])
  }

  const clearAll = () => {
    setUuids([])
  }

  const removeUuid = (index: number) => {
    setUuids((prev) => prev.filter((_, i) => i !== index))
  }

  const copyAll = () => {
    navigator.clipboard.writeText(uuids.join('\n'))
  }

  return (
    <ToolLayout
      title="UUID Generator"
      description="Generate random UUIDs (v4)"
      actions={
        uuids.length > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={copyAll}>
              Copy All
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-24"
          />
          <Button onClick={generateUuids} className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate {count} UUID{count > 1 ? 's' : ''}
          </Button>
        </div>

        {uuids.length > 0 && (
          <div className="space-y-2 max-h-[400px] overflow-auto">
            {uuids.map((uuid, index) => (
              <div
                key={`${uuid}-${index}`}
                className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md font-mono text-sm group"
              >
                <span className="select-all">{uuid}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton text={uuid} />
                  <Button variant="ghost" size="sm" onClick={() => removeUuid(index)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {uuids.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Click generate to create UUIDs
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>Generated UUIDs use the v4 (random) format.</p>
          <p>Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx</p>
        </div>
      </div>
    </ToolLayout>
  )
}
