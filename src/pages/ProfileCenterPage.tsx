import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, Upload, Download, CheckCircle, AlertCircle, Heart } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'
import { resumeService } from '../services/resume-service'
import { processedJobsService } from '../services/processed-jobs-service'
import { usePageCache } from '../hooks/usePageCache'
import { Job } from '../types'

type TabKey = 'resume' | 'favorites'

export default function ProfileCenterPage() {
  const { user: authUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initialTab: TabKey = (() => {
    const t = new URLSearchParams(location.search).get('tab') as TabKey | null
    return t === 'favorites' ? 'favorites' : 'resume'
  })()

  const [tab, setTab] = useState<TabKey>(initialTab)
  const [isUploading, setIsUploading] = useState(false)
  const [resumeScore, setResumeScore] = useState<number>(0)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [latestResume, setLatestResume] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    const sp = new URLSearchParams(location.search)
    const t = sp.get('tab') as TabKey | null
    if (t && (t === 'resume' || t === 'favorites')) setTab(t)
  }, [location.search])

  const switchTab = (t: TabKey) => {
    setTab(t)
    const sp = new URLSearchParams(location.search)
    sp.set('tab', t)
    navigate({ pathname: '/profile', search: `?${sp.toString()}` }, { replace: true })
  }

  const { data: jobs } = usePageCache<Job[]>('profile-jobs-source', {
    fetcher: async () => await processedJobsService.getAllProcessedJobs(300),
    ttl: 60000,
    persist: false,
    namespace: 'profile'
  })

  const [savedJobs, setSavedJobs] = useState<{ jobId: string; title?: string; company?: string }[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/user-profile', { method: 'GET' })
        const j = await r.json()
        if (j?.success && Array.isArray(j?.profile?.savedJobs)) {
          setSavedJobs(j.profile.savedJobs)
        }
      } catch {}
    })()
  }, [])

  const favoritesWithStatus = useMemo(() => {
    const map = new Map<string, Job>()
    ;(jobs || []).forEach(j => map.set(j.id, j))
    const now = Date.now()
    return savedJobs.map(s => {
      const j = map.get(s.jobId)
      let status: '有效中' | '已失效' | '已下架' = '已下架'
      if (j) {
        const exp = j.expiresAt ? new Date(j.expiresAt).getTime() : undefined
        status = exp && exp < now ? '已失效' : '有效中'
      }
      return { jobId: s.jobId, title: s.title || j?.title, company: s.company || j?.company, status, job: j }
    })
  }, [savedJobs, jobs])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const parsed = await parseResumeFileEnhanced(file)
      setLatestResume({ id: Date.now().toString(), name: file.name })
      if (parsed.success && parsed.textContent && parsed.textContent.length > 50) {
        const analysis = await resumeService.analyzeResume(parsed.textContent)
        if (analysis.success && analysis.data) {
          setResumeScore(analysis.data.score || 0)
          setSuggestions(analysis.data.suggestions || [])
        }
      }
    } finally {
      setIsUploading(false)
    }
  }

  const ResumeTab = () => (
    <div className="space-y-6">
      <div className="profile-card p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-medium">Overall Resume Score</p>
          <p className="text-base font-bold text-[var(--profile-primary)]">{Math.max(0, Math.min(100, resumeScore))}%</p>
        </div>
        <div className="profile-progress"><div className="fill" style={{ width: `${Math.max(0, Math.min(100, resumeScore))}%` }} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 profile-fixed-row">
        <div className="lg:col-span-2 space-y-4 profile-col-left">
          <h3 className="text-xl font-bold px-4">我的简历</h3>
          <div className="profile-card p-6 profile-fill-card">
            {!latestResume ? (
              <div className="profile-upload-area">
                <div className="flex flex-col items-center gap-2 text-center max-w-[480px] mx-auto">
                  <FileText className="w-12 h-12 text-gray-400" />
                  <p className="text-lg font-bold">尚未上传简历</p>
                  <p className="text-sm text-gray-500">拖拽文件到此处或点击上传</p>
                  <button onClick={() => fileInputRef.current?.click()} className="profile-apply-btn" style={{ width: '240px', height: '40px' }}>
                    <Upload className="w-4 h-4 mr-2" />上传简历
                  </button>
                  <p className="text-xs text-gray-500">支持 PDF、DOC、DOCX、TXT</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-xl border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[var(--profile-primary)]" />
                      <span className="font-medium text-gray-900">{latestResume.name}</span>
                    </div>
                    <button className="p-2 text-gray-400 hover:text-[var(--profile-primary)]"><Download className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleUpload} className="hidden" />
            {isUploading && (
              <div className="mt-4 text-sm text-gray-500">正在上传并分析...</div>
            )}
          </div>
        </div>
        <div className="lg:col-span-1 space-y-4 profile-col-right">
          <h3 className="text-xl font-bold px-4">AI优化建议</h3>
          <div className="profile-suggestions-list">
            {suggestions.length === 0 ? (
              <div className="profile-suggestion-card">
                <div className="flex items-start gap-4">
                  <CheckCircle className="w-5 h-5 text-[var(--profile-primary)] mt-1" />
                  <div className="flex-1">
                    <h4 className="font-bold text-base">上传简历以获取建议</h4>
                    <p className="text-sm text-gray-600 mt-1">AI 将为你提供量化优化建议与关键词补全。</p>
                  </div>
                </div>
              </div>
            ) : (
              suggestions.map((s, idx) => (
                <div key={idx} className="profile-suggestion-card">
                  <div className="flex items-start gap-4">
                    <AlertCircle className="w-5 h-5 text-[var(--profile-primary)] mt-1" />
                    <div className="flex-1">
                      <h4 className="font-bold text-base">建议 {idx + 1}</h4>
                      <p className="text-sm text-gray-600 mt-1">{s}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const FavoritesTab = () => (
    <div className="profile-card p-6 profile-fill-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">我的收藏</h2>
        <div className="text-sm text-gray-500 flex items-center"><Heart className="w-4 h-4 mr-1 text-[var(--profile-primary)]" />{favoritesWithStatus.length}</div>
      </div>
      {favoritesWithStatus.length === 0 ? (
        <div className="profile-upload-area">
          <p className="text-lg font-bold">还没有收藏职位</p>
          <p className="text-sm text-gray-600">在首页点击收藏按钮后，这里将展示已收藏的职位</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoritesWithStatus.map(f => (
            <div key={f.jobId} className="p-4 bg-white rounded-xl border shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-gray-900 text-base">{f.title || '未命名职位'}</div>
                  <div className="text-sm text-gray-500">{f.company || '未知公司'}</div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  f.status === '有效中' ? 'bg-green-100 text-green-700' : f.status === '已下架' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'
                }`}>{f.status}</span>
              </div>
              {f.job?.description && (
                <p className="mt-3 text-sm text-gray-600 line-clamp-2">{f.job.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen landing-bg-page profile-theme">
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-start">
          <aside className="profile-sidebar">
            <div className="profile-nav-title">Personal Center</div>
            <div className="profile-nav" role="tablist" aria-label="个人中心切换">
              <button className={`profile-nav-item ${tab==='resume' ? 'active' : ''}`} role="tab" aria-selected={tab==='resume'} onClick={() => switchTab('resume')}>
                <FileText className={`w-5 h-5 ${tab==='resume' ? 'text-[var(--profile-primary)]' : 'text-gray-400'}`} />
                <span className="text-sm font-medium">我的简历</span>
              </button>
              <button className={`profile-nav-item ${tab==='favorites' ? 'active' : ''}`} role="tab" aria-selected={tab==='favorites'} onClick={() => switchTab('favorites')}>
                <Heart className={`w-5 h-5 ${tab==='favorites' ? 'text-[var(--profile-primary)]' : 'text-gray-400'}`} />
                <span className="text-sm font-medium">我的收藏</span>
              </button>
            </div>
          </aside>
          <main>
            {tab === 'resume' ? <ResumeTab /> : <FavoritesTab />}
          </main>
        </div>
      </div>
    </div>
  )
}