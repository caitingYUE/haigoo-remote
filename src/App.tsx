import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import JobsPage from './pages/JobsPage'
import RemoteExperiencePage from './pages/RemoteExperiencePage'
import JobApplicationPage from './pages/JobApplicationPage'
import JobDetailPage from './pages/JobDetailPage'
import ProfilePage from './pages/ProfilePage'
import ResumeOptimizationPage from './pages/ResumeOptimizationPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import { AppProvider } from './contexts/AppContext'
import NotificationProvider from './components/NotificationSystem'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <NotificationProvider>
          <Routes>
            {/* JobApplicationPage 独立布局，不使用 Layout */}
            <Route path="/job/:jobId/apply" element={<JobApplicationPage />} />
            
            {/* AdminDashboardPage 独立布局，不使用 Layout */}
            <Route path="/admin" element={<AdminDashboardPage />} />
            
            {/* 其他页面使用标准布局 */}
            <Route path="/*" element={
              <Layout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/jobs" element={<JobsPage />} />
                  <Route path="/remote-experience" element={<RemoteExperiencePage />} />
                  <Route path="/job/:id" element={<JobDetailPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/resume" element={<ResumeOptimizationPage />} />
                </Routes>
              </Layout>
            } />
          </Routes>
        </NotificationProvider>
      </AppProvider>
    </ErrorBoundary>
  )
}

export default App