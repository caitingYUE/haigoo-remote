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
  const { user: authUser, token } = useAuth()
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
  const [resumeText, setResumeText] = useState<string>('')

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


  // 移除收藏数据加载，后续将重新设计收藏方案

  

  // 移除收藏状态映射

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const parsed = await parseResumeFileEnhanced(file)
      setLatestResume({ id: Date.now().toString(), name: file.name })
      if (parsed.success && parsed.textContent && parsed.textContent.length > 50) {
        setResumeText(parsed.textContent)
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
      {/* 顶部标题与下载 */}
      <div className="profile-topbar">
        <div>
          <div className="profile-title">Resume Optimization</div>
          <div className="profile-subtitle">Enhance your resume with AI-powered suggestions.</div>
        </div>
        <button className="profile-download-btn"><Download className="w-4 h-4" />Download Optimized Resume</button>
      </div>

      {/* 分数条 */}
      <div className="profile-card p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-medium">Overall Resume Score</p>
          <p className="text-base font-bold text-[var(--profile-primary)]">{Math.max(0, Math.min(100, resumeScore))}%</p>
        </div>
        <div className="profile-progress"><div className="fill" style={{ width: `${Math.max(0, Math.min(100, resumeScore))}%` }} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 profile-fixed-row">
        {/* 左列：上传区 */}
        <div className="lg:col-span-2 space-y-4 profile-col-left">
          <h3 className="text-xl font-bold px-4">Your Resume</h3>
          <div className="profile-card p-6 profile-fill-card">
            {!latestResume ? (
              <div className="profile-upload-area">
                <div className="flex flex-col items-center gap-2 text-center max-w-[520px] mx-auto">
                  <FileText className="w-12 h-12 text-gray-400" />
                  <p className="text-lg font-bold">No resume uploaded yet</p>
                  <p className="text-sm text-gray-500">Drag and drop your file here or click to upload.</p>
                  <button onClick={() => fileInputRef.current?.click()} className="profile-apply-btn" style={{ width: '240px', height: '40px' }}>
                    <Upload className="w-4 h-4 mr-2" />Upload Resume
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
                {resumeText && (
                  <div className="rounded-xl border p-4 h-[360px] overflow-auto bg-white">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800">{resumeText}</pre>
                  </div>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleUpload} className="hidden" />
            {isUploading && (
              <div className="mt-4 text-sm text-gray-500">正在上传并分析...</div>
            )}
          </div>
        </div>

        {/* 右列：建议与CTA */}
        <div className="lg:col-span-1 space-y-4 profile-col-right">
          <h3 className="text-xl font-bold px-4">AI-Powered Suggestions</h3>
          <div className="profile-suggestions-list">
            {!resumeText && (
              <div className="profile-notice">These are example suggestions. Upload your resume to generate personalized recommendations.</div>
            )}
            {/* 三张建议卡 */}
            <div className="profile-suggestion-card">
              <div className="flex items-start gap-4">
                <CheckCircle className="w-5 h-5 text-[var(--profile-primary)] mt-1" />
                <div className="flex-1">
                  <h4 className="font-bold text-base">Strengthen Your Action Verbs</h4>
                  <p className="text-sm text-gray-600 mt-1">Use powerful verbs to describe your accomplishments.</p>
                  <button className="text-sm font-medium text-[var(--profile-primary)] mt-2">Learn More</button>
                </div>
              </div>
            </div>
            <div className="profile-suggestion-card">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-[var(--profile-primary)] mt-1" />
                <div className="flex-1">
                  <h4 className="font-bold text-base">Add Quantifiable Results</h4>
                  <p className="text-sm text-gray-600 mt-1">Include numbers and data to demonstrate your impact.</p>
                  <button className="text-sm font-medium text-[var(--profile-primary)] mt-2">Show Example</button>
                </div>
              </div>
            </div>
            <div className="profile-suggestion-card">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-[var(--profile-primary)] mt-1" />
                <div className="flex-1">
                  <h4 className="font-bold text-base">ATS Compatibility Check</h4>
                  <p className="text-sm text-gray-600 mt-1">Ensure your resume is formatted to pass ATS.</p>
                  <button className="text-sm font-medium text-[var(--profile-primary)] mt-2">Learn More</button>
                </div>
              </div>
            </div>

          </div>
          <div className="profile-actions">
            <button className="profile-apply-btn">Apply Suggestions</button>
            <button className="profile-reset-btn">Reset Suggestions</button>
          </div>
        </div>
      </div>
    </div>
  )

  const FavoritesTab = () => (
    <div className="space-y-4">
      <div className="profile-topbar">
        <div>
          <div className="profile-title">My Favorites</div>
          <div className="profile-subtitle">Your bookmarked job postings.</div>
        </div>
      </div>
      <div className="profile-card p-6 profile-fill-card">
        {favoritesWithStatus.length === 0 ? (
          <div className="profile-upload-area">
            <p className="text-lg font-bold">还没有收藏职位</p>
            <p className="text-sm text-gray-600">在首页点击收藏按钮后，这里将展示已收藏的职位</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favoritesWithStatus.map(f => (
              <div key={f.jobId} className="favorite-card relative">
                <button className="favorite-heart text-[var(--profile-primary)]"><Heart className="w-5 h-5" /></button>
                <div className="favorite-title text-base">{f.title || '未命名职位'}</div>
                <div className="favorite-company">{f.company || '未知公司'}</div>
                {f.job?.description && (
                  <p className="favorite-summary">{String(f.job.description)}</p>
                )}
                <div className="favorite-tags">
                  {f.job?.isRemote && <span className="favorite-tag">Remote</span>}
                  {f.job?.type && <span className="favorite-tag">{f.job.type}</span>}
                  {f.job?.salary && f.job.salary.min>0 && <span className="favorite-salary">${f.job.salary.min} - ${f.job.salary.max}</span>}
                </div>
                <div className="favorite-bottom">
                  {f.status === '有效中' && <div className="favorite-status-ok"><span className="inline-block w-2 h-2 rounded-full bg-green-500" />有效中</div>}
                  {f.status === '已下架' && <div className="favorite-status-off">已下架</div>}
                  {f.status === '已失效' && <div className="favorite-status-exp">已失效</div>}
                  <button className="favorite-view">View Details</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="profile-page profile-theme">
      <div className="max-w-7xl mx-auto px-8 py-10 profile-container">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 profile-main-grid">
          <aside className="profile-sidebar">
            <div className="profile-nav-title">Personal Center</div>
            <div className="profile-nav" role="tablist" aria-label="个人中心切换">
              <button className={`profile-nav-item ${tab==='resume' ? 'active' : ''}`} role="tab" aria-selected={tab==='resume'} onClick={() => switchTab('resume')}>
                <FileText className={`w-5 h-5 ${tab==='resume' ? 'text-[var(--profile-primary)]' : 'text-gray-400'}`} />
                <span className="text-sm font-medium">我的简历</span>
              </button>
            </div>
          </aside>
          <main>
            {tab === 'resume' ? <ResumeTab /> : <ResumeTab />}
          </main>
        </div>
      </div>
    </div>
  )
}