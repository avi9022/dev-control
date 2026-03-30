import { useEffect, useRef, useState, useCallback, type FC } from 'react'
import { TaskCard } from './TaskCard'

const CARD_WIDTH = 260
const CARD_GAP_X = 60
const CARD_GAP_Y = 10
const ANIMATION_STAGGER_MS = 60
const ANIMATION_DURATION_MS = 350
const DRAW_DELAY_BUFFER_MS = 80
const CONNECTOR_WIDTH = 2
const VIEWPORT_PADDING = 16
const BACKDROP_FADE_MS = 200
const BACKDROP_Z_INDEX = 100
const CONNECTOR_Z_INDEX = 101
const CARDS_Z_INDEX = 102

interface ClusterFlowOverlayProps {
  task: AITask
  anchorRect: DOMRect
  onSelectSubtask: (taskId: string, subtaskIndex: number) => void
  onDelete: (taskId: string) => void
  onClose: () => void
}

function subtaskToTask(subtask: AISubtask, parent: AITask, isActive: boolean): AITask {
  return {
    id: parent.id,
    title: subtask.title,
    description: subtask.description,
    boardId: parent.boardId,
    phase: subtask.phase,
    createdAt: subtask.createdAt,
    updatedAt: subtask.updatedAt,
    projects: parent.projects,
    worktrees: parent.worktrees,
    taskDirPath: subtask.taskDirPath || parent.taskDirPath,
    reviewComments: subtask.reviewComments,
    humanComments: subtask.humanComments,
    activeProcessPid: isActive ? parent.activeProcessPid : undefined,
    currentPhaseName: subtask.currentPhaseName,
    needsUserInput: subtask.needsUserInput,
    needsUserInputReason: subtask.needsUserInputReason,
    stallRetryCount: subtask.stallRetryCount,
    phaseHistory: subtask.phaseHistory,
    excludedFiles: subtask.excludedFiles,
    amendments: subtask.amendments,
    sessionId: subtask.sessionId,
  }
}

function clearSvgChildren(svg: SVGSVGElement): void {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild)
  }
}

export const ClusterFlowOverlay: FC<ClusterFlowOverlayProps> = ({ task, anchorRect, onSelectSubtask, onDelete, onClose }) => {
  const subtaskRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [closing, setClosing] = useState(false)
  const [animationReady, setAnimationReady] = useState(false)
  const offsetsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  const handleClose = useCallback((): void => {
    setClosing(true)
    setTimeout(onClose, BACKDROP_FADE_MS)
  }, [onClose])

  const handleEscape = useCallback((e: KeyboardEvent): void => {
    if (e.key === 'Escape') handleClose()
  }, [handleClose])

  useEffect(() => {
    window.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleClose, true)
    return () => {
      window.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleClose, true)
    }
  }, [handleEscape, handleClose])

  useEffect(() => {
    requestAnimationFrame(() => {
      const parentCenterX = anchorRect.left + anchorRect.width / 2
      const parentCenterY = anchorRect.top + anchorRect.height / 2
      subtaskRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect()
        const cardCenterX = rect.left + rect.width / 2
        const cardCenterY = rect.top + rect.height / 2
        offsetsRef.current.set(id, {
          x: parentCenterX - cardCenterX,
          y: parentCenterY - cardCenterY,
        })
      })
      setAnimationReady(true)
    })
  }, [anchorRect])

  useEffect(() => {
    const drawConnectors = (): void => {
      const svg = svgRef.current
      if (!svg) return

      const rightSpace = window.innerWidth - anchorRect.right - VIEWPORT_PADDING
      const onRight = rightSpace >= CARD_GAP_X + CARD_WIDTH

      const startX = onRight ? anchorRect.right : anchorRect.left
      const startY = anchorRect.top + anchorRect.height / 2

      clearSvgChildren(svg)

      subtaskRefs.current.forEach((el) => {
        const rect = el.getBoundingClientRect()
        const endX = onRight ? rect.left : rect.right
        const endY = rect.top + rect.height / 2
        const midX = startX + (endX - startX) / 2

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`)
        path.setAttribute('stroke', 'var(--ai-border)')
        path.setAttribute('stroke-width', String(CONNECTOR_WIDTH))
        path.setAttribute('fill', 'none')
        path.setAttribute('opacity', '0')
        path.style.transition = `opacity ${BACKDROP_FADE_MS}ms ease`
        requestAnimationFrame(() => { path.setAttribute('opacity', '1') })
        svg.appendChild(path)
      })
    }

    const delay = ANIMATION_STAGGER_MS * (task.subtasks?.length || 0) + DRAW_DELAY_BUFFER_MS
    const timer = setTimeout(drawConnectors, delay)
    return () => clearTimeout(timer)
  }, [task.subtasks, anchorRect])

  if (!task.subtasks) return null

  const spaceOnRight = window.innerWidth - anchorRect.right - VIEWPORT_PADDING
  const spaceNeeded = CARD_GAP_X + CARD_WIDTH
  const placeOnRight = spaceOnRight >= spaceNeeded

  const subtasksLeft = placeOnRight
    ? anchorRect.right + CARD_GAP_X
    : anchorRect.left - CARD_GAP_X - CARD_WIDTH

  const containerHeight = containerRef.current?.scrollHeight || 0
  const parentCenterY = anchorRect.top + anchorRect.height / 2
  const idealTop = parentCenterY - containerHeight / 2
  const clampedTop = Math.max(VIEWPORT_PADDING, Math.min(idealTop, window.innerHeight - containerHeight - VIEWPORT_PADDING))

  return (
    <>
      <div
        className="fixed inset-0"
        style={{
          background: 'rgba(0,0,0,0.4)',
          zIndex: BACKDROP_Z_INDEX,
          opacity: closing ? 0 : 1,
          transition: `opacity ${BACKDROP_FADE_MS}ms ease`,
        }}
        onClick={handleClose}
      />

      <svg
        ref={svgRef}
        className="fixed inset-0 pointer-events-none"
        style={{
          width: '100vw',
          height: '100vh',
          zIndex: CONNECTOR_Z_INDEX,
          opacity: closing ? 0 : 1,
          transition: `opacity ${BACKDROP_FADE_MS}ms ease`,
        }}
      />

      <div
        ref={containerRef}
        className="fixed pointer-events-auto flex flex-col items-start"
        style={{
          left: subtasksLeft,
          top: animationReady ? clampedTop : parentCenterY,
          transform: animationReady ? 'none' : 'translateY(-50%)',
          width: CARD_WIDTH,
          overflow: 'visible',
          gap: CARD_GAP_Y,
          zIndex: CARDS_Z_INDEX,
          maxHeight: `calc(100vh - ${VIEWPORT_PADDING * 2}px)`,
        }}
      >
        {task.subtasks.map((subtask, index) => {
          const isActiveSubtask = task.activeSubtaskIndex === index
          const taskView = subtaskToTask(subtask, task, isActiveSubtask)
          const offsets = offsetsRef.current.get(subtask.id)

          return (
            <div
              key={subtask.id}
              ref={(el) => {
                if (el) subtaskRefs.current.set(subtask.id, el)
                else subtaskRefs.current.delete(subtask.id)
              }}
              style={{
                flexShrink: 0,
                animationName: animationReady ? (closing ? 'clusterCollapse' : 'clusterExpand') : 'none',
                animationDuration: closing ? `${BACKDROP_FADE_MS}ms` : `${ANIMATION_DURATION_MS}ms`,
                animationTimingFunction: closing ? 'ease-in' : 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                animationFillMode: 'both',
                animationDelay: closing ? '0ms' : `${index * ANIMATION_STAGGER_MS}ms`,
                opacity: animationReady ? undefined : 0,
                ['--offset-x' as string]: `${offsets?.x || 0}px`,
                ['--offset-y' as string]: `${offsets?.y || 0}px`,
              }}
            >
              <div
                className="rounded-lg"
                style={{
                  background: 'var(--ai-surface-1)',
                  border: '1px solid var(--ai-border-subtle)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}
              >
                <TaskCard
                  task={taskView}
                  onClick={() => onSelectSubtask(task.id, index)}
                  onDelete={onDelete}
                />
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes clusterExpand {
          from {
            opacity: 0;
            transform: translate(var(--offset-x), var(--offset-y)) scale(0.01);
          }
          to {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
        }
        @keyframes clusterCollapse {
          from {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          to {
            opacity: 0;
            transform: translate(var(--offset-x), var(--offset-y)) scale(0.01);
          }
        }
      `}</style>
    </>
  )
}
