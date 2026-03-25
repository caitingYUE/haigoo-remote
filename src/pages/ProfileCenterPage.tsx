import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { FileText, Upload, CheckCircle, Heart, ArrowLeft, MessageSquare, Crown, ChevronLeft, ChevronRight, Trash2, Sparkles, ArrowRight, Briefcase, Settings, Download, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { trackingService } from '../services/tracking-service'
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'
import { processedJobsService } from '../services/processed-jobs-service'
import { usePageCache } from '../hooks/usePageCache'
import { Job } from '../types'
import JobCardNew from '../components/JobCardNew'
import JobDetailModal from '../components/JobDetailModal'
import { MembershipUpgradeModal } from '../components/MembershipUpgradeModal'
import { MembershipCertificateModal } from '../components/MembershipCertificateModal'
import MyApplicationsTab from '../components/MyApplicationsTab'
import GeneratedPlanView from '../components/GeneratedPlanView'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { markMatchScoreRefresh } from '../utils/match-score-refresh'

type TabKey = 'custom-plan' | 'resume' | 'favorites' | 'applications' | 'feedback' | 'membership' | 'settings'

interface AiSuggestion {
  category: string
  priority: '高' | '中' | '低'
  issue: string
  suggestion: string
}

interface AssistantStrength {
  title: string
  detail: string
}

interface AssistantGrowthArea {
  title: string
  detail: string
  priority?: '高' | '中' | '低'
  focusKey?: string
}

interface AssistantStarGap {
  title: string
  detail: string
  missing?: string[]
  focusKey?: string
}

interface AssistantRewriteDirection {
  title: string
  direction: string
  example?: string
}

interface AssistantInterviewQuestion {
  question: string
  focus?: string
  hint?: string
}

interface AssistantFramework {
  score?: number
  confidenceSummary?: {
    headline?: string
    summary?: string
  }
  strengths?: AssistantStrength[]
  growthAreas?: AssistantGrowthArea[]
  starGaps?: AssistantStarGap[]
  rewriteDirections?: AssistantRewriteDirection[]
  englishInterviewFramework?: {
    summary?: string
    selfIntroOutline?: string[]
    questions?: AssistantInterviewQuestion[]
  }
}

interface AssistantPolishSection {
  heading: string
  body: string
  bullets?: string[]
}

interface AssistantPolishResult {
  mode: 'resume' | 'interview' | 'mock_answer'
  title: string
  sections: AssistantPolishSection[]
  questions?: AssistantInterviewQuestion[]
  question?: string
}

type AssistantConversationKey = 'overview' | 'strengths' | 'growth' | 'interview' | 'polish'

interface AssistantConversationMessage {
  id: string
  role: 'assistant' | 'user'
  title?: string
  body: string
  bullets?: string[]
  accent?: 'neutral' | 'indigo' | 'emerald'
}

interface AssistantConversationRenderableMessage extends AssistantConversationMessage {
  bodyLines: string[]
  bulletLines: string[]
  totalLines: number
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (!value) return fallback
  if (typeof value === 'object') return value as T
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

function splitConversationLines(text: string): string[] {
  if (!text) return []

  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[。！？!?])/g))
    .map((line) => line.trim())
    .filter(Boolean)
}

const AssistantAvatar = memo(function AssistantAvatar() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
      <img src="/copilot.webp" alt="Haigoo Copilot" className="h-full w-full object-cover" loading="eager" decoding="async" draggable={false} />
    </div>
  )
})

const ResumePreviewPane = memo(function ResumePreviewPane({
  previewUrl,
  fileType,
  resumeText
}: {
  previewUrl: string | null
  fileType: string
  resumeText: string
}) {
  return (
    <div className="flex-1 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50/80">
      {previewUrl && fileType === 'application/pdf' ? (
        <iframe src={previewUrl} className="h-[820px] w-full bg-white" title="Resume Preview" />
      ) : previewUrl && fileType.startsWith('image/') ? (
        <div className="flex h-full w-full justify-center overflow-auto bg-slate-100 p-4">
          <img src={previewUrl} alt="Resume" className="h-auto max-w-full rounded-xl shadow-md" />
        </div>
      ) : (
        <div className="h-full min-h-[620px] overflow-auto bg-slate-100 p-4 md:p-8">
          <div className="mx-auto min-h-[297mm] max-w-[210mm] bg-white p-8 shadow-md md:p-12">
            <pre className="max-w-none whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{resumeText || '预览暂不可用'}</pre>
          </div>
        </div>
      )}
    </div>
  )
})

export default function ProfileCenterPage() {
  const { user: authUser, token, isMember, isTrialMember, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const conversationScrollRef = useRef<HTMLDivElement>(null)
  const loadedPreviewResumeIdRef = useRef<string | null>(null)

  const initialTab: TabKey = (() => {
    const t = new URLSearchParams(location.search).get('tab') as TabKey | null
    return t && ['resume', 'favorites', 'applications', 'feedback', 'membership', 'settings'].includes(t) ? t : 'resume'
  })()

  const [tab, setTab] = useState<TabKey>(initialTab)

  // Sync tab with URL query parameter
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const urlTab = searchParams.get('tab') as TabKey | null
    if (urlTab && ['custom-plan', 'resume', 'favorites', 'applications', 'feedback', 'membership', 'settings'].includes(urlTab)) {
      setTab(urlTab)
    }
  }, [location.search])

  const [isUploading, setIsUploading] = useState(false)
  const [resumeScore, setResumeScore] = useState<number>(0)
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]) // Store AI suggestions
  const [assistantFramework, setAssistantFramework] = useState<AssistantFramework | null>(null)
  const [assistantPolishResult, setAssistantPolishResult] = useState<AssistantPolishResult | null>(null)
  const [assistantUpdatedAt, setAssistantUpdatedAt] = useState<string>('')
  const [assistantAnalysisMode, setAssistantAnalysisMode] = useState<'local' | 'ai'>('local')
  const [selectedPolishMode, setSelectedPolishMode] = useState<'polish_resume' | 'polish_interview' | 'mock_answer'>('polish_resume')
  const [selectedInterviewQuestion, setSelectedInterviewQuestion] = useState<string>('')
  const [assistantConversationKey, setAssistantConversationKey] = useState<AssistantConversationKey>('overview')
  const [assistantConversationRevealLineCount, setAssistantConversationRevealLineCount] = useState(0)
  const [assistantStartChoice, setAssistantStartChoice] = useState<'pending' | 'deferred' | 'running'>('pending')
  const resumeAssistantUpgradeTracked = useRef(false)

  const [latestResume, setLatestResume] = useState<{ id: string; name: string } | null>(null)
  const [resumeText, setResumeText] = useState<string>('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileType, setFileType] = useState<string>('')
  const [isResumeInitializing, setIsResumeInitializing] = useState(true)

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
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStep, setAnalysisStep] = useState<string>('')

  const [upgradeSource, setUpgradeSource] = useState<'referral' | 'ai_resume' | 'general'>('general')
  const [copilotPlan, setCopilotPlan] = useState<any>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const defaultAnalysisMode = isMember ? 'ai_preferred' : 'local'
  const analysisStepFallback = '正在准备分析...'
  const analysisDescription = '我们正在分析你的简历内容与表达，通常只需要片刻，请耐心等待。'
  const hasSuggestions = aiSuggestions.length > 0
  const hasAssistantFramework = Boolean(
    assistantFramework?.strengths?.length ||
    assistantFramework?.growthAreas?.length ||
    assistantFramework?.englishInterviewFramework?.questions?.length
  )

  const openResumePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const openAiEnhancementModal = (featureKey: string = 'resume_assistant_polish') => {
    setUpgradeSource('ai_resume')
    setShowUpgradeModal(true)
    trackingService.track('upgrade_modal_view', {
      page_key: 'profile',
      module: 'resume_assistant',
      feature_key: featureKey,
      source_key: 'resume_assistant',
      user_segment: isMember ? 'member' : 'free'
    })
  }

  const handleRemoveFavorite = async (jobId: string) => {
    try {
      trackingService.track('click_save_job', {
        page_key: 'profile',
        module: 'profile_favorites',
        feature_key: 'favorite',
        source_key: 'profile_favorites',
        entity_type: 'job',
        entity_id: jobId,
        job_id: jobId,
        action: 'unsave'
      })
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
      trackingService.track('click_save_job', {
        page_key: 'profile',
        module: 'profile_favorites',
        feature_key: 'favorite',
        source_key: 'profile_favorites',
        entity_type: 'job',
        entity_id: job.id,
        job_id: job.id,
        action: 'save'
      })
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

  useEffect(() => {
    if (tab !== 'resume') return
    trackingService.track('resume_assistant_open', {
      page_key: 'profile',
      module: 'resume_assistant',
      source_key: 'profile_resume_tab',
      feature_key: 'resume_assistant_framework',
      has_resume: Boolean(latestResume?.id),
      user_segment: isMember ? 'member' : 'free'
    })
  }, [tab, latestResume?.id, isMember])

  useEffect(() => {
    if (!hasAssistantFramework || isMember || resumeAssistantUpgradeTracked.current) return
    resumeAssistantUpgradeTracked.current = true
    trackingService.track('resume_assistant_upgrade_view', {
      page_key: 'profile',
      module: 'resume_assistant',
      source_key: 'resume_assistant_locks',
      feature_key: 'resume_assistant_polish',
      user_segment: 'free',
      has_resume: Boolean(latestResume?.id)
    })
  }, [hasAssistantFramework, isMember, latestResume?.id])

  useEffect(() => {
    if (!hasAssistantFramework) {
      resumeAssistantUpgradeTracked.current = false
    }
  }, [hasAssistantFramework])

  useEffect(() => {
    if (!selectedInterviewQuestion && assistantFramework?.englishInterviewFramework?.questions?.length) {
      setSelectedInterviewQuestion(assistantFramework.englishInterviewFramework.questions[0].question)
    }
  }, [assistantFramework, selectedInterviewQuestion])

  useEffect(() => {
    if (!latestResume?.id) {
      setAssistantConversationKey('overview')
      setAssistantStartChoice('pending')
    } else if (!hasAssistantFramework) {
      setAssistantStartChoice('pending')
    }
  }, [latestResume?.id, hasAssistantFramework])

  const assistantConversationMessages = useMemo<AssistantConversationMessage[]>(() => {
    if (!latestResume?.id) {
      return [
        {
          id: 'empty-assistant',
          role: 'assistant',
          title: '简历助手已就绪',
          body: '上传简历后，我会先陪您看一遍整体状态，再一起把亮点、补强方向和面试准备理顺。',
          accent: 'neutral'
        }
      ]
    }

    if (!assistantFramework && !aiSuggestions.length) {
      const messages: AssistantConversationMessage[] = [
        {
          id: 'upload-complete',
          role: 'assistant',
          title: '简历已经上传完成',
          body: '让我先帮您整体看一遍，找出最值得继续放大的优势。',
          accent: 'neutral'
        }
      ]

      if (assistantStartChoice === 'deferred') {
        messages.push(
          {
            id: 'defer-user',
            role: 'user',
            body: '暂时不用了',
            accent: 'indigo'
          },
          {
            id: 'defer-assistant',
            role: 'assistant',
            body: '好的，您想开始时随时叫我。',
            accent: 'neutral'
          }
        )
      }

      return messages
    }

    const promptMap: Record<AssistantConversationKey, string> = {
      overview: '我想先看整体判断',
      strengths: '先告诉我最值得放大的亮点',
      growth: '我想知道接下来该重点补强什么',
      interview: '先帮我准备英文面试框架',
      polish: isMember ? '继续做一轮深度打磨' : '我想看看还能继续升级什么'
    }

    const messages: AssistantConversationMessage[] = [
      {
        id: `prompt-${assistantConversationKey}`,
        role: 'user',
        body: promptMap[assistantConversationKey],
        accent: 'indigo'
      }
    ]

    if (!assistantFramework && aiSuggestions.length) {
      if (assistantConversationKey === 'strengths') {
        messages.push({
          id: 'legacy-strength',
          role: 'assistant',
          title: '先从已有优势开始',
          body: '你已经有了不错的经历基础，下面这些位置最值得继续放大。',
          bullets: aiSuggestions.slice(0, 3).map((item) => item.issue),
          accent: 'emerald'
        })
      } else {
        messages.push({
          id: 'legacy-summary',
          role: 'assistant',
          title: '我先帮你整理一个旧版结论',
          body: '这是根据你之前的分析结果整理出的重点，后续重新生成后会得到更完整的框架。',
          bullets: aiSuggestions.slice(0, 4).map((item) => `${item.issue}：${item.suggestion}`),
          accent: 'neutral'
        })
      }
      return messages
    }

    if (!assistantFramework) {
      return messages
    }

    const confidenceHeadline = assistantFramework.confidenceSummary?.headline || '你的简历已经具备可以继续放大的基础。'
    const confidenceSummary = assistantFramework.confidenceSummary?.summary || '先把最有代表性的经历、结果与目标岗位的关系表达得更集中，你的说服力会更强。'

    if (assistantConversationKey === 'overview') {
      messages.push(
        {
          id: 'overview-headline',
          role: 'assistant',
          title: '先看整体判断',
          body: confidenceHeadline,
          accent: 'emerald'
        },
        {
          id: 'overview-summary',
          role: 'assistant',
          body: confidenceSummary,
          accent: 'neutral'
        }
      )

      if (assistantFramework.strengths?.length) {
        messages.push({
          id: 'overview-strengths',
          role: 'assistant',
          title: '最值得继续放大的优势',
          body: '这些亮点已经出现了，只需要表达得更聚焦。',
          bullets: assistantFramework.strengths.slice(0, 3).map((item) => `${item.title}：${item.detail}`),
          accent: 'emerald'
        })
      }
      return messages
    }

    if (assistantConversationKey === 'strengths') {
      messages.push({
        id: 'strengths-message',
        role: 'assistant',
        title: '你已经有这些可放大的亮点',
        body: '这些已经是你简历里很有说服力的部分，后续投递和面试都可以围绕它们展开。',
        bullets: (assistantFramework.strengths || []).map((item) => `${item.title}：${item.detail}`),
        accent: 'emerald'
      })

      if (assistantFramework.rewriteDirections?.length) {
        messages.push({
          id: 'strengths-direction',
          role: 'assistant',
          title: '表达上再往前一步',
          body: '下面这些表达方向能让你的优势更快被看到。',
          bullets: assistantFramework.rewriteDirections.slice(0, 3).map((item) => `${item.title}：${item.direction}`),
          accent: 'neutral'
        })
      }
      return messages
    }

    if (assistantConversationKey === 'growth') {
      if (assistantFramework.growthAreas?.length) {
        messages.push({
          id: 'growth-areas',
          role: 'assistant',
          title: '建议优先补强的信息',
          body: '先把这些位置补完整，会比从头重写更有效。',
          bullets: assistantFramework.growthAreas.map((item) => `${item.title}：${item.detail}`),
          accent: 'neutral'
        })
      }

      if (assistantFramework.starGaps?.length) {
        messages.push({
          id: 'growth-star',
          role: 'assistant',
          title: 'STAR 法则可以重点补这些',
          body: '如果把情境、动作和结果补完整，简历会更有说服力。',
          bullets: assistantFramework.starGaps.map((item) => {
            const missing = item.missing?.length ? `（可补：${item.missing.join(' / ')}）` : ''
            return `${item.title}：${item.detail}${missing}`
          }),
          accent: 'indigo'
        })
      }
      return messages
    }

    if (assistantConversationKey === 'interview') {
      const interviewQuestions = assistantFramework.englishInterviewFramework?.questions || []
      const selectedQuestion = interviewQuestions.find((item) => item.question === selectedInterviewQuestion) || interviewQuestions[0]

      messages.push({
        id: 'interview-summary',
        role: 'assistant',
        title: '英文面试框架',
        body: assistantFramework.englishInterviewFramework?.summary || '我先帮你把英文面试的表达主线理出来，后面再继续往下展开。',
        bullets: assistantFramework.englishInterviewFramework?.selfIntroOutline || [],
        accent: 'indigo'
      })

      if (selectedQuestion) {
        messages.push({
          id: 'interview-selected',
          role: 'assistant',
          title: selectedQuestion.question,
          body: selectedQuestion.hint || '先围绕目标、动作、结果来组织回答，再补充你与岗位的匹配点。',
          bullets: selectedQuestion.focus ? [`回答重点：${selectedQuestion.focus}`] : undefined,
          accent: 'neutral'
        })
      }
      return messages
    }

    if (assistantConversationKey === 'polish') {
      if (assistantPolishResult?.sections?.length) {
        messages.push({
          id: 'polish-result',
          role: 'assistant',
          title: assistantPolishResult.title,
          body: '我把刚才这轮深度打磨拆成了几个可直接使用的部分。',
          bullets: assistantPolishResult.sections.flatMap((section) => [
            `${section.heading}：${section.body}`,
            ...(section.bullets || [])
          ]),
          accent: 'indigo'
        })
      } else if (isMember) {
        messages.push({
          id: 'polish-member-empty',
          role: 'assistant',
          title: '准备开始深度打磨',
          body: '你可以继续选择简历打磨、英文面试或模拟回答，我会基于当前内容继续往下展开。',
          accent: 'neutral'
        })
      } else {
        messages.push({
          id: 'polish-upgrade',
          role: 'assistant',
          title: '下一步可以继续升级',
          body: '继续解锁深度打磨后，就能把重点经历、英文面试和模拟回答串成一套更完整的求职准备。',
          accent: 'neutral'
        })
      }
      return messages
    }

    return messages
  }, [assistantConversationKey, assistantFramework, assistantPolishResult, selectedInterviewQuestion, aiSuggestions, isMember, latestResume?.id, assistantStartChoice])

  const assistantConversationRenderableMessages = useMemo<AssistantConversationRenderableMessage[]>(
    () =>
      assistantConversationMessages.map((message) => {
        const bodyLines = splitConversationLines(message.body)
        const bulletLines = message.bullets || []
        const totalLines = (message.title ? 1 : 0) + bodyLines.length + bulletLines.length
        return {
          ...message,
          bodyLines,
          bulletLines,
          totalLines
        }
      }),
    [assistantConversationMessages]
  )

  useEffect(() => {
    const totalLines = assistantConversationRenderableMessages.reduce((sum, message) => sum + message.totalLines, 0)

    if (!assistantConversationRenderableMessages.length || totalLines === 0) {
      setAssistantConversationRevealLineCount(0)
      return
    }

    setAssistantConversationRevealLineCount(1)
    if (totalLines === 1) return

    const timer = window.setInterval(() => {
      setAssistantConversationRevealLineCount((prev) => {
        if (prev >= totalLines) {
          window.clearInterval(timer)
          return prev
        }
        return prev + 1
      })
    }, 150)

    return () => window.clearInterval(timer)
  }, [assistantConversationRenderableMessages, assistantConversationKey, assistantUpdatedAt])

  useEffect(() => {
    if (!conversationScrollRef.current) return
    const node = conversationScrollRef.current
    const frame = window.requestAnimationFrame(() => {
      node.scrollTo({
        top: node.scrollHeight,
        behavior: 'smooth'
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [assistantConversationRevealLineCount, isAnalyzing])

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
          setAssistantFramework(null)
          setAssistantPolishResult(null)
          setAssistantUpdatedAt('')
          setAssistantAnalysisMode('local')
          setSelectedInterviewQuestion('')
          setFileType('')
          loadedPreviewResumeIdRef.current = null
          setIsResumeInitializing(false)
          return
        }

        setIsResumeInitializing(true)
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

          setResumeText(extractResumeText(latestResumeData))

          // Fetch and set preview content
          const rId = latestResumeData.id || latestResumeData.resume_id

          // Restore AI Analysis Result
          if (latestResumeData.aiScore) {
            setResumeScore(latestResumeData.aiScore)
          }
          const assistantPayload = parseJsonValue<any>(latestResumeData.assistantPayload, null)
          if (assistantPayload?.framework) {
            setAssistantFramework(assistantPayload.framework)
            setAssistantPolishResult(assistantPayload.lastPolishResult || null)
            setAssistantUpdatedAt(
              assistantPayload.updatedAt ||
              latestResumeData.assistantUpdatedAt ||
              latestResumeData.lastAnalyzedAt ||
              ''
            )
            setAssistantAnalysisMode(assistantPayload.lastFrameworkMode === 'ai' ? 'ai' : 'local')
            if (assistantPayload.lastQuestion) {
              setSelectedInterviewQuestion(assistantPayload.lastQuestion)
            }
          } else {
            setAssistantFramework(null)
            setAssistantPolishResult(null)
            setAssistantUpdatedAt(latestResumeData.lastAnalyzedAt || '')
          }
          if (latestResumeData.aiSuggestions) {
            try {
              const suggestions = parseJsonValue<any[]>(latestResumeData.aiSuggestions, [])
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
              if (loadedPreviewResumeIdRef.current !== String(rId) || !previewUrl) {
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
                      loadedPreviewResumeIdRef.current = String(rId)
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
          setAssistantFramework(null)
          setAssistantPolishResult(null)
          setAssistantUpdatedAt('')
          setAssistantAnalysisMode('local')
          setSelectedInterviewQuestion('')
          setFileType('')
          loadedPreviewResumeIdRef.current = null
        }
      } catch (e) {
        console.error('[ProfileCenter] ❌ Failed to fetch resumes:', e)
      } finally {
        setIsResumeInitializing(false)
      }
    })()
  }, [authUser, token])

  // Fetch Copilot Plan
  useEffect(() => {
    const fetchPlan = async () => {
      if (!authUser || !token) return
      try {
        setLoadingPlan(true)
        const res = await fetch('/api/copilot', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (res.ok && data.plan) {
          setCopilotPlan(data.plan)
        }
      } catch (err) {
        console.error('Failed to fetch copilot plan:', err)
      } finally {
        setLoadingPlan(false)
      }
    }
    fetchPlan()
  }, [authUser, token, tab])


  const favoritesWithStatus = useMemo(() => favorites, [favorites])

  const extractResumeText = (resume: any): string => {
    if (!resume) return ''
    if (typeof resume.contentText === 'string' && resume.contentText.trim()) return resume.contentText.trim()
    if (typeof resume.content_text === 'string' && resume.content_text.trim()) return resume.content_text.trim()

    const rawParseResult = resume.parseResult ?? resume.parse_result
    const parseResult = typeof rawParseResult === 'string'
      ? (() => {
        try {
          return JSON.parse(rawParseResult)
        } catch {
          return null
        }
      })()
      : rawParseResult

    if (typeof parseResult?.content === 'string' && parseResult.content.trim()) return parseResult.content.trim()
    if (typeof parseResult?.text === 'string' && parseResult.text.trim()) return parseResult.text.trim()

    return ''
  }

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
      e.target.value = ''
      return
    }

    setIsUploading(true)
    setResumeScore(0)
    setAiSuggestions([])
    setAssistantFramework(null)
    setAssistantPolishResult(null)
    setAssistantUpdatedAt('')
    setAssistantAnalysisMode('local')
    setSelectedInterviewQuestion('')
    setAssistantStartChoice('pending')

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

          markMatchScoreRefresh('resume_upload')
          showSuccess('简历上传成功')
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
      setResumeText('')
      setPreviewUrl(null)
      setFileType('')
      setAssistantFramework(null)
      setAssistantPolishResult(null)
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const getFeatureKeyByStage = (stage: 'framework' | 'polish_resume' | 'polish_interview' | 'mock_answer') => {
    if (stage === 'polish_resume') return 'resume_assistant_polish'
    if (stage === 'polish_interview') return 'resume_assistant_interview'
    if (stage === 'mock_answer') return 'resume_assistant_mock_answer'
    return 'resume_assistant_framework'
  }

  const handleRunResumeAssistant = async (
    stage: 'framework' | 'polish_resume' | 'polish_interview' | 'mock_answer' = 'framework',
    extra: { focusKey?: string; question?: string } = {}
  ) => {
    if (!latestResume?.id) {
      showError('无法分析', '请先上传简历后再开始分析')
      return
    }

    if (stage === 'framework') {
      setAssistantStartChoice('running')
    }

    const featureKey = getFeatureKeyByStage(stage)
    const eventName = stage === 'framework'
      ? (hasAssistantFramework ? 'resume_assistant_refresh_click' : 'resume_assistant_generate_click')
      : stage === 'polish_interview'
        ? 'resume_assistant_interview_expand_click'
        : stage === 'mock_answer'
          ? 'resume_assistant_mock_answer_click'
          : 'resume_assistant_polish_click'

    trackingService.track(eventName, {
      page_key: 'profile',
      module: 'resume_assistant',
      feature_key: featureKey,
      source_key: 'profile_resume',
      entity_type: 'resume',
      entity_id: latestResume.id,
      analysis_mode: defaultAnalysisMode,
      stage,
      focus_key: extra.focusKey || '',
      question: extra.question || '',
      has_resume: true,
      user_segment: isMember ? 'member' : 'free'
    })

    try {
      const startTitle = stage === 'framework'
        ? '正在开始分析...'
        : stage === 'polish_interview'
          ? '正在拓展英文面试框架...'
          : stage === 'mock_answer'
            ? '正在生成模拟回答...'
            : '正在进行深度打磨...'

      showSuccess(startTitle, stage === 'framework'
        ? '我们会先帮你梳理亮点、补强方向和英文面试框架'
        : '请稍候，我们正在基于你的框架继续细化内容')
      setIsAnalyzing(true)

      const steps = stage === 'framework'
        ? (isMember
          ? ['正在解析简历结构...', '正在提炼优势亮点...', '正在梳理补强方向...', '正在生成英文面试框架...']
          : ['正在梳理简历结构...', '正在提炼优势亮点...', '正在整理补强建议...'])
        : stage === 'polish_interview'
          ? ['正在扩展英文问题...', '正在整理练习顺序...', '正在生成拓展建议...']
          : stage === 'mock_answer'
            ? ['正在选择回答结构...', '正在生成英文回答...', '正在补充中文练习提示...']
            : ['正在定位关键经历...', '正在补充 STAR 结构...', '正在生成优化方案...']

      let stepIndex = 0
      setAnalysisStep(steps[0])

      const interval = setInterval(() => {
        stepIndex = (stepIndex + 1) % steps.length
        if (stepIndex < steps.length - 1) { // Don't loop endlessly if it takes too long
          setAnalysisStep(steps[stepIndex])
        }
      }, 2500)

      const targetRole = authUser?.profile?.targetRole || ''
      const resumeIdToAnalyze = latestResume.id

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
          stage,
          focusKey: extra.focusKey || '',
          question: extra.question || selectedInterviewQuestion || assistantFramework?.englishInterviewFramework?.questions?.[0]?.question || ''
        })
      })

      const result = await resp.json()

      clearInterval(interval)

      if (resp.ok && result.success) {
        setResumeScore(result.data.score || 0)
        setAiSuggestions(result.data.suggestions || [])
        if (result.data.framework) {
          setAssistantFramework(result.data.framework)
        }
        if (result.data.polishResult) {
          setAssistantPolishResult(result.data.polishResult)
          if (result.data.polishResult.question) {
            setSelectedInterviewQuestion(result.data.polishResult.question)
          }
        } else if (stage === 'framework') {
          setAssistantPolishResult(null)
        }
        setAssistantAnalysisMode(result.data.analysisMode || 'local')
        setAssistantUpdatedAt(new Date().toISOString())

        const frameworkData = result.data.framework || assistantFramework
        const polishSuccessEvent = stage === 'framework'
          ? 'resume_assistant_generate_success'
          : 'resume_assistant_polish_success'

        showSuccess(
          stage === 'framework' ? '分析结果已准备好' : '深度内容已更新',
          stage === 'framework'
            ? `已为你整理亮点、补强方向和英文面试框架`
            : '你可以继续基于当前结果做针对性打磨'
        )

        trackingService.track(polishSuccessEvent, {
          page_key: 'profile',
          module: 'resume_assistant',
          feature_key: featureKey,
          source_key: 'profile_resume',
          resume_id: resumeIdToAnalyze,
          score: result.data.score,
          result_score: result.data.score,
          strength_count: frameworkData?.strengths?.length || 0,
          growth_area_count: frameworkData?.growthAreas?.length || 0,
          star_gap_count: frameworkData?.starGaps?.length || 0,
          interview_question_count: frameworkData?.englishInterviewFramework?.questions?.length || 0,
          analysis_mode: result.data.analysisMode || 'local',
          stage,
          focus_key: extra.focusKey || '',
          user_segment: isMember ? 'member' : 'free'
        })
      } else {
        console.error('[ProfileCenter] Analysis failed:', result)
        if (result.requiresMembership) {
          openAiEnhancementModal(featureKey)
          trackingService.track('resume_assistant_upgrade_click', {
            page_key: 'profile',
            module: 'resume_assistant',
            feature_key: featureKey,
            source_key: 'resume_assistant_locks',
            stage,
            user_segment: 'free'
          })
        } else {
          if (result.error === 'Resume content is empty') {
            if (resumeIdToAnalyze && resumeText) {
              await fetch('/api/resumes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'update_content', id: resumeIdToAnalyze, contentText: resumeText })
              })
              const retryResp = await fetch('/api/resumes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ action: 'analyze', id: resumeIdToAnalyze, targetRole, stage, focusKey: extra.focusKey || '', question: extra.question || '' })
              })
              const retryResult = await retryResp.json()
              if (retryResp.ok && retryResult.success) {
                setResumeScore(retryResult.data.score || 0)
                setAiSuggestions(retryResult.data.suggestions || [])
                if (retryResult.data.framework) setAssistantFramework(retryResult.data.framework)
                if (retryResult.data.polishResult) setAssistantPolishResult(retryResult.data.polishResult)
                setAssistantAnalysisMode(retryResult.data.analysisMode || 'local')
                setAssistantUpdatedAt(new Date().toISOString())
                showSuccess(stage === 'framework' ? '分析结果已准备好' : '深度内容已更新')
                return
              }
            }
          }
          throw new Error(result.error || '分析未返回结果')
        }
      }
    } catch (aiError) {
      if (stage === 'framework') {
        setAssistantStartChoice('pending')
      }
      console.warn('AI analysis failed:', aiError)
      trackingService.track('resume_assistant_generate_click', {
        page_key: 'profile',
        module: 'resume_assistant',
        feature_key: featureKey,
        source_key: 'profile_resume',
        entity_type: 'resume',
        entity_id: latestResume?.id,
        analysis_mode: defaultAnalysisMode,
        error_message: aiError instanceof Error ? aiError.message : 'unknown_error',
        stage,
        user_segment: isMember ? 'member' : 'free'
      })
      showError('分析失败', '暂时无法生成简历助手结果，请稍后重试')
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
        setAssistantFramework(null)
        setAssistantPolishResult(null)
        setAssistantUpdatedAt('')
        setAssistantAnalysisMode('local')
        setSelectedInterviewQuestion('')
        setAssistantStartChoice('pending')
        setPreviewUrl(null)
        setFileType('')
        loadedPreviewResumeIdRef.current = null
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        markMatchScoreRefresh('resume_delete')
        showSuccess('简历已删除')

        trackingService.track('delete_resume', { resume_id: latestResume.id })
      } else {
        throw new Error('删除失败')
      }
    } catch (error) {
      showError('删除失败', '无法删除简历，请稍后重试')
    }
  }

  const resumePreviewContent = useMemo(() => {
    if (isResumeInitializing) {
      return (
        <div className="flex flex-1 flex-col rounded-[24px] border border-slate-200 bg-slate-50/80 p-6">
          <div className="mb-4 h-5 w-28 animate-pulse rounded-full bg-slate-200" />
          <div className="flex-1 animate-pulse rounded-[22px] bg-white shadow-inner" />
        </div>
      )
    }

    if (!latestResume) {
      return (
        <div className="flex flex-1 flex-col items-center justify-start rounded-[24px] border border-dashed border-indigo-200 bg-slate-50 px-8 pt-14 text-center">
          <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-slate-900 text-white shadow-lg shadow-slate-200">
            <FileText className="h-10 w-10" />
          </div>
          <h4 className="text-[20px] font-black text-slate-900">上传你的简历</h4>
          <button
            onClick={openResumePicker}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-slate-900 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-600 hover:shadow-xl"
          >
            <Upload className="h-4 w-4" />
            上传简历
          </button>
          <p className="mt-5 text-xs text-slate-400">支持 PDF、DOC、DOCX</p>
        </div>
      )
    }

    return <ResumePreviewPane previewUrl={previewUrl} fileType={fileType} resumeText={resumeText} />
  }, [isResumeInitializing, latestResume, previewUrl, fileType, resumeText])

  const ResumeTab = () => {
    const lastUpdatedLabel = assistantUpdatedAt
      ? new Date(assistantUpdatedAt).toLocaleString()
      : '尚未生成'
    const analysisProgress = Math.max(8, Math.min(100, resumeScore || (latestResume ? 28 : 8)))
    const analysisStatusLabel = isAnalyzing
      ? (analysisStep || analysisStepFallback)
      : hasAssistantFramework
        ? '已整理完成'
        : latestResume
          ? '等待开始'
          : '等待上传'
    const analysisStatusNote = !latestResume
      ? '上传简历后，我会从整体判断、亮点和面试准备开始陪你往下拆。'
      : hasAssistantFramework
        ? '右侧对话会陪你继续往下看亮点、补强方向和英文面试准备。'
        : '简历已经准备好，你可以直接在右侧开始第一轮整体分析。'

    const triggerMemberPolish = () => {
      handleRunResumeAssistant(selectedPolishMode, {
        focusKey: assistantFramework?.growthAreas?.[0]?.focusKey || assistantFramework?.starGaps?.[0]?.focusKey || '',
        question: selectedInterviewQuestion || assistantFramework?.englishInterviewFramework?.questions?.[0]?.question || '',
      })
    }

    const handleConversationChoice = (choice: 'start' | 'defer' | 'overview' | 'strengths' | 'growth' | 'interview' | 'upgrade' | 'polish' | 'mock') => {
      if (choice === 'start') {
        setAssistantConversationKey('overview')
        handleRunResumeAssistant('framework')
        return
      }
      if (choice === 'defer') {
        setAssistantStartChoice('deferred')
        return
      }
      if (choice === 'overview' || choice === 'strengths' || choice === 'growth' || choice === 'interview') {
        setAssistantConversationKey(choice)
        return
      }
      if (choice === 'upgrade') {
        openAiEnhancementModal('resume_assistant_polish')
        return
      }
      if (choice === 'polish') {
        setSelectedPolishMode('polish_resume')
        setAssistantConversationKey('polish')
        if (isMember) {
          triggerMemberPolish()
        } else {
          openAiEnhancementModal('resume_assistant_polish')
        }
        return
      }
      if (choice === 'mock') {
        if (isMember) {
          setSelectedPolishMode('mock_answer')
          setAssistantConversationKey('polish')
          const question = selectedInterviewQuestion || assistantFramework?.englishInterviewFramework?.questions?.[0]?.question || ''
          if (question) {
            handleRunResumeAssistant('mock_answer', { question })
          } else {
            setAssistantConversationKey('interview')
          }
        } else {
          setAssistantConversationKey('interview')
        }
      }
    }

    return (
      <div className="space-y-5 pb-8">
        <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_32px_-26px_rgba(15,23,42,0.16)]">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] xl:items-stretch">
            <div className="space-y-4">
              <div>
                <h2 className="text-[24px] font-black tracking-tight text-slate-950">简历助手</h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-7 text-slate-600">
                  帮你发现自己的优势与潜力，从简历到面试，一路通关！
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400">简历状态</div>
                  <div className="mt-2 text-lg font-black text-slate-900">{latestResume ? '已上传' : '等待上传'}</div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400">当前得分</div>
                  <div className="mt-2 text-lg font-black text-slate-900">{Math.max(0, Math.min(100, resumeScore))}%</div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-400">最近更新</div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-slate-700">{lastUpdatedLabel}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <AssistantAvatar />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-900">简历分析</span>
                    <span className="text-xs font-semibold text-slate-500">{analysisStatusLabel}</span>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-indigo-100">
                    <div
                      className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{analysisStatusNote}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(340px,0.78fr)_minmax(0,1.22fr)] xl:items-start">
          <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">简历预览</h3>
                  <p className="mt-1 text-sm text-slate-500">{latestResume ? latestResume.name : '支持 PDF、DOC、DOCX'}</p>
                </div>
                {latestResume && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openResumePicker}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
                    >
                      <Upload className="h-4 w-4" />
                      重新上传
                    </button>
                    <button
                      onClick={handleDeleteResume}
                      className="rounded-full border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>

              <div className="relative min-h-[760px]">
                {resumePreviewContent}
                {showUpgradeModal && latestResume ? (
                  <div className="pointer-events-none absolute inset-0 z-10 rounded-[24px] bg-slate-50/70 backdrop-blur-[1px]" />
                ) : null}
              </div>

              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} className="hidden" />
              {isUploading && <div className="mt-4 text-center text-sm text-slate-500">正在上传并解析简历...</div>}
            </div>
          </section>

          <section id="ai-analysis-section" className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="flex min-h-[760px] flex-col">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-[20px] font-black tracking-tight text-slate-950">逐步拆解你的简历与面试准备</h3>
              </div>

              <div ref={conversationScrollRef} className="min-h-[660px] max-h-[calc(100vh-260px)] flex-1 overflow-y-auto bg-slate-50/70 px-5 py-4">
                {isAnalyzing ? (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <div className="max-w-[72%] rounded-[24px] rounded-br-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm">
                        {assistantConversationKey === 'polish' ? '继续帮我往下打磨' : '好啊'}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <AssistantAvatar />
                      <div className="max-w-[82%] rounded-[24px] rounded-bl-md border border-indigo-100 bg-white px-4 py-4 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600" />
                          <div>
                            <div className="text-sm font-bold text-slate-900">{analysisStep || analysisStepFallback}</div>
                            <div className="mt-1 text-xs leading-6 text-slate-500">{analysisDescription}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : isResumeInitializing ? (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-200" />
                      <div className="w-full max-w-[84%] rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
                        <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
                        <div className="mt-4 h-10 w-32 animate-pulse rounded-full bg-slate-200" />
                      </div>
                    </div>
                  </div>
                ) : !resumeText ? (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-start gap-3">
                      <AssistantAvatar />
                      <div className="w-full max-w-[84%] rounded-[24px] rounded-bl-md border border-slate-200 bg-white px-5 py-5 shadow-sm">
                        <p className="text-base font-semibold leading-7 text-slate-900">把简历上传给我吧，我会陪您从整体判断一路拆到面试准备。</p>
                        <div className="mt-4">
                          <button
                            onClick={openResumePicker}
                            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700"
                          >
                            上传简历
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      let remainingLines = assistantConversationRevealLineCount

                      return assistantConversationRenderableMessages.map((message) => {
                        const isUser = message.role === 'user'
                        const accentClass = message.accent === 'emerald'
                          ? 'border-emerald-100 bg-emerald-50/95'
                          : message.accent === 'indigo'
                            ? 'border-indigo-100 bg-indigo-50/95'
                            : 'border-slate-200 bg-white'

                        const showTitle = Boolean(message.title) && remainingLines > 0
                        if (message.title) remainingLines = Math.max(0, remainingLines - 1)

                        const visibleBodyCount = Math.min(message.bodyLines.length, remainingLines)
                        const visibleBodyLines = message.bodyLines.slice(0, visibleBodyCount)
                        remainingLines = Math.max(0, remainingLines - visibleBodyCount)

                        const visibleBulletCount = Math.min(message.bulletLines.length, remainingLines)
                        const visibleBulletLines = message.bulletLines.slice(0, visibleBulletCount)
                        remainingLines = Math.max(0, remainingLines - visibleBulletCount)

                        if (!showTitle && visibleBodyLines.length === 0 && visibleBulletLines.length === 0) {
                          return null
                        }

                        return (
                          <div key={message.id} className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                            {!isUser ? <AssistantAvatar /> : null}
                            <div className={`max-w-[84%] rounded-[24px] px-4 py-4 shadow-sm ${
                              isUser
                                ? 'rounded-br-md bg-indigo-600 text-white'
                                : `rounded-bl-md border ${accentClass}`
                            }`}>
                              {showTitle ? (
                                <div className={`text-sm font-black ${isUser ? 'text-white' : 'text-slate-900'}`}>{message.title}</div>
                              ) : null}
                              {visibleBodyLines.length ? (
                                <div className={`${showTitle ? 'mt-2' : ''} space-y-2`}>
                                  {visibleBodyLines.map((line, index) => (
                                    <p key={`${message.id}-line-${index}`} className={`text-sm leading-7 ${isUser ? 'text-white' : 'text-slate-700'}`}>
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              ) : null}
                              {visibleBulletLines.length ? (
                                <div className="mt-3 space-y-2">
                                  {visibleBulletLines.map((bullet, index) => (
                                    <div key={`${message.id}-bullet-${index}`} className={`flex gap-2 text-sm leading-6 ${isUser ? 'text-white/90' : 'text-slate-600'}`}>
                                      <span className={`mt-[8px] h-1.5 w-1.5 rounded-full ${isUser ? 'bg-white/80' : 'bg-indigo-400'}`} />
                                      <span>{bullet}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )
                      })
                    })()}

                    {!hasAssistantFramework && assistantStartChoice !== 'deferred' ? (
                      <div className="flex items-start gap-3">
                        <AssistantAvatar />
                        <div className="w-full max-w-[82%] rounded-[24px] rounded-bl-md border border-slate-200 bg-white px-4 py-4 shadow-sm">
                          <div className="text-sm font-semibold text-slate-900">要不要我现在开始？</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              onClick={() => handleConversationChoice('start')}
                              className="rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-700"
                            >
                              好啊
                            </button>
                            <button
                              onClick={() => handleConversationChoice('defer')}
                              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
                            >
                              暂时不用了
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {hasAssistantFramework && !isAnalyzing ? (
                      <div className="flex items-start gap-3">
                        <AssistantAvatar />
                        <div className="w-full max-w-[88%] rounded-[24px] rounded-bl-md border border-slate-200 bg-white px-4 py-4 shadow-sm">
                          <div className="text-sm font-semibold text-slate-900">接下来我们继续哪一步？</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {[
                              { id: 'overview', label: '先看整体判断' },
                              { id: 'strengths', label: '看看我的亮点' },
                              { id: 'growth', label: '告诉我怎么补强' },
                              { id: 'interview', label: '准备英文面试' }
                            ].map((item) => (
                              <button
                                key={item.id}
                                onClick={() => handleConversationChoice(item.id as 'overview' | 'strengths' | 'growth' | 'interview')}
                                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-indigo-200 hover:text-indigo-600"
                              >
                                {item.label}
                              </button>
                            ))}
                            <button
                              onClick={() => handleConversationChoice('polish')}
                              className="rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-700"
                            >
                              {isMember ? '继续深度打磨' : '继续往下打磨'}
                            </button>
                            <button
                              onClick={() => handleConversationChoice('mock')}
                              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-indigo-200 hover:text-indigo-600"
                            >
                              模拟英文面试
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    )
  }

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
    <div className="mt-16 min-h-[calc(100vh-64px)] bg-slate-50">
      <div className="mx-auto max-w-[1600px] px-2 py-4 sm:px-3 lg:px-4">
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[228px_minmax(0,1fr)] lg:items-start">
          {/* Sidebar */}
          <aside className={`relative flex-shrink-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-full lg:w-[76px]' : 'w-full lg:w-[228px]'} lg:sticky lg:top-20 lg:self-start`}>
            <div className="flex flex-col gap-4">
              <button
                className={`group flex items-center rounded-[20px] border border-slate-200 bg-white px-3 py-3 text-slate-500 shadow-sm transition-all hover:border-indigo-200 hover:text-slate-900 ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                onClick={() => navigate(-1)}
                aria-label="返回上一页"
                title={isSidebarCollapsed ? '返回上一页' : undefined}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 transition-all group-hover:border-indigo-200 group-hover:bg-indigo-50 ${isSidebarCollapsed ? '' : 'mr-2'}`}>
                  <ArrowLeft className="h-4 w-4 text-slate-400 group-hover:text-indigo-600" />
                </div>
                {!isSidebarCollapsed ? <span className="text-sm font-medium">返回上一页</span> : null}
              </button>

              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="absolute -right-3 top-5 z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-transform hover:scale-110 hover:text-indigo-600 lg:flex"
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>

              {!isSidebarCollapsed ? (
                <div className="overflow-hidden rounded-[24px] border border-indigo-100 bg-white shadow-[0_20px_45px_-34px_rgba(79,70,229,0.22)]">
                  <div className="border-b border-indigo-100 bg-[linear-gradient(180deg,#eef2ff_0%,#f8fbff_100%)] px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-[0_14px_30px_-20px_rgba(79,70,229,0.7)]">
                        <Crown className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">会员中心</div>
                        <div className="text-xs text-slate-500">{isMember ? '当前权益已开启' : '解锁更多求职能力'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 px-4 py-4">
                    {isMember ? (
                      <>
                        <div className="rounded-2xl border border-indigo-100 bg-[linear-gradient(180deg,#ffffff_0%,#f5f7ff_100%)] px-3.5 py-3 shadow-[0_12px_30px_-24px_rgba(79,70,229,0.35)]">
                          <div className="text-[11px] font-semibold tracking-[0.16em] text-slate-400">当前等级</div>
                          <div className="mt-2 flex items-center gap-2 text-base font-black text-slate-900">
                            <span>{isTrialMember ? 'Haigoo Member Lite' : 'Haigoo Member'}</span>
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            有效期至 {authUser?.memberExpireAt ? new Date(authUser.memberExpireAt).toLocaleDateString() : '永久有效'}
                          </div>
                        </div>
                        <button
                          onClick={() => navigate('/membership')}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700"
                        >
                          续费 / 升级权益
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setShowCertificateModal(true)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-indigo-200 hover:text-indigo-600"
                        >
                          下载会员证书
                          <Download className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="rounded-2xl border border-indigo-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7f8ff_100%)] px-3.5 py-3 shadow-[0_12px_30px_-24px_rgba(79,70,229,0.24)]">
                          <div className="text-base font-black text-slate-900">开通会员</div>
                          <div className="mt-2 text-sm leading-6 text-slate-600">
                            解锁 AI 简历优化、关键人脉直达与更完整的求职陪伴。
                          </div>
                        </div>
                        <button
                          onClick={() => navigate('/membership')}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700"
                        >
                          立即开通
                          <Zap className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <button
                    onClick={() => setIsSidebarCollapsed(false)}
                    className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-slate-200 bg-white text-indigo-600 shadow-sm transition-all hover:border-indigo-200 hover:text-indigo-700"
                    title="会员中心"
                  >
                    <Crown className="h-6 w-6" />
                  </button>
                </div>
              )}

              <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
                <div className={`mb-3 px-2 text-xs font-bold tracking-[0.16em] text-slate-400 ${isSidebarCollapsed ? 'text-center px-0' : ''}`}>
                  {isSidebarCollapsed ? 'MENU' : '个人中心'}
                </div>
                <nav className="space-y-1" role="tablist">
                {[
                  // { id: 'custom-plan', label: '定制方案', icon: Sparkles, badge: 'AI' },
                  { id: 'resume', label: '简历助手', icon: FileText },
                  { id: 'favorites', label: '我的收藏', icon: Heart },
                  { id: 'applications', label: '我的申请', icon: Briefcase },
                  { id: 'feedback', label: '我要反馈', icon: MessageSquare },
                  { id: 'settings', label: '注销账号', icon: Settings }
                ].map((item) => (
                    <button
                    key={item.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative
                        ${tab === item.id
                        ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      } 
                        ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                    role="tab"
                    aria-selected={tab === item.id}
                    onClick={() => switchTab(item.id as TabKey)}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon className={`w-5 h-5 transition-colors ${tab === item.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                    {!isSidebarCollapsed && (
                      <span className="flex items-center gap-2">
                        {item.label}
                        {(item as any).badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-md shadow-sm">
                            {(item as any).badge}
                          </span>
                        )}
                      </span>
                    )}
                    {tab === item.id && !isSidebarCollapsed && (
                      <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                    )}
                  </button>
                ))}
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="min-w-0">
            <div className="pr-1 pb-10 transition-all duration-300">
              {tab === 'custom-plan' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 min-h-[400px] relative overflow-hidden">
                  {loadingPlan ? (
                    <div className="flex flex-col items-center justify-center h-full py-20">
                      <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
                      <p className="text-slate-500 text-sm">正在加载您的定制方案...</p>
                    </div>
                  ) : copilotPlan ? (
                    <div className="max-w-4xl mx-auto">
                      {!isMember && (
                        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                              <Crown className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                              <h4 className="font-bold text-indigo-900 text-sm">升级会员解锁更多权益</h4>
                              <p className="text-xs text-indigo-700/80">获取无限次 AI 优化、内推通道及专家服务</p>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate('/membership')}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                          >
                            立即升级
                          </button>
                        </div>
                      )}
                      <GeneratedPlanView plan={copilotPlan} isGuest={false} showProfileCta={false} showSavedHint={false} />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-indigo-200 transform rotate-3 hover:rotate-0 transition-all duration-500">
                        <Sparkles className="w-12 h-12 text-white" />
                      </div>

                      <h3 className="text-3xl font-bold text-slate-900 mb-4 text-center">
                        开启您的 AI 职业导航
                      </h3>

                      <p className="text-slate-500 mb-10 max-w-lg mx-auto leading-relaxed text-center text-lg">
                        还没有生成的方案？立即体验 Copilot，让 AI 为您量身定制远程求职路径，从简历到面试，全流程护航。
                      </p>

                      <Link
                        to="/"
                        className="group relative inline-flex items-center gap-3 px-10 py-4 bg-slate-900 text-white font-bold rounded-full hover:bg-indigo-600 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/30 hover:-translate-y-1"
                      >
                        <span className="relative z-10">立即生成方案</span>
                        <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </Link>

                      <div className="mt-12 grid grid-cols-3 gap-8 text-center max-w-2xl w-full">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-1">
                            <FileText className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium text-slate-600">简历诊断</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-1">
                            <Briefcase className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium text-slate-600">精准匹配</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 mb-1">
                            <MessageSquare className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium text-slate-600">面试辅导</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {tab === 'resume' && ResumeTab()}
              {tab === 'favorites' && <FavoritesTab />}
              {tab === 'applications' && <MyApplicationsTab />}
              {tab === 'feedback' && <FeedbackTab />}
              {tab === 'membership' && ResumeTab()}
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
