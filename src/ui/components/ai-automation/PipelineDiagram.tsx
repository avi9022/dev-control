import { useState, useCallback, useEffect, useRef, useMemo, type FC } from 'react'
import {
  ReactFlow,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type NodeTypes,
  type EdgeTypes,
  type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PhaseNode } from './PhaseNode'
import { RejectEdge } from './RejectEdge'
import { PhaseEditDialog } from './PhaseEditDialog'
import { PHASE_TEMPLATES } from './pipeline-constants'
import { Plus } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Inline node types                                                  */
/* ------------------------------------------------------------------ */

interface EndpointNodeData extends Record<string, unknown> {
  label: string
}

type EndpointNodeType = Node<EndpointNodeData, 'endpoint'>

function EndpointNode({ data }: NodeProps<EndpointNodeType>) {
  const isBacklog = data.label === 'Backlog'
  return (
    <div style={{
      padding: '10px 22px',
      borderRadius: 20,
      background: 'var(--ai-surface-3)',
      color: 'var(--ai-text-tertiary)',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      border: '1px solid var(--ai-border-subtle)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    }}>
      {data.label}
      {isBacklog && (
        <Handle type="source" position={Position.Right} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--ai-surface-3)', border: '2px solid var(--ai-border)',
        }} />
      )}
      {!isBacklog && (
        <Handle type="target" position={Position.Left} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--ai-surface-3)', border: '2px solid var(--ai-border)',
        }} />
      )}
    </div>
  )
}

// Flow edge with "+" add button at midpoint — menu is rendered by parent PipelineDiagram
function FlowEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, data } = props

  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2
  const path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`

  const edgeData = data as { insertIndex: number; onOpenMenu: (index: number, x: number, y: number) => void }

  return (
    <>
      <path d={path} fill="none" stroke="var(--ai-text-tertiary)" strokeWidth={2} markerEnd="url(#flow-arrow)" />

      <foreignObject
        x={midX - 20} y={midY - 15} width={40} height={30}
        requiredExtensions="http://www.w3.org/1999/xhtml"
        style={{ overflow: 'visible' }}
      >
        <div style={{ width: 40, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            className="pipeline-add-btn"
            onPointerDown={(e) => {
              e.stopPropagation()
              // Use client coordinates directly — reliable regardless of SVG transforms
              edgeData.onOpenMenu(edgeData.insertIndex, e.clientX, e.clientY + 20)
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      </foreignObject>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Node / edge type registries                                        */
/* ------------------------------------------------------------------ */

const nodeTypes: NodeTypes = {
  phase: PhaseNode,
  endpoint: EndpointNode,
} as unknown as NodeTypes

const edgeTypes: EdgeTypes = {
  flow: FlowEdge,
  reject: RejectEdge,
} as unknown as EdgeTypes

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const NODE_SPACING = 280

/* ------------------------------------------------------------------ */
/*  PipelineDiagram                                                    */
/* ------------------------------------------------------------------ */

interface PipelineDiagramProps {
  settings: AIAutomationSettings
  updateSettings: (updates: Partial<AIAutomationSettings>) => void
  themeClass: string
}

export const PipelineDiagram: FC<PipelineDiagramProps> = ({
  settings,
  updateSettings,
  themeClass,
}) => {
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)
  const [addMenu, setAddMenu] = useState<{ insertIndex: number; pos: { top: number; left: number } } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const addMenuRef = useRef<HTMLDivElement>(null)

  const onOpenAddMenu = useCallback((insertIndex: number, x: number, y: number) => {
    // Convert viewport coords to container-relative coords
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setAddMenu({ insertIndex, pos: { top: y - rect.top, left: x - rect.left } })
    }
  }, [])

  // Close add menu on any outside click
  useEffect(() => {
    if (!addMenu) return
    const close = (e: PointerEvent) => {
      // Don't close if clicking inside the menu
      if (addMenuRef.current && addMenuRef.current.contains(e.target as Node)) return
      setAddMenu(null)
    }
    const timer = setTimeout(() => window.addEventListener('pointerdown', close, true), 10)
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', close, true) }
  }, [addMenu])

  const activeBoard = settings.boards?.find(b => b.id === settings.activeBoardId)
  const pipeline = useMemo(() => activeBoard?.pipeline || [], [activeBoard?.pipeline])

  const updateBoardPipeline = useCallback((next: AIPipelinePhase[]) => {
    if (!activeBoard) return
    const updatedBoards = (settings.boards || []).map(b =>
      b.id === activeBoard.id ? { ...b, pipeline: next } : b
    )
    updateSettings({ boards: updatedBoards })
  }, [activeBoard, settings.boards, updateSettings])

  /* ---- mutation helpers ---- */

  const addPhaseAt = useCallback(
    (index: number, templateId: string) => {
      const template = PHASE_TEMPLATES.find((t) => t.id === templateId)
      if (!template) return
      const newPhase: AIPipelinePhase = {
        id: crypto.randomUUID(),
        name: template.label,
        type: 'agent',
        prompt: template.prompt,
        roles: template.roles.length > 0 ? [...template.roles] : undefined,
        color: template.color,
      }
      const next = [...pipeline]
      next.splice(index, 0, newPhase)
      updateBoardPipeline(next)
      setEditingPhaseId(newPhase.id)
    },
    [pipeline, updateBoardPipeline],
  )

  const updatePhase = useCallback(
    (id: string, updates: Partial<AIPipelinePhase>) => {
      const next = pipeline.map((p) => (p.id === id ? { ...p, ...updates } : p))
      updateBoardPipeline(next)
    },
    [pipeline, updateBoardPipeline],
  )

  const deletePhase = useCallback(
    (id: string) => {
      // Also clear any rejectTarget pointing to this phase
      const next = pipeline
        .filter((p) => p.id !== id)
        .map((p) => (p.rejectTarget === id ? { ...p, rejectTarget: undefined, rejectPattern: undefined } : p))
      updateBoardPipeline(next)
      setEditingPhaseId(null)
    },
    [pipeline, updateBoardPipeline],
  )

  /* ---- build nodes/edges from pipeline ---- */

  const buildNodes = useCallback((): Node[] => {
    const result: Node[] = []

    result.push({
      id: 'backlog',
      type: 'endpoint',
      position: { x: 0, y: 0 },
      draggable: false,
      data: { label: 'Backlog' },
    })

    pipeline.forEach((phase, i) => {
      result.push({
        id: phase.id,
        type: 'phase',
        position: { x: (i + 1) * NODE_SPACING, y: 0 },
        draggable: true,
        data: { phase, onEdit: (id: string) => setEditingPhaseId(id) },
      })
    })

    result.push({
      id: 'done',
      type: 'endpoint',
      position: { x: (pipeline.length + 1) * NODE_SPACING, y: 0 },
      draggable: false,
      data: { label: 'Done' },
    })

    return result
  }, [pipeline])

  const buildEdges = useCallback((): Edge[] => {
    const result: Edge[] = []

    const mainIds = ['backlog', ...pipeline.map((p) => p.id), 'done']
    for (let i = 0; i < mainIds.length - 1; i++) {
      result.push({
        id: `flow-${mainIds[i]}-${mainIds[i + 1]}`,
        source: mainIds[i],
        target: mainIds[i + 1],
        type: 'flow',
        data: { insertIndex: i, onOpenMenu: onOpenAddMenu },
      })
    }

    pipeline.forEach((phase) => {
      if (phase.rejectTarget) {
        result.push({
          id: `reject-${phase.id}`,
          source: phase.id,
          sourceHandle: 'reject',
          target: phase.rejectTarget,
          type: 'reject',
        })
      }
    })

    return result
  }, [pipeline, onOpenAddMenu])

  // React Flow owns node/edge state — we sync from pipeline on changes
  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes())
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges())
  const pipelineRef = useRef(pipeline)

  useEffect(() => {
    // Only rebuild when the pipeline actually changed (not during drag)
    if (pipelineRef.current !== pipeline) {
      pipelineRef.current = pipeline
      setNodes(buildNodes())
      setEdges(buildEdges())
    }
  }, [pipeline, buildNodes, buildEdges, setNodes, setEdges])

  /* ---- drag reorder ---- */

  const dragIndexRef = useRef<{ from: number; to: number } | null>(null)

  const calcDropIndex = useCallback((draggedId: string, draggedX: number) => {
    const currentIndex = pipeline.findIndex((p) => p.id === draggedId)
    if (currentIndex === -1) return currentIndex

    // Find which slot the dragged node is closest to
    let newIndex = 0
    let minDist = Infinity
    for (let i = 0; i < pipeline.length; i++) {
      const slotX = (i + 1) * NODE_SPACING
      const dist = Math.abs(draggedX - slotX)
      if (dist < minDist) {
        minDist = dist
        newIndex = i
      }
    }
    return newIndex
  }, [pipeline])

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== 'phase') return

      const currentIndex = pipeline.findIndex((p) => p.id === node.id)
      if (currentIndex === -1) return

      const newIndex = calcDropIndex(node.id, node.position.x)
      if (newIndex === currentIndex) {
        // Reset — no swap preview needed
        if (dragIndexRef.current) {
          dragIndexRef.current = null
          // Restore other nodes to their original positions
          setNodes((nds) =>
            nds.map((n) => {
              if (n.type !== 'phase' || n.id === node.id) return n
              const idx = pipeline.findIndex((p) => p.id === n.id)
              if (idx === -1) return n
              return { ...n, position: { ...n.position, x: (idx + 1) * NODE_SPACING } }
            })
          )
        }
        return
      }

      // Preview: shift other phase nodes to show where things will land
      dragIndexRef.current = { from: currentIndex, to: newIndex }

      // Build the preview order (without the dragged node, then insert at newIndex)
      const previewOrder = pipeline.filter((_, i) => i !== currentIndex)
      previewOrder.splice(newIndex, 0, pipeline[currentIndex])

      setNodes((nds) =>
        nds.map((n) => {
          if (n.type !== 'phase' || n.id === node.id) return n
          const previewIdx = previewOrder.findIndex((p) => p.id === n.id)
          if (previewIdx === -1) return n
          return {
            ...n,
            position: { ...n.position, x: (previewIdx + 1) * NODE_SPACING },
          }
        })
      )
    },
    [pipeline, calcDropIndex, setNodes],
  )

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== 'phase') return
      dragIndexRef.current = null

      const currentIndex = pipeline.findIndex((p) => p.id === node.id)
      if (currentIndex === -1) return

      const newIndex = calcDropIndex(node.id, node.position.x)

      if (newIndex !== currentIndex) {
        const next = [...pipeline]
        const [moved] = next.splice(currentIndex, 1)
        next.splice(newIndex, 0, moved)
        updateBoardPipeline(next)
      } else {
        // Snap back to original position
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== node.id) return n
            return { ...n, position: { ...n.position, x: (currentIndex + 1) * NODE_SPACING } }
          })
        )
      }
    },
    [pipeline, updateBoardPipeline, calcDropIndex, setNodes],
  )

  /* ---- drag to connect (reject routing) ---- */

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.sourceHandle !== 'reject') return
      const sourceId = connection.source
      const targetId = connection.target
      if (!sourceId || !targetId) return
      if (['backlog', 'done'].includes(targetId)) return
      // Also disallow connecting to add buttons
      if (targetId.startsWith('add-')) return

      const next = pipeline.map((p) => {
        if (p.id === sourceId) {
          return {
            ...p,
            rejectTarget: targetId,
            rejectPattern: p.rejectPattern || 'REVIEW_DECISION: REJECT',
          }
        }
        return p
      })
      updateBoardPipeline(next)
    },
    [pipeline, updateBoardPipeline],
  )

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      let next = [...pipeline]
      for (const edge of deletedEdges) {
        if (edge.type === 'reject' || edge.sourceHandle === 'reject') {
          next = next.map((p) =>
            p.id === edge.source
              ? { ...p, rejectTarget: undefined, rejectPattern: undefined }
              : p,
          )
        }
      }
      updateBoardPipeline(next)
    },
    [pipeline, updateBoardPipeline],
  )

  const isValidConnection = useCallback((connection: Connection) => {
    return (
      connection.sourceHandle === 'reject' &&
      !['backlog', 'done'].includes(connection.target || '') &&
      !(connection.target || '').startsWith('add-')
    )
  }, [])

  /* ---- edit dialog phase lookup ---- */

  const editingPhase = editingPhaseId
    ? pipeline.find((p) => p.id === editingPhaseId) || null
    : null

  return (
    <div ref={containerRef} className={themeClass} style={{
      height: '100%', width: '100%', overflow: 'hidden', position: 'relative',
      borderTop: '1px solid var(--ai-border-subtle)',
      backgroundImage: `radial-gradient(circle, var(--ai-border) 1px, transparent 1px)`,
      backgroundSize: '20px 20px',
      backgroundColor: 'var(--ai-surface-0)',
    }}>
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker id="flow-arrow" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6 Z" fill="var(--ai-text-tertiary)" />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        isValidConnection={isValidConnection}
        fitView
        proOptions={{ hideAttribution: true }}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnDrag={true}
        style={{ background: 'transparent' }}
      />

      {/* Add phase template menu — rendered outside ReactFlow so it's above nodes */}
      {addMenu && (
        <div
          ref={addMenuRef}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: addMenu.pos.top,
            left: addMenu.pos.left,
            transform: 'translateX(-50%)',
            background: 'var(--ai-surface-1)',
            border: '1px solid var(--ai-border-subtle)',
            borderRadius: 10,
            padding: 6,
            zIndex: 9999,
            minWidth: 160,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{
            fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--ai-text-tertiary)', padding: '4px 10px 6px',
          }}>
            Add Phase
          </div>
          {PHASE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => { addPhaseAt(addMenu.insertIndex, t.id); setAddMenu(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '7px 10px', borderRadius: 6, background: 'transparent',
                border: 'none', color: 'var(--ai-text-primary)', fontSize: 12,
                fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ai-surface-3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, background: t.color, flexShrink: 0 }} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      <PhaseEditDialog
        phase={editingPhase}
        allPhases={pipeline}
        open={!!editingPhase}
        onOpenChange={(open) => {
          if (!open) setEditingPhaseId(null)
        }}
        onUpdate={updatePhase}
        onDelete={deletePhase}
        themeClass={themeClass}
      />
    </div>
  )
}
