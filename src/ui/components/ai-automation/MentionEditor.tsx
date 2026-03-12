import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { FolderOpen } from 'lucide-react'

const MENTION_ATTR = 'data-mention-id'

export interface MentionEditorHandle {
  getPlainText: () => string
  hydrateText: (text: string, labels: Set<string>) => void
  clear: () => void
}

interface MentionEditorProps {
  placeholder?: string
  className?: string
  minHeight?: string
  onProjectTagged?: (dir: DirectorySettings) => void
  onProjectRemoved?: (label: string) => void
  /** Already-tagged project paths to exclude from the dropdown */
  excludeProjectPaths?: Set<string>
}

function getPlainText(el: HTMLElement): string {
  let text = ''
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    } else if (node instanceof HTMLElement) {
      if (node.hasAttribute(MENTION_ATTR)) {
        text += `@${node.textContent || ''}`
      } else if (node.tagName === 'BR') {
        text += '\n'
      } else {
        text += getPlainText(node)
      }
    }
  }
  return text
}

function createChipElement(label: string): HTMLSpanElement {
  const chip = document.createElement('span')
  chip.setAttribute(MENTION_ATTR, label)
  chip.setAttribute('contenteditable', 'false')
  chip.className = 'inline-flex items-center gap-0.5 px-1.5 py-0 rounded border text-xs mx-0.5 align-baseline cursor-default select-none'
  chip.style.background = 'var(--ai-accent-subtle)'
  chip.style.borderColor = 'var(--ai-accent)'
  chip.style.color = 'var(--ai-accent)'
  chip.textContent = label
  return chip
}

export const MentionEditor = forwardRef<MentionEditorHandle, MentionEditorProps>(
  ({ placeholder, className, minHeight = '100px', onProjectTagged, onProjectRemoved, excludeProjectPaths }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const [directories, setDirectories] = useState<DirectorySettings[]>([])
    const [showMention, setShowMention] = useState(false)
    const [mentionFilter, setMentionFilter] = useState('')
    const [mentionIndex, setMentionIndex] = useState(0)

    useEffect(() => {
      window.electron.getDirectories().then(setDirectories)
    }, [])

    useEffect(() => {
      if (!showMention || !menuRef.current) return
      const activeItem = menuRef.current.children[mentionIndex] as HTMLElement | undefined
      if (activeItem) activeItem.scrollIntoView({ block: 'nearest' })
    }, [mentionIndex, showMention])

    const filteredDirs = directories.filter(d => {
      const label = d.customLabel || d.name
      return label.toLowerCase().includes(mentionFilter.toLowerCase()) &&
        !(excludeProjectPaths?.has(d.path))
    })

    useImperativeHandle(ref, () => ({
      getPlainText: () => editorRef.current ? getPlainText(editorRef.current) : '',
      hydrateText: (text: string, labels: Set<string>) => {
        const el = editorRef.current
        if (!el) return
        while (el.firstChild) el.removeChild(el.firstChild)
        if (labels.size === 0) {
          el.appendChild(document.createTextNode(text))
          return
        }
        const sorted = [...labels].sort((a, b) => b.length - a.length)
        let remaining = text
        while (remaining.length > 0) {
          const atIdx = remaining.indexOf('@')
          if (atIdx === -1) {
            el.appendChild(document.createTextNode(remaining))
            break
          }
          const afterAt = remaining.slice(atIdx + 1)
          const matched = sorted.find(l => afterAt.startsWith(l))
          if (matched) {
            if (atIdx > 0) el.appendChild(document.createTextNode(remaining.slice(0, atIdx)))
            el.appendChild(createChipElement(matched))
            remaining = remaining.slice(atIdx + 1 + matched.length)
          } else {
            el.appendChild(document.createTextNode(remaining.slice(0, atIdx + 1)))
            remaining = remaining.slice(atIdx + 1)
          }
        }
      },
      clear: () => {
        if (editorRef.current) {
          while (editorRef.current.firstChild) editorRef.current.removeChild(editorRef.current.firstChild)
        }
      }
    }))

    const insertMention = (dir: DirectorySettings) => {
      const editor = editorRef.current
      if (!editor) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return

      const range = sel.getRangeAt(0)
      const textNode = range.startContainer
      if (textNode.nodeType !== Node.TEXT_NODE) return

      const text = textNode.textContent || ''
      const cursorOffset = range.startOffset
      const textBefore = text.slice(0, cursorOffset)
      const atIndex = textBefore.lastIndexOf('@')
      if (atIndex === -1) return

      const beforeText = text.slice(0, atIndex)
      const afterText = text.slice(cursorOffset)
      const label = dir.customLabel || dir.name
      const chip = createChipElement(label)
      const parent = textNode.parentNode!

      const beforeNode = document.createTextNode(beforeText)
      const afterNode = document.createTextNode('\u00A0' + afterText)

      parent.insertBefore(beforeNode, textNode)
      parent.insertBefore(chip, textNode)
      parent.insertBefore(afterNode, textNode)
      parent.removeChild(textNode)

      if (afterNode.textContent && afterNode.textContent.length > 0) {
        const newSel = window.getSelection()
        if (newSel) {
          const newRange = document.createRange()
          newRange.setStart(afterNode, 1)
          newRange.collapse(true)
          newSel.removeAllRanges()
          newSel.addRange(newRange)
        }
      }

      setShowMention(false)
      setMentionFilter('')
      onProjectTagged?.(dir)
      setTimeout(() => editor.focus(), 0)
    }

    const handleInput = () => {
      const editor = editorRef.current
      if (!editor) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return

      const range = sel.getRangeAt(0)
      const textNode = range.startContainer
      if (textNode.nodeType !== Node.TEXT_NODE) {
        setShowMention(false)
        return
      }

      const text = textNode.textContent || ''
      const cursorOffset = range.startOffset
      const textBefore = text.slice(0, cursorOffset)
      const atIndex = textBefore.lastIndexOf('@')

      if (atIndex !== -1) {
        const query = textBefore.slice(atIndex + 1)
        const charBeforeAt = atIndex > 0 ? text[atIndex - 1] : ' '
        if ((charBeforeAt === ' ' || charBeforeAt === '\u00A0' || charBeforeAt === '\n' || atIndex === 0) && !query.includes(' ')) {
          setShowMention(true)
          setMentionFilter(query)
          setMentionIndex(0)
          return
        }
      }
      setShowMention(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (showMention && filteredDirs.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setMentionIndex(prev => (prev + 1) % filteredDirs.length)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setMentionIndex(prev => (prev - 1 + filteredDirs.length) % filteredDirs.length)
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault()
          insertMention(filteredDirs[mentionIndex])
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setShowMention(false)
        }
        return
      }

      if (e.key === 'Backspace') {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        if (!range.collapsed) return
        const node = range.startContainer
        const offset = range.startOffset

        if (node.nodeType === Node.TEXT_NODE && offset === 0) {
          const prev = node.previousSibling
          if (prev instanceof HTMLElement && prev.hasAttribute(MENTION_ATTR)) {
            e.preventDefault()
            const label = prev.getAttribute(MENTION_ATTR) || ''
            prev.remove()
            onProjectRemoved?.(label)
            return
          }
        }
        if (node === editorRef.current && offset > 0) {
          const prev = node.childNodes[offset - 1]
          if (prev instanceof HTMLElement && prev.hasAttribute(MENTION_ATTR)) {
            e.preventDefault()
            const label = prev.getAttribute(MENTION_ATTR) || ''
            prev.remove()
            onProjectRemoved?.(label)
            return
          }
        }
      }
    }

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      document.execCommand('insertText', false, text)
    }

    return (
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          data-placeholder={placeholder}
          className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:pointer-events-none ${className || ''}`}
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight, borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-2)', color: 'var(--ai-text-primary)', '--tw-ring-color': 'var(--ai-border)' } as React.CSSProperties}
        />
        {showMention && filteredDirs.length > 0 && (
          <div
            ref={menuRef}
            className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto rounded-md border shadow-lg"
            style={{ borderColor: 'var(--ai-border-subtle)', background: 'var(--ai-surface-1)' }}
          >
            {filteredDirs.map((dir, i) => (
              <button
                key={dir.id}
                onMouseDown={e => { e.preventDefault(); insertMention(dir) }}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors"
                style={{
                  background: i === mentionIndex ? 'var(--ai-surface-3)' : undefined,
                  color: i === mentionIndex ? 'var(--ai-text-primary)' : 'var(--ai-text-secondary)',
                }}
              >
                <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{dir.customLabel || dir.name}</p>
                  <p className="truncate text-[11px]" style={{ color: 'var(--ai-text-tertiary)' }}>{dir.path}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }
)
