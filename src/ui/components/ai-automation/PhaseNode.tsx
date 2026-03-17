import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Bot, UserCheck } from 'lucide-react'

interface PhaseNodeData extends Record<string, unknown> {
  phase: AIPipelinePhase
  onEdit: (id: string) => void
}

export type PhaseNodeType = Node<PhaseNodeData, 'phase'>

export function PhaseNode({ data, selected }: NodeProps<PhaseNodeType>) {
  const { phase, onEdit } = data
  const color = phase.color || '#7C8894'
  const isAgent = phase.type === 'agent'

  return (
    <div
      onClick={() => onEdit(phase.id)}
      style={{
        minWidth: 170,
        padding: '14px 16px',
        borderRadius: 10,
        background: `linear-gradient(135deg, var(--ai-surface-2) 0%, color-mix(in srgb, ${color} 6%, var(--ai-surface-2)) 100%)`,
        border: selected ? `1.5px solid ${color}` : '1px solid var(--ai-border-subtle)',
        borderTop: `3px solid ${color}`,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        boxShadow: selected
          ? `0 0 0 1px ${color}40, 0 4px 12px rgba(0,0,0,0.2)`
          : '0 2px 8px rgba(0,0,0,0.12)',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.boxShadow = `0 0 0 1px ${color}30, 0 4px 14px rgba(0,0,0,0.18)`
        e.currentTarget.style.borderColor = color
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'
          e.currentTarget.style.borderColor = 'var(--ai-border-subtle)'
        }
      }}
    >
      {/* Phase name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6,
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {isAgent
            ? <Bot size={12} style={{ color }} />
            : <UserCheck size={12} style={{ color }} />
          }
        </div>
        <span style={{
          fontSize: 13, fontWeight: 600, color: 'var(--ai-text-primary)',
          letterSpacing: '-0.01em', lineHeight: 1.2,
        }}>
          {phase.name}
        </span>
      </div>

      {/* Type label */}
      <div style={{
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em',
          color: `color-mix(in srgb, ${color} 70%, var(--ai-text-secondary))`,
        }}>
          {phase.type}
        </span>
        {phase.rejectPattern && (
          <span style={{
            fontSize: 9, fontWeight: 500, padding: '1px 5px', borderRadius: 4,
            background: 'var(--ai-warning-subtle)', color: 'var(--ai-warning)',
            letterSpacing: '0.03em',
          }}>
            routing
          </span>
        )}
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} style={{
        width: 10, height: 10, borderRadius: '50%',
        background: 'var(--ai-surface-3)', border: `2px solid var(--ai-border)`,
        transition: 'border-color 0.15s',
      }} />
      <Handle type="source" position={Position.Right} style={{
        width: 10, height: 10, borderRadius: '50%',
        background: 'var(--ai-surface-3)', border: `2px solid var(--ai-border)`,
        transition: 'border-color 0.15s',
      }} />

      {/* Reject port — bottom, only for agent phases */}
      {isAgent && (
        <Handle type="source" position={Position.Bottom} id="reject" style={{
          width: 10, height: 10, borderRadius: '50%',
          background: 'var(--ai-warning-subtle)', border: '2px solid var(--ai-warning)',
          bottom: -5,
        }} />
      )}
    </div>
  )
}
