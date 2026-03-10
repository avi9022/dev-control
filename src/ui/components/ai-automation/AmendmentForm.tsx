import { useState, useRef, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MentionEditor, type MentionEditorHandle } from './MentionEditor'
import { Send } from 'lucide-react'

interface AmendmentFormProps {
  pipeline: AIPipelinePhase[]
  onSubmit: (text: string, targetPhase: string) => Promise<void>
  onCancel?: () => void
  excludeProjectPaths?: Set<string>
  defaultPhase?: string
}

export const AmendmentForm: FC<AmendmentFormProps> = ({ pipeline, onSubmit, onCancel, excludeProjectPaths, defaultPhase }) => {
  const editorRef = useRef<MentionEditorHandle>(null)
  const [targetPhase, setTargetPhase] = useState<string>(defaultPhase || pipeline[0]?.id || '')
  const [submitting, setSubmitting] = useState(false)

  const phases = pipeline.filter(p => p.id !== 'BACKLOG' && p.id !== 'DONE')

  const handleSubmit = async () => {
    const text = editorRef.current?.getPlainText().trim()
    if (!text || !targetPhase) return
    setSubmitting(true)
    try {
      await onSubmit(text, targetPhase)
      editorRef.current?.clear()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-neutral-400 mb-1 block">New Requirement</label>
        <MentionEditor
          ref={editorRef}
          placeholder="Describe the new requirement... Type @ to tag a project"
          minHeight="80px"
          excludeProjectPaths={excludeProjectPaths}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-400 mb-1 block">Send to Phase</label>
        <Select value={targetPhase} onValueChange={setTargetPhase}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select phase..." />
          </SelectTrigger>
          <SelectContent>
            {phases.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        )}
        <Button size="sm" onClick={handleSubmit} disabled={submitting}>
          <Send className="h-3 w-3 mr-1" />
          {submitting ? 'Submitting...' : 'Submit Amendment'}
        </Button>
      </div>
    </div>
  )
}
