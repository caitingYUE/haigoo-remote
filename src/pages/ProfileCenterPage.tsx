import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, Upload, Download, CheckCircle, AlertCircle, Heart, ArrowLeft, MessageSquare, ThumbsUp, Crown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'
import { resumeService } from '../services/resume-service'
import { processedJobsService } from '../services/processed-jobs-service'
import { usePageCache } from '../hooks/usePageCache'
import { Job } from '../types'
import JobCardNew from '../components/JobCardNew'
import JobDetailModal from '../components/JobDetailModal'
import { MembershipUpgradeModal } from '../components/MembershipUpgradeModal'
import { useNotificationHelpers } from '../components/NotificationSystem'

type TabKey = 'resume' | 'favorites' | 'feedback' | 'recommend'

export default function ProfileCenterPage() {
  const { user: authUser, token } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initialTab: TabKey = (() => {
    const t = new URLSearchParams(location.search).get('tab') as TabKey | null
    return t && ['resume', 'favorites', 'feedback', 'recommend'].includes(t) ? t : 'resume'
  })()

  const [tab, setTab] = useState<TabKey>(initialTab)
  const [isUploading, setIsUploading] = useState(false)
  const [resumeScore, setResumeScore] = useState<number>(0)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]) // Store AI suggestions
  
  const [latestResume, setLatestResume] = useState<{ id: string; name: string } | null>(null)
  const [resumeText, setResumeText] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileType, setFileType] = useState<string>('')

  // Cleanup object URL
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const [favorites, setFavorites] = useState<any[]>([])
  const [loadingFavorites, setLoadingFavorites] = useState<boolean>(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const { showSuccess, showError } = useNotificationHelpers()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeSource, setUpgradeSource] = useState<'referral' | 'ai_resume' | 'general'>('general')

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

  const handleAddFavorite = async (job: Job) => {
    try {
      const resp = await fetch(`/api/user-profile?action=favorites_add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ jobId: job.id })
      })

      if (resp.ok) {
        setFavorites(prev => [job, ...prev])
        showSuccess('已收藏')
      } else {
        throw new Error('Failed to add')
      }
    } catch (error) {
      showError('操作失败', '无法添加收藏')
    }
  }

  const handleToggleFavorite = async (job: Job) => {
    const isSaved = favorites.some(f => (f.id === job.id) || (f.jobId === job.id))
    if (isSaved) {
      await handleRemoveFavorite(job.id)
    } else {
      await handleAddFavorite(job)
    }
  }

  useEffect(() => {
    const sp = new URLSearchParams(location.search)
    const t = sp.get('tab') as TabKey | null
    if (t && ['resume', 'favorites', 'feedback', 'recommend'].includes(t)) setTab(t as TabKey)
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

  // Fetch user resume on page load - FIXED: Read directly from resumes API
  useEffect(() => {
    (async () => {
      try {
        if (!authUser || !token) {
          console.log('[ProfileCenter] No auth user or token')
          return
        }

        console.log('[ProfileCenter] Fetching resumes from /api/resumes...')

        // ✅ Read directly from resumes table instead of profile.resumeFiles
        const resumesResp = await fetch('/api/resumes', {
          headers: { Authorization: `Bearer ${token}` }
        })

        if (!resumesResp.ok) {
          console.error('[ProfileCenter] Failed to fetch resumes:', resumesResp.status)
          return
        }

        const resumesData = await resumesResp.json()
        console.log('[ProfileCenter] Resumes response:', resumesData)

        // Handle the response format from /api/resumes
        if (resumesData.data && Array.isArray(resumesData.data) && resumesData.data.length > 0) {
          const latestResumeData = resumesData.data[0]
          console.log('[ProfileCenter] ✅ Found resume:', latestResumeData)

          setLatestResume({
            id: latestResumeData.id || latestResumeData.resume_id,
            name: latestResumeData.fileName || latestResumeData.file_name || 'Resume'
          })

          // Set resume text if available
          if (latestResumeData.contentText) {
            setResumeText(latestResumeData.contentText)
          } else if (latestResumeData.content_text) {
            setResumeText(latestResumeData.content_text)
          } else if (latestResumeData.parseResult?.text) {
            setResumeText(latestResumeData.parseResult.text)
          } else if (latestResumeData.parse_result?.text) {
            const parseResult = typeof latestResumeData.parse_result === 'string'
              ? JSON.parse(latestResumeData.parse_result)
              : latestResumeData.parse_result
            setResumeText(parseResult.text || parseResult.content || '')
          }

          // Fetch and set preview content
          const rId = latestResumeData.id || latestResumeData.resume_id
          
          // Robust file type detection
          let fType = (latestResumeData.fileType || latestResumeData.file_type || '').toLowerCase()
          if (!fType) {
             const fName = latestResumeData.fileName || latestResumeData.file_name || ''
             const parts = fName.split('.')
             if (parts.length > 1) fType = parts[parts.length - 1].toLowerCase()
          }

          let mimeType = 'text/plain'
          if (fType === 'pdf') mimeType = 'application/pdf'
          else if (fType === 'doc') mimeType = 'application/msword'
          else if (fType === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          else if (fType === 'png' || fType === 'jpg' || fType === 'jpeg') mimeType = `image/${fType}`
          
          console.log(`[ProfileCenter] Resolved file type: ${fType}, MIME: ${mimeType}`)
          setFileType(mimeType)

          if (rId) {
             try {
                 console.log('[ProfileCenter] Fetching preview content for', rId)
                 const contentResp = await fetch(`/api/resumes?action=content&id=${rId}`, {
                     headers: { Authorization: `Bearer ${token}` }
                 })
                 if (contentResp.ok) {
                     const contentData = await contentResp.json()
                     if (contentData.success && contentData.content) {
                         try {
                            // Convert base64 to Blob
                            const byteCharacters = atob(contentData.content)
                            const byteNumbers = new Array(byteCharacters.length)
                            for (let i = 0; i < byteCharacters.length; i++) {
                                byteNumbers[i] = byteCharacters.charCodeAt(i)
                            }
                            const byteArray = new Uint8Array(byteNumbers)
                            const blob = new Blob([byteArray], { type: mimeType })
                            const url = URL.createObjectURL(blob)
                            setPreviewUrl(url)
                            console.log('[ProfileCenter] Preview loaded successfully with MIME', mimeType)
                         } catch (conversionErr) {
                             console.error('[ProfileCenter] Failed to convert content to blob:', conversionErr)
                         }
                     } else {
                         console.warn('[ProfileCenter] No content in response:', contentData)
                     }
                 } else {
                     console.warn('[ProfileCenter] Content fetch failed status:', contentResp.status)
                 }
             } catch (err) {
                 console.error('[ProfileCenter] Failed to load preview content:', err)
             }
          }

          console.log('[ProfileCenter] ✅ Resume loaded successfully')
        } else {
          console.log('[ProfileCenter] No resumes found in database')
        }
      } catch (e) {
        console.error('[ProfileCenter] ❌ Failed to fetch resumes:', e)
      }
    })()
  }, [authUser, token])


  const favoritesWithStatus = useMemo(() => favorites, [favorites])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setResumeScore(0)
    setAiSuggestions([])

    // 1. 乐观更新：立即展示文件
    const tempId = Date.now().toString()
    setLatestResume({ id: tempId, name: file.name })
    
    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setFileType(file.type)
    
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

          showSuccess('简历上传成功！', '您可以点击右侧按钮进行AI深度分析')

          // 4. AI 分析不再自动触发，由用户手动触发
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

  const handleAnalyzeResume = async () => {
    if (!resumeText) {
      showError('无法分析', '简历内容为空，请重新上传')
      return
    }

    const isMember = authUser?.membershipLevel && authUser.membershipLevel !== 'none' && authUser.membershipExpireAt && new Date(authUser.membershipExpireAt) > new Date();

    if (!isMember) {
      setUpgradeSource('ai_resume');
      setShowUpgradeModal(true);
      return;
    }

    try {
      showSuccess('正在分析简历...', 'AI 正在深度读取您的简历内容')
      const analysis = await resumeService.analyzeResume(resumeText)
      if (analysis.success && analysis.data) {
        setResumeScore(analysis.data.score || 0)
        setAiSuggestions(analysis.data.suggestions || [])
        showSuccess('简历分析完成！', `您的简历得分：${analysis.data.score || 0}%`)
      } else {
        throw new Error(analysis.error || '分析未返回结果')
      }
    } catch (aiError) {
      console.warn('AI analysis failed:', aiError)
      showError('分析失败', 'AI 服务暂时繁忙，请稍后重试')
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
        setAiSuggestions([])
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Resume Optimization</h2>
          <p className="text-slate-500 mt-1">Enhance your resume with AI-powered suggestions.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
          <Download className="w-4 h-4" />Download Optimized Resume
        </button>
      </div>

      {/* 分数条 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-medium text-slate-900">Overall Resume Score</p>
          <p className="text-base font-bold text-indigo-600">{Math.max(0, Math.min(100, resumeScore))}%</p>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, resumeScore))}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左列：上传区 */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 px-1">Your Resume</h3>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[400px] flex flex-col">
            {!latestResume ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <div className="flex flex-col items-center gap-2 text-center max-w-[520px] mx-auto p-8">
                  <FileText className="w-12 h-12 text-slate-400 mb-2" />
                  <p className="text-lg font-bold text-slate-900">No resume uploaded yet</p>
                  <p className="text-sm text-slate-500 mb-6">Drag and drop your file here or click to upload.</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium flex items-center justify-center w-full max-w-[240px]"
                  >
                    <Upload className="w-4 h-4 mr-2" />Upload Resume
                  </button>
                  <p className="text-xs text-slate-400 mt-4">支持 PDF、DOC、DOCX、TXT</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 h-full flex flex-col">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <span className="font-medium text-slate-900">{latestResume.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center"
                        title="重新上传简历"
                      >
                        <Upload className="w-4 h-4 mr-1" />
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
                {(previewUrl || resumeText) && (
                  <div className="rounded-xl border border-slate-200 flex-1 overflow-hidden bg-slate-50/50 flex flex-col min-h-[500px]">
                    {previewUrl && fileType === 'application/pdf' ? (
                      <iframe
                        src={previewUrl}
                        className="w-full h-full min-h-[500px] bg-white"
                        title="Resume Preview"
                      />
                    ) : previewUrl && fileType.startsWith('image/') ? (
                      <div className="w-full h-full overflow-auto flex justify-center bg-slate-100 p-4">
                        <img src={previewUrl} alt="Resume" className="max-w-full h-auto shadow-md" />
                      </div>
                    ) : (
                      <div className="w-full h-full overflow-auto p-4 md:p-8 bg-slate-100 shadow-inner">
                        <div className="max-w-[210mm] mx-auto bg-white shadow-md min-h-[297mm] p-8 md:p-12">
                          <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed max-w-none">{resumeText || 'Preview not available. Content extracted below.'}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleUpload} className="hidden" />
            {isUploading && (
              <div className="mt-4 text-sm text-slate-500 text-center">正在上传并分析...</div>
            )}
          </div>
        </div>

        {/* 右列：建议与CTA */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 px-1">AI-Powered Suggestions</h3>
          <div className="space-y-3">
            {!resumeText ? (
              <div className="p-4 bg-slate-50 text-slate-600 rounded-lg text-sm border border-slate-200">
                Upload your resume to unlock AI-powered optimization suggestions.
              </div>
            ) : aiSuggestions.length === 0 && (
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                <p className="text-sm text-indigo-900 font-medium mb-3">Ready to optimize your resume?</p>
                <button
                  onClick={handleAnalyzeResume}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-sm flex items-center justify-center gap-2"
                >
                  <Crown className="w-4 h-4 text-yellow-300" />
                  Generate AI Suggestions
                </button>
                <p className="text-xs text-indigo-600/70 mt-2">Premium Feature</p>
              </div>
            )}

            {aiSuggestions.length > 0 ? (
              aiSuggestions.map((suggestion, idx) => (
                <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-slate-900">Optimization Suggestion</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{suggestion}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 opacity-60">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-slate-900">Strengthen Your Action Verbs</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">Use powerful verbs to describe your accomplishments.</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 opacity-60">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-slate-900">Add Quantifiable Results</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">Include numbers and data to demonstrate your impact.</p>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>
          {aiSuggestions.length > 0 && (
            <div className="flex flex-col gap-3 pt-2">
              <button 
                onClick={() => setAiSuggestions([])}
                className="w-full py-2.5 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              >
                Reset Suggestions
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const FavoritesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">My Favorites</h2>
          <p className="text-slate-500 mt-1">Your bookmarked job postings.</p>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[300px]">
        {loadingFavorites ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        ) : favoritesWithStatus.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center">
            <Heart className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-lg font-bold text-slate-900">还没有收藏职位</p>
            <p className="text-sm text-slate-500 mt-1">在首页点击收藏按钮后，这里将展示已收藏的职位</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {favoritesWithStatus.map((f: any) => (
              <div key={f.id || f.jobId}>
                <JobCardNew
                  job={f as Job}
                  variant="list"
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
    const [accuracy, setAccuracy] = useState<'accurate' | 'inaccurate' | 'unknown'>('unknown')
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
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">我要反馈</h2>
            <p className="text-slate-500 mt-1">反馈岗位或平台信息问题与建议。</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-3">信息准确度</label>
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={accuracy === 'accurate'}
                    onChange={() => setAccuracy('accurate')}
                    className="text-indigo-600 focus:ring-indigo-600"
                  />
                  <span className="text-sm text-slate-700">准确</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={accuracy === 'inaccurate'}
                    onChange={() => setAccuracy('inaccurate')}
                    className="text-indigo-600 focus:ring-indigo-600"
                  />
                  <span className="text-sm text-slate-700">不准确</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={accuracy === 'unknown'}
                    onChange={() => setAccuracy('unknown')}
                    className="text-indigo-600 focus:ring-indigo-600"
                  />
                  <span className="text-sm text-slate-700">不确定</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">反馈内容</label>
              <textarea
                rows={5}
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="请描述问题或建议"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">联系方式（可选）</label>
              <input
                value={contact}
                onChange={e => setContact(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="邮箱或微信"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={submit}
                disabled={submitting}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '提交中…' : '提交反馈'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const RecommendTab = () => {
    const [type, setType] = useState<'enterprise' | 'job' | 'user'>('enterprise')
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
      } catch (e) {
        showError('提交失败', '网络错误')
      } finally { setSubmitting(false) }
    }
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">我要推荐</h2>
            <p className="text-slate-500 mt-1">推荐企业、岗位或优秀用户。</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">推荐类型</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white"
              >
                <option value="enterprise">企业</option>
                <option value="job">岗位</option>
                <option value="user">用户</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">名称</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="例如：GitLab"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">链接（可选）</label>
              <input
                value={link}
                onChange={e => setLink(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">推荐理由（可选）</label>
              <textarea
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="简述推荐原因"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={submit}
                disabled={submitting}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '提交中…' : '提交推荐'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <button
            className="flex items-center text-slate-500 hover:text-slate-900 transition-colors"
            onClick={() => navigate(-1)}
            aria-label="返回上一页"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">返回</span>
          </button>
        </div>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full lg:w-64 flex-shrink-0 space-y-6">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Personal Center</div>
              <div className="space-y-1" role="tablist" aria-label="个人中心切换">
                <button
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'resume' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  role="tab"
                  aria-selected={tab === 'resume'}
                  onClick={() => switchTab('resume')}
                >
                  <FileText className={`w-4 h-4 ${tab === 'resume' ? 'text-white' : 'text-slate-400'}`} />
                  我的简历
                </button>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'favorites' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  role="tab"
                  aria-selected={tab === 'favorites'}
                  onClick={() => switchTab('favorites')}
                >
                  <Heart className={`w-4 h-4 ${tab === 'favorites' ? 'text-white' : 'text-slate-400'}`} />
                  我的收藏
                </button>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'feedback' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  role="tab"
                  aria-selected={tab === 'feedback'}
                  onClick={() => switchTab('feedback')}
                >
                  <MessageSquare className={`w-4 h-4 ${tab === 'feedback' ? 'text-white' : 'text-slate-400'}`} />
                  我要反馈
                </button>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'recommend' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'
                    }`}
                  role="tab"
                  aria-selected={tab === 'recommend'}
                  onClick={() => switchTab('recommend')}
                >
                  <ThumbsUp className={`w-4 h-4 ${tab === 'recommend' ? 'text-white' : 'text-slate-400'}`} />
                  我要推荐
                </button>
              </div>
            </div>

            {/* Membership Card */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
              {/* Decoration */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl"></div>

              <div className="flex items-center gap-2 mb-4 relative z-10">
                <Crown className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-sm text-white">会员权益</h3>
              </div>

              <div className="relative z-10">
                {authUser?.membershipLevel && authUser.membershipLevel !== 'none' && authUser.membershipExpireAt && new Date(authUser.membershipExpireAt) > new Date() ? (
                  <div>
                    <p className="text-xs text-slate-300 mb-2">您当前是 <span className="font-bold text-yellow-300">{authUser.membershipLevel === 'club_go' ? '俱乐部Go会员' : 'Goo+会员'}</span></p>
                    <p className="text-xs text-slate-400 mb-4">有效期至 {new Date(authUser.membershipExpireAt).toLocaleDateString()}</p>
                    <button
                      onClick={() => navigate('/membership')}
                      className="w-full py-2 bg-white/10 border border-white/20 text-white text-xs font-bold rounded-lg hover:bg-white/20 transition-colors"
                    >
                      续费/升级
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-300 mb-4 leading-relaxed">加入俱乐部，解锁内推直达与AI简历深度优化。</p>
                    <button
                      onClick={() => navigate('/membership')}
                      className="w-full py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
                    >
                      立即开通
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {tab === 'resume' ? <ResumeTab /> : tab === 'favorites' ? <FavoritesTab /> : tab === 'feedback' ? <FeedbackTab /> : <RecommendTab />}
            {isJobDetailOpen && selectedJob && (
              <JobDetailModal
                job={selectedJob}
                isOpen={isJobDetailOpen}
                onClose={() => { setIsJobDetailOpen(false); setSelectedJob(null) }}
                onSave={() => handleToggleFavorite(selectedJob)}
                isSaved={favorites.some(f => (f.id === selectedJob.id) || (f.jobId === selectedJob.id))}
                variant="center"
              />
            )}
          </main>
          <MembershipUpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            triggerSource={upgradeSource}
          />
        </div>
      </div>
    </div>
  )
}
