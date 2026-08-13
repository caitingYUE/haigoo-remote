import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 11)
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000
    }

    setNotifications(prev => {
      const isDuplicate = prev.some(item => (
        item.type === newNotification.type
        && item.title === newNotification.title
        && item.message === newNotification.message
      ))

      return isDuplicate ? prev : [...prev, newNotification]
    })

    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, newNotification.duration)
    }
  }, [removeNotification])

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearAll
    }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  )
}

function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications()

  if (notifications.length === 0) return null

  return (
    <div
      className="fixed left-4 right-4 top-4 z-[100] space-y-2 sm:left-auto sm:w-full sm:max-w-sm"
      style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
    >
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  )
}

interface NotificationItemProps {
  notification: Notification
  onClose: () => void
}

function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const { type, title, message, action } = notification

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle aria-hidden="true" className="hg-toast__icon w-5 h-5" />
      case 'error':
        return <AlertCircle aria-hidden="true" className="hg-toast__icon w-5 h-5" />
      case 'warning':
        return <AlertTriangle aria-hidden="true" className="hg-toast__icon w-5 h-5" />
      case 'info':
        return <Info aria-hidden="true" className="hg-toast__icon w-5 h-5" />
    }
  }

  return (
    <div
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`hg-toast hg-toast--${type} animate-slide-in-right transform transition-[opacity,transform] duration-300`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-900 text-sm">
            {title}
          </h4>
          {message && (
            <p className="text-slate-700 text-sm mt-1">
              {message}
            </p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className="hg-toast__action mt-2 text-sm font-semibold"
            >
              {action.label}
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          aria-label="关闭通知"
          className="hg-toast__close -mr-2 -mt-2 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-700"
        >
          <X aria-hidden="true" className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Convenience hooks for different notification types
export function useNotificationHelpers() {
  const { addNotification } = useNotifications()

  const showSuccess = useCallback((title: string, message?: string) => {
    addNotification({ type: 'success', title, message, duration: 2000 })
  }, [addNotification])

  const showError = useCallback((title: string, message?: string) => {
    addNotification({ type: 'error', title, message, duration: 0 }) // Don't auto-dismiss errors
  }, [addNotification])

  const showWarning = useCallback((title: string, message?: string) => {
    addNotification({ type: 'warning', title, message })
  }, [addNotification])

  const showInfo = useCallback((title: string, message?: string) => {
    addNotification({ type: 'info', title, message })
  }, [addNotification])

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo
  }
}

export default NotificationProvider
