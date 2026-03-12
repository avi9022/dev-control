import { type FC, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewerProps {
  content: string
  className?: string
}

export const MarkdownViewer: FC<MarkdownViewerProps> = ({ content, className }) => {
  return (
    <div className={`ai-markdown ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children, ...props }: ComponentPropsWithoutRef<'pre'>) => (
            <pre
              style={{
                background: 'var(--ai-surface-0)',
                border: '1px solid var(--ai-border-subtle)',
                borderRadius: '6px',
                padding: '12px',
                overflowX: 'auto',
              }}
              {...props}
            >
              {children}
            </pre>
          ),
          code: ({ children, className: codeClassName, ...props }: ComponentPropsWithoutRef<'code'>) => {
            const isBlock = codeClassName?.startsWith('language-')
            if (isBlock) {
              return (
                <code
                  className={codeClassName}
                  style={{ fontFamily: 'var(--ai-mono)', fontSize: '12px', color: 'var(--ai-text-primary)' }}
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code
                style={{
                  fontFamily: 'var(--ai-mono)',
                  fontSize: '0.85em',
                  background: 'var(--ai-surface-3)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  color: 'var(--ai-accent)',
                }}
                {...props}
              >
                {children}
              </code>
            )
          },
          a: ({ children, href, ...props }: ComponentPropsWithoutRef<'a'>) => (
            <a
              href={href}
              style={{ color: 'var(--ai-accent)', textDecoration: 'underline', cursor: 'pointer' }}
              onClick={(e) => {
                e.preventDefault()
                if (href) window.electron.openExternalUrl(href)
              }}
              {...props}
            >
              {children}
            </a>
          ),
          table: ({ children, ...props }: ComponentPropsWithoutRef<'table'>) => (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{ borderCollapse: 'collapse', width: '100%' }}
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }: ComponentPropsWithoutRef<'th'>) => (
            <th
              style={{
                border: '1px solid var(--ai-border-subtle)',
                padding: '6px 10px',
                textAlign: 'left',
                fontWeight: 600,
                background: 'var(--ai-surface-2)',
                color: 'var(--ai-text-primary)',
              }}
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }: ComponentPropsWithoutRef<'td'>) => (
            <td
              style={{
                border: '1px solid var(--ai-border-subtle)',
                padding: '6px 10px',
                color: 'var(--ai-text-secondary)',
              }}
              {...props}
            >
              {children}
            </td>
          ),
          blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => (
            <blockquote
              style={{
                borderLeft: '3px solid var(--ai-accent)',
                paddingLeft: '12px',
                margin: '8px 0',
                color: 'var(--ai-text-secondary)',
                fontStyle: 'italic',
              }}
              {...props}
            >
              {children}
            </blockquote>
          ),
          hr: (props: ComponentPropsWithoutRef<'hr'>) => (
            <hr style={{ border: 'none', borderTop: '1px solid var(--ai-border-subtle)', margin: '16px 0' }} {...props} />
          ),
          input: ({ ...props }: ComponentPropsWithoutRef<'input'>) => (
            <input disabled {...props} style={{ marginRight: '6px', accentColor: 'var(--ai-accent)' }} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
