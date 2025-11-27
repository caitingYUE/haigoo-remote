import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import LandingPage from './pages/LandingPage'
import JobsPage from './pages/JobsPage'
import RemoteExperiencePage from './pages/RemoteExperiencePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AdminLocationPage from './pages/AdminLocationPage'
import AdminPanel from './components/AdminPanel'
import ProfileCenterPage from './pages/ProfileCenterPage'
import AdminTeamPage from './pages/AdminTeamPage'
import UserManagementPage from './pages/UserManagementPage'
import AdminTrustedCompaniesPage from './pages/AdminTrustedCompaniesPage'
import AdminTagManagementPage from './pages/AdminTagManagementPage'
import CompanyProfilePage from './pages/CompanyProfilePage'
import TrustedCompaniesPage from './pages/TrustedCompaniesPage'
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

              {/* AdminPanel 独立布局，用于数据管理（需要登录） */}
              <Route path="/admin/data" element={
                <ProtectedRoute>
                  <AdminPanel />
                </ProtectedRoute>
              } />

              {/* Tag Management - No Layout wrapper */}
              <Route path="/admin/tag-management" element={
                <ProtectedRoute>
                  <AdminTagManagementPage />
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
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/jobs" element={<JobsPage />} />
                    <Route path="/trusted-companies" element={<TrustedCompaniesPage />} />
                    <Route path="/company/:id" element={<CompanyProfilePage />} />
                    <Route path="/admin/location-categories" element={
                      <ProtectedRoute>
                        <AdminLocationPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/admin/trusted-companies" element={
                      <ProtectedRoute>
                        <AdminTrustedCompaniesPage />
                      </ProtectedRoute>
                    } />
                    <Route path="/remote-experience" element={<RemoteExperiencePage />} />

                    {/* 需要登录的页面 */}
                    <Route path="/profile" element={
                      <ProtectedRoute>
                        <ProfileCenterPage />
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