import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export function RejectEdge(props: EdgeProps) {
  const {
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition, id,
  } = props

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    offset: 50,
  })

  const markerId = `reject-arrow-${id}`

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L7,3 L0,6" fill="none" stroke="var(--ai-warning)" strokeWidth="1.2" strokeLinecap="round" />
        </marker>
        <linearGradient id={`reject-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--ai-warning)" stopOpacity="0.7" />
          <stop offset="50%" stopColor="var(--ai-warning)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--ai-warning)" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Soft glow */}
      <path d={edgePath} fill="none" stroke="var(--ai-warning)" strokeWidth="6" strokeOpacity="0.08" />

      {/* Main path */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: 'var(--ai-warning)',
          strokeWidth: 1.5,
          strokeDasharray: '5 4',
          strokeLinecap: 'round',
        }}
        markerEnd={`url(#${markerId})`}
      />

      {/* Label */}
      <foreignObject x={labelX - 26} y={labelY - 11} width={52} height={22}
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <div style={{
          fontSize: 9, fontWeight: 600, fontFamily: 'var(--ai-mono)',
          color: 'var(--ai-warning)', textAlign: 'center', lineHeight: '22px',
          background: 'var(--ai-surface-1)', borderRadius: 4,
          border: '1px solid var(--ai-warning-subtle)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          reject
        </div>
      </foreignObject>
    </>
  )
}
