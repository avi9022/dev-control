import { useState, useEffect, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Save, Trash2, Plus, AlertTriangle, Wand2 } from 'lucide-react'
import Editor from '@monaco-editor/react'

interface ItemEditorProps {
  open: boolean
  onClose: () => void
  item: Record<string, unknown> | null
  tableInfo: DynamoDBTableInfo | null
  mode: 'view' | 'edit' | 'create'
  onSave: (item: Record<string, unknown>) => Promise<void>
  onDelete: (key: Record<string, unknown>) => Promise<void>
}

export const ItemEditor: FC<ItemEditorProps> = ({
  open,
  onClose,
  item,
  tableInfo,
  mode,
  onSave,
  onDelete,
}) => {
  const [jsonValue, setJsonValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (open) {
      if (mode === 'create') {
        // Pre-populate with key schema for new items
        const template: Record<string, unknown> = {}
        tableInfo?.keySchema.forEach(key => {
          const attr = tableInfo.attributeDefinitions.find(a => a.attributeName === key.attributeName)
          template[key.attributeName] = attr?.attributeType === 'N' ? 0 : ''
        })
        setJsonValue(JSON.stringify(template, null, 2))
      } else if (item) {
        setJsonValue(JSON.stringify(item, null, 2))
      }
      setError(null)
    }
  }, [open, item, mode, tableInfo])

  const getItemKey = (itemData: Record<string, unknown>): Record<string, unknown> => {
    const key: Record<string, unknown> = {}
    tableInfo?.keySchema.forEach(k => {
      key[k.attributeName] = itemData[k.attributeName]
    })
    return key
  }

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonValue)
      setJsonValue(JSON.stringify(parsed, null, 2))
      setError(null)
    } catch {
      setError('Invalid JSON - cannot format')
    }
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)

    try {
      const parsed = JSON.parse(jsonValue)

      // Validate required keys are present
      for (const key of tableInfo?.keySchema || []) {
        if (parsed[key.attributeName] === undefined || parsed[key.attributeName] === '') {
          throw new Error(`Missing required key: ${key.attributeName}`)
        }
      }

      await onSave(parsed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!item) return

    setSaving(true)
    try {
      await onDelete(getItemKey(item))
      setShowDeleteConfirm(false)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  const pkName = tableInfo?.keySchema.find(k => k.keyType === 'HASH')?.attributeName
  const skName = tableInfo?.keySchema.find(k => k.keyType === 'RANGE')?.attributeName

  const title = mode === 'create'
    ? 'Create New Item'
    : mode === 'edit'
      ? 'Edit Item'
      : 'View Item'

  const keyDisplay = item && pkName
    ? `${pkName}=${JSON.stringify(item[pkName])}${skName ? `, ${skName}=${JSON.stringify(item[skName])}` : ''}`
    : null

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="sm:max-w-[700px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {mode === 'create' && <Plus className="h-4 w-4" />}
              {title}
            </SheetTitle>
            {keyDisplay && (
              <SheetDescription className="font-mono text-xs">
                {keyDisplay}
              </SheetDescription>
            )}
          </SheetHeader>

          <div className="flex-1 py-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm">Item JSON</Label>
              <div className="flex items-center gap-2">
                {error && (
                  <span className="text-xs text-destructive">{error}</span>
                )}
                {mode !== 'view' && (
                  <Button variant="ghost" size="sm" onClick={handleFormat}>
                    <Wand2 className="h-3 w-3 mr-1" />
                    Format
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 border rounded-md overflow-hidden">
              <Editor
                height="100%"
                defaultLanguage="json"
                value={jsonValue}
                onChange={(value) => setJsonValue(value || '')}
                theme="vs-dark"
                options={{
                  readOnly: mode === 'view',
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  tabSize: 2,
                  wordWrap: 'on',
                  automaticLayout: true,
                  formatOnPaste: true,
                  folding: true,
                }}
              />
            </div>
          </div>

          <SheetFooter className="flex-row gap-2 sm:justify-between">
            {mode !== 'create' && mode !== 'view' && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={onClose}>
                {mode === 'view' ? 'Close' : 'Cancel'}
              </Button>
              {mode !== 'view' && (
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Delete
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {keyDisplay && (
            <div className="bg-muted p-3 rounded-md font-mono text-xs">
              {keyDisplay}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
