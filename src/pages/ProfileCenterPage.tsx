import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Clock, FileText, Upload, CheckCircle, Heart, MessageSquare, Crown, ChevronLeft, ChevronRight, Trash2, Sparkles, ArrowRight, Briefcase, Settings, Download, Zap, Home, Send, Eye, ShieldCheck, Copy, Check, Users, Building2, Quote, Star, Globe2, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { trackingService } from '../services/tracking-service'
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'
import { Job } from '../types'
import JobCardNew from '../components/JobCardNew'
import JobDetailModal from '../components/JobDetailModal'
import { MembershipUpgradeModal } from '../components/MembershipUpgradeModal'
import { MembershipCertificateModal } from '../components/MembershipCertificateModal'
import MyApplicationsTab from '../components/MyApplicationsTab'
import GeneratedPlanView from '../components/GeneratedPlanView'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { markMatchScoreRefresh } from '../utils/match-score-refresh'
import { fetchDailyMemberRecommendations } from '../utils/member-recommendations'
import { LinkedInLogo } from '../components/SocialIcons'

type TabKey = 'custom-plan' | 'resume' | 'favorites' | 'applications' | 'feedback' | 'membership' | 'about' | 'settings'

interface ProfileCenterPageProps {
  publicAboutOnly?: boolean
}

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

interface StoredAssistantConversationHistory {
  savedAt: string
  messages: AssistantConversationMessage[]
}

interface AssistantProgressCard {
  current: string
  currentTone?: 'default' | 'active' | 'done'
  next: Array<{
    label: string
    memberOnly?: boolean
  }>
}

type EmbeddedMemberType = 'trial_week' | 'quarter' | 'year'

interface EmbeddedMembershipPlan {
  id: string
  memberType: EmbeddedMemberType
  name: string
  shortLabel?: string
  price: number
  currency: string
  features: string[]
  duration_days: number
  description?: string
  discountLabel?: string
  wechat_qr?: string
  alipay_qr?: string
  comingSoon?: boolean
}

const EMBEDDED_STATIC_MEMBERSHIP_PLANS: EmbeddedMembershipPlan[] = [
  {
    id: 'trial_week_lite',
    memberType: 'trial_week',
    name: '体验会员（7天）',
    shortLabel: '体验会员',
    price: 29.9,
    currency: 'CNY',
    duration_days: 7,
    discountLabel: '7 天体验',
    alipay_qr: '/alipay_mini.jpg',
    wechat_qr: '/Wechatpay_mini.png',
    description: '适合先集中推进一轮投递，快速打开岗位、联系人和邮箱直申能力。',
    features: ['解锁全部高价值岗位信息', '解锁全部企业联系人信息', '解锁全部企业直申机会', '解锁会员专属推荐和 AI 简历优化']
  },
  {
    id: 'club_go_quarterly',
    memberType: 'quarter',
    name: '季度会员',
    shortLabel: '季度会员',
    price: 199,
    currency: 'CNY',
    duration_days: 90,
    discountLabel: '推荐 · 1-3 个月认真找工作',
    description: '适合持续推进远程求职，把申请效率、企业线索和人工支持一起拉满。',
    features: ['解锁全部高价值岗位信息', '解锁全部企业联系人信息', '解锁全部企业直申机会', '解锁会员专属推荐和 AI 简历优化', '优先人工支持和服务']
  },
  {
    id: 'goo_plus_yearly',
    memberType: 'year',
    name: '远程工作个性化咨询',
    shortLabel: '线上咨询',
    price: 299,
    currency: 'CNY',
    duration_days: 0,
    discountLabel: '¥299-¥599',
    comingSoon: false,
    description: '适合希望提高效率的你',
    features: [
      '解答关于远程工作的任何疑问',
      '针对个人背景提供职业发展分析',
      '英文简历、求职信、定向岗位匹配'
    ]
  }
]

const EMBEDDED_MEMBER_VALUE_POINTS = [
  { title: '查看完整岗位', desc: '解锁会员岗位、精选企业和完整岗位信息', icon: Eye },
  { title: '查看联系人邮箱', desc: '查看 HR 邮箱、BOSS 邮箱等直达线索', icon: Send },
  { title: '不限次申请', desc: '会员期内可继续申请，不受免费次数限制', icon: FileText },
  { title: '会员岗位推荐', desc: '优先查看更适合远程求职的精选机会', icon: Users }
]

const MEMBERSHIP_RECOMMENDATION_PREVIEW = [
  {
    id: 'member-preview-ampifire-accounting',
    company: 'AmpiFire',
    title: '会计业务专员',
    location: '全球远程',
    date: '05-27',
    salary: '$1.2k-$1.8k/月',
    tags: ['合同', '中级', '财务', '互联网/软件'],
    logoTone: 'bg-[#f1e7ff]'
  },
  {
    id: 'member-preview-crimson-course',
    company: 'Crimson Education',
    title: '职业课程辅导员，Crimson Rise',
    location: '中国远程',
    date: '05-27',
    salary: '薪资Open',
    tags: ['合同', '高级', '课程导师', '教育/文化'],
    logoTone: 'bg-[#e7f1ff]'
  },
  {
    id: 'member-preview-transperfect-lqa',
    company: 'TransPerfect',
    title: '游戏LQA测试员（远程自由职业）',
    location: '中国远程',
    date: '05-27',
    salary: '薪资Open',
    tags: ['自由职业', '中级', '测试/QA', '企业服务/SaaS'],
    logoTone: 'bg-[#f2e8ff]'
  },
  {
    id: 'member-preview-remote-people-bank',
    company: 'Remote People',
    title: '初级银行调节分析师',
    location: '全球远程',
    date: '05-26',
    salary: '薪资Open',
    tags: ['会计', '簿记', 'Xero', 'English'],
    logoTone: 'bg-[#e9fff4]'
  },
  {
    id: 'member-preview-airbnb-market',
    company: 'Airbnb',
    title: 'iOS 全球市场高级工程师',
    location: '全球远程',
    date: '05-26',
    salary: '$3k-$5k/月',
    tags: ['Swift', 'SwiftUI', 'UIKit', 'AI Coding'],
    logoTone: 'bg-[#ffe8ee]'
  },
  {
    id: 'member-preview-ops-growth',
    company: 'GrowthLoop',
    title: '远程增长运营专员',
    location: '亚洲远程',
    date: '05-25',
    salary: '$1.8k-$2.6k/月',
    tags: ['增长运营', 'CRM', '英语良好', 'SaaS'],
    logoTone: 'bg-[#fff3d8]'
  }
]

const MEMBER_FEEDBACK = [
  {
    quote: '在这里遇到了自己非常喜欢的工作，跟专业背景对口，薪资也比预期更满意。最有帮助的是岗位信息和联系人线索比较清楚，让我少走了很多弯路。',
    name: 'Flora',
    title: '心理咨询师',
    avatar: '/flora.webp'
  },
  {
    quote: '很满意通过这个找到了工作，也顺利入职了。以前看海外远程岗位总觉得信息太散，现在能更快判断哪些值得申请，遇到匹配的机会也敢及时出手。',
    name: '福多多',
    title: '粤语客服',
    avatar: '/fuduoduo.webp'
  },
  {
    quote: '从海狗远程俱乐部刚发起时我就关注了，终于等到了中国人自己的远程工作网站。希望这里可以持续把真实、可申请的全球机会整理出来。',
    name: 'JoJo',
    title: '产品经理',
    avatar: '/jojo.webp'
  }
]

const MEMBER_PARTNERS = ['Red Mountain', 'Bodhitree Group', 'VitaStep', 'ClarityInfra', 'Fintech 社区']

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

function getAssistantConversationStorageKey(userKey?: string | null, resumeId?: string | null) {
  if (!userKey || !resumeId) return null
  return `haigoo:resume-assistant-history:${userKey}:${resumeId}`
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

const UserAvatar = memo(function UserAvatar({
  avatar,
  username,
  isMember
}: {
  avatar?: string
  username?: string
  isMember?: boolean
}) {
  const fallback = (username || 'U').trim().charAt(0).toUpperCase()

  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
      {avatar ? (
        <img src={avatar} alt={username || '用户头像'} className="h-full w-full object-cover" loading="eager" decoding="async" draggable={false} />
      ) : (
        <span className="text-sm font-black text-slate-700">{fallback}</span>
      )}
      {isMember ? (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-indigo-600 text-white shadow-sm">
          <Crown className="h-2.5 w-2.5" />
        </span>
      ) : null}
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
    <div className="h-full min-h-0 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50/80">
      {previewUrl && fileType === 'application/pdf' ? (
        <iframe src={previewUrl} className="h-full min-h-0 w-full bg-white" title="Resume Preview" />
      ) : previewUrl && fileType.startsWith('image/') ? (
        <div className="flex h-full w-full justify-center overflow-auto bg-slate-100 p-4">
          <img src={previewUrl} alt="Resume" className="h-auto max-w-full rounded-xl shadow-md" />
        </div>
      ) : (
        <div className="h-full min-h-0 overflow-auto bg-slate-100 p-4 md:p-8">
          <div className="mx-auto min-h-[297mm] max-w-[210mm] bg-white p-8 shadow-md md:p-12">
            <pre className="max-w-none whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{resumeText || '预览暂不可用'}</pre>
          </div>
        </div>
      )}
    </div>
  )
})

export default function ProfileCenterPage({ publicAboutOnly = false }: ProfileCenterPageProps = {}) {
  const { user: authUser, token, isAuthenticated, isMember, isTrialMember, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const conversationScrollRef = useRef<HTMLDivElement>(null)
  const loadedPreviewResumeIdRef = useRef<string | null>(null)
  const previousConversationTotalLinesRef = useRef(0)

  const initialTab: TabKey = (() => {
    if (publicAboutOnly) return 'about'
    const t = new URLSearchParams(location.search).get('tab') as TabKey | null
    return t && ['resume', 'favorites', 'applications', 'feedback', 'membership', 'about', 'settings'].includes(t) ? t : 'resume'
  })()

  const [tab, setTab] = useState<TabKey>(initialTab)

  useEffect(() => {
    if (isAuthenticated || publicAboutOnly || tab === 'about') return
    navigate(`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`, { replace: true })
  }, [isAuthenticated, location.pathname, location.search, navigate, publicAboutOnly, tab])

  // Sync tab with URL query parameter
  useEffect(() => {
    if (publicAboutOnly) {
      setTab('about')
      return
    }
    const searchParams = new URLSearchParams(location.search)
    const urlTab = searchParams.get('tab') as TabKey | null
    if (urlTab && ['custom-plan', 'resume', 'favorites', 'applications', 'feedback', 'membership', 'about', 'settings'].includes(urlTab)) {
      setTab(urlTab)
    }
  }, [location.search, publicAboutOnly])

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
  const [assistantConversationHistory, setAssistantConversationHistory] = useState<AssistantConversationMessage[]>([])
  const [assistantStartChoice, setAssistantStartChoice] = useState<'pending' | 'deferred' | 'running'>('pending')
  const resumeAssistantUpgradeTracked = useRef(false)
  const shouldAnimateConversationRef = useRef(true)

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
  const [applicationCount, setApplicationCount] = useState<number | null>(null)
  const [loadingApplicationCount, setLoadingApplicationCount] = useState<boolean>(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const { showSuccess, showError } = useNotificationHelpers()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showCertificateModal, setShowCertificateModal] = useState(false)
  const [membershipPlans, setMembershipPlans] = useState<EmbeddedMembershipPlan[]>(EMBEDDED_STATIC_MEMBERSHIP_PLANS)
  const [membershipStatus, setMembershipStatus] = useState<any>(null)
  const [selectedMembershipPlan, setSelectedMembershipPlan] = useState<EmbeddedMembershipPlan | null>(null)
  const [membershipPaymentMethod, setMembershipPaymentMethod] = useState<'wechat' | 'alipay'>('alipay')
  const [showMembershipPlanChooserModal, setShowMembershipPlanChooserModal] = useState(false)
  const [showMembershipPaymentModal, setShowMembershipPaymentModal] = useState(false)
  const [returnToMembershipPlansOnPaymentClose, setReturnToMembershipPlansOnPaymentClose] = useState(false)
  const [showMembershipAssistantModal, setShowMembershipAssistantModal] = useState(false)
  const [memberRecommendedJobs, setMemberRecommendedJobs] = useState<Job[]>([])
  const [loadingMemberRecommendations, setLoadingMemberRecommendations] = useState(false)
  const [approvedAboutFeedbacks, setApprovedAboutFeedbacks] = useState<Array<{ quote: string; name: string; title: string; avatar?: string }>>([])
  const [showAboutFeedbackModal, setShowAboutFeedbackModal] = useState(false)
  const [aboutFeedbackName, setAboutFeedbackName] = useState(authUser?.username || authUser?.email?.split('@')[0] || '')
  const [aboutFeedbackTitle, setAboutFeedbackTitle] = useState('')
  const [aboutFeedbackContent, setAboutFeedbackContent] = useState('')
  const [aboutFeedbackContact, setAboutFeedbackContact] = useState(authUser?.email || '')
  const [aboutFeedbackSubmitting, setAboutFeedbackSubmitting] = useState(false)
  const modalRoot = typeof document !== 'undefined' ? document.body : null
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

  const visibleAboutFeedbacks = useMemo(() => {
    return [...MEMBER_FEEDBACK, ...approvedAboutFeedbacks]
  }, [approvedAboutFeedbacks])

  useEffect(() => {
    if (!authUser) return
    setAboutFeedbackName((current) => current || authUser.username || authUser.email?.split('@')[0] || '')
    setAboutFeedbackContact((current) => current || authUser.email || '')
  }, [authUser])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/user-profile?action=public_feedbacks&source=about_testimonial')
        const data = await res.json().catch(() => ({ success: false }))
        if (!cancelled && data?.success && Array.isArray(data.feedbacks)) {
          setApprovedAboutFeedbacks(data.feedbacks.map((item: any) => ({
            quote: String(item.content || '').trim(),
            name: String(item.displayName || item.username || 'Haigoo 用户').trim(),
            title: String(item.displayTitle || '远程工作探索者').trim(),
            avatar: item.avatar || undefined
          })).filter((item: { quote: string }) => item.quote))
        }
      } catch (error) {
        console.error('[ProfileCenter] Failed to fetch public about feedbacks:', error)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const openAboutFeedbackModal = () => {
    trackingService.track('feedback_entry_click', {
      page_key: 'about',
      module: 'about_testimonials',
      feature_key: 'about_testimonial',
      source_key: 'about_leave_message_button'
    })
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent('/profile?tab=about')}`)
      return
    }
    setShowAboutFeedbackModal(true)
  }

  const submitAboutFeedback = async () => {
    if (!aboutFeedbackContent.trim()) {
      showError('请填写留言内容')
      return
    }
    if (!aboutFeedbackName.trim()) {
      showError('请填写展示名称')
      return
    }
    try {
      setAboutFeedbackSubmitting(true)
      trackingService.track('feedback_submit', {
        page_key: 'about',
        module: 'about_testimonials',
        feature_key: 'about_testimonial',
        source_key: 'about_leave_message_modal'
      })
      const res = await fetch('/api/user-profile?action=submit_feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || localStorage.getItem('haigoo_auth_token') || ''}` },
        body: JSON.stringify({
          accuracy: 'unknown',
          content: aboutFeedbackContent.trim(),
          contact: aboutFeedbackContact.trim(),
          source: 'about_testimonial',
          displayName: aboutFeedbackName.trim(),
          displayTitle: aboutFeedbackTitle.trim() || '远程工作探索者'
        })
      })
      const data = await res.json().catch(() => ({ success: false }))
      if (!res.ok || !data?.success) {
        showError('留言提交失败', data?.error || '请稍后重试')
        return
      }
      showSuccess('留言已提交，审核通过后会展示在页面中')
      setAboutFeedbackContent('')
      setAboutFeedbackTitle('')
      setShowAboutFeedbackModal(false)
    } catch (error) {
      showError('留言提交失败', '网络错误')
    } finally {
      setAboutFeedbackSubmitting(false)
    }
  }
  const assistantHistoryStorageKey = useMemo(
    () => getAssistantConversationStorageKey(
      authUser?.user_id || authUser?.email || authUser?.username || null,
      latestResume?.id || null
    ),
    [authUser?.email, authUser?.user_id, authUser?.username, latestResume?.id]
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

  useEffect(() => {
    let mounted = true

    const fetchMembershipPlans = async () => {
      try {
        const res = await fetch('/api/membership?action=plans')
        const data = await res.json()
        if (!mounted) return
        if (data?.success && Array.isArray(data.plans) && data.plans.length > 0) {
          const mergedPlans = EMBEDDED_STATIC_MEMBERSHIP_PLANS.map((fallback) => {
            const livePlan = data.plans.find((plan: EmbeddedMembershipPlan) => plan.memberType === fallback.memberType)
            return livePlan ? { ...fallback, ...livePlan } : fallback
          })
          setMembershipPlans(mergedPlans)
        }
      } catch (error) {
        console.error('[ProfileCenter] Failed to fetch membership plans:', error)
      }
    }

    const fetchMembershipStatus = async () => {
      try {
        const storedToken = token || localStorage.getItem('haigoo_auth_token')
        if (!storedToken) return
        const res = await fetch('/api/membership?action=status', {
          headers: { Authorization: `Bearer ${storedToken}` }
        })
        const data = await res.json()
        if (!mounted) return
        if (data?.success) {
          setMembershipStatus(data.membership)
        }
      } catch (error) {
        console.error('[ProfileCenter] Failed to fetch membership status:', error)
      }
    }

    fetchMembershipPlans()
    fetchMembershipStatus()
    trackingService.featureExposure('membership_center', {
      page_key: 'profile',
      module: 'profile_membership',
      source_key: 'profile_membership_tab'
    })

    return () => {
      mounted = false
    }
	  }, [token])

  useEffect(() => {
    if (tab !== 'membership' || !isAuthenticated || !isMember) {
      if (!isMember) setMemberRecommendedJobs([])
      return
    }

    let cancelled = false
    setLoadingMemberRecommendations(true)

    ;(async () => {
      try {
        const jobs = await fetchDailyMemberRecommendations(6)
        if (!cancelled) setMemberRecommendedJobs(jobs)
      } catch (error) {
        console.error('[ProfileCenter] Failed to fetch member recommendations:', error)
        if (!cancelled) setMemberRecommendedJobs([])
      } finally {
        if (!cancelled) setLoadingMemberRecommendations(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authUser?.user_id, isAuthenticated, isMember, tab, token])

  const activeMemberType = membershipStatus?.memberType || authUser?.memberType
  const activeMembershipExpireAt = membershipStatus?.expireAt || authUser?.memberExpireAt
  const displayMembershipPlans = useMemo(() => {
    return (['trial_week', 'quarter', 'year'] as EmbeddedMemberType[]).map((memberType) => {
      const plan = membershipPlans.find((plan) => plan.memberType === memberType)
        || EMBEDDED_STATIC_MEMBERSHIP_PLANS.find((plan) => plan.memberType === memberType)!
      if (memberType === 'year') {
        return {
          ...plan,
          ...EMBEDDED_STATIC_MEMBERSHIP_PLANS.find((item) => item.memberType === 'year')!,
          id: plan.id || 'goo_plus_yearly'
        }
      }
      return plan
    })
  }, [membershipPlans])

  const openMembershipPayment = (plan: EmbeddedMembershipPlan, options?: { returnToPlansOnClose?: boolean }) => {
    if (plan.comingSoon) return
    const planFeatureKey = plan.memberType === 'trial_week'
      ? 'membership_plan_trial_week'
      : plan.memberType === 'quarter'
        ? 'membership_plan_quarter'
        : 'membership_plan_year'

    trackingService.track('membership_plan_click', {
      page_key: 'profile',
      module: 'profile_membership_pricing',
      feature_key: planFeatureKey,
      source_key: 'profile_membership_tab',
      entity_type: 'plan',
      entity_id: plan.id,
      plan_id: plan.id,
      plan_name: plan.name,
      price: plan.price
    })

    if (plan.memberType === 'year') {
      setShowMembershipAssistantModal(true)
      return
    }

    setSelectedMembershipPlan(plan)
    setMembershipPaymentMethod('alipay')
    setReturnToMembershipPlansOnPaymentClose(Boolean(options?.returnToPlansOnClose))
    setShowMembershipPaymentModal(true)
  }

  const closeMembershipPaymentToPlans = () => {
    setShowMembershipPaymentModal(false)
    if (returnToMembershipPlansOnPaymentClose && selectedMembershipPlan) {
      setShowMembershipPlanChooserModal(true)
    }
    setReturnToMembershipPlansOnPaymentClose(false)
  }

  const currentMembershipPaymentInfo = {
    imageUrl: membershipPaymentMethod === 'alipay'
      ? (selectedMembershipPlan?.alipay_qr || (selectedMembershipPlan?.price === 999 ? '/alipay_999.jpg' : '/alipay.jpg'))
      : (selectedMembershipPlan?.wechat_qr || (selectedMembershipPlan?.price === 999 ? '/wechatpay_999.png' : '/wechatpay.png')),
    instruction: `请使用${membershipPaymentMethod === 'alipay' ? '支付宝' : '微信'}扫码支付`
  }

  const handleMembershipPaymentComplete = async () => {
    try {
      const storedToken = token || localStorage.getItem('haigoo_auth_token')
      if (storedToken && selectedMembershipPlan) {
        await fetch('/api/membership?action=claim_payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${storedToken}`
          },
          body: JSON.stringify({
            planId: selectedMembershipPlan.id,
            paymentMethod: membershipPaymentMethod,
            amount: selectedMembershipPlan.price,
            email: authUser?.email,
            page_key: 'profile',
            source_key: 'profile_membership_tab',
            flow_id: selectedMembershipPlan.id
          })
        })
      }
    } catch (error) {
      console.error('[ProfileCenter] Failed to report payment claim:', error)
    }

    setShowMembershipPaymentModal(false)
    setShowMembershipPlanChooserModal(false)
    setReturnToMembershipPlansOnPaymentClose(false)
    showSuccess('已提交支付确认', '权益通常在 3 分钟内生效（深夜除外）。如未生效可邮件联系 hi@haigooremote.com。')

    try {
      const storedToken = token || localStorage.getItem('haigoo_auth_token')
      if (storedToken) {
        const res = await fetch('/api/membership?action=status', {
          headers: { Authorization: `Bearer ${storedToken}` }
        })
        const data = await res.json()
        if (data?.success) setMembershipStatus(data.membership)
      }
    } catch (error) {
      console.error('[ProfileCenter] Failed to refresh membership status:', error)
    }

    trackingService.track('complete_payment_client_claim', {
      page_key: 'profile',
      module: 'profile_membership_payment',
      source_key: 'profile_membership_tab',
      entity_type: 'plan',
      entity_id: selectedMembershipPlan?.id,
      plan_id: selectedMembershipPlan?.id
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
    if (t && ['resume', 'favorites', 'applications', 'feedback', 'membership', 'about', 'settings'].includes(t)) setTab(t as TabKey)
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

  useEffect(() => {
    setAssistantConversationHistory([])
    setAssistantConversationRevealLineCount(0)
    previousConversationTotalLinesRef.current = 0
    shouldAnimateConversationRef.current = true
  }, [latestResume?.id])

  useEffect(() => {
    if (!assistantHistoryStorageKey || typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(assistantHistoryStorageKey)
      if (!raw) return
      const parsed = parseJsonValue<StoredAssistantConversationHistory | null>(raw, null)
      if (!parsed?.messages?.length || !parsed.savedAt) return
      const savedAt = new Date(parsed.savedAt)
      if (Number.isNaN(savedAt.getTime()) || Date.now() - savedAt.getTime() > 90 * 24 * 60 * 60 * 1000) {
        window.localStorage.removeItem(assistantHistoryStorageKey)
        return
      }
      setAssistantConversationHistory(parsed.messages)
      shouldAnimateConversationRef.current = false
    } catch (error) {
      console.warn('[ProfileCenter] Failed to restore assistant history:', error)
    }
  }, [assistantHistoryStorageKey])

  const assistantConversationMessages = useMemo<AssistantConversationMessage[]>(() => {
    if (!latestResume?.id) {
      return [
        {
          id: 'empty-assistant',
          role: 'assistant',
          title: '简历助手已就绪',
          body: '把简历交给我后，我会先陪您做一轮整体判断，再一步步带您看到亮点、补强方向和面试准备。',
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
          body: '我先陪您做一轮整体判断，看看哪些优势最值得继续放大。',
          accent: 'neutral'
        }
      ]

      if (assistantStartChoice === 'deferred') {
        messages.push(
          {
            id: 'defer-user',
            role: 'user',
            body: '我先稍后再看',
            accent: 'indigo'
          },
          {
            id: 'defer-assistant',
            role: 'assistant',
            body: '没问题。您准备好了再回来，我会接着陪您往下看。',
            accent: 'neutral'
          }
        )
      }

      return messages
    }

    const promptMap: Record<AssistantConversationKey, string> = {
      overview: '我想先看看整体判断',
      strengths: '想先看看我最突出的亮点',
      growth: '请告诉我接下来该重点补强什么',
      interview: '先帮我准备英文面试',
      polish: isMember ? '继续陪我往下深度打磨' : '我想继续往下完善'
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
          title: '我先说一个整体判断',
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
          title: '这里有几项优势已经很值得继续放大',
          body: '它们不是重新编造出来的，而是你已经具备，只需要表达得更集中。',
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
        title: '先和您确认几项已经很有说服力的亮点',
        body: '这些内容后面不管是投递还是面试，都可以继续围绕它们展开。',
        bullets: (assistantFramework.strengths || []).map((item) => `${item.title}：${item.detail}`),
        accent: 'emerald'
      })

      if (assistantFramework.rewriteDirections?.length) {
        messages.push({
          id: 'strengths-direction',
          role: 'assistant',
          title: '接下来只需要把表达再往前推一步',
          body: '下面这些方向能让招聘方更快看见你的价值。',
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
          title: '接下来最值得优先补强的是这些位置',
          body: '先把这几处补完整，往往会比整份简历推倒重来更有效。',
          bullets: assistantFramework.growthAreas.map((item) => `${item.title}：${item.detail}`),
          accent: 'neutral'
        })
      }

      if (assistantFramework.starGaps?.length) {
        messages.push({
          id: 'growth-star',
          role: 'assistant',
          title: '如果按 STAR 再补一层，说服力会更稳',
          body: '尤其是情境、动作和结果补齐以后，面试官会更容易快速理解你的价值。',
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
        title: '我先帮您把英文面试的主线搭起来',
        body: assistantFramework.englishInterviewFramework?.summary || '先把表达骨架搭清楚，后面再继续往下展开会轻松很多。',
        bullets: assistantFramework.englishInterviewFramework?.selfIntroOutline || [],
        accent: 'indigo'
      })

      if (selectedQuestion) {
        messages.push({
          id: 'interview-selected',
          role: 'assistant',
          title: selectedQuestion.question,
          body: selectedQuestion.hint || '可以先围绕目标、动作和结果来组织回答，再补上你与岗位的匹配点。',
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
          body: '我把这一轮深度打磨拆成了几个可以直接拿去用的部分。',
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
          title: '我们可以继续往下深挖',
          body: '您可以继续选择简历打磨、英文面试或模拟回答，我会基于当前内容接着展开。',
          accent: 'neutral'
        })
      } else {
        messages.push({
          id: 'polish-upgrade',
          role: 'assistant',
          title: '下一步可以继续往下完善',
          body: '继续解锁深度打磨后，就能把重点经历、英文面试和模拟回答串成更完整的一套准备。',
          accent: 'neutral'
        })
      }
      return messages
    }

    return messages
  }, [assistantConversationKey, assistantFramework, assistantPolishResult, selectedInterviewQuestion, aiSuggestions, isMember, latestResume?.id, assistantStartChoice])

  useEffect(() => {
    setAssistantConversationHistory((prev) => {
      if (!assistantConversationMessages.length) return prev
      const existingIds = new Set(prev.map((message) => message.id))
      const appended = assistantConversationMessages.filter((message) => !existingIds.has(message.id))
      if (!appended.length) return prev
      return [...prev, ...appended]
    })
  }, [assistantConversationMessages])

  const renderedConversationMessages = useMemo(
    () => (assistantConversationHistory.length ? assistantConversationHistory : assistantConversationMessages),
    [assistantConversationHistory, assistantConversationMessages]
  )

  useEffect(() => {
    if (!assistantHistoryStorageKey || typeof window === 'undefined' || !assistantConversationHistory.length) return
    try {
      const payload: StoredAssistantConversationHistory = {
        savedAt: new Date().toISOString(),
        messages: assistantConversationHistory
      }
      window.localStorage.setItem(assistantHistoryStorageKey, JSON.stringify(payload))
    } catch (error) {
      console.warn('[ProfileCenter] Failed to persist assistant history:', error)
    }
  }, [assistantConversationHistory, assistantHistoryStorageKey])

  const assistantConversationRenderableMessages = useMemo<AssistantConversationRenderableMessage[]>(
    () =>
      renderedConversationMessages.map((message) => {
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
    [renderedConversationMessages]
  )

  useEffect(() => {
    const totalLines = assistantConversationRenderableMessages.reduce((sum, message) => sum + message.totalLines, 0)
    const previousTotalLines = previousConversationTotalLinesRef.current

    if (!assistantConversationRenderableMessages.length || totalLines === 0) {
      setAssistantConversationRevealLineCount(0)
      previousConversationTotalLinesRef.current = 0
      return
    }

    if (!shouldAnimateConversationRef.current) {
      setAssistantConversationRevealLineCount(totalLines)
      previousConversationTotalLinesRef.current = totalLines
      shouldAnimateConversationRef.current = true
      return
    }

    const startingLine = previousTotalLines === 0 ? 1 : Math.min(previousTotalLines, totalLines)
    setAssistantConversationRevealLineCount(startingLine)

    if (totalLines <= startingLine) {
      previousConversationTotalLinesRef.current = totalLines
      return
    }

    const timer = window.setInterval(() => {
      setAssistantConversationRevealLineCount((prev) => {
        if (prev >= totalLines) {
          window.clearInterval(timer)
          return prev
        }
        return prev + 1
      })
    }, 150)

    previousConversationTotalLinesRef.current = totalLines

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
    if (!isAuthenticated && t !== 'about') {
      navigate(`/login?redirect=${encodeURIComponent(`/profile?tab=${t}`)}`)
      return
    }
    setTab(t)
    const sp = new URLSearchParams(location.search)
    sp.set('tab', t)
    navigate({ pathname: '/profile', search: `?${sp.toString()}` }, { replace: true })
  }

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
  }, [authUser?.user_id, token])

  useEffect(() => {
    ; (async () => {
      if (!authUser || !token) {
        setApplicationCount(null)
        return
      }

      setLoadingApplicationCount(true)
      try {
        const response = await fetch('/api/user-profile?action=my_applications', {
          headers: { Authorization: `Bearer ${token as string}` }
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload?.success || !Array.isArray(payload?.applications)) {
          throw new Error(payload?.error || '申请记录接口返回异常')
        }
        setApplicationCount(payload.applications.length)
      } catch (error) {
        console.error('[ProfileCenter] Failed to fetch application count:', error)
        setApplicationCount(null)
      } finally {
        setLoadingApplicationCount(false)
      }
    })()
  }, [authUser?.user_id, token])

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
    const assistantProgressCard: AssistantProgressCard = !latestResume
      ? {
          current: '现在先上传简历，马上开始第一轮整体评估。',
          currentTone: 'default',
          next: [
            { label: '整体判断' },
            { label: '亮点提炼' },
            { label: '英文面试准备' }
          ]
        }
      : isAnalyzing
        ? {
            current: analysisStep || '正在帮你梳理简历重点',
            currentTone: 'active',
            next: [
              { label: '强化简历表达', memberOnly: true },
              { label: '补足弱项' },
              { label: '模拟英文面试', memberOnly: true }
            ]
          }
        : hasAssistantFramework
          ? {
              current: assistantConversationKey === 'interview'
                ? '当前正在进行英文面试准备'
                : assistantConversationKey === 'growth'
                  ? '当前正在补足弱项'
                  : assistantConversationKey === 'strengths'
                    ? '当前正在提炼优势亮点'
                    : assistantConversationKey === 'polish'
                      ? '当前正在继续深度打磨'
                      : '当前正在查看整体判断',
              currentTone: 'done',
              next: [
                { label: '强化简历表达', memberOnly: true },
                { label: '补足弱项' },
                { label: '模拟英文面试', memberOnly: true }
              ]
            }
          : {
              current: '简历已经准备好，可以开始第一轮整体评估。',
              currentTone: 'default',
              next: [
                { label: '整体判断' },
                { label: '亮点提炼' },
                { label: '英文面试准备' }
              ]
            }

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
                  <p className="mt-4 text-sm leading-6 text-slate-700">{assistantProgressCard.current}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assistantProgressCard.next.map((item) => (
                      <span
                        key={item.label}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          item.memberOnly
                            ? 'border-indigo-200 bg-white text-indigo-700'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {item.memberOnly ? <Crown className="h-3 w-3" /> : null}
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.84fr)_minmax(0,1.16fr)] xl:items-stretch">
          <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:h-[680px] xl:h-[calc(100vh-250px)] xl:max-h-[820px]">
            <div className="flex h-full min-h-0 flex-col">
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

              <div className="relative flex-1 min-h-0">
                {resumePreviewContent}
                {showUpgradeModal && latestResume ? (
                  <div className="pointer-events-none absolute inset-0 z-10 rounded-[24px] bg-slate-50/70 backdrop-blur-[1px]" />
                ) : null}
              </div>

              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleUpload} className="hidden" />
              {isUploading && <div className="mt-4 text-center text-sm text-slate-500">正在上传并解析简历...</div>}
            </div>
          </section>

          <section id="ai-analysis-section" className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm md:h-[680px] xl:h-[calc(100vh-250px)] xl:max-h-[820px]">
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-slate-200 px-5 py-4">
                <h3 className="text-[18px] font-black tracking-tight text-slate-950 md:text-[20px]">逐步拆解你的简历与面试准备</h3>
              </div>

              <div ref={conversationScrollRef} className="flex-1 overflow-y-auto bg-slate-50/70 px-5 py-4">
                {isAnalyzing ? (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <div className="flex max-w-[72%] items-start gap-3">
                        <div className="rounded-[24px] rounded-br-md bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm">
                          {assistantConversationKey === 'polish' ? '继续陪我往下打磨' : '好啊，我们开始吧'}
                        </div>
                        <UserAvatar avatar={authUser?.avatar} username={authUser?.username || authUser?.profile?.fullName} isMember={isMember} />
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
                        <p className="text-base font-semibold leading-7 text-slate-900">把简历交给我吧。我会先陪您看清整体判断，再一步步往面试准备推进。</p>
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
                            {isUser ? <UserAvatar avatar={authUser?.avatar} username={authUser?.username || authUser?.profile?.fullName} isMember={isMember} /> : null}
                          </div>
                        )
                      })
                    })()}

                    {!hasAssistantFramework && assistantStartChoice !== 'deferred' ? (
                      <div className="flex items-start gap-3">
                        <AssistantAvatar />
                        <div className="w-full max-w-[82%] rounded-[24px] rounded-bl-md border border-slate-200 bg-white px-4 py-4 shadow-sm">
                          <div className="text-sm font-semibold text-slate-900">简历已经准备好了。要不要先让我陪您看一遍整体状态？</div>
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
                              className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-700"
                            >
                              <Crown className="h-3.5 w-3.5" />
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
    const feedbackSource = new URLSearchParams(location.search).get('source') || 'profile_feedback'

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
          body: JSON.stringify({
            accuracy,
            content,
            contact,
            source: feedbackSource,
            sourceUrl: `${location.pathname}${location.search || ''}`
          })
        })
        const j = await r.json().catch(() => ({ success: false }))
        if (r.ok && j.success) {
          trackingService.track('feedback_submit', {
            page_key: 'profile',
            module: 'feedback_tab',
            feature_key: 'platform_feedback',
            source_key: feedbackSource
          })
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
      if (!confirm('确定要永久删除账号吗？所有数据（简历、收藏、订阅等）将无法恢复，且该邮箱 30 天内无法重新注册。')) return
      if (!confirm('再次确认：此操作不可撤销，且 30 天内无法用同邮箱重新注册，确定要删除吗？')) return

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

  const displayName = authUser?.profile?.fullName || authUser?.username || authUser?.email?.split('@')[0] || '朋友'
  const currentHour = new Date().getHours()
  const greeting = currentHour < 12 ? '上午好' : currentHour < 18 ? '下午好' : '晚上好'
  const homeStats = [
    {
      label: '收藏岗位',
      value: favoritesWithStatus.length,
      icon: Heart,
      tint: 'bg-[#fff0f4] text-[#ef668f]'
    },
    {
      label: '简历状态',
      value: latestResume ? '已上传' : '待上传',
      icon: FileText,
      tint: 'bg-[#edf7ff] text-[#4b95e8]'
    },
    {
      label: '会员状态',
      value: isMember ? (isTrialMember ? '体验会员' : '生效中') : '未开通',
      icon: Crown,
      tint: 'bg-[#f0edff] text-[#6f63f6]'
    },
    {
      label: '求职记录',
      value: loadingApplicationCount ? '读取中' : applicationCount == null ? '读取失败' : applicationCount,
      icon: Clock,
      tint: 'bg-[#fff7dc] text-[#c78b1d]'
    }
  ]
  const activeMemberLabel = activeMemberType === 'trial_week'
    ? '体验会员'
    : activeMemberType === 'quarter'
      ? '季度会员'
      : isMember
        ? 'Haigoo Member'
        : '未开通'
  const membershipExpireDate = activeMembershipExpireAt ? new Date(activeMembershipExpireAt) : null
  const membershipExpireLabel = membershipExpireDate && !Number.isNaN(membershipExpireDate.getTime())
    ? membershipExpireDate.toLocaleDateString('zh-CN')
    : '长期有效'
  const membershipStatusExpireLabel = isMember ? membershipExpireLabel : '开通后生效'
  const membershipDaysRemaining = membershipExpireDate && !Number.isNaN(membershipExpireDate.getTime())
    ? Math.ceil((membershipExpireDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null
  const shouldShowRenewalPlans = !isMember || (membershipDaysRemaining !== null && membershipDaysRemaining <= 14)

  const openMembershipPlanChooser = () => {
    setShowMembershipPlanChooserModal(true)
    trackingService.track('membership_plan_chooser_open', {
      page_key: 'profile',
      module: 'profile_membership_status_card',
      source_key: 'profile_membership_status_card',
      user_segment: isMember ? 'member' : 'free'
    })
  }

  const chooseMembershipPlan = (plan: EmbeddedMembershipPlan) => {
    openMembershipPayment(plan, { returnToPlansOnClose: true })
  }

  const openMembershipRecommendedJob = (job: Job) => {
    setSelectedJob({ ...job, memberOnly: true })
    setIsJobDetailOpen(true)
  }

  const memberRecommendationModalIndex = selectedJob
    ? memberRecommendedJobs.findIndex((job) => job.id === selectedJob.id)
    : -1
  const modalNavigationJobs = memberRecommendationModalIndex >= 0 ? memberRecommendedJobs : []
  const navigateMemberRecommendationModal = (direction: 'prev' | 'next') => {
    if (memberRecommendationModalIndex < 0 || memberRecommendedJobs.length <= 1) return
    const nextIndex = direction === 'prev'
      ? Math.max(0, memberRecommendationModalIndex - 1)
      : Math.min(memberRecommendedJobs.length - 1, memberRecommendationModalIndex + 1)
    setSelectedJob({ ...memberRecommendedJobs[nextIndex], memberOnly: true })
  }

  const membershipPlanFeatures: Record<EmbeddedMemberType, string[]> = {
    trial_week: ['解锁全部高价值岗位信息', '解锁全部企业联系人信息', '解锁全部企业直申机会', '解锁会员专属推荐和 AI 简历优化'],
    quarter: ['解锁全部高价值岗位信息', '解锁全部企业联系人信息', '解锁全部企业直申机会', '解锁会员专属推荐和 AI 简历优化', '优先人工支持和服务'],
    year: ['远程求职路径答疑', '个人背景与目标岗位分析', '英文简历 / 求职信定制', '职业路径规划与转型咨询']
  }

  const membershipPlanTags: Record<EmbeddedMemberType | 'free', string> = {
    free: '基础体验',
    trial_week: '集中冲刺',
    quarter: '在职友好',
    year: '量身定制'
  }

  const membershipPlanDescriptions: Record<EmbeddedMemberType | 'free', string> = {
    free: '适合先判断方向，轻量体验岗位申请流程。',
    trial_week: '适合已经有明确意向、集中冲刺指定岗位方向的人。',
    quarter: '适合正在准备远程机会、需要持续积累信息和资源的在职人士。',
    year: '适合精力有限、需要人工一对一服务的高效能人士。'
  }

  const getMembershipPlanTitle = (memberType: EmbeddedMemberType) => {
    if (memberType === 'trial_week') return '远程俱乐部体验会员（7天）'
    if (memberType === 'quarter') return '远程俱乐部会员（季度）'
    return '远程工作个性化咨询'
  }

  const getMembershipPlanUnit = (memberType: EmbeddedMemberType) => {
    if (memberType === 'trial_week') return '/ 7 天'
    if (memberType === 'quarter') return '/ 季度'
    return ''
  }

  const MembershipTab = () => (
    <div className="relative min-h-full overflow-hidden rounded-[30px] bg-[#fffdf8] px-4 py-5 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <img src="/pic_lists/About_pics/about_bg.webp" alt="" className="absolute inset-x-0 top-0 h-[520px] w-full object-cover object-[58%_36%] opacity-[0.18] saturate-[0.96]" />
        <img src="/pic_lists/Home_pics/background04.webp" alt="" className="absolute inset-x-0 bottom-0 h-[420px] w-full object-cover object-bottom opacity-[0.18]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,248,0.94)_0%,rgba(251,253,255,0.9)_48%,rgba(255,253,248,0.95)_100%)]" />
      </div>

      <section className="relative mb-7 overflow-hidden rounded-[30px] border border-[#eadfcf] bg-[#fffdf8] px-6 py-7 shadow-[0_28px_86px_-62px_rgba(139,101,54,0.46)] sm:px-8 lg:px-10 lg:py-9">
        <div className="pointer-events-none absolute inset-0">
          <img src="/pic_lists/Home_pics/background04.webp" alt="" className="absolute inset-0 h-full w-full scale-[1.04] object-cover object-[70%_55%] opacity-[0.54] saturate-[0.95]" />
          <img src="/pic_lists/About_pics/grass_icon-transparent.webp" alt="" className="absolute bottom-3 left-[54%] hidden h-24 w-24 object-contain opacity-24 xl:block" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,253,248,0.99)_0%,rgba(255,253,248,0.94)_42%,rgba(255,253,248,0.66)_70%,rgba(255,253,248,0.86)_100%),linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,253,248,0.62)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(255,253,248,0)_0%,rgba(255,253,248,0.96)_100%)]" />
        </div>
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-center">
          <div className="max-w-[820px]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#f3e0bb] bg-white/82 px-3 py-1 text-xs font-black text-[#bd7a12] shadow-sm">
              <Crown className="h-3.5 w-3.5" />
              会员权益中心
            </div>
            <h1 className="haigoo-hand-bold max-w-[780px] font-haigoo-hand text-[38px] leading-[1.08] tracking-normal text-slate-950 sm:text-[52px] xl:text-[64px]">
              优中选优，更快拿到有效结果
            </h1>
            <p className="mt-5 max-w-[680px] text-sm leading-7 text-slate-600 sm:text-base">
              Haigoo 为你提供专属资源支持，会员类岗位优中选优，国内申请成功概率更高。
            </p>
            <div className="mt-6 grid max-w-[640px] gap-3 sm:grid-cols-3">
              {[
                ['会员岗位', '国内友好'],
                ['企业联系人', '无限次数'],
                ['申请路径', '畅通无阻']
              ].map(([title, desc]) => (
                <div key={title} className="rounded-[18px] border border-[#eadfcf] bg-white px-4 py-3 shadow-[0_14px_32px_-28px_rgba(139,101,54,0.3)]">
                  <div className="text-sm font-black text-slate-950">{title}</div>
                  <div className="mt-1 text-xs font-bold text-slate-500">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[24px] border border-[#eadfcf] bg-white p-5 shadow-[0_24px_70px_-58px_rgba(139,101,54,0.36)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f0edff] text-[#6f63f6]">
                <Crown className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black text-slate-950">{activeMemberLabel}</div>
                <div className="mt-0.5 text-xs font-bold text-slate-400">当前会员状态</div>
              </div>
            </div>
            <div className="mt-5 rounded-[20px] border border-[#efe5d5] bg-[#fffdf9] px-4 py-3">
              <div className="text-[11px] font-black tracking-[0.14em] text-slate-400">有效期至</div>
              <div className="mt-1 text-2xl font-black text-slate-900">{membershipStatusExpireLabel}</div>
              {membershipDaysRemaining !== null ? (
                <div className="mt-1 text-xs font-bold text-[#6f63f6]">剩余 {Math.max(membershipDaysRemaining, 0)} 天</div>
              ) : null}
            </div>
            <div className={`mt-4 grid gap-2 ${isMember ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button
                type="button"
                onClick={openMembershipPlanChooser}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#6f63f6] px-4 py-2.5 text-sm font-black text-white shadow-[0_18px_38px_-24px_rgba(95,99,246,0.58)] transition-all hover:-translate-y-0.5"
              >
                {isMember ? '续费/升级权益' : '加入会员'}
                <ArrowRight className="h-4 w-4" />
              </button>
              {isMember ? (
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#d8d2ff] bg-white px-4 py-2.5 text-sm font-black text-[#6f63f6] transition-all hover:-translate-y-0.5"
                >
                  证书
                  <Download className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {isMember ? (
        <section className="relative mb-7 grid items-stretch gap-5 xl:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]">
          <div className="relative flex min-h-[460px] overflow-hidden rounded-[28px] border border-[#e5dccb] bg-white/88 p-5 shadow-[0_24px_70px_-56px_rgba(139,101,54,0.36)] xl:h-full xl:max-h-[560px]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_12%,rgba(244,173,50,0.1),transparent_28%),linear-gradient(180deg,rgba(255,253,249,0.62),rgba(255,255,255,0.92))]" />
            <div className="relative flex min-h-0 w-full flex-col">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#e6dccb] bg-white/82 px-3 py-1 text-xs font-black text-[#8b6b3d] shadow-sm">
                  <Crown className="h-3.5 w-3.5" />
                  权益工作台
                </div>
                <h3 className="mt-3 text-xl font-black leading-tight text-slate-950">会员权益已解锁，申请畅通无阻</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  畅享全站所有岗位与企业联系人信息，好机会先人一步。
                </p>
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  ['解锁高价值岗位', '优先查看国内申请成功率更高的真实稀缺岗位'],
                  ['解锁关键决策人信息', '查看经过验证的岗位直属联系人，内推更高效'],
                  ['会员专属推荐', '综合简历、搜索和筛选记录，每日更新精选机会'],
                  ['全站畅通体验', '岗位、企业、线索和工具统一开放，减少来回切换']
                ].map(([title, desc]) => (
                  <div key={title} className="rounded-[18px] border border-[#efe7da] bg-white/78 px-4 py-3 shadow-[0_14px_34px_-32px_rgba(139,101,54,0.34)]">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                      <Check className="h-4 w-4 text-[#6f63f6]" strokeWidth={3} />
                      {title}
                    </div>
                    <div className="mt-1 pl-6 text-xs leading-5 text-slate-500">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[460px] overflow-hidden rounded-[28px] border border-[#e1e8f4] bg-white/92 p-5 shadow-[0_24px_70px_-56px_rgba(64,78,102,0.32)] xl:max-h-[560px]">
            <div className="relative flex min-h-0 w-full flex-col">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#e6dccb] bg-white/82 px-3 py-1 text-xs font-black text-[#6f63f6] shadow-sm">
                  <Star className="h-3.5 w-3.5 fill-[#f4ad32] text-[#f4ad32]" />
                  会员专属推荐
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/jobs?memberOnly=true')}
                  className="inline-flex items-center gap-1.5 text-xs font-black text-[#6f63f6] transition hover:text-[#5148d8]"
                >
                  查看更多
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                {loadingMemberRecommendations ? (
                  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#dfe8ef] bg-[#fbfdff]/80 text-center">
                    <Loader2 className="h-7 w-7 animate-spin text-[#7b74ff]" />
                    <div className="mt-3 text-sm font-bold text-slate-500">正在生成今日会员推荐...</div>
                  </div>
                ) : memberRecommendedJobs.length > 0 ? (
                  memberRecommendedJobs.map((job) => (
                    <JobCardNew
                      key={job.id}
                      job={{ ...job, memberOnly: true }}
                      variant="list"
                      matchScore={job.matchScore || job.displayMatchScore || job.recommendationScore || undefined}
                      onClick={() => openMembershipRecommendedJob(job)}
                    />
                  ))
                ) : (
                  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#dfe8ef] bg-[#fbfdff]/80 px-6 text-center">
                    <Star className="h-8 w-8 fill-[#f4ad32] text-[#f4ad32]" />
                    <div className="mt-3 text-sm font-bold text-slate-600">今日会员推荐正在更新</div>
                    <button
                      type="button"
                      onClick={() => navigate('/jobs?memberOnly=true')}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#6f63f6] px-4 py-2 text-xs font-black text-white"
                    >
                      查看会员岗位
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </section>
      ) : null}

      <section className="relative mb-7 grid overflow-hidden rounded-[24px] border border-[#e6edf3] bg-white p-3 shadow-[0_26px_72px_-58px_rgba(64,78,102,0.28)] md:grid-cols-2 xl:grid-cols-5">
        {[
          { title: '精准岗位推荐', desc: '智能匹配优质远程岗位', icon: Eye },
          { title: '无限机会与资源', desc: '优先获得全部稀缺岗位与企业联系人资源', icon: Send },
          { title: '个性化咨询', desc: '为你一对一解答远程求职疑惑', icon: Users },
          { title: '优先体验新功能', desc: '抢先体验产品新能力与活动', icon: Sparkles },
          { title: '专属客服支持', desc: '会员专属通道，快速响应', icon: MessageSquare }
        ].map((item) => (
          <div key={item.title} className="group relative flex min-h-[92px] items-center gap-4 rounded-[18px] px-4 py-4 transition hover:bg-[#fbfdff] xl:after:absolute xl:after:right-0 xl:after:top-5 xl:after:h-12 xl:after:w-px xl:after:bg-[linear-gradient(180deg,transparent,rgba(148,163,184,0.2),transparent)] xl:last:after:hidden">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f3f0ff] text-[#7b74ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <item.icon className="h-5 w-5 transition-transform group-hover:scale-110" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black text-slate-900">{item.title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{item.desc}</div>
            </div>
          </div>
        ))}
      </section>

      {shouldShowRenewalPlans ? (
      <section className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="relative flex min-h-[380px] flex-col overflow-hidden rounded-[22px] border border-[#dfe8ef] bg-white p-6 shadow-[0_18px_48px_-42px_rgba(64,78,102,0.18)] transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-52px_rgba(64,78,102,0.24)]">
          <div className="mb-5">
            <div className="mb-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{membershipPlanTags.free}</div>
            <h3 className="text-2xl font-extrabold leading-tight text-slate-950">免费版</h3>
            <p className="mt-4 min-h-[52px] text-sm leading-6 text-slate-600">{membershipPlanDescriptions.free}</p>
          </div>
          <div className="mb-6 flex items-end gap-1">
            <span className="text-4xl font-extrabold tracking-tight text-slate-900">¥0</span>
            <span className="pb-1 text-sm font-bold text-slate-400">/ 永久</span>
          </div>
          <div className="flex-1 space-y-3">
            {['基本搜索、筛选、推荐功能', '企业直申 20 次', '企业联系人信息解锁 3 次', '可查看部分岗位信息'].map((feature) => (
              <div key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <Check className="mt-1 h-4 w-4 shrink-0 text-slate-500" strokeWidth={3} />
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled
            className="mt-7 inline-flex w-full cursor-not-allowed items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-5 py-3 text-sm font-black text-slate-400"
          >
            当前方案
          </button>
        </article>
        {displayMembershipPlans.map((plan) => {
          const isQuarter = plan.memberType === 'quarter'
          const isCurrentPlan = isMember && activeMemberType === plan.memberType
          const isDisabled = Boolean(plan.comingSoon)
          const priceUnit = getMembershipPlanUnit(plan.memberType)
          const planTitle = getMembershipPlanTitle(plan.memberType)
          const planPrice = plan.memberType === 'year' ? '¥299-¥599' : `¥${plan.price}`
          return (
            <article
              key={plan.id}
              className={`relative flex min-h-[380px] flex-col overflow-hidden rounded-[22px] border p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-52px_rgba(64,78,102,0.24)] ${
                isQuarter
                  ? 'border-[#cdc7ff] bg-[linear-gradient(180deg,rgba(250,249,255,0.98),rgba(255,255,255,0.98))] shadow-[0_24px_60px_-46px_rgba(123,116,255,0.24)]'
                  : plan.memberType === 'trial_week'
                    ? 'border-[#bee8cf] bg-[linear-gradient(180deg,rgba(248,255,251,0.98),rgba(255,255,255,0.99))] shadow-[0_18px_48px_-42px_rgba(73,169,130,0.18)]'
                    : 'border-[#efd5a7] bg-[linear-gradient(180deg,rgba(255,253,248,0.98),rgba(255,255,255,0.99))] shadow-[0_18px_48px_-42px_rgba(194,137,50,0.16)]'
              }`}
            >
              {isQuarter ? (
                <div className="absolute right-5 top-5 rounded-full bg-[#6f63f6] px-3 py-1 text-xs font-black text-white shadow-[0_12px_26px_-18px_rgba(123,116,255,0.65)]">推荐</div>
              ) : null}
              <div className="mb-5">
                <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-black ${plan.memberType === 'trial_week' ? 'bg-emerald-50 text-emerald-700' : isQuarter ? 'bg-[#f1efff] text-[#6f63f6]' : 'bg-[#fff5df] text-[#b47319]'}`}>
                  {membershipPlanTags[plan.memberType]}
                </div>
                <h3 className="max-w-[86%] text-2xl font-extrabold leading-tight text-slate-950">{planTitle}</h3>
                <p className="mt-4 min-h-[52px] text-sm leading-6 text-slate-600">
                  {membershipPlanDescriptions[plan.memberType]}
                </p>
              </div>
              {isQuarter ? (
                <div className="mb-5 mt-1">
                  <div className="text-sm font-black text-slate-400 line-through decoration-2">¥399 /季度</div>
                  <div className="mt-1 flex min-w-0 items-center gap-2 whitespace-nowrap">
                    <span className="shrink-0 text-[42px] font-extrabold leading-none tracking-tight text-slate-900">¥199</span>
                    <span className="shrink-0 text-sm font-bold text-slate-400">/季度</span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#ffd6a6] bg-[#fff7e8] px-2.5 py-1 text-[11px] font-black text-[#c26b00]">
                      🔥 限时 5 折
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mb-3 flex items-end gap-1">
                  {plan.comingSoon ? (
                    <span className="text-4xl font-extrabold tracking-tight text-slate-900">筹备中</span>
                  ) : (
                    <>
                      <span className="text-4xl font-extrabold tracking-tight text-slate-900">{planPrice}</span>
                      <span className="pb-1 text-sm font-bold text-slate-400">{priceUnit}</span>
                    </>
                  )}
                </div>
              )}
              <div className="flex-1 space-y-3">
                {membershipPlanFeatures[plan.memberType].map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                    <Check className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${isQuarter ? 'text-[#6f63f6]' : plan.memberType === 'year' ? 'text-amber-600' : 'text-emerald-600'}`} strokeWidth={3} />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={isCurrentPlan || isDisabled}
                onClick={() => openMembershipPayment(plan)}
                className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition-all ${
                  isCurrentPlan
                    ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                    : isDisabled
                      ? 'cursor-not-allowed border border-slate-200 bg-white text-slate-400'
                      : isQuarter
                        ? 'bg-[#6f63f6] text-white shadow-[0_18px_38px_-24px_rgba(95,99,246,0.52)] hover:-translate-y-0.5'
                        : plan.memberType === 'year'
                          ? 'bg-[#e8a020] text-white shadow-[0_18px_38px_-24px_rgba(210,130,20,0.46)] hover:-translate-y-0.5'
                          : 'bg-slate-950 text-white hover:-translate-y-0.5'
                }`}
              >
                {isCurrentPlan ? '当前方案' : isDisabled ? '即将开放' : plan.memberType === 'trial_week' ? '立即体验 7 天' : plan.memberType === 'year' ? '微信咨询了解详情' : '开通会员'}
                {!isCurrentPlan && !isDisabled ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </article>
          )
        })}
      </section>
      ) : null}

      <section className="relative mt-5 grid items-stretch gap-4 xl:grid-cols-[1fr_340px]">
        <div className="relative flex min-h-[260px] overflow-hidden rounded-[26px] border border-[#e6d7b9] bg-[linear-gradient(115deg,rgba(255,253,248,0.98)_0%,rgba(255,255,255,0.98)_56%,rgba(246,253,250,0.96)_100%)] p-5 shadow-[0_24px_66px_-52px_rgba(139,101,54,0.32)]">
          <div className="pointer-events-none absolute inset-0">
            <img src="/pic_lists/About_pics/thanks_bg.webp" alt="" className="absolute inset-y-0 right-0 h-full w-[42%] object-cover object-right opacity-[0.1] saturate-[0.88]" />
            <img src="/pic_lists/About_pics/sun-transparent.webp" alt="" className="absolute right-8 top-7 h-12 w-12 object-contain opacity-22" />
            <img src="/pic_lists/Home_pics/grass_icon2-transparent.webp" alt="" className="absolute bottom-3 left-6 h-16 w-16 object-contain opacity-18" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,253,248,0.99)_0%,rgba(255,253,248,0.94)_58%,rgba(255,255,255,0.76)_100%)]" />
          </div>
          <div className="relative grid w-full gap-5 lg:grid-cols-[240px_1fr] lg:items-center">
              <div className="self-center">
                <h3 className="text-2xl font-black text-slate-950">我们的承诺</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  持续更新优质岗位资源，让远程工作成为你的安心选择。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { title: '信息安全', desc: '保护隐私与数据', icon: ShieldCheck },
                  { title: '持续更新', desc: '新增优质资源', icon: Sparkles },
                  { title: '透明可靠', desc: '真实岗位企业', icon: CheckCircle }
                ].map((item) => {
                  const ItemIcon = item.icon
                  return (
                  <div key={item.title} className="flex min-h-[150px] flex-col justify-center rounded-[18px] border border-[#edf2f6] bg-white/88 p-4 shadow-[0_16px_42px_-36px_rgba(64,78,102,0.22)]">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <ItemIcon className="h-4 w-4" />
                    </div>
                    <div className="font-black text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{item.desc}</div>
                  </div>
                )})}
          </div>
        </div>
        </div>
        <div className="relative flex min-h-[260px] overflow-hidden rounded-[26px] border border-[#dfe8ef] bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-5 shadow-[0_20px_56px_-44px_rgba(64,78,102,0.22)]">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[radial-gradient(circle_at_15%_100%,rgba(111,99,246,0.1),transparent_38%),radial-gradient(circle_at_88%_82%,rgba(73,169,130,0.1),transparent_32%)]" />
          <div className="relative flex w-full flex-col gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-950">需要帮助？</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                支付、权益或岗位疑惑，可以通过微信或邮件咨询。
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <div className="mx-auto w-full max-w-[118px] rounded-[18px] border border-[#f3e7c8] bg-white/92 p-2 text-center shadow-sm">
                <img
                  src="/series_assistant.png"
                  alt="微信咨询二维码"
                  className="mx-auto h-20 w-20 object-contain"
                />
                <div className="mt-1 text-[11px] font-black text-slate-600">微信咨询</div>
              </div>
              <a
                href="mailto:hi@haigooremote.com"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6f63f6] px-4 py-2.5 text-sm font-black text-white no-underline shadow-[0_16px_34px_-24px_rgba(111,99,246,0.65)] transition-all hover:-translate-y-0.5 hover:no-underline"
              >
                或试试 邮件联系
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )

  const founderLetterParagraphs = [
    '我是 Haigoo Remote 的创始人 Caitlin。',
    '最开始做这件事，并不是因为我有一个多宏大的商业计划。它其实来自一次很个人的经历。',
    '有段时间，我也在尝试寻找远程工作机会，但很快就发现：**适合我们申请的远程工作不仅稀缺，而且很分散，散落在全球各种网站、平台、小众渠道甚至是非公开信息里。更沮丧的是，我们也无法直接联系到企业，对来自全球各地的远程公司常常一无所知。**',
    '信息壁垒、语言门槛、文化差异、筛选麻烦……每一样都让人头疼。',
    '于是，我开始认真研究这件事，并在 **2025 年 8 月底成立了海狗远程俱乐部。**',
    '一开始，Haigoo 只是一个小小的社群。我把自己看到的远程机会分享出来，有时也邀请专家来分享经验。在和大家交流的过程中，我看到了很多真实的职业困境，有能力、有经验、有想法，也愿意尝试新的可能的人很多，只是被地点或信息门槛或家庭限制住了。',
    '**一个人的价值实现不应该被地点困住，家庭和事业也不应该只能二选一。出于产品经理的职业使命感，我想把这个愿望变成现实。**',
    '从 2025 年下半年开始，我一边人工筛选和审核岗位，一边借助 AI 工具搭建数据链路，把全球远程机会收集起来，再整理成更适合中国用户理解、判断和申请的信息。与此同时，我也在逐步搭建网站、运营社区、连接用户和远程机会。',
    '**很感谢早期在这个过程中给予我帮助的朋友们，有些人参与了社群创建，有些人参与了产品设计，有些人参与了项目落地，有些人提供了宝贵的经验 @张小刀 @Priscilla @Jason @吴槿彦 @Suzy @Kia @Ada Xu @David**',
    '我们在一点点打磨，很多地方或许还不够成熟，但好在它已经让一些人看到了新的可能性，甚至获得了 offer。',
    '慢慢的，我逐渐发现，Haigoo 想做的，原来不只是一个找远程工作的网站。',
    '当我不断接触全球范围里那些 remote-first 的公司，我越来越被他们的工作方式和企业文化打动。**那些更尊重个体，更追求价值和结果创造，更看重工作与生活平衡的企业文化点亮了我，让我相信追求效率和增长，可以不必以牺牲人的生活和幸福感为代价。**',
    '工作可以很专业，也可以更灵活。公司可以跑得很快，也可以让人活得更舒展。',
    '这些让我相信，远程工作不只是打破地域限制。它代表一种新的协作方式，也是一种更值得被认真对待的生活选择。',
    '在当前阶段，Haigoo 最重要的事，是**帮助更多中国职场人，在不离开家的情况下，也能触达真实、可靠、优质的全球远程机会。**从资源连接、语言准备、企业文化到远程协作技能，我们都将逐步攻破，让你可以安心地待在自己喜欢的地方。',
    '在更长远的未来，我希望 Haigoo 能成为一个摆渡人。正如我们定的企业名称【行渡科技】一样，一方面，我们希望能通过新的职场文化、协作方式和组织理念引入，帮助更多中国企业实现良性的远程协作模式，推动国内远程机会繁荣发展；另一方面，我们希望能够帮助国内职场人实现更加灵活和多元的职业选择，提升事业和生活的幸福感。',
    '工作与生活，本来不该彼此撕扯。自我价值实现，也可以是一个美好而幸福的追求。这是 Haigoo 持续探索的方向，也是我们想和大家一起走向的未来。',
    '**谢谢你看到这里，很开心与你一路同行。**'
  ]

  const aboutContributors = [
    { name: '张小刀', title: '全栈工程师，联创及技术顾问', social: 'https://xhslink.com/m/r4e0z3tC9z' },
    { name: 'Priscilla', title: '十年投资人，早期联创', social: 'https://xhslink.com/m/3qM51xfogQy' },
    { name: 'Jason', title: '产品专家，早期联创', social: 'https://xhslink.com/m/1roMyikbrEq' },
    { name: '吴槿彦', title: '工程经理，社群共建者', social: 'https://xhslink.com/m/63TkmmRSA8' },
    { name: 'Suzy', title: '产品经理，社群共建者', social: 'https://www.linkedin.com/in/suzy-guo-285351384/' },
    { name: 'Kia', title: '营销专家，社群共建者', social: 'https://xhslink.com/m/1DsvfxTMRcK' },
    { name: 'Ada Xu', title: '海外人力资源专家，特邀分享嘉宾', social: 'https://www.linkedin.com/in/ada-xu-08308469/' },
    { name: 'David', title: '增长营销专家，特邀分享嘉宾', social: 'https://www.linkedin.com/in/daoud-bouacha/' }
  ]

  const contributorByName = new Map(aboutContributors.map((item) => [item.name, item]))
  const contributorMentionPattern = /@(Ada Xu|Priscilla|Jason|David|Suzy|Kia|张小刀|吴槿彦)/g

  const renderFounderText = (text: string, strong = false) => (
    text.split(contributorMentionPattern).map((part, index) => {
      const contributor = contributorByName.get(part)
      if (contributor) {
        return (
          <a
            key={`${part}-${index}`}
            href={contributor.social}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-0.5 inline font-black text-[#2f6ed8] underline decoration-[#c9dcf6] decoration-2 underline-offset-4 transition hover:text-[#6f63f6] hover:no-underline"
          >
            @{contributor.name}（{contributor.title}）
          </a>
        )
      }
      return strong ? <strong key={`${part}-${index}`} className="font-black text-slate-700">{part}</strong> : <span key={`${part}-${index}`}>{part}</span>
    })
  )

  const renderFounderParagraph = (paragraph: string) => (
    paragraph.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
      const isBold = part.startsWith('**') && part.endsWith('**')
      const text = isBold ? part.slice(2, -2) : part
      return <span key={`${text}-${index}`}>{renderFounderText(text, isBold)}</span>
    })
  )

  const AboutTab = () => (
    <div className="relative min-h-full max-w-full overflow-x-hidden rounded-[30px] px-2 py-3 sm:px-4">
      <section className="relative min-h-[calc(100vh-132px)] max-w-full overflow-hidden rounded-[30px] border border-[#eadfcf] bg-[#fffdf8] p-5 shadow-[0_30px_88px_-70px_rgba(139,101,54,0.42)] sm:p-7">
        <div className="pointer-events-none absolute inset-0">
          <img src="/pic_lists/About_pics/about_bg.webp" alt="" className="absolute inset-x-0 top-0 h-[48%] w-full object-cover object-[58%_34%] opacity-[0.34] saturate-[0.96]" />
          <img src="/pic_lists/Home_pics/background04.webp" alt="" className="absolute inset-x-0 bottom-0 h-[48%] w-full object-cover object-[66%_82%] opacity-[0.48] saturate-[0.96]" />
          <img src="/pic_lists/About_pics/sun-transparent.webp" alt="" className="absolute right-9 top-8 h-20 w-20 object-contain opacity-45" />
          <img src="/pic_lists/About_pics/grass_icon-transparent.webp" alt="" className="absolute bottom-6 left-8 h-24 w-24 object-contain opacity-24" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,253,249,0.96)_0%,rgba(255,253,249,0.9)_45%,rgba(255,253,249,0.72)_100%),linear-gradient(180deg,rgba(255,253,249,0.2)_0%,rgba(255,253,249,0.84)_50%,rgba(255,253,249,0.48)_100%)]" />
        </div>

        <div className="relative grid gap-6 xl:min-h-[980px] xl:grid-cols-[minmax(660px,1.28fr)_minmax(360px,0.68fr)]">
          <article className="relative flex min-h-[760px] min-w-0 flex-col overflow-hidden p-3 sm:p-5 xl:h-[980px]">
            <div className="shrink-0">
              <h1 className="haigoo-hand-bold flex flex-wrap items-center gap-1.5 font-haigoo-hand text-[34px] leading-[1.16] tracking-normal text-slate-950 sm:text-[44px]">
                创始人的一封信
                <span className="relative -ml-1 inline-flex h-[0.9em] w-[0.95em] translate-y-[0.05em] overflow-hidden">
                  <img src="/pic_lists/Home_pics/love-transparent.webp" alt="" className="absolute left-1/2 top-1/2 h-[1.45em] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain" />
                </span>
              </h1>
              <p className="mt-3 text-base font-bold leading-7 text-slate-600">来自 Haigoo Remote 的初心与坚持</p>
              <div className="haigoo-hand-bold mt-7 font-haigoo-hand text-3xl text-slate-950">Hi，朋友们：</div>
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-4">
              <div className="max-w-[900px] space-y-5 text-[15px] leading-8 text-slate-600">
                {founderLetterParagraphs.map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 16)}`}>{renderFounderParagraph(paragraph)}</p>
                ))}
              </div>
            </div>

            <div className="mt-5 shrink-0 border-t border-dashed border-[#eadfcf] pt-5">
              <p className="haigoo-hand-bold flex items-center gap-3 font-haigoo-hand text-2xl text-slate-950">
                <img src="/pic_lists/Home_pics/grass_icon2-transparent.webp" alt="" className="h-9 w-9 object-contain opacity-70" />
                Good Day, Now and Future!
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <a
                  href="https://www.linkedin.com/in/caitlinyct/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="打开 Caitlin Y. 的 LinkedIn 主页"
                  className="relative shrink-0 rounded-full transition hover:-translate-y-0.5 hover:no-underline"
                >
                  <img src="/pic_lists/About_pics/founder-head.webp" alt="Caitlin Y." className="h-16 w-16 rounded-full bg-slate-100 object-cover object-center shadow-sm ring-4 ring-white" />
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#0a66c2] text-white shadow-sm">
                    <LinkedInLogo className="h-3.5 w-3.5" />
                  </span>
                </a>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span>Haigoo Remote 创始人&CEO</span>
                    <span className="haigoo-hand-bold font-haigoo-hand text-2xl text-slate-700">Caitlin Y.</span>
                    <span className="inline-flex h-8 w-8 items-center justify-center">
                      <img src="/pic_lists/About_pics/sun-transparent.webp" alt="" className="h-8 w-8 object-contain opacity-80" />
                    </span>
                  </div>
                </div>
                <a
                  href="mailto:caitlin@haigooremote.com"
                  className="ml-auto inline-flex items-center gap-2 rounded-full bg-[#6f63f6] px-4 py-2 text-sm font-black text-white shadow-[0_14px_36px_-24px_rgba(111,99,246,0.9)] transition hover:-translate-y-0.5 hover:bg-[#5f52e8] hover:no-underline"
                >
                  <Send className="h-4 w-4" />
                  给我写信
                </a>
              </div>
            </div>
          </article>

          <aside className="flex min-h-[760px] flex-col gap-4 xl:h-[980px]">
            <section className="relative overflow-hidden rounded-[24px] border border-[#e7e4ff] bg-white/95 p-5 shadow-[0_18px_55px_-48px_rgba(95,99,246,0.28)]">
              <Quote className="absolute left-5 top-5 h-8 w-8 text-[#c9b8ff]" />
              <p className="pl-11 text-[15px] font-bold leading-8 text-slate-600">
                我们相信，工作不该被地点限制，每个人都值得拥有更灵活的选择，更有意义的事业，以及与家人和自己更多的相处时间。
              </p>
            </section>

            <section className="relative flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-[24px] border border-[#e9edf4] bg-white/88 p-5 shadow-[0_18px_55px_-48px_rgba(61,89,120,0.42)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-slate-950">来自用户的真实反馈</h3>
                <button
                  type="button"
                  onClick={openAboutFeedbackModal}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e3ddff] bg-[#f4f1ff] px-3 py-1.5 text-xs font-black text-[#6f63f6] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  我要留言
                </button>
              </div>
              <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
                {visibleAboutFeedbacks.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="rounded-[18px] border border-[#edf2f6] bg-[#fbfdff]/86 p-4">
                    <p className="text-sm leading-7 text-slate-600">“{item.quote}”</p>
                    <div className="mt-3 flex items-center gap-3">
                      {item.avatar ? (
                        <img src={item.avatar} alt={item.name} className="h-9 w-9 rounded-full bg-slate-100 object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0edff] text-sm font-black text-[#6f63f6]">
                          {item.name.slice(0, 1)}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-black text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.title}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[24px] border border-[#f3e7c8] bg-white/86 p-5 shadow-[0_18px_55px_-48px_rgba(182,132,50,0.3)]">
              <h3 className="mb-4 text-lg font-black text-slate-950">我们的价值观</h3>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { title: '真诚', image: '/pic_lists/About_pics/love-transparent.webp', tone: 'text-[#e06b58]' },
                  { title: '自由', icon: Star, tone: 'text-[#dfa32f]' },
                  { title: '成长', icon: Sparkles, tone: 'text-emerald-600' },
                  { title: '连接', icon: Users, tone: 'text-[#6f63f6]' }
                ].map((item) => (
                  <div key={item.title} className="min-h-[108px] rounded-[16px] border border-[#f0e5d4] bg-[#fffaf0]/64 px-2 py-3 text-center">
                    <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#f0e5d4] bg-white ${item.tone}`}>
                      {'image' in item ? (
                        <img src={item.image} alt="" className="h-[58px] w-[58px] max-w-none object-contain" />
                      ) : (
                        <item.icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="mt-2 text-xs font-black text-slate-950">{item.title}</div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  )

  return (
    <div className="relative mt-16 h-[calc(100vh-64px)] overflow-hidden bg-[#fffdf9] font-haigoo-rounded">
      <div className="pointer-events-none absolute inset-0">
        <img
          src="/pic_lists/About_pics/about_bg.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[58%_38%] opacity-[0.18] blur-[0.25px] saturate-[0.95]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#fffdf9_0%,rgba(255,253,249,0.9)_34%,rgba(255,253,249,0.72)_70%,#fffdf9_100%)]" />
        <div className="absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(circle_at_20%_20%,rgba(188,222,255,0.28),transparent_32%),radial-gradient(circle_at_78%_16%,rgba(255,222,158,0.2),transparent_34%),linear-gradient(180deg,#fff_0%,rgba(251,250,246,0)_100%)]" />
      </div>
      <div className="relative mx-auto h-full max-w-[1600px] px-2 py-4 sm:px-3 lg:px-4">
        <div className="flex h-full flex-col gap-5 lg:flex-row lg:overflow-hidden">
          {/* Sidebar */}
          <aside className={`relative flex-shrink-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-full lg:w-[96px]' : 'w-full lg:w-[248px]'} lg:h-full`}>
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="absolute -right-3 top-5 z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-transform hover:scale-110 hover:text-indigo-600 lg:flex"
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>

              {!isSidebarCollapsed ? (
                <div className="overflow-hidden rounded-[28px] border border-[#e1e9f1] bg-white/82 text-slate-900 shadow-[0_24px_70px_-58px_rgba(61,89,120,0.62)] backdrop-blur">
                  <div className="relative overflow-hidden border-b border-[#edf2f6] bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(247,251,255,0.96)_100%)] px-4 py-3.5">
                    <div className="relative">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-black text-slate-950">会员中心</div>
                        {isMember ? <Crown className="h-4 w-4 shrink-0 text-[#6f63f6]" /> : null}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">{isMember ? '权益与账号管理' : '查看会员权益和方案'}</div>
                    </div>
                  </div>

                  <div className="space-y-4 px-4 py-3.5">
                    {isMember ? (
                      <>
                        <div className="relative overflow-hidden rounded-[22px] border border-[#eadfcf] bg-[linear-gradient(135deg,rgba(255,251,243,0.98)_0%,rgba(255,255,255,0.96)_56%,rgba(246,244,255,0.94)_100%)] p-3.5 shadow-[0_18px_44px_-38px_rgba(139,101,54,0.46)]">
                          <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-[#f3d89f]/28 blur-2xl" />
                          <div className="relative flex items-center gap-2">
                            <div className="min-w-0">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <div className="max-w-full truncate text-[15px] font-black leading-tight text-slate-950">{activeMemberLabel}</div>
                                <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                <CheckCircle className="h-3 w-3" />
                                生效中
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="relative mt-3 rounded-[16px] border border-[#efe5d5] bg-white/80 px-3 py-2.5">
                            <div className="text-[10px] font-black tracking-[0.12em] text-slate-400">有效期至</div>
                            <div className="mt-1 text-[17px] font-black leading-tight text-slate-900">{membershipStatusExpireLabel}</div>
                            {membershipDaysRemaining !== null ? (
                              <div className="mt-1 text-[11px] font-bold text-[#6f63f6]">剩余 {Math.max(membershipDaysRemaining, 0)} 天</div>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-[#edf2f6] bg-white/78 px-3.5 py-3 shadow-sm">
                        <div className="text-base font-black text-slate-950">开通会员</div>
                        <div className="mt-2 text-sm leading-6 text-slate-500">
                          查看会员岗位、联系人邮箱和不限次申请。
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-[#e1e9f1] bg-white/82 px-3 py-4 shadow-[0_24px_70px_-58px_rgba(61,89,120,0.62)]">
                  <div className="flex justify-center">
                    <button
                      onClick={() => setIsSidebarCollapsed(false)}
                      className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-[#dfeaf1] bg-[#f0edff] text-[#6f63f6] shadow-sm transition-all hover:-translate-y-0.5"
                      title="会员中心"
                    >
                      <Crown className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-[28px] border border-[#e1e9f1] bg-white/82 p-3 shadow-[0_18px_55px_-48px_rgba(61,89,120,0.58)] backdrop-blur">
                <div className={`mb-3 px-2 text-xs font-bold tracking-[0.16em] text-slate-400 ${isSidebarCollapsed ? 'text-center px-0' : ''}`}>
                  {isSidebarCollapsed ? 'MENU' : '会员中心'}
                </div>
                <nav className="space-y-1" role="tablist">
                {[
                  // { id: 'custom-plan', label: '定制方案', icon: Sparkles, badge: 'AI' },
                  { id: 'resume', label: '首页', icon: Home },
                  { id: 'membership', label: '会员权益', icon: Crown },
                  { id: 'about', label: '关于我们', icon: Building2 },
                  { id: 'favorites', label: '我的收藏', icon: Heart },
                  { id: 'applications', label: '我的申请', icon: Briefcase },
                  { id: 'feedback', label: '我要反馈', icon: MessageSquare },
                  { id: 'settings', label: '注销账号', icon: Settings }
                ].map((item) => (
                    <button
                    key={item.id}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative
                        ${tab === item.id
                        ? 'bg-[#f0edff] text-[#6f63f6] shadow-sm'
                        : 'text-slate-500 hover:bg-[#f7fbff] hover:text-slate-900'
                      } 
                        ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                    role="tab"
                    aria-selected={tab === item.id}
                    onClick={() => switchTab(item.id as TabKey)}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon className={`w-5 h-5 transition-colors ${tab === item.id ? 'text-[#6f63f6]' : 'text-slate-400 group-hover:text-[#6f63f6]'}`} />
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
                      <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-[#6f63f6]"></div>
                    )}
                  </button>
                ))}
                </nav>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="min-w-0 flex-1 transition-all duration-300 lg:h-full lg:min-h-0 lg:overflow-y-auto">
            <div className="pr-1 pb-10 transition-all duration-300 lg:min-h-full">
              {tab === 'resume' && (
                <>
                  <section className="relative mb-5 overflow-hidden rounded-[30px] border border-[#e1e9f1] bg-[#fffdf8]/78 p-6 shadow-[0_24px_70px_-60px_rgba(61,89,120,0.62)] backdrop-blur sm:p-8">
                    <img src="/pic_lists/Home_pics/background04.webp" alt="" className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08] object-cover object-[70%_58%] opacity-[0.62] saturate-[0.98]" />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,253,248,0.94)_0%,rgba(255,253,248,0.84)_40%,rgba(255,253,248,0.36)_72%,rgba(255,253,248,0.62)_100%),linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,253,248,0.72)_100%)]" />
                    <img src="/pic_lists/Home_pics/Haigoo_hi-transparent.webp" alt="" className="pointer-events-none absolute bottom-3 right-8 h-24 w-24 object-contain opacity-75" />
                    <div className="relative max-w-[860px]">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#f3e7c8] bg-[#fffaf0]/90 px-3 py-1 text-xs font-black text-[#bd7a12]">
                        <Sparkles className="h-3.5 w-3.5" />
                        今日小确幸
                      </div>
                      <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
                        {greeting}，{displayName}
                        <span className="ml-2 text-[#7b74ff]">♡</span>
                      </h1>
                      <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base lg:whitespace-nowrap">
                        愿你今天也是自由而专注的一天。把简历、收藏和申请线索放在这里，慢慢整理也来得及。
                      </p>
                    </div>
                  </section>

                  <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {homeStats.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          if (item.label === '收藏岗位') switchTab('favorites')
                          if (item.label === '会员状态') switchTab('membership')
                          if (item.label === '求职记录') switchTab('applications')
                        }}
                        className="group flex items-center gap-4 rounded-[24px] border border-[#e1e9f1] bg-white/82 p-4 text-left shadow-[0_18px_55px_-50px_rgba(61,89,120,0.56)] transition-all hover:-translate-y-0.5 hover:bg-white"
                      >
                        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] ${item.tint}`}>
                          <item.icon className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block text-xl font-black text-slate-950">{item.value}</span>
                          <span className="mt-1 block text-xs font-semibold text-slate-500">{item.label}</span>
                        </span>
                      </button>
                    ))}
                  </section>
                </>
              )}
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
                            onClick={() => switchTab('membership')}
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
              {tab === 'membership' && <MembershipTab />}
              {tab === 'about' && <AboutTab />}
              {tab === 'settings' && <SettingsTab />}
            </div>
            {isJobDetailOpen && selectedJob && (
              <JobDetailModal
                job={selectedJob}
                isOpen={isJobDetailOpen}
                onClose={() => { setIsJobDetailOpen(false); setSelectedJob(null) }}
                onSave={() => handleToggleFavorite(selectedJob)}
                isSaved={favorites.some(f => (f.id === selectedJob.id) || (f.jobId === selectedJob.id))}
                jobs={modalNavigationJobs}
                currentJobIndex={memberRecommendationModalIndex}
                onNavigateJob={navigateMemberRecommendationModal}
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
          {modalRoot && showAboutFeedbackModal && createPortal((
            <div className="fixed inset-0 z-[10000] isolate flex items-center justify-center p-4">
              <button
                type="button"
                aria-label="关闭留言弹窗"
                className="fixed inset-0 z-0 cursor-default bg-slate-950/60 backdrop-blur-md"
                onClick={() => setShowAboutFeedbackModal(false)}
              />
              <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-[30px] border border-white/15 bg-white p-6 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.72)] sm:p-7">
                <button
                  type="button"
                  className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-colors hover:text-slate-700"
                  onClick={() => setShowAboutFeedbackModal(false)}
                >
                  ×
                </button>
                <div className="pr-10">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#e3ddff] bg-[#f4f1ff] px-3 py-1 text-xs font-black text-[#6f63f6]">
                    <MessageSquare className="h-3.5 w-3.5" />
                    用户留言
                  </div>
                  <h3 className="mt-4 text-2xl font-black text-slate-950">分享你的 Haigoo 体验</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    留言会进入后台用户反馈审核，管理员通过后才会展示在关于我们页面。
                  </p>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-black text-slate-500">展示名称</span>
                    <input
                      value={aboutFeedbackName}
                      onChange={(e) => setAboutFeedbackName(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#e1e9f1] bg-[#fbfdff] px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#9a8cff] focus:bg-white"
                      placeholder="例如：Flora"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-black text-slate-500">身份/职业</span>
                    <input
                      value={aboutFeedbackTitle}
                      onChange={(e) => setAboutFeedbackTitle(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-[#e1e9f1] bg-[#fbfdff] px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#9a8cff] focus:bg-white"
                      placeholder="例如：产品经理"
                    />
                  </label>
                </div>

                <label className="mt-3 block">
                  <span className="text-xs font-black text-slate-500">留言内容</span>
                  <textarea
                    value={aboutFeedbackContent}
                    onChange={(e) => setAboutFeedbackContent(e.target.value)}
                    rows={5}
                    maxLength={300}
                    className="mt-1 w-full resize-none rounded-2xl border border-[#e1e9f1] bg-[#fbfdff] px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-[#9a8cff] focus:bg-white"
                    placeholder="可以写下你通过 Haigoo 找远程工作、使用会员资源或获得支持的真实体验。"
                  />
                </label>

                <label className="mt-3 block">
                  <span className="text-xs font-black text-slate-500">联系方式（仅后台可见）</span>
                  <input
                    value={aboutFeedbackContact}
                    onChange={(e) => setAboutFeedbackContact(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-[#e1e9f1] bg-[#fbfdff] px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-[#9a8cff] focus:bg-white"
                    placeholder="邮箱或微信"
                  />
                </label>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAboutFeedbackModal(false)}
                    className="rounded-full border border-[#e1e9f1] bg-white px-5 py-2.5 text-sm font-black text-slate-500 transition hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={aboutFeedbackSubmitting}
                    onClick={submitAboutFeedback}
                    className="rounded-full bg-[#6f63f6] px-6 py-2.5 text-sm font-black text-white shadow-[0_14px_36px_-24px_rgba(111,99,246,0.9)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {aboutFeedbackSubmitting ? '提交中...' : '提交审核'}
                  </button>
                </div>
              </div>
            </div>
          ), modalRoot)}
          {modalRoot && showMembershipPlanChooserModal && createPortal((
            <div className="fixed inset-0 z-[10000] isolate flex items-center justify-center overflow-y-auto p-4">
              <button
                type="button"
                aria-label="关闭方案选择弹窗"
                className="fixed inset-0 z-0 cursor-default bg-slate-950/62 backdrop-blur-md"
                onClick={() => setShowMembershipPlanChooserModal(false)}
              />
              <div className="relative z-10 my-4 w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/20 bg-[#fffdf8] p-5 shadow-[0_34px_96px_-42px_rgba(15,23,42,0.74)] sm:p-6">
                <div className="pointer-events-none absolute inset-0">
                  <img src="/pic_lists/About_pics/about_bg.webp" alt="" className="absolute inset-x-0 top-0 h-56 w-full object-cover object-[55%_38%] opacity-25" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,248,0.82)_0%,rgba(255,253,248,0.98)_58%,#fffdf8_100%)]" />
                </div>
                <button
                  type="button"
                  className="absolute right-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/86 text-slate-400 shadow-sm transition-colors hover:text-slate-700"
                  onClick={() => setShowMembershipPlanChooserModal(false)}
                >
                  ×
                </button>

                <div className="relative pr-12">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#eadfcf] bg-white/86 px-3 py-1 text-xs font-black text-[#bd7a12] shadow-sm">
                    <Crown className="h-3.5 w-3.5" />
                    {isMember ? '续费 / 升级权益' : '加入会员'}
                  </div>
                  <h3 className="mt-4 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">选择适合你的会员方案</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    可以短期冲刺，也可以按季度持续使用资源；需要一对一规划时，再选择个性化咨询。
                  </p>
                </div>

                <div className="relative mt-6 grid gap-4 lg:grid-cols-3">
                  {displayMembershipPlans.map((plan) => {
                    const isQuarter = plan.memberType === 'quarter'
                    const isYear = plan.memberType === 'year'
                    const planTitle = getMembershipPlanTitle(plan.memberType)
                    const ctaText = isYear
                      ? '微信咨询'
                      : isMember && activeMemberType === plan.memberType
                        ? '续费当前方案'
                        : plan.memberType === 'trial_week'
                          ? '体验 7 天'
                          : '选择季度会员'
                    return (
                      <article
                        key={plan.id}
                        className={`relative flex min-h-[320px] flex-col rounded-[24px] border p-5 transition-all hover:-translate-y-0.5 ${
                          isQuarter
                            ? 'border-[#cfc8ff] bg-[linear-gradient(180deg,#fbfaff_0%,#fff_100%)] shadow-[0_22px_54px_-40px_rgba(111,99,246,0.42)]'
                            : plan.memberType === 'trial_week'
                              ? 'border-[#c6ead6] bg-[linear-gradient(180deg,#f8fffb_0%,#fff_100%)]'
                              : 'border-[#efd6a7] bg-[linear-gradient(180deg,#fffaf0_0%,#fff_100%)]'
                        }`}
                      >
                        {isQuarter ? <div className="absolute right-5 top-5 rounded-full bg-[#6f63f6] px-3 py-1 text-xs font-black text-white">推荐</div> : null}
                        <div className={`mb-4 inline-flex w-fit rounded-full px-3 py-1 text-xs font-black ${plan.memberType === 'trial_week' ? 'bg-emerald-50 text-emerald-700' : isQuarter ? 'bg-[#f1efff] text-[#6f63f6]' : 'bg-[#fff5df] text-[#b47319]'}`}>
                          {membershipPlanTags[plan.memberType]}
                        </div>
                        <h4 className="max-w-[86%] text-xl font-black leading-tight text-slate-950">{planTitle}</h4>
                        <p className="mt-3 min-h-[48px] text-sm leading-6 text-slate-500">{membershipPlanDescriptions[plan.memberType]}</p>
                        {isQuarter ? (
                          <div className="mt-4">
                            <div className="text-sm font-black text-slate-400 line-through decoration-2">¥399 /季度</div>
                            <div className="mt-1 flex items-center gap-2 whitespace-nowrap">
                              <span className="text-[38px] font-black leading-none text-slate-950">¥199</span>
                              <span className="text-sm font-bold text-slate-400">/季度</span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#ffd6a6] bg-[#fff7e8] px-2.5 py-0.5 text-[10px] font-black text-[#c26b00]">
                                🔥 限时 5 折
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 flex items-end gap-1">
                            <span className="text-[34px] font-black leading-none text-slate-950">{isYear ? '¥299-¥599' : `¥${plan.price}`}</span>
                            <span className="pb-1 text-sm font-bold text-slate-400">{getMembershipPlanUnit(plan.memberType)}</span>
                          </div>
                        )}
                        <div className="mt-5 flex-1 space-y-2.5">
                          {membershipPlanFeatures[plan.memberType].slice(0, 4).map((feature) => (
                            <div key={feature} className="flex items-start gap-2 text-sm leading-5 text-slate-700">
                              <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isQuarter ? 'text-[#6f63f6]' : isYear ? 'text-amber-600' : 'text-emerald-600'}`} strokeWidth={3} />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(plan.comingSoon)}
                          onClick={() => chooseMembershipPlan(plan)}
                          className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition-all ${
                            plan.comingSoon
                              ? 'cursor-not-allowed border border-slate-200 bg-white text-slate-400'
                              : isQuarter
                                ? 'bg-[#6f63f6] text-white shadow-[0_18px_38px_-24px_rgba(95,99,246,0.52)]'
                                : isYear
                                  ? 'bg-[#e8a020] text-white shadow-[0_18px_38px_-24px_rgba(210,130,20,0.46)]'
                                  : 'bg-slate-950 text-white'
                          }`}
                        >
                          {plan.comingSoon ? '即将开放' : ctaText}
                          {!plan.comingSoon ? <ArrowRight className="h-4 w-4" /> : null}
                        </button>
                      </article>
                    )
                  })}
                </div>
              </div>
            </div>
          ), modalRoot)}
          {modalRoot && showMembershipAssistantModal && createPortal((
            <div className="fixed inset-0 z-[10000] isolate flex items-center justify-center p-4">
              <button
                type="button"
                aria-label="关闭咨询弹窗"
                className="fixed inset-0 z-0 cursor-default bg-slate-950/65 backdrop-blur-md"
                onClick={() => setShowMembershipAssistantModal(false)}
              />
              <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[30px] border border-white/10 bg-white p-7 text-center shadow-[0_30px_90px_-40px_rgba(15,23,42,0.75)]">
                <button
                  type="button"
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xl leading-none text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
                  onClick={() => setShowMembershipAssistantModal(false)}
                >
                  ×
                </button>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <h3 className="text-2xl font-black text-slate-950">微信咨询</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  扫码咨询，了解远程工作个性化咨询的适配方案与价格。
                </p>
                <div className="mx-auto mt-5 w-56 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                  <img src="/series_assistant.png" alt="微信咨询二维码" className="h-full w-full object-contain" />
                </div>
                <div className="mt-3 text-sm font-black text-slate-700">微信扫一扫添加</div>
              </div>
            </div>
          ), modalRoot)}
          {modalRoot && showMembershipPaymentModal && selectedMembershipPlan && createPortal((
            <div className="fixed inset-0 z-[10000] isolate flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
              <button
                type="button"
                aria-label="关闭支付弹窗"
                className="fixed inset-0 z-0 cursor-default bg-slate-950/65 backdrop-blur-md"
                onClick={closeMembershipPaymentToPlans}
              />
              <div className="relative z-10 my-4 grid max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-[30px] border border-white/10 bg-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.75)] md:max-h-[620px] md:grid-cols-[0.9fr_1.1fr] md:overflow-hidden">
                <div className="relative overflow-hidden border-b border-[#edf2f6] bg-[#fbfdff] p-6 md:border-b-0 md:border-r">
                  <img src="/pic_lists/Home_pics/background03.webp" alt="" className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full object-cover object-bottom opacity-35" />
                  <div className="relative">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div className="inline-flex rounded-full bg-[#f0edff] px-3 py-1 text-xs font-black text-[#6f63f6]">确认方案</div>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-colors hover:text-slate-700 md:hidden"
                        onClick={closeMembershipPaymentToPlans}
                      >
                        ×
                      </button>
                    </div>
                    <h3 className="text-2xl font-black text-slate-950">{getMembershipPlanTitle(selectedMembershipPlan.memberType)}</h3>
                    {selectedMembershipPlan.memberType === 'quarter' ? (
                      <div className="mt-4">
                        <div className="text-sm font-black text-slate-400 line-through decoration-2">¥399 /季度</div>
                        <div className="mt-1 flex min-w-0 items-center gap-2 whitespace-nowrap">
                          <span className="shrink-0 text-4xl font-black leading-none text-slate-950">¥199</span>
                          <span className="shrink-0 text-sm font-bold text-slate-400">/季度</span>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#ffd6a6] bg-[#fff7e8] px-2.5 py-1 text-[11px] font-black text-[#c26b00]">
                            🔥 限时 5 折
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex items-end gap-1">
                        <span className="text-4xl font-black text-slate-950">¥{selectedMembershipPlan.price}</span>
                        <span className="pb-1 text-sm font-bold text-slate-400">
                          {getMembershipPlanUnit(selectedMembershipPlan.memberType)}
                        </span>
                      </div>
                    )}
                    <p className="mt-4 text-sm leading-7 text-slate-500">{membershipPlanDescriptions[selectedMembershipPlan.memberType]}</p>

                    <div className="mt-6 space-y-2.5">
                      {membershipPlanFeatures[selectedMembershipPlan.memberType].map((feature) => (
                        <div key={feature} className="flex items-start gap-2 text-sm leading-5 text-slate-700">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6f63f6]" strokeWidth={3} />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMembershipPaymentMethod('alipay')}
                        className={`flex items-center gap-2 rounded-2xl border p-3 text-sm font-black transition-all ${membershipPaymentMethod === 'alipay' ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-[#e1e9f1] bg-white text-slate-600'}`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1677ff] text-white">
                          <Zap className="h-4 w-4" />
                        </span>
                        支付宝
                      </button>
                      <button
                        type="button"
                        onClick={() => setMembershipPaymentMethod('wechat')}
                        className={`flex items-center gap-2 rounded-2xl border p-3 text-sm font-black transition-all ${membershipPaymentMethod === 'wechat' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-[#e1e9f1] bg-white text-slate-600'}`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#07c160] text-white">
                          <ShieldCheck className="h-4 w-4" />
                        </span>
                        微信支付
                      </button>
                    </div>
                  </div>
                </div>

                <div className="relative flex flex-col items-center justify-center p-6 text-center sm:p-8">
                  <button
                    type="button"
                    className="absolute right-5 top-5 hidden h-9 w-9 items-center justify-center rounded-full bg-[#f7fbff] text-slate-400 transition-colors hover:text-slate-700 md:flex"
                    onClick={closeMembershipPaymentToPlans}
                  >
                    ×
                  </button>

                  <div className="rounded-[28px] border border-[#edf2f6] bg-white p-4 shadow-[0_20px_55px_-42px_rgba(61,89,120,0.62)]">
                    <img
                      src={currentMembershipPaymentInfo.imageUrl}
                      alt="支付二维码"
                      className="h-44 w-44 rounded-2xl object-contain"
                    />
                  </div>
                  <h4 className="mt-5 text-xl font-black text-slate-950">{currentMembershipPaymentInfo.instruction}</h4>
                  <p className="mt-2 text-sm text-slate-500">付款备注请填写你的注册邮箱，便于自动核销。</p>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(authUser?.email || '')
                      showSuccess('邮箱已复制')
                    }}
                    className="mt-4 flex w-full max-w-sm items-center gap-2 rounded-2xl border border-[#f2dfb7] bg-[#fffaf0] px-4 py-3 text-left text-sm font-bold text-slate-700"
                  >
                    <code className="min-w-0 flex-1 truncate">{authUser?.email || '你的注册邮箱'}</code>
                    <Copy className="h-4 w-4 text-[#bd7a12]" />
                  </button>

                  <button
                    type="button"
                    onClick={handleMembershipPaymentComplete}
                    className="mt-6 inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[#6f63f6] px-6 py-3.5 text-sm font-black text-white shadow-[0_18px_40px_-24px_rgba(95,99,246,0.58)] transition-all hover:-translate-y-0.5"
                  >
                    <CheckCircle className="h-5 w-5" />
                    我已完成支付
                  </button>
                  <p className="mt-3 max-w-sm text-xs leading-5 text-slate-400">
                    通常 3 分钟内生效；超出 10 分钟系统会自动补偿 1 天会员。客服邮箱：hi@haigooremote.com
                  </p>
                </div>
              </div>
            </div>
          ), modalRoot)}
        </div>
      </div>
    </div>
  )
}
