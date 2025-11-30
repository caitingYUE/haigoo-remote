import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { AppProvider } from './contexts/AppContext'
import { AuthProvider } from './contexts/AuthContext'
import NotificationProvider from './components/NotificationSystem'
import ErrorBoundary from './components/ErrorBoundary'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const JobsPage = lazy(() => import('./pages/JobsPage'))
const RemoteExperiencePage = lazy(() => import('./pages/RemoteExperiencePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const AdminLocationPage = lazy(() => import('./pages/AdminLocationPage'))
const AdminPanel = lazy(() => import('./components/AdminPanel'))
const ProfileCenterPage = lazy(() => import('./pages/ProfileCenterPage'))
const AdminTeamPage = lazy(() => import('./pages/AdminTeamPage'))
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'))
const AdminTrustedCompaniesPage = lazy(() => import('./pages/AdminTrustedCompaniesPage'))
const AdminTagManagementPage = lazy(() => import('./pages/AdminTagManagementPage'))
const AdminCompanyManagementPage = lazy(() => import('./pages/AdminCompanyManagementPage'))
const CompanyProfilePage = lazy(() => import('./pages/CompanyProfilePage'))
const TrustedCompaniesPage = lazy(() => import('./pages/TrustedCompaniesPage'))

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <NotificationProvider>
            <Suspense fallback={<div className="p-6 text-center">加载中…</div>}>
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

                {/* Company Management - No Layout wrapper */}
                <Route path="/admin/companies" element={
                  <ProtectedRoute>
                    <AdminCompanyManagementPage />
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
                    <Suspense fallback={<div className="p-6 text-center">加载中…</div>}>
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
                    </Suspense>
                  </Layout>
                } />
              </Routes>
            </Suspense>
          </NotificationProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
