import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const isAdmin = !!(user?.roles?.admin || user?.email === 'caitlinyct@gmail.com')
  if (!isAdmin) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}