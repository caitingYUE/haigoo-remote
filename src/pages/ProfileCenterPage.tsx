import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, Upload, Download, CheckCircle, AlertCircle, Heart, ArrowLeft, MessageSquare, ThumbsUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'
import { resumeService } from '../services/resume-service'
import { processedJobsService } from '../services/processed-jobs-service'
import { usePageCache } from '../hooks/usePageCache'
import { Job } from '../types'
import JobCard from '../components/JobCard'
import JobDetailModal from '../components/JobDetailModal'
import { useNotificationHelpers } from '../components/NotificationSystem'
import '../styles/landing-upgrade.css'

type TabKey = 'resume' | 'favorites' | 'feedback' | 'recommend'

export default function ProfileCenterPage() {
  const { user: authUser, token } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initialTab: TabKey = (() => {
    const t = new URLSearchParams(location.search).get('tab') as TabKey | null
    return t && ['resume','favorites','feedback','recommend'].includes(t) ? t : 'resume'
  })()

  const [tab, setTab] = useState<TabKey>(initialTab)
  const [isUploading, setIsUploading] = useState(false)
  const [resumeScore, setResumeScore] = useState<number>(0)
  
  const [latestResume, setLatestResume] = useState<{ id: string; name: string } | null>(null)
  const [resumeText, setResumeText] = useState<string>('')
  const [favorites, setFavorites] = useState<any[]>([])
  const [loadingFavorites, setLoadingFavorites] = useState<boolean>(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const { showSuccess, showError } = useNotificationHelpers()

  const handleRemoveFavorite = async (jobId: string) => {
    try {
      const resp = await fetch(`/api/user-profile?action=favorites_remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ jobId })
      })

      if (resp.ok) {
        setFavorites(prev => prev.filter(f => f.id !== jobId && f.jobId !== jobId))
        showSuccess('已取消收藏')
      } else {
        throw new Error('Failed to remove')
      }
    } catch (error) {
      showError('操作失败', '无法移除收藏')
    }
  }

  useEffect(() => {
    const sp = new URLSearchParams(location.search)
    const t = sp.get('tab') as TabKey | null
    if (t && ['resume','favorites','feedback','recommend'].includes(t)) setTab(t as TabKey)
  }, [location.search])

  const switchTab = (t: TabKey) => {
    setTab(t)
    const sp = new URLSearchParams(location.search)
    sp.set('tab', t)
    navigate({ pathname: '/profile', search: `?${sp.toString()}` }, { replace: true })
  }

  const { data: _jobs } = usePageCache<Job[]>('profile-jobs-source', {
    fetcher: async () => await processedJobsService.getAllProcessedJobs(300),
    ttl: 60000,
    persist: false,
    namespace: 'profile'
  })


  useEffect(() => {
    ; (async () => {
      try {
        if (!authUser || !token) {
          console.log('[ProfileCenter] No auth user or token')
          return
        }
        console.log('[ProfileCenter] Fetching favorites...')
        setLoadingFavorites(true)
        const r = await fetch('/api/user-profile?action=favorites', {
          headers: { Authorization: `Bearer ${token as string}` }
        })
        const j = await r.json()
        console.log('[ProfileCenter] Favorites response:', j)

        // Handle both success and direct array responses
        if (j?.success && Array.isArray(j?.favorites)) {
          console.log('[ProfileCenter] Setting favorites (success):', j.favorites.length)
          setFavorites(j.favorites)
        } else if (Array.isArray(j?.favorites)) {
          console.log('[ProfileCenter] Setting favorites (direct):', j.favorites.length)
          setFavorites(j.favorites)
        } else if (Array.isArray(j)) {
          console.log('[ProfileCenter] Setting favorites (array):', j.length)
          setFavorites(j)
        } else {
          console.warn('[ProfileCenter] Unexpected favorites response format:', j)
        }
        setLoadingFavorites(false)
      } catch (e) {
        console.error('[ProfileCenter] Failed to fetch favorites:', e)
        setLoadingFavorites(false)
      }
    })()
  }, [authUser, token])



  const favoritesWithStatus = useMemo(() => favorites, [favorites])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    // 1. 乐观更新：立即展示文件
    const tempId = Date.now().toString()
    setLatestResume({ id: tempId, name: file.name })
    showSuccess('开始上传简历...', '正在后台解析文件')

    try {
      // 2. 调用 API 上传并解析
      const parsed = await parseResumeFileEnhanced(file)

      // 3. 处理结果
      if (parsed && parsed.success) {
        // 解析成功
        if (parsed.textContent && parsed.textContent.length > 50) {
          setResumeText(parsed.textContent)

          // 更新本地状态以包含更多详情（如果有）
          // 注意：这里不需要再调用 ResumeStorageService.addResume，因为 API 已经保存了

          showSuccess('简历上传成功！', '正在分析简历内容...')

          // 4. 获取 AI 建议
          try {
            const analysis = await resumeService.analyzeResume(parsed.textContent)
            if (analysis.success && analysis.data) {
              setResumeScore(analysis.data.score || 0)
              showSuccess('简历分析完成！', `您的简历得分：${analysis.data.score || 0}%`)
            }
          } catch (aiError) {
            console.warn('AI analysis failed:', aiError)
            // AI 分析失败不影响简历上传状态
          }
        } else {
          // 解析内容太少，可能解析不完全
          showSuccess('简历上传成功', '但解析到的内容较少')
        }
      } else {
        // 解析失败，但文件已保存（API 端已处理保存逻辑）
        console.warn('Resume parsed with errors or fallback')
        showSuccess('简历上传成功', '文件已保存，但自动解析失败')
      }
    } catch (error) {
      console.error('Resume upload error:', error)
      // 只有在网络错误等严重情况才回滚
      showError('上传失败', error instanceof Error ? error.message : '简历上传失败，请重试')
      setLatestResume(null) // 回滚
    } finally {
      setIsUploading(false)
    }
  }

  const handleDeleteResume = async () => {
    if (!confirm('确定要删除简历吗？删除后无法恢复。')) return

    try {
      if (!latestResume || !token) return

      // 调用 API 删除简历
      const res = await fetch(`/api/resumes?id=${latestResume.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.ok) {
        // 清除本地状态
        setLatestResume(null)
        setResumeText('')
        setResumeScore(0)
        showSuccess('简历已删除')
      } else {
        throw new Error('删除失败')
      }
    } catch (error) {
      showError('删除失败', '无法删除简历，请稍后重试')
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 text-sm font-medium text-[var(--profile-primary)] hover:bg-blue-50 rounded-lg transition-colors"
                        title="重新上传简历"
                      >
                        <Upload className="w-4 h-4 inline mr-1" />
                        重新上传
                      </button>
                      <button
                        onClick={handleDeleteResume}
                        className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除简历"
                      >
                        删除
                      </button>
                    </div>
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
        {loadingFavorites ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 rounded-xl bg-gray-100" />
              </div>
            ))}
          </div>
        ) : favoritesWithStatus.length === 0 ? (
          <div className="profile-upload-area">
            <p className="text-lg font-bold">还没有收藏职位</p>
            <p className="text-sm text-gray-600">在首页点击收藏按钮后，这里将展示已收藏的职位</p>
          </div>
        ) : (
          <div className="space-y-4">
            {favoritesWithStatus.map((f: any) => (
              <div key={f.id || f.jobId}>
                <JobCard
                  job={f as Job}
                  isSaved={true}
                  onSave={() => handleRemoveFavorite(f.id || f.jobId)}
                  onClick={() => { setSelectedJob(f as Job); setIsJobDetailOpen(true) }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const FeedbackTab = () => {
    const [accuracy, setAccuracy] = useState<'accurate'|'inaccurate'|'unknown'>('unknown')
    const [content, setContent] = useState('')
    const [contact, setContact] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const submit = async () => {
      if (!content.trim()) { showError('请填写反馈内容'); return }
      try {
        setSubmitting(true)
        const r = await fetch('/api/user-profile?action=submit_feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ accuracy, content, contact })
        })
        const j = await r.json().catch(() => ({ success: false }))
        if (r.ok && j.success) { showSuccess('反馈已提交'); setAccuracy('unknown'); setContent(''); setContact('') }
        else { showError('提交失败', j.error || '请稍后重试') }
      } catch (e) {
        showError('提交失败', '网络错误')
      } finally { setSubmitting(false) }
    }
    return (
      <div className="space-y-4">
        <div className="profile-topbar">
          <div>
            <div className="profile-title">我要反馈</div>
            <div className="profile-subtitle">反馈岗位或平台信息问题与建议。</div>
          </div>
        </div>
        <div className="profile-card p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">信息准确度</label>
              <div className="flex items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2"><input type="radio" checked={accuracy==='accurate'} onChange={()=>setAccuracy('accurate')} />准确</label>
                <label className="inline-flex items-center gap-2"><input type="radio" checked={accuracy==='inaccurate'} onChange={()=>setAccuracy('inaccurate')} />不准确</label>
                <label className="inline-flex items-center gap-2"><input type="radio" checked={accuracy==='unknown'} onChange={()=>setAccuracy('unknown')} />不确定</label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">反馈内容</label>
              <textarea rows={5} value={content} onChange={e=>setContent(e.target.value)} className="w-full rounded-lg border p-3" placeholder="请描述问题或建议" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">联系方式（可选）</label>
              <input value={contact} onChange={e=>setContact(e.target.value)} className="w-full rounded-lg border p-3" placeholder="邮箱或微信" />
            </div>
            <div className="flex justify-end">
              <button onClick={submit} disabled={submitting} className="profile-apply-btn">{submitting?'提交中…':'提交反馈'}</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const RecommendTab = () => {
    const [type, setType] = useState<'enterprise'|'job'|'user'>('enterprise')
    const [name, setName] = useState('')
    const [link, setLink] = useState('')
    const [description, setDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const submit = async () => {
      if (!name.trim()) { showError('请填写名称'); return }
      try {
        setSubmitting(true)
        const r = await fetch('/api/user-profile?action=submit_recommendation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ type, name, link, description })
        })
        const j = await r.json().catch(() => ({ success: false }))
        if (r.ok && j.success) { showSuccess('推荐已提交'); setName(''); setLink(''); setDescription('') }
        else { showError('提交失败', j.error || '请稍后重试') }
      } catch (e) { showError('提交失败', '网络错误') } finally { setSubmitting(false) }
    }
    return (
      <div className="space-y-4">
        <div className="profile-topbar">
          <div>
            <div className="profile-title">我要推荐</div>
            <div className="profile-subtitle">推荐企业、岗位或优秀用户。</div>
          </div>
        </div>
        <div className="profile-card p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">推荐类型</label>
              <select value={type} onChange={e=>setType(e.target.value as any)} className="w-full rounded-lg border p-2">
                <option value="enterprise">企业</option>
                <option value="job">岗位</option>
                <option value="user">用户</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">名称</label>
              <input value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-lg border p-3" placeholder="例如：GitLab" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">链接（可选）</label>
              <input value={link} onChange={e=>setLink(e.target.value)} className="w-full rounded-lg border p-3" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">推荐理由（可选）</label>
              <textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} className="w-full rounded-lg border p-3" placeholder="简述推荐原因" />
            </div>
            <div className="flex justify-end">
              <button onClick={submit} disabled={submitting} className="profile-apply-btn">{submitting?'提交中…':'提交推荐'}</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-page profile-theme">
      <div className="mesh-background"></div>
      <div className="max-w-7xl mx-auto px-8 py-10 profile-container">
        <div className="mb-4">
          <button className="profile-back-btn" onClick={() => navigate(-1)} aria-label="返回上一页">
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
        </div>
        <div className="profile-dashboard-wrapper">
          {/* Sidebar */}
          <aside className="profile-sidebar">
            <div className="profile-nav-title">Personal Center</div>
            <div className="profile-nav" role="tablist" aria-label="个人中心切换">
              <button className={`profile-nav-item ${tab === 'resume' ? 'active' : ''}`} role="tab" aria-selected={tab === 'resume'} onClick={() => switchTab('resume')}>
                <FileText className={`w-5 h-5 ${tab === 'resume' ? 'text-white' : 'text-gray-400'}`} />
                <span className="text-sm font-medium">我的简历</span>
              </button>
              <button className={`profile-nav-item ${tab === 'favorites' ? 'active' : ''}`} role="tab" aria-selected={tab === 'favorites'} onClick={() => switchTab('favorites')}>
                <Heart className={`w-5 h-5 ${tab === 'favorites' ? 'text-white' : 'text-gray-400'}`} />
                <span className="text-sm font-medium">我的收藏</span>
              </button>
              <button className={`profile-nav-item ${tab === 'feedback' ? 'active' : ''}`} role="tab" aria-selected={tab === 'feedback'} onClick={() => switchTab('feedback')}>
                <MessageSquare className={`w-5 h-5 ${tab === 'feedback' ? 'text-white' : 'text-gray-400'}`} />
                <span className="text-sm font-medium">我要反馈</span>
              </button>
              <button className={`profile-nav-item ${tab === 'recommend' ? 'active' : ''}`} role="tab" aria-selected={tab === 'recommend'} onClick={() => switchTab('recommend')}>
                <ThumbsUp className={`w-5 h-5 ${tab === 'recommend' ? 'text-white' : 'text-gray-400'}`} />
                <span className="text-sm font-medium">我要推荐</span>
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="profile-content-area w-full">
            {tab === 'resume' ? <ResumeTab /> : tab === 'favorites' ? <FavoritesTab /> : tab === 'feedback' ? <FeedbackTab /> : <RecommendTab />}
            {isJobDetailOpen && selectedJob && (
              <JobDetailModal
                job={selectedJob}
                isOpen={isJobDetailOpen}
                onClose={() => { setIsJobDetailOpen(false); setSelectedJob(null) }}
                onSave={() => handleRemoveFavorite(selectedJob.id)}
                isSaved={true}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
