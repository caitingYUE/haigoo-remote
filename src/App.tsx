import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import { AppProvider } from './contexts/AppContext'
import { AuthProvider } from './contexts/AuthContext'
import NotificationProvider from './components/NotificationSystem'
import ErrorBoundary from './components/ErrorBoundary'
import GlobalVerificationGuard from './components/GlobalVerificationGuard'
import { lazyRetry } from './utils/lazyRetry'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const JobsPage = lazy(() => import('./pages/JobsPage'))
const RemoteExperiencePage = lazy(() => import('./pages/RemoteExperiencePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'))
const AdminLocationPage = lazy(() => import('./pages/AdminLocationPage'))
const AdminPanel = lazy(() => import('./components/AdminPanel'))
const ProfileCenterPage = lazyRetry(() => import('./pages/ProfileCenterPage'), 'ProfileCenterPage')
const AdminTeamPage = lazy(() => import('./pages/AdminTeamPage'))
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'))
const AdminTagManagementPage = lazy(() => import('./pages/AdminTagManagementPage'))
const AdminCompanyManagementPage = lazy(() => import('./pages/AdminCompanyManagementPage'))
const AdminTrustedCompaniesPage = lazy(() => import('./pages/AdminTrustedCompaniesPage'))
const AdminApplicationsPage = lazy(() => import('./pages/AdminApplicationsPage'))
const CompanyProfilePage = lazy(() => import('./pages/CompanyProfilePage'))
const TrustedCompaniesPage = lazy(() => import('./pages/TrustedCompaniesPage'))
const CompanyDetailPage = lazy(() => import('./pages/CompanyDetailPage'))
const MembershipPage = lazyRetry(() => import('./pages/MembershipPage'), 'MembershipPage')
const JoinClubApplicationPage = lazy(() => import('./pages/JoinClubApplicationPage'))
const NoPermissionPage = lazy(() => import('./pages/NoPermissionPage'))
const JobDetailPage = lazy(() => import('./pages/JobDetailPage'))
const UnsubscribePage = lazy(() => import('./pages/UnsubscribePage'))
const MyApplicationsPage = lazy(() => import('./pages/MyApplicationsPage'))


const ChristmasPage = lazyRetry(() => import('./pages/ChristmasPage'), 'ChristmasPage')
const AdminBugReportsPage = lazy(() => import('./pages/AdminBugReportsPage'))
const BugLeaderboardPage = lazy(() => import('./pages/BugLeaderboardPage'))

import { BugReportButton } from './components/BugReporter/BugReportButton'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackingService } from './services/tracking-service'

// Page view tracker component
function PageViewTracker() {
  const location = useLocation()

  useEffect(() => {
    trackingService.pageView({
      path: location.pathname,
      search: location.search
    })
  }, [location])

  return null
}

function App() {
  console.log('Haigoo Frontend Version: 2025-12-18-Fix-Visuals-v2');
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <NotificationProvider>
            <GlobalVerificationGuard>
              <BugReportButton />
              <PageViewTracker />
              <Suspense fallback={<div className="p-6 text-center">加载中…</div>}>
                <Routes>
                  {/* Public: Christmas Campaign */}
                  <Route path="/christmas" element={<ChristmasPage />} />
                  {/* 公开路由：登录和注册 */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/no-permission" element={<NoPermissionPage />} />
                  <Route path="/unsubscribe" element={<UnsubscribePage />} />

                  {/* AdminPanel 独立布局，用于数据管理（需要登录） */}
                  <Route path="/admin/data" element={
                    <AdminRoute>
                      <AdminPanel />
                    </AdminRoute>
                  } />

                  {/* Tag Management - No Layout wrapper */}
                  <Route path="/admin/tag-management" element={
                    <AdminRoute>
                      <AdminTagManagementPage />
                    </AdminRoute>
                  } />

                  {/* Company Management - No Layout wrapper */}
                  <Route path="/admin/companies" element={
                    <AdminRoute>
                      <AdminCompanyManagementPage />
                    </AdminRoute>
                  } />

                  {/* Trusted Company Management - No Layout wrapper */}
                  <Route path="/admin/trusted-companies" element={
                    <AdminRoute>
                      <AdminTrustedCompaniesPage />
                    </AdminRoute>
                  } />

                  {/* Member Applications Management */}
                  <Route path="/admin/applications" element={
                    <AdminRoute>
                      <AdminApplicationsPage />
                    </AdminRoute>
                  } />

                  {/* AdminTeamPage 统一后台管理页面（需要登录） */}
                  <Route path="/admin_team" element={
                    <AdminRoute>
                      <AdminTeamPage />
                    </AdminRoute>
                  } />

                  {/* Bug Reports Management - Now under admin_team path structure */}
                  <Route path="/admin_team/bug-reports" element={
                    <AdminRoute>
                      <AdminBugReportsPage />
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
                          <Route path="/job/:id" element={<JobDetailPage />} />
                          <Route path="/trusted-companies" element={<TrustedCompaniesPage />} />
                          <Route path="/company/:id" element={<CompanyProfilePage />} />
                          <Route path="/companies/:companyName" element={<CompanyDetailPage />} />
                          <Route path="/verify-email" element={<VerifyEmailPage />} />
                          <Route path="/admin/location-categories" element={
                            <AdminRoute>
                              <AdminLocationPage />
                            </AdminRoute>
                          } />
                          <Route path="/remote-experience" element={<RemoteExperiencePage />} />
                          <Route path="/membership" element={<MembershipPage />} />
                          <Route path="/join-club-application" element={<JoinClubApplicationPage />} />
                          <Route path="/bug-leaderboard" element={<BugLeaderboardPage />} />

                          {/* 需要登录的页面 */}
                          <Route path="/profile" element={
                            <ProtectedRoute>
                              <ProfileCenterPage />
                            </ProtectedRoute>
                          } />
                          <Route path="/my-applications" element={
                            <ProtectedRoute>
                              <MyApplicationsPage />
                            </ProtectedRoute>
                          } />
                        </Routes>
                      </Suspense>
                    </Layout>
                  } />
                </Routes>
              </Suspense>
            </GlobalVerificationGuard>
          </NotificationProvider>
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
