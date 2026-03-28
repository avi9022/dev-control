import { type FC } from 'react'
import { type DiffFile } from './diff-parser'
import { DiffLineRow } from './DiffLineRow'

export const UnifiedView: FC<{
  file: DiffFile
  qualifiedPath: string
  commentMap: Map<string, AIHumanComment[]>
  activeComment: string | null
  onStartComment: (key: string) => void
  onSubmitComment: (file: string, line: number, text: string) => void
  onCancelComment: () => void
  onDeleteComment: (commentId: string) => void
  onToggleResolved: (commentId: string) => void
  readOnly: boolean
}> = ({ file, qualifiedPath, commentMap, activeComment, onStartComment, onSubmitComment, onCancelComment, onDeleteComment, onToggleResolved, readOnly }) => {
  const filePath = qualifiedPath
  return (
    <div className="font-mono text-xs leading-5">
      {file.hunks.map((hunk, hi) => (
        <div key={hi}>
          <div
            className="px-4 py-0.5 select-none border-y"
            style={{ background: 'var(--ai-accent-subtle)', color: 'var(--ai-accent)', borderColor: 'var(--ai-border-subtle)' }}
          >
            {hunk.header}
          </div>
          {hunk.lines.map((line, li) => (
            <DiffLineRow
              key={li}
              line={line}
              filePath={filePath}
              commentMap={commentMap}
              activeComment={activeComment}
              onStartComment={onStartComment}
              onSubmitComment={onSubmitComment}
              onCancelComment={onCancelComment}
              onDeleteComment={onDeleteComment}
              onToggleResolved={onToggleResolved}
              readOnly={readOnly}
            >
              <span
                className="w-12 text-right pr-2 select-none shrink-0 border-r"
                style={{ color: 'var(--ai-text-tertiary)', borderColor: 'var(--ai-border-subtle)' }}
              >
                {line.oldLineNum ?? ''}
              </span>
              <span
                className="w-12 text-right pr-2 select-none shrink-0 border-r"
                style={{ color: 'var(--ai-text-tertiary)', borderColor: 'var(--ai-border-subtle)' }}
              >
                {line.newLineNum ?? ''}
              </span>
              <span
                className="w-4 text-center select-none shrink-0"
                style={{
                  color: line.type === 'added' ? 'var(--ai-diff-added-text)' :
                    line.type === 'removed' ? 'var(--ai-diff-removed-text)' : 'var(--ai-text-tertiary)'
                }}
              >
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="flex-1 px-2 whitespace-pre overflow-x-auto">{line.content}</span>
            </DiffLineRow>
          ))}
        </div>
      ))}
    </div>
  )
}
