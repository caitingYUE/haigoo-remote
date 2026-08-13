
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Share2, FileQuestion } from 'lucide-react'
import { Job } from '../types'
import { JobDetailPanel } from '../components/JobDetailPanel'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { trackingService } from '../services/tracking-service'
import { ShareJobModal } from '../components/ShareJobModal'
import { decodeJobId, getJobSharePath } from '../utils/share-link-helper'
import { useReturnNavigation } from '../hooks/useReturnNavigation'
import { useLanguage } from '../contexts/LanguageContext'
import { COMPLIANCE_FEATURES } from '../config/compliance'

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const handleBack = useReturnNavigation('/jobs')
  const { token, isAuthenticated } = useAuth()
  const { showSuccess, showError, showWarning } = useNotificationHelpers()
  const { isEnglish, text } = useLanguage()
  const textRef = React.useRef(text)

  useEffect(() => {
    textRef.current = text
  }, [text])

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [showCopied, setShowCopied] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const isShortJobPath = location.pathname.startsWith('/j/')
  const resolvedJobId = id ? decodeJobId(id, { allowBareToken: isShortJobPath }) : ''

  // Track visit source
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const source = params.get('source')
    if (source === 'share' && resolvedJobId) {
      trackingService.track('visit_via_share', { jobId: resolvedJobId })
    }
  }, [location.search, resolvedJobId])

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return
      setLoading(true)
      try {
        // 个性化匹配代码保留；合规开关关闭时详情仅读取普通岗位数据。
        let resp: Response
        if (COMPLIANCE_FEATURES.personalizedJobDiscovery && isAuthenticated && token) {
          const personalizedParams = new URLSearchParams({
            action: 'jobs_with_match_score',
            id: String(resolvedJobId),
            page: '1',
            pageSize: '1',
            sortBy: 'relevance'
          })
          const personalizedUrl = `/api/data/processed-jobs?${personalizedParams.toString()}`
          resp = await fetch(personalizedUrl, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (!resp.ok) {
            resp = await fetch(`/api/data/processed-jobs?id=${encodeURIComponent(resolvedJobId)}`)
          }
        } else {
          resp = await fetch(`/api/data/processed-jobs?id=${encodeURIComponent(resolvedJobId)}`)
        }

        if (!resp.ok) throw new Error(textRef.current('该职位可能已下线、过期，或当前不可访问。', 'This job may be closed, expired, or unavailable to you.'))
        const data = await resp.json()
        if (data.jobs && data.jobs.length > 0) {
          const fetchedJob = data.jobs[0]

          // Check validity
          if (fetchedJob.status === 'closed' || fetchedJob.status === 'expired') {
            setError(textRef.current('该职位已停止招聘', 'This role is no longer accepting applications.'))
            startRedirectCountdown()
          } else {
            setJob(fetchedJob)
            trackingService.track('view_job_detail', { jobId: resolvedJobId, title: fetchedJob.title })
          }
        } else {
          setError(textRef.current('该职位可能已下线、过期，或当前不可访问。', 'This job may be closed, expired, or unavailable to you.'))
          startRedirectCountdown()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : textRef.current('加载失败', 'Could not load this job.'))
      } finally {
        setLoading(false)
      }
    }

    fetchJob()
  }, [id, isAuthenticated, token, location.search, resolvedJobId])

  useEffect(() => {
    if (!job?.title) return
    document.title = `${isEnglish ? job.title : (job.translations?.title || job.title)} | Haigoo Remote`
  }, [job, isEnglish])

  const startRedirectCountdown = () => {
    setCountdown(5)
  }

  // Handle countdown
  useEffect(() => {
    if (countdown === null) return

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      navigate('/jobs')
    }
  }, [countdown, navigate])

  const handleShare = () => {
    setIsShareModalOpen(true);
    trackingService.track('click_share_button', { jobId: resolvedJobId || id, from: 'detail_page_mobile' });
  }

  // Check if saved
  useEffect(() => {
    const checkSaved = async () => {
      if (!resolvedJobId || !isAuthenticated || !token) return
      try {
        const resp = await fetch('/api/user-profile?action=favorites', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (resp.ok) {
          const data = await resp.json()
          const savedIds = (data.favorites || []).map((f: any) => f.id)
          setIsSaved(savedIds.includes(resolvedJobId))
        }
      } catch (e) {
        console.warn('Failed to check saved status', e)
      }
    }
    checkSaved()
  }, [resolvedJobId, isAuthenticated, token])

  const handleSave = async () => {
    if (!isAuthenticated || !token) {
      showWarning(text('请先登录', 'Please log in'), text('登录后可以收藏职位', 'Log in to save jobs.'))
      navigate(`/login?redirect=${encodeURIComponent(getJobSharePath(resolvedJobId || id || ''))}`)
      return
    }

    try {
      const action = isSaved ? 'favorites_remove' : 'favorites_add'
      const resp = await fetch(`/api/user-profile?action=${action}&jobId=${encodeURIComponent(resolvedJobId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ jobId: resolvedJobId, job })
      })

      if (resp.ok) {
        setIsSaved(!isSaved)
        showSuccess(isSaved ? text('已取消收藏', 'Removed from saved jobs') : text('收藏成功', 'Job saved'))
      } else {
        throw new Error(text('操作失败', 'Action failed'))
      }
    } catch (e) {
      showError(text('操作失败，请重试', 'Action failed. Please try again.'))
    }
  }

  const handleApply = () => {
    if (job?.url) {
      window.open(job.url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#466f9d] border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f5ef] p-4">
        <div className="w-full max-w-xl border-y border-[#cfcbbf] bg-[#fffdf8] px-6 py-12 text-center sm:border-x sm:px-12">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-[#9eb9ad] bg-[#eef4f0] text-[#31594e]">
            <FileQuestion className="h-6 w-6" />
          </div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#55746a]">Haigoo Remote · Job notice</p>
          <h2 className="mb-3 font-serif text-3xl font-semibold tracking-tight text-[#101829]">{text('该职位链接已失效', 'This job link is no longer valid')}</h2>
          <p className="mx-auto mb-8 max-w-md text-sm leading-7 text-slate-600">{error || text('该职位可能已下线、过期，或当前不可访问。', 'This job may be closed, expired, or unavailable to you.')}</p>
          <button
            onClick={() => navigate('/jobs')}
            className="inline-flex h-11 items-center justify-center border border-[#1b2440] bg-[#1b2440] px-7 text-sm font-bold text-white transition-colors hover:border-[#31594e] hover:bg-[#31594e]"
          >
            {text('查看其他职位', 'Browse other jobs')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="sticky top-14 z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5 md:top-16 lg:hidden">
        <button onClick={handleBack} className="p-2 -ml-2 hover:bg-slate-50 rounded-full" aria-label={text('返回上一页', 'Go back')}>
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="px-1 text-center text-sm font-semibold leading-5 text-slate-900 line-clamp-2">{isEnglish ? job.title : (job.translations?.title || job.title)}</div>
        <button
          type="button"
          onClick={handleShare}
          className="p-2 -mr-2 hover:bg-slate-50 rounded-full"
          aria-label={text('分享岗位', 'Share job')}
        >
          <Share2 className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-4 lg:p-8">
        <div className="lg:mb-6 hidden lg:block">
          <button
            onClick={handleBack}
            className="flex items-center text-slate-500 hover:text-[#466f9d] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {text('返回', 'Back')}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px]">
          <JobDetailPanel
            job={job}
            isSaved={isSaved}
            onSave={handleSave}
            onApply={handleApply}
            showCloseButton={false}
          />
        </div>

        {/* Share Modal */}
        {job && (
          <ShareJobModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            jobId={job.id}
            jobTitle={isEnglish ? job.title : (job.translations?.title || job.title)}
            companyName={isEnglish ? (job.company || '') : (job.translations?.company || job.company || '')}
          />
        )}
      </div>
    </div>
  )
}
