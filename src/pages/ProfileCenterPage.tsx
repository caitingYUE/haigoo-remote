import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FileText, Upload, CheckCircle, Heart, ArrowLeft, MessageSquare, ThumbsUp, Crown, ChevronLeft, ChevronRight, Bell, Trash2, Edit2, X, Check, ChevronDown, Zap, Download, Briefcase, Settings } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { trackingService } from '../services/tracking-service'
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'
import { processedJobsService } from '../services/processed-jobs-service'
import { usePageCache } from '../hooks/usePageCache'
import { Job } from '../types'
import JobCardNew from '../components/JobCardNew'
import JobDetailModal from '../components/JobDetailModal'
import { MembershipApplicationModal } from '../components/MembershipApplicationModal'
import { MembershipUpgradeModal } from '../components/MembershipUpgradeModal'
import { MembershipCertificateModal } from '../components/MembershipCertificateModal'
import MyApplicationsTab from '../components/MyApplicationsTab'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { SUBSCRIPTION_TOPICS, MAX_SUBSCRIPTION_TOPICS } from '../constants/subscription-topics'

type TabKey = 'resume' | 'favorites' | 'applications' | 'feedback' | 'subscriptions' | 'membership' | 'settings'

export default function ProfileCenterPage() {
  const { user: authUser, token, isMember, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initialTab: TabKey = (() => {
    const t = new URLSearchParams(location.search).get('tab') as TabKey | null
    return t && ['resume', 'favorites', 'applications', 'feedback', 'subscriptions', 'membership', 'settings'].includes(t) ? t : 'resume'
  })()

  const [tab, setTab] = useState<TabKey>(initialTab)

  // Sync tab with URL query parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const urlTab = searchParams.get('tab') as TabKey | null
    if (urlTab && ['resume', 'favorites', 'applications', 'feedback', 'subscriptions', 'membership', 'settings'].includes(urlTab)) {
      setTab(urlTab)
    }
  }, [location.search])

  const [isUploading, setIsUploading] = useState(false)
  const [resumeScore, setResumeScore] = useState<number>(0)
  // Define suggestion type
  interface AiSuggestion {
    category: string
    priority: '高' | '中' | '低'
    issue: string
    suggestion: string
  }

  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]) // Store AI suggestions

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
  const [showCertificateModal, setShowCertificateModal] = useState(false)
   
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
        body: JSON.stringify({ jobId: job.id, job })
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
    if (t && ['resume', 'favorites', 'feedback'].includes(t)) setTab(t as TabKey)
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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  useEffect(() => {
    ; (async () => {
      try {
        if (!authUser || !token) {
          console.log('[ProfileCenter] No auth user or token, clearing favorites')
          setFavorites([])
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
          console.log('[ProfileCenter] No auth user or token, clearing resume state')
          setLatestResume(null)
          setResumeText('')
          setPreviewUrl(null)
          setResumeScore(0)
          setAiSuggestions([])
          setFileType('')
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

          // Restore AI Analysis Result
          if (latestResumeData.aiScore) {
            setResumeScore(latestResumeData.aiScore)
          }
          if (latestResumeData.aiSuggestions) {
            try {
              const suggestions = typeof latestResumeData.aiSuggestions === 'string'
                ? JSON.parse(latestResumeData.aiSuggestions)
                : latestResumeData.aiSuggestions
              if (Array.isArray(suggestions)) {
                setAiSuggestions(suggestions)
              }
            } catch (e) {
              console.warn('[ProfileCenter] Failed to parse aiSuggestions', e)
            }
          }

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
          console.log('[ProfileCenter] No resumes found in database, clearing resume state')
          setLatestResume(null)
          setResumeText('')
          setPreviewUrl(null)
          setResumeScore(0)
          setAiSuggestions([])
          setFileType('')
        }
      } catch (e) {
        console.error('[ProfileCenter] ❌ Failed to fetch resumes:', e)
      }
    })()
  }, [authUser, token])


  const favoritesWithStatus = useMemo(() => favorites, [favorites])

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState<string>('')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. File Type Validation
    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
    if (!validTypes.includes(file.type)) {
      showError('文件格式不支持', '请上传 PDF, DOC 或 DOCX 格式的简历')
      return
    }

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
      // Track upload start
      trackingService.track('upload_resume', {
        source: 'personal_center',
        file_type: file.type,
        file_size: file.size
      })

      // 2. 调用 API 上传并解析
      const formData = new FormData()
      formData.append('file', file)
      formData.append('metadata', JSON.stringify({ source: 'personal_center' }))

      const uploadResp = await fetch('/api/resumes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (uploadResp.ok) {
        const uploadResult = await uploadResp.json()
        if (uploadResult.success) {
          const finalResumeId = uploadResult.id
          console.log('[ProfileCenter] Uploaded resume with ID:', finalResumeId)

          if (finalResumeId) {
            setLatestResume(prev => ({ ...prev!, id: finalResumeId }))
          }

          // Use server parsed text if available, otherwise fall back to client parse
          const serverText = uploadResult.data?.text || uploadResult.data?.content
          if (serverText && serverText.length > 50) {
            setResumeText(serverText)
          } else {
            // Fallback to client side parsing if server failed to extract text
            const parsed = await parseResumeFileEnhanced(file)
            if (parsed && parsed.success && parsed.textContent) {
              setResumeText(parsed.textContent)
              // Sync text back to server?
              // Ideally server parser should work. 
            }
          }

          showSuccess('简历上传成功！', '您可以点击按钮进行AI深度分析')
        } else {
          throw new Error(uploadResult.error || 'Upload failed')
        }
      } else {
        throw new Error('Upload request failed')
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
    // 确保 resumeText 存在
    if (!resumeText || resumeText.length < 50) {
      showError('无法分析', '简历内容为空或过短，请重新上传')
      return
    }

    // 滚动到分析区域，确保用户看到进度
    const analysisSection = document.getElementById('ai-analysis-section')
    if (analysisSection) {
      analysisSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    if (!isMember) {
      setUpgradeSource('ai_resume');
      setShowUpgradeModal(true);
      return;
    }

    try {
      showSuccess('正在分析简历...', 'AI 正在深度读取您的简历内容')
      setIsAnalyzing(true)

      // Simulate progress steps
      const steps = [
        '正在解析简历结构...',
        '正在提取关键技能...',
        '正在评估工作经历...',
        '正在生成优化建议...',
        '正在计算综合得分...'
      ]

      let stepIndex = 0
      setAnalysisStep(steps[0])

      const interval = setInterval(() => {
        stepIndex = (stepIndex + 1) % steps.length
        if (stepIndex < steps.length - 1) { // Don't loop endlessly if it takes too long
          setAnalysisStep(steps[stepIndex])
        }
      }, 2500)

      // 获取用户求职意向
      const targetRole = authUser?.profile?.targetRole || ''

      // Call backend API for analysis
      // Ensure we have an ID. If latestResume.id is temporary (timestamp), we might fail if backend doesn't have it.
      // But handleUpload logic tries to sync it.
      // If synced successfully, backend has it.
      // If not synced (e.g. only local parse), we need to ensure content is sent?
      // Our API design for 'analyze' requires 'id'.
      // If id is not found in DB, it returns 404.
      // So we MUST ensure the resume exists in DB before calling analyze.

      // Check if ID is a timestamp (temporary)
      const isTempId = latestResume?.id && /^\d{13}$/.test(latestResume.id);

      // If temp ID or no ID, we might need to create it first (should have been done in upload, but just in case)
      const resumeIdToAnalyze = latestResume?.id;

      // If we are unsure if it's saved, we can try to re-save/sync content
      // But 'analyze' endpoint reads from DB.
      // Let's rely on the upload logic having done its job.
      // But if we see 404 in logs, it means ID is not found.

      console.log('[ProfileCenter] Requesting analysis for ID:', resumeIdToAnalyze);

      const resp = await fetch('/api/resumes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'analyze',
          id: resumeIdToAnalyze,
          targetRole,
          // Fallback: send content if ID might be missing? No, API expects ID to load from DB.
          // If we really want robustness, we could allow sending content directly to analyze endpoint,
          // but that bypasses the "save result to DB" logic unless we also save it there.
        })
      })

      const result = await resp.json()

      clearInterval(interval)

      if (resp.ok && result.success) {
        setResumeScore(result.data.score || 0)
        setAiSuggestions(result.data.suggestions || [])
        showSuccess('简历分析完成！', `您的简历得分：${result.data.score || 0}%`)

        trackingService.track('analyze_resume', {
          resume_id: resumeIdToAnalyze,
          score: result.data.score,
          suggestion_count: result.data.suggestions?.length || 0
        })
      } else {
        console.error('[ProfileCenter] Analysis failed:', result);
        if (result.limitReached) {
          showError('次数限制', '每天只能使用1次简历分析功能')
        } else if (result.contentUnchanged) {
          showError('需要更新简历', '简历内容未变更。如需重新分析，请更新简历内容并重新上传。')
        } else {
          // Handle "Resume content is empty" specifically
          if (result.error === 'Resume content is empty') {
            // Try to sync content again
            console.log('[ProfileCenter] Content missing on server, trying to sync...');
            if (resumeIdToAnalyze && resumeText) {
              await fetch('/api/resumes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'update_content', id: resumeIdToAnalyze, contentText: resumeText })
              });
              // Retry analysis once
              const retryResp = await fetch('/api/resumes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'analyze', id: resumeIdToAnalyze, targetRole })
              });
              const retryResult = await retryResp.json();
              if (retryResp.ok && retryResult.success) {
                setResumeScore(retryResult.data.score || 0)
                setAiSuggestions(retryResult.data.suggestions || [])
                showSuccess('简历分析完成！', `您的简历得分：${retryResult.data.score || 0}%`)
                return;
              }
            }
          }
          throw new Error(result.error || '分析未返回结果')
        }
      }
    } catch (aiError) {
      console.warn('AI analysis failed:', aiError)
      showError('分析失败', 'AI 服务暂时繁忙，请稍后重试')
    } finally {
      setIsAnalyzing(false)
      setAnalysisStep('')
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

        trackingService.track('delete_resume', { resume_id: latestResume.id })
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">简历优化</h2>
          <p className="text-slate-500 mt-2 text-lg">利用 AI 智能分析，获取专业的简历优化建议。</p>
        </div>
      </div>

      {/* 分数条 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-medium text-slate-900">简历综合得分</p>
          <p className="text-base font-bold text-indigo-600">{Math.max(0, Math.min(100, resumeScore))}%</p>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, resumeScore))}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Top Section: Resume Preview & Basic Info */}
        <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[500px] flex flex-col w-full`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900 px-1">您的简历</h3>
            {!latestResume && (
              <p className="text-xs text-slate-400">支持 PDF、DOC、DOCX</p>
            )}
          </div>
          {!latestResume ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <div className="flex flex-col items-center gap-2 text-center max-w-[520px] mx-auto p-8">
                <FileText className="w-12 h-12 text-slate-400 mb-2" />
                <p className="text-lg font-bold text-slate-900">暂无简历</p>
                <p className="text-sm text-slate-500 mb-6">拖拽文件到此处或点击上传</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium flex items-center justify-center w-full max-w-[240px]"
                >
                  <Upload className="w-4 h-4 mr-2" />上传简历
                </button>
                <p className="text-xs text-slate-400 mt-4">支持 PDF、DOC、DOCX</p>
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
                <div className="rounded-xl border border-slate-200 flex-1 overflow-hidden bg-slate-50/50 flex flex-col min-h-[400px] max-h-[700px]">
                  {previewUrl && fileType === 'application/pdf' ? (
                    <iframe
                      src={previewUrl}
                      className="w-full h-full min-h-[400px] bg-white"
                      title="Resume Preview"
                    />
                  ) : previewUrl && fileType.startsWith('image/') ? (
                    <div className="w-full h-full overflow-auto flex justify-center bg-slate-100 p-4">
                      <img src={previewUrl} alt="Resume" className="max-w-full h-auto shadow-md" />
                    </div>
                  ) : (
                    <div className="w-full h-full overflow-auto p-4 md:p-8 bg-slate-100 shadow-inner">
                      <div className="max-w-[210mm] mx-auto bg-white shadow-md min-h-[297mm] p-8 md:p-12">
                        <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed max-w-none">{resumeText || '预览暂不可用'}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} className="hidden" />
          {isUploading && (
            <div className="mt-4 text-sm text-slate-500 text-center">正在上传并分析...</div>
          )}
        </div>

        {/* Bottom Section: AI Analysis Results */}
        <div id="ai-analysis-section" className="space-y-4 w-full">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 px-1">AI 优化建议</h3>
          </div>

          <div className="space-y-3">
            {!resumeText ? (
              <div className="p-8 bg-slate-50 text-slate-500 rounded-xl text-center border-2 border-dashed border-slate-200">
                <Crown className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p>上传简历以解锁 AI 智能优化建议。</p>
              </div>
            ) : isAnalyzing ? (
              <div className="p-12 bg-white border border-indigo-100 rounded-xl text-center shadow-sm">
                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
                <h4 className="text-lg font-bold text-slate-900 mb-2">{analysisStep || '正在初始化 AI 引擎...'}</h4>
                <p className="text-slate-500">正在进行深度分析，这可能需要 30-60 秒，请耐心等待...</p>
              </div>
            ) : aiSuggestions.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {aiSuggestions.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:border-indigo-200 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${item.priority === '高' ? 'bg-red-50 text-red-600' :
                        item.priority === '中' ? 'bg-orange-50 text-orange-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                        <span className="font-bold text-sm">{item.priority}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h4 className="font-bold text-base text-slate-900 flex-1">{item.issue}</h4>
                          <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full flex-shrink-0 whitespace-nowrap">{item.category}</span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <span className="font-semibold text-indigo-600 mr-1">建议修改：</span>
                          {item.suggestion}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Re-analyze Button */}
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleAnalyzeResume}
                    disabled={isAnalyzing}
                    className={`px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-md flex items-center justify-center gap-2 w-full
                             ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}
                          `}
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        正在分析...
                      </>
                    ) : (
                      <>
                        <Crown className="w-5 h-5 text-yellow-300" />
                        重新生成 AI 建议
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                <p className="text-base text-indigo-900 font-medium mb-4">
                  准备好使用 AI 优化简历了吗？
                </p>
                <button
                  onClick={handleAnalyzeResume}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-md flex items-center justify-center gap-2 mx-auto w-full"
                >
                  <Crown className="w-5 h-5 text-yellow-300" />
                  生成 AI 建议
                </button>
                <p className="text-xs text-indigo-600/70 mt-3">会员专属权益 • 不限次数优化</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const FavoritesTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">我的收藏</h2>
          <p className="text-slate-500 mt-1">您收藏的职位列表。</p>
        </div>
        <span className="text-xs font-normal text-gray-400">仅保留近1年的收藏记录</span>
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
                  onDelete={(jobId) => handleRemoveFavorite(jobId)}
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
    const [myFeedbacks, setMyFeedbacks] = useState<any[]>([])

    const fetchMyFeedbacks = async () => {
      try {
        const res = await fetch('/api/user-profile?action=my_feedbacks', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (data.success) {
          setMyFeedbacks(data.feedbacks || [])
        }
      } catch (e) {
        console.error('Failed to fetch feedbacks', e)
      }
    }

    useEffect(() => {
      fetchMyFeedbacks()
    }, [])

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
        if (r.ok && j.success) {
          showSuccess('反馈已提交');
          setAccuracy('unknown');
          setContent('');
          setContact('');
          fetchMyFeedbacks(); // Refresh list
        }
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

        {/* Feedback History */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">历史反馈记录</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {myFeedbacks.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">暂无反馈记录</div>
            ) : (
              myFeedbacks.map(item => (
                <div key={item.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${item.accuracy === 'accurate' ? 'bg-green-100 text-green-700' :
                      item.accuracy === 'inaccurate' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                      {item.accuracy === 'accurate' ? '准确' : item.accuracy === 'inaccurate' ? '不准确' : '平台建议/未知'}
                    </span>
                    <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-800 text-sm mb-3 whitespace-pre-wrap">{item.content}</p>
                  {item.replyContent && (
                    <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100 mt-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-indigo-700">管理员回复</span>
                        <span className="text-xs text-indigo-400">{new Date(item.repliedAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-indigo-900">{item.replyContent}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  const SubscriptionsTab = () => {
    const [subscriptions, setSubscriptions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTopics, setEditTopics] = useState<string[]>([])
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsDropdownOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const fetchSubscriptions = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/auth?action=get-subscriptions', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (data.success) {
          setSubscriptions(data.subscriptions || [])
        }
      } catch (e) {
        console.error('Failed to fetch subscriptions', e)
        showError('加载失败', '无法获取订阅列表')
      } finally {
        setLoading(false)
      }
    }

    useEffect(() => {
      fetchSubscriptions()
    }, [])

    const startEditing = (sub: any) => {
      setEditingId(sub.subscription_id)
      setEditTopics(sub.topic ? sub.topic.split(',') : [])
      setIsDropdownOpen(false)
    }

    const toggleEditTopic = (val: string) => {
      if (editTopics.includes(val)) {
        setEditTopics(editTopics.filter(t => t !== val))
      } else {
        if (editTopics.length >= MAX_SUBSCRIPTION_TOPICS) return
        setEditTopics([...editTopics, val])
      }
    }

    const handleUpdate = async (id: string) => {
      if (editTopics.length === 0) {
        showError('请至少选择一个类型')
        return
      }
      try {
        const res = await fetch('/api/auth?action=update-subscription', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id, topic: editTopics.join(',') })
        })
        const data = await res.json()
        if (data.success) {
          showSuccess('更新成功')
          setEditingId(null)
          fetchSubscriptions()
        } else {
          showError('更新失败', data.error)
        }
      } catch (e) {
        showError('更新失败', '网络错误')
      }
    }

    const handleDelete = async (id: string) => {
      if (!confirm('确定要取消订阅吗？')) return
      try {
        const res = await fetch('/api/auth?action=delete-subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id })
        })
        const data = await res.json()
        if (data.success) {
          showSuccess('已取消订阅')
          fetchSubscriptions()
        } else {
          showError('操作失败', data.error)
        }
      } catch (e) {
        showError('操作失败', '网络错误')
      }
    }

    const getTopicLabel = (topicStr: string) => {
      if (!topicStr) return '无'
      const values = topicStr.split(',')
      return values.map(v => SUBSCRIPTION_TOPICS.find(t => t.value === v)?.label || v).join(', ')
    }

    const getEditLabel = () => {
      if (editTopics.length === 0) return '请选择'
      if (editTopics.length === 1) return SUBSCRIPTION_TOPICS.find(t => t.value === editTopics[0])?.label || editTopics[0]
      return `已选 ${editTopics.length} 个`
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">订阅管理</h2>
            <p className="text-slate-500 mt-1">管理您的岗位推送订阅。</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
          {loading ? (
            <div className="p-8 text-center text-slate-500">加载中...</div>
          ) : subscriptions.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <Bell className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-900 font-medium">暂无订阅</p>
              <p className="text-slate-500 text-sm mt-1">在首页订阅后，可以在这里管理</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {subscriptions.map(sub => (
                <div key={sub.subscription_id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sub.channel === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {sub.channel === 'email' ? 'Email' : '飞书'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${sub.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {sub.status === 'active' ? '活跃' : '已暂停'}
                      </span>
                    </div>
                    <div className="font-medium text-slate-900">{sub.identifier}</div>
                    <div className="text-sm text-slate-500 mt-1 relative">
                      订阅内容：
                      {editingId === sub.subscription_id ? (
                        <div className="inline-flex items-center gap-2 ml-2 relative" ref={dropdownRef}>
                          <div className="relative">
                            <button
                              className="border rounded px-2 py-1 bg-white text-sm min-w-[100px] flex items-center justify-between"
                              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                              <span className="truncate max-w-[120px]">{getEditLabel()}</span>
                              <ChevronDown className="w-3 h-3 ml-1 text-slate-400" />
                            </button>
                            {isDropdownOpen && (
                              <div className="absolute top-full left-0 mt-1 w-64 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2">
                                <div className="text-xs text-slate-500 px-2 py-1 mb-1">最多可选 {MAX_SUBSCRIPTION_TOPICS} 个</div>
                                {SUBSCRIPTION_TOPICS.map(opt => {
                                  const isSelected = editTopics.includes(opt.value)
                                  return (
                                    <div
                                      key={opt.value}
                                      onClick={() => toggleEditTopic(opt.value)}
                                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors
                                                        ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}
                                                    `}
                                    >
                                      <span>{opt.label}</span>
                                      {isSelected && <Check className="w-3.5 h-3.5" />}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          <button onClick={() => handleUpdate(sub.subscription_id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <span className="font-medium text-slate-700 ml-1">
                          {getTopicLabel(sub.topic)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {editingId !== sub.subscription_id && (
                      <>
                        <button
                          onClick={() => startEditing(sub)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          修改
                        </button>
                        <button
                          onClick={() => handleDelete(sub.subscription_id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          取消
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }


  const SettingsTab = () => {
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDeleteAccount = async () => {
      if (!confirm('确定要永久删除账号吗？所有数据（简历、收藏、订阅等）将无法恢复。')) return
      if (!confirm('再次确认：此操作不可撤销，确定要删除吗？')) return

      try {
        setIsDeleting(true)
        const res = await fetch('/api/user-profile?action=delete_account', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        const data = await res.json()

        if (res.ok && data.success) {
          showSuccess('账号已永久删除')
          // Logout and redirect
          logout()
          navigate('/')
        } else {
          throw new Error(data.error || '删除失败')
        }
      } catch (error) {
        showError('删除失败', error instanceof Error ? error.message : '无法删除账号，请稍后重试')
      } finally {
        setIsDeleting(false)
      }
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">账号设置</h2>
            <p className="text-slate-500 mt-1">管理您的账号安全与隐私。</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="space-y-8">
            {/* Danger Zone */}
            <div>
              <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                危险区域
              </h3>
              <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">删除账号</h4>
                    <p className="text-sm text-slate-600">
                      永久删除您的账号及所有相关数据（简历、收藏、订阅记录等）。
                      <br />
                      <span className="text-red-600 font-medium">此操作无法撤销。</span>
                    </p>
                  </div>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="px-5 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all font-medium shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? '正在删除...' : '删除账号'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <button
            className="flex items-center text-slate-500 hover:text-slate-900 transition-colors group"
            onClick={() => navigate(-1)}
            aria-label="返回上一页"
          >
            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center mr-2 shadow-sm group-hover:border-indigo-300 transition-all">
              <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </div>
            <span className="text-sm font-medium">返回上一页</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className={`transition-all duration-300 ease-in-out flex-shrink-0 space-y-6 relative ${isSidebarCollapsed ? 'w-20' : 'w-full lg:w-72'}`}>
            {/* Toggle Button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="absolute -right-3 top-6 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-md text-slate-500 hover:text-indigo-600 z-10 hidden lg:flex hover:scale-110 transition-transform"
            >
              {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>

            {/* Member Card - Premium Upgrade */}
            {!isSidebarCollapsed ? (
              <div className="bg-gradient-to-br from-indigo-900 via-blue-800 to-teal-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-white/10">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-400/20 rounded-full -mr-10 -mt-10 blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-400/20 rounded-full -ml-10 -mb-10 blur-2xl animate-pulse delay-700"></div>

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-sm border border-white/10">
                        <Crown className="w-5 h-5 text-indigo-200" />
                      </div>
                      <span className="font-bold text-sm tracking-wide text-white/90">会员中心</span>
                    </div>
                    {isMember && (
                      <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-[10px] font-bold text-teal-200 uppercase">
                        Active
                      </span>
                    )}
                  </div>

                  {isMember ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-indigo-200 mb-1">当前等级</p>
                        <p className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                          {(authUser?.membershipLevel === 'club_go' || !authUser?.membershipLevel) ? 'Haigoo Member' : 'Haigoo Member'}
                          <CheckCircle className="w-4 h-4 text-teal-300" />
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-indigo-200 mb-1">有效期至</p>
                        <p className="text-sm font-medium text-white/80 font-mono">
                          {authUser?.memberExpireAt ? new Date(authUser.memberExpireAt).toLocaleDateString() : '永久有效'}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate('/membership')}
                        className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl transition-all shadow-lg backdrop-blur-md flex items-center justify-center gap-2 group"
                      >
                        续费 / 升级权益 <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                      <button
                        onClick={() => setShowCertificateModal(true)}
                        className="w-full py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-indigo-100 text-xs font-bold rounded-xl transition-all shadow-lg backdrop-blur-md flex items-center justify-center gap-2 group mt-2"
                      >
                        下载会员证书 <Download className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-bold text-white mb-2">开通会员</h4>
                        <p className="text-xs text-indigo-100 leading-relaxed opacity-90">
                          解锁无限次 AI 简历优化、内推直达通道及职位专属推荐权益。
                        </p>
                      </div>
                      <button
                        onClick={() => navigate('/membership')}
                        className="w-full py-3 bg-gradient-to-r from-white via-indigo-50 to-teal-50 hover:from-indigo-100 hover:to-teal-100 text-indigo-900 text-sm font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
                      >
                        立即开通 <Zap className="w-4 h-4 text-teal-600 group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex justify-center" title="会员权益">
                <button onClick={() => setIsSidebarCollapsed(false)} className="p-3 bg-gradient-to-br from-indigo-900 to-teal-800 text-white rounded-2xl hover:shadow-lg transition-all shadow-md border border-white/10">
                  <Crown className="w-6 h-6" />
                </button>
              </div>
            )}

            <div>
              <div className={`text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-4 ${isSidebarCollapsed ? 'text-center px-0' : ''}`}>
                {isSidebarCollapsed ? 'MENU' : 'Dashboard'}
              </div>
              <nav className="space-y-1" role="tablist">
                {[
                  { id: 'resume', label: '我的简历', icon: FileText },
                  { id: 'favorites', label: '我的收藏', icon: Heart },
                  { id: 'applications', label: '我的申请', icon: Briefcase },
                  { id: 'subscriptions', label: '订阅管理', icon: Bell },
                  { id: 'feedback', label: '我要反馈', icon: MessageSquare },
                  { id: 'settings', label: '注销账号', icon: Settings }
                ].map((item) => (
                  <button
                    key={item.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative
                        ${tab === item.id
                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100'
                        : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                      } 
                        ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                    role="tab"
                    aria-selected={tab === item.id}
                    onClick={() => switchTab(item.id as TabKey)}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon className={`w-5 h-5 transition-colors ${tab === item.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                    {!isSidebarCollapsed && (
                      <span>{item.label}</span>
                    )}
                    {tab === item.id && !isSidebarCollapsed && (
                      <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            <div className="transition-all duration-300">
              {tab === 'resume' && <ResumeTab />}
              {tab === 'favorites' && <FavoritesTab />}
              {tab === 'applications' && <MyApplicationsTab />}
              {tab === 'feedback' && <FeedbackTab />}
              {tab === 'subscriptions' && <SubscriptionsTab />}
              {tab === 'membership' && <ResumeTab />}
              {tab === 'settings' && <SettingsTab />}
            </div>
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
          {authUser && (
            <MembershipCertificateModal
              isOpen={showCertificateModal}
              onClose={() => setShowCertificateModal(false)}
              user={authUser}
            />
          )}
        </div>
      </div>
    </div>
  )
}
