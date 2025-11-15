import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import HomePage from './pages/HomePage'
import JobsPage from './pages/JobsPage'
import RemoteExperiencePage from './pages/RemoteExperiencePage'
import JobApplicationPage from './pages/JobApplicationPage'
import JobDetailPage from './pages/JobDetailPage'
import ProfilePage from './pages/ProfilePage'
import ResumeOptimizationPage from './pages/ResumeOptimizationPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminPanel from './components/AdminPanel'
import AdminTeamPage from './pages/AdminTeamPage'
import UserManagementPage from './pages/UserManagementPage'
import { AppProvider } from './contexts/AppContext'
import { AuthProvider } from './contexts/AuthContext'
import NotificationProvider from './components/NotificationSystem'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <NotificationProvider>
          <Routes>
            {/* 公开路由：登录和注册 */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* JobApplicationPage 独立布局，不使用 Layout（需要登录） */}
            <Route path="/job/:jobId/apply" element={
              <ProtectedRoute>
                <JobApplicationPage />
              </ProtectedRoute>
            } />
            
            {/* AdminDashboardPage 独立布局，不使用 Layout（需要登录） */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminDashboardPage />
              </ProtectedRoute>
            } />
            
            {/* AdminPanel 独立布局，用于数据管理（需要登录） */}
            <Route path="/admin/data" element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            } />
            
            {/* AdminTeamPage 统一后台管理页面（需要登录） */}
            <Route path="/admin_team" element={
              <AdminRoute>
                <AdminTeamPage />
              </AdminRoute>
            } />
            
            {/* 用户管理页面（需要登录） */}
            <Route path="/admin/users" element={
              <AdminRoute>
                <UserManagementPage />
              </AdminRoute>
            } />
            
            {/* 其他页面使用标准布局 */}
            <Route path="/*" element={
              <Layout>
                <Routes>
                  {/* 公开页面 */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/jobs" element={<JobsPage />} />
                  <Route path="/remote-experience" element={<RemoteExperiencePage />} />
                  <Route path="/job/:id" element={<JobDetailPage />} />
                  
                  {/* 需要登录的页面 */}
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  } />
                  <Route path="/resume" element={
                    <ProtectedRoute>
                      <ResumeOptimizationPage />
                    </ProtectedRoute>
                  } />
                </Routes>
              </Layout>
            } />
          </Routes>
        </NotificationProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App