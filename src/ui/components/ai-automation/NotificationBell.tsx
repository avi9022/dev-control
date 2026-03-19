import { useState, useEffect, useRef, useCallback, type FC } from 'react'
import { Bell, CheckCircle, AlertTriangle, UserCheck, Play } from 'lucide-react'
import { toast } from 'sonner'

interface NotificationBellProps {
  onNavigateToTask: (taskId: string) => void
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function TypeIcon({ type }: { type: AINotification['type'] }) {
  switch (type) {
    case 'task_done':
      return <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-success)' }} />
    case 'needs_attention':
      return <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-warning)' }} />
    case 'manual_phase':
      return <UserCheck className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-accent)' }} />
    case 'phase_start':
      return <Play className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
  }
}

export const NotificationBell: FC<NotificationBellProps> = ({ onNavigateToTask }) => {
  const [notifications, setNotifications] = useState<AINotification[]>([])
  const [showPanel, setShowPanel] = useState(false)
  const prevIdsRef = useRef<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electron.aiGetNotifications().then(initial => {
      setNotifications(initial)
      prevIdsRef.current = new Set(initial.map(n => n.id))
    })

    const unsub = window.electron.subscribeAINotifications((updated) => {
      setNotifications(updated)

      // Toast for new unread notifications
      const prevIds = prevIdsRef.current
      for (const n of updated) {
        if (!prevIds.has(n.id) && !n.read) {
          toast(n.taskTitle, { description: n.message })
        }
      }
      prevIdsRef.current = new Set(updated.map(n => n.id))
    })

    return unsub
  }, [])

  // Click outside to close
  useEffect(() => {
    if (!showPanel) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPanel(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [showPanel])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleToggle = useCallback(() => {
    setShowPanel(prev => {
      if (!prev && unreadCount > 0) {
        window.electron.aiMarkNotificationsRead()
      }
      return !prev
    })
  }, [unreadCount])

  const handleMarkAllRead = useCallback(() => {
    window.electron.aiMarkNotificationsRead()
  }, [])

  const handleClickNotification = useCallback((taskId: string) => {
    onNavigateToTask(taskId)
    setShowPanel(false)
  }, [onNavigateToTask])

  const displayedNotifications = notifications.slice(0, 20)

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={handleToggle}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
        style={{ color: 'var(--ai-text-secondary)', background: 'var(--ai-surface-2)', position: 'relative' }}
        title="Notifications"
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: 'var(--ai-accent)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showPanel && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 6,
            width: 320,
            maxHeight: 400,
            overflowY: 'auto',
            background: 'var(--ai-surface-1)',
            border: '1px solid var(--ai-border-subtle)',
            borderRadius: 10,
            zIndex: 100,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: '1px solid var(--ai-border-subtle)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ai-text-primary)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  fontSize: 11,
                  color: 'var(--ai-accent)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          {displayedNotifications.length === 0 ? (
            <div style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--ai-text-tertiary)', fontSize: 13 }}>
              No notifications yet
            </div>
          ) : (
            displayedNotifications.map(n => (
              <button
                key={n.id}
                onClick={() => handleClickNotification(n.taskId)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  borderLeft: n.read ? '3px solid transparent' : '3px solid var(--ai-accent)',
                  borderBottom: '1px solid var(--ai-border-subtle)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ai-surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <div style={{ paddingTop: 2 }}>
                  <TypeIcon type={n.type} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ai-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.taskTitle}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ai-text-secondary)', marginTop: 2, lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--ai-text-tertiary)', whiteSpace: 'nowrap', paddingTop: 2 }}>
                  {timeAgo(n.createdAt)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
