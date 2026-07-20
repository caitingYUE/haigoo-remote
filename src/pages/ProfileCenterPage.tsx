import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Clock, FileText, Upload, CheckCircle, Heart, MessageSquare, Crown, ChevronLeft, ChevronRight, Trash2, Sparkles, ArrowRight, Briefcase, Settings, Download, Home, Send, Eye, ShieldCheck, Check, Minus, Users, Building2, Quote, Star, Globe2, Loader2, Calendar, Volume2, BookOpen, PlayCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { trackingService } from '../services/tracking-service'
import { Job } from '../types'
import JobCardNew from '../components/JobCardNew'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { markMatchScoreRefresh } from '../utils/match-score-refresh'
import { fetchDailyMemberRecommendations } from '../utils/member-recommendations'
import { LinkedInLogo } from '../components/SocialIcons'
import { corporateEnglishPublicService, type CorporateEnglishPublicClip } from '../services/corporate-english-public-service'

const LazyJobDetailModal = lazy(() => import('../components/JobDetailModal'))
const LazyMembershipUpgradeModal = lazy(() => import('../components/MembershipUpgradeModal').then((module) => ({ default: module.MembershipUpgradeModal })))
const LazyMembershipCertificateModal = lazy(() => import('../components/MembershipCertificateModal').then((module) => ({ default: module.MembershipCertificateModal })))
const LazyMyApplicationsTab = lazy(() => import('../components/MyApplicationsTab'))
const LazyGeneratedPlanView = lazy(() => import('../components/GeneratedPlanView'))

type TabKey = 'custom-plan' | 'resume' | 'favorites' | 'applications' | 'feedback' | 'membership' | 'about' | 'settings'

interface ProfileCenterPageProps {
  publicAboutOnly?: boolean
}

function formatClipTime(ms?: number) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function AudioFavoriteCard({
  clip,
  onError
}: {
  clip: CorporateEnglishPublicClip
  onError: (message: string) => void
}) {
  const [audioUrl, setAudioUrl] = useState('')
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [showScript, setShowScript] = useState(false)

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const loadAudio = async () => {
    if (audioUrl) return
    try {
      setLoadingAudio(true)
      const blob = await corporateEnglishPublicService.downloadClipAudio(clip.clipId)
      setAudioUrl(URL.createObjectURL(blob))
    } catch (error) {
      onError(error instanceof Error ? error.message : '音频加载失败')
    } finally {
      setLoadingAudio(false)
    }
  }

  const subtitleRows = (clip.subtitleCues || []).length > 0
    ? (clip.subtitleCues || []).map((cue) => ({
      time: `${formatClipTime(cue.startMs)} - ${formatClipTime(cue.endMs)}`,
      text: cue.subtitleText,
      translation: cue.translationText
    }))
    : (clip.subtitleText || '').split('\n').map((line, index) => ({
      time: '',
      text: line,
      translation: (clip.translationText || '').split('\n')[index] || ''
    })).filter((row) => row.text || row.translation)

  return (
    <div className="rounded-[22px] border border-[#e1e9f1] bg-white/88 p-4 shadow-[0_18px_55px_-50px_rgba(61,89,120,0.52)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#eadff8] bg-[#f5f2ff] px-2.5 py-1 text-[11px] font-black text-[#6251f5]">
            <Volume2 className="h-3.5 w-3.5" />
            职业成长音频
          </div>
          <h3 className="line-clamp-2 text-base font-black text-slate-950">{clip.clipTitle || clip.materialTitle || '跟读片段'}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{clip.companyName || '职业成长'} · {formatClipTime(clip.startMs)}</p>
          {clip.materialTitle ? <p className="mt-1 line-clamp-1 text-xs text-slate-400">{clip.materialTitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={loadAudio}
          disabled={loadingAudio}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#6f63f6] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#5d50df] disabled:cursor-wait disabled:opacity-70"
        >
          {loadingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          {audioUrl ? '已加载' : '播放音频'}
        </button>
      </div>

      {audioUrl ? (
        <audio className="mt-4 w-full rounded-full" controls src={audioUrl}>
          <track kind="captions" />
        </audio>
      ) : null}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowScript((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe8ef] bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:border-[#cbbfff] hover:text-[#6251f5]"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {showScript ? '收起字幕' : '查看字幕'}
        </button>
        {showScript ? (
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-[#edf2f6] bg-[#fffdf8] p-3">
            {subtitleRows.length > 0 ? subtitleRows.map((row, index) => (
              <div key={`${row.time}-${index}`} className="rounded-xl bg-white px-3 py-2 text-sm">
                {row.time ? <div className="mb-1 font-mono text-xs font-bold text-[#6251f5]">{row.time}</div> : null}
                {row.text ? <div className="font-semibold leading-6 text-slate-900">{row.text}</div> : null}
                {row.translation ? <div className="mt-1 leading-6 text-slate-500">{row.translation}</div> : null}
              </div>
            )) : (
              <div className="py-6 text-center text-sm text-slate-400">暂无字幕内容</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
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

type EmbeddedMemberType = 'trial_week' | 'starter' | 'quarter' | 'quarter_pro' | 'year' | 'half_year' | 'annual'

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
    id: 'club_starter_monthly',
    memberType: 'starter',
    name: 'Club Starter',
    shortLabel: 'Starter',
    price: 99,
    currency: 'CNY',
    duration_days: 31,
    discountLabel: '工具服务',
    description: '适合远程入门或目标明确、希望通过网站信息和工具高效推进投递的人。',
    features: ['精选岗位参考与申请路径', '企业联系人与直达线索', '远程职业成长内容', 'AI 简历优化、岗位订阅等工具', '不含语音咨询服务']
  },
  {
    id: 'quarter_pro_quarterly',
    memberType: 'quarter_pro',
    name: 'Pro会员',
    shortLabel: 'Pro会员',
    price: 399,
    currency: 'CNY',
    duration_days: 90,
    discountLabel: 'Pro',
    alipay_qr: '/alipay_399.jpg',
    wechat_qr: '/wechatpay_399.png',
    description: '适合同时准备口语、远程求职和深入了解远程企业文化的人。',
    features: ['包含季度会员现有服务', '职业成长跟读音频片段', '更多企业资料', '跟读音频收藏&下载功能', '企业 CEO 联系方式']
  },
  {
    id: 'trial_week_lite',
    memberType: 'trial_week',
    name: '体验会员（周）',
    shortLabel: '体验会员',
    price: 29.9,
    currency: 'CNY',
    duration_days: 7,
    discountLabel: '7 天体验',
    alipay_qr: '/alipay_mini.jpg',
    wechat_qr: '/Wechatpay_mini.png',
    description: '适合先集中推进一轮投递，快速打开岗位、联系人和邮箱直申能力。',
    features: ['获取精选岗位信息', '获取企业联系人信息', '获取企业直申机会', '获取会员推荐和 AI 简历优化']
  },
  {
    id: 'club_go_quarterly',
    memberType: 'quarter',
    name: '季度会员',
    shortLabel: '季度会员',
    price: 199,
    currency: 'CNY',
    duration_days: 90,
    discountLabel: '季度会员',
    description: '适合持续推进远程求职、深入了解企业文化的人。',
    features: ['远程求职权益完整开放', '精选企业页面权益开放', '远程职业成长全部视频内容', '企业文化与 CEO 商业思维', '跟读素材免费样例']
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

type ClubServicePlanId = 'starter' | 'half_year' | 'annual'

interface ClubServicePlan {
  id: ClubServicePlanId
  title: string
  clubName: string
  price: string
  originalPrice?: string
  topTag?: string
  description: string
  features: string[]
  who: string
  outcomeTitle: string
  outcome: string
  cta: string
  note?: string
  highlighted?: boolean
}

const CLUB_SERVICE_PLANS: ClubServicePlan[] = [
  {
    id: 'starter',
    title: '远程入门启动方案',
    clubName: 'Club Starter',
    price: '¥99 / 30 天',
    description: '用一次诊断和一份行动清单，看清下一步并完成第一轮有效申请。',
    who: '无远程经验，准备尝试远程工作、开始第一轮有效申请的人。',
    outcomeTitle: '通过这个方案，你会更清楚',
    outcome: '自己适合什么、简历怎么改、可以先开始申请哪些方向。',
    cta: '开启你的远程探索',
    features: [
      '简历文字诊断',
      '简历修改建议',
      '3-5 个站内岗位推荐',
      '远程入门准备材料',
      '30 天网站会员权限'
    ]
  },
  {
    id: 'half_year',
    title: '远程求职陪伴方案',
    clubName: 'Club Member',
    price: '¥499 / 6 个月',
    description: '在持续投递与调整中，有稳定的岗位、内容和人工支持。',
    who: '明确需要寻找远程工作，希望持续推进申请、获得长期求职支持的人。',
    outcomeTitle: '通过这个方案，你将获得',
    outcome: '一套基于个人背景和需求设计的定制求职方案 & 持续协助推进申请。',
    cta: '申请远程陪伴',
    highlighted: true,
    features: [
      '工作方向与简历初步诊断',
      '英文简历优化或30-60分钟语音咨询',
      '定制远程求职准备材料',
      '定向远程岗位挖掘5-10个',
      '6 个月网站会员权限'
    ]
  },
  {
    id: 'annual',
    title: '远程职业共建方案',
    clubName: 'Club Partner',
    price: '¥998 / 年',
    description: '将全球职业探索、同行连接与企业协作沉淀为长期职业资源。',
    who: '终身/长期远程工作者，将远程企业、人才和行业连接沉淀为个人职业资源。',
    outcomeTitle: '长期价值',
    outcome: '明确职业方向、建立同行连接和企业协作资源，帮你构建终身远程资本',
    cta: '成为共建伙伴',
    note: '共建伙伴不代表雇佣、代理或固定合作关系。',
    features: [
      '包含 Club Member 全部支持',
      '一次年度远程职业规划',
      '优先参与主题交流与共建讨论',
      '可在海狗网站、社群和社媒等渠道，申请企业岗位发布、人才连接和雇主品牌传播支持'
    ]
  }
]

const CLUB_VALUE_STRIP = [
  { title: '长期岗位资源', desc: '持续筛选适合中国用户申请的机会', icon: Eye },
  { title: '申请路径支持', desc: '联系人资源、申请入口与工具支持', icon: Send },
  { title: '远程职业成长', desc: '远程求职准备、英文面试、远程会议等', icon: Sparkles },
  { title: '企业文化理解', desc: '从CEO访谈里了解远程企业的使命、文化和商业模式', icon: Users },
  { title: '社群陪伴支持', desc: '资料更新、交流和远程求职咨询', icon: MessageSquare }
]

const CLUB_SERVICE_COMPARISON_ROWS = [
  { label: '远程岗位申请', free: '有限体验', starter: '完全开放', half_year: '完全开放+定向挖掘', annual: '完全开放+定向挖掘' },
  { label: '岗位更新订阅', free: '不支持', starter: '完全开放', half_year: '完全开放', annual: '完全开放' },
  { label: 'AI 工具、申请攻略等', free: '有限体验', starter: '完全开放', half_year: '完全开放', annual: '完全开放' },
  { label: '职业成长内容', free: '免费样例', starter: '完全开放', half_year: '完全开放', annual: '完全开放' },
  { label: '人工咨询', free: '不支持', starter: '一次性建议', half_year: '语音咨询', annual: '语音咨询 + 年度规划' },
  { label: '个性化诊断', free: '不支持', starter: '一次性建议', half_year: '长期支持', annual: '长期支持' },
  { label: '远程准备材料', free: '不支持', starter: '通用入门材料', half_year: '定制材料包', annual: '定制材料包' },
] as const

const CLUB_SERVICE_COMPARISON_FULL_ROWS = [
  ...CLUB_SERVICE_COMPARISON_ROWS,
  { label: '闭门交流', free: '不支持', starter: '不支持', half_year: '不支持', annual: '可参与' },
  { label: '可申请成为共建伙伴', free: '不支持', starter: '不支持', half_year: '不支持', annual: '可申请' },
  { label: '岗位发布与品牌传播支持', free: '不支持', starter: '不支持', half_year: '不支持', annual: '可申请' }
] as const

const CLUB_MEMBERSHIP_FAQS = [
  {
    question: '为什么需要添加顾问才能开通？',
    answer: '顾问会先了解你的阶段、目标与适配度，确认适合后再帮你开通对应权限和提供支持，避免盲目加入，对双方更负责。'
  },
  {
    question: '这几项权益适合谁，核心差别是什么？',
    answer: 'Club Starter 适合远程入门/新手小白，可以结合顾问建议低成本尝试申请，不盲投；Club Member 适合明确要寻找远程工作的人，可结合 1V1 咨询梳理准备路径，提高申请成功率；Club Partner 适合 HR、品牌、商务或市场等有资源协作需求的人，Haigoo 会作为你的资源辅助与职业背书，帮助你放大工作优势。'
  },
  {
    question: '加入会员后发现不适合自己怎么办？',
    answer: '如果投递一段时间效果不理想，建议先找顾问复盘方向、简历和投递策略；再次尝试仍无改善，可按剩余有效时间申请退款。Haigoo 更希望长期陪伴并真正帮到你，而不是做一次性服务。'
  },
  {
    question: '语音咨询可以咨询哪些内容？',
    answer: '可以咨询在职如何提前准备、适合哪些远程方向、需要补哪些技能、转行路径、远程工作的五险一金、税务和沟通方式等问题。'
  },
  {
    question: '远程求职规划是什么？会包含哪些内容？',
    answer: '我们会结合你的过往经历、能力优势、兴趣偏好和目标岗位，梳理适合发展的职业方向，并评估每个方向的落地性、成长性和可拓展性。报告通常包含核心定位、方向排序、适合岗位、人群/行业建议、简历优化重点、能力补充建议和阶段行动路径，帮助你判断适合往哪里走、怎么准备、下一步做什么。'
  },
  {
    question: '成为共建伙伴最大的作用是什么？',
    answer: 'Partner 可以更充分调用 Haigoo Remote 的网站、社媒、社群与合作资源，作为职业背书或求职优势。若有企业商务合作、岗位发布、品牌传播等需求，也会优先为 Partner 协同支持。'
  }
]

const CLUB_COPY_EN: Record<string, string> = {
  '工具服务': 'Self-service tools',
  '推荐｜适合 HR / 品牌 / 市场 / 运营': 'Recommended · For HR, brand, marketing & operations',
  '长期陪伴': 'Long-term support',
  '¥99 / 月': '¥99 / month',
  '¥499 / 半年': '¥499 / 6 months',
  '¥998 / 年': '¥998 / year',
  '适合远程入门或已经有明确目标的用户，通过网站上的岗位、内容和 AI 工具自主推进申请。': 'For focused job seekers who prefer self-service tools.',
  '适合正在认真探索远程工作，希望获得长期岗位资源和求职支持的用户。': 'For an active search with ongoing resources and support.',
  '适合希望长期探索远程职业机会，并沉淀个人职业资源的用户。': 'For long-term career growth and professional collaboration.',
  '了解 Club Starter': 'Explore Club Starter',
  '了解 Club Member': 'Explore Club Member',
  '了解 Club Partner': 'Explore Club Partner',
  '远程探索': 'Remote exploration',
  '持续陪伴': 'Ongoing support',
  '长期共建': 'Long-term collaboration',
  '远程入门启动方案': 'Remote career starter',
  '远程求职陪伴方案': 'Remote job-search support',
  '远程职业共建方案': 'Remote career collaboration',
  '用一次诊断和一份行动清单，看清下一步并完成第一轮有效申请。': 'Clarify your next step and complete a first effective application with one assessment and action plan.',
  '在持续投递与调整中，有稳定的岗位、内容和人工支持。': 'Keep applying and iterating with steady role, content, and human support.',
  '将全球职业探索、同行连接与企业协作沉淀为长期职业资源。': 'Turn global career exploration, peer connection, and company collaboration into lasting career resources.',
  '无远程经验，准备尝试远程工作、开始第一轮有效申请的人。': 'For people new to remote work and ready to make a first effective application.',
  '明确需要寻找远程工作，希望持续推进申请、获得长期求职支持的人。': 'For people committed to finding remote work and seeking continued application support.',
  '终身/长期远程工作者，将远程企业、人才和行业连接沉淀为个人职业资源。': 'For long-term remote professionals building career resources through company, talent, and industry connections.',
  '简历文字诊断': 'Written resume assessment',
  '简历修改建议': 'Resume improvement suggestions',
  '3-5 个站内岗位推荐': '3–5 role recommendations on Haigoo',
  '远程入门准备材料': 'Remote-work starter materials',
  '30 天网站会员权限': '30 days of site tools',
  '工作方向与简历初步诊断': 'Initial role-direction and resume assessment',
  '英文简历优化或30-60分钟语音咨询': 'English-resume refinement or a 30–60 min voice consultation',
  '定制远程求职准备材料': 'Tailored remote job-search preparation materials',
  '定向远程岗位挖掘5-10个': 'Research on 5–10 targeted remote roles',
  '6 个月网站会员权限': '6 months of site tools',
  '包含 Club Member 全部支持': 'Includes all Club Member support',
  '一次年度远程职业规划': 'One annual remote-career planning session',
  '优先参与主题交流与共建讨论': 'Priority access to themed exchanges and collaboration discussions',
  '可在海狗网站、社群和社媒等渠道，申请企业岗位发布、人才连接和雇主品牌传播支持': 'Apply for job-posting, talent-connection, and employer-brand support across Haigoo channels',
  '通过这个方案，你会更清楚': 'With this plan, you will understand more clearly',
  '通过这个方案，你将获得': 'With this plan, you will gain',
  '长期价值': 'Long-term value',
  '自己适合什么、简历怎么改、可以先开始申请哪些方向。': 'Which roles fit you, what to improve in your resume, and where to start applying.',
  '一套基于个人背景和需求设计的定制求职方案 & 持续协助推进申请。': 'A tailored job-search plan based on your background, plus continued application support.',
  '明确职业方向、建立同行连接和企业协作资源，帮你构建终身远程资本': 'Clarify your direction, build peer and company connections, and develop enduring remote-career capital.',
  '开启你的远程探索': 'Start your remote exploration',
  '申请远程陪伴': 'Apply for ongoing support',
  '成为共建伙伴': 'Become a collaboration partner',
  '共建伙伴不代表雇佣、代理或固定合作关系。': 'Collaboration partner status does not imply employment, agency, or a fixed commercial relationship.',
  '远程岗位申请': 'Remote job applications',
  '岗位更新订阅': 'Job update alerts',
  'AI 工具、申请攻略等': 'AI tools and application guides',
  '职业成长内容': 'Career-growth content',
  '人工咨询': 'Human consultation',
  '个性化诊断': 'Personalized assessment',
  '远程准备材料': 'Remote-work preparation materials',
  '不支持': 'Not included',
  '完全开放': 'Full access',
  '完全开放+定向挖掘': 'Full access + targeted research',
  '一次性建议': 'One-time guidance',
  '长期支持': 'Ongoing support',
  '通用入门材料': 'General starter materials',
  '定制材料包': 'Tailored material pack',
  '精选岗位参考与申请路径': 'Curated roles and application paths',
  '企业联系人与直达线索': 'Company contacts and direct leads',
  '远程职业成长内容': 'Remote-career learning content',
  'AI 简历优化、岗位订阅等工具': 'AI resume tools & job alerts',
  '纯网站工具服务，不含语音咨询': 'Self-service tools; no consultation',
  '30-60 分钟语音 1V1 咨询': '30–60 min 1:1 consultation',
  '包含 Club Member 支持': 'Includes Club Member support',
  '1 次远程求职规划': 'One career planning session',
  '优先参与会员闭门交流': 'Priority access to private events',
  '可申请成为共建伙伴': 'Apply as a community partner',
  '企业岗位发布与品牌传播支持额度（1季度1次）': 'Quarterly employer-brand support',
  '长期岗位资源': 'Curated jobs',
  '持续筛选适合中国用户申请的机会': 'Remote roles selected for China-based talent',
  '申请路径支持': 'Application support',
  '联系人资源、申请入口与工具支持': 'Contacts, direct links, and practical tools',
  '远程职业成长': 'Career growth',
  '远程求职准备、英文面试、远程会议等': 'Interviews, meetings, and remote-work skills',
  '企业文化理解': 'Company insight',
  '从CEO访谈里了解远程企业的使命、文化和商业模式': 'Learn culture and business through CEO interviews',
  '社群陪伴支持': 'Community support',
  '资料更新、交流和远程求职咨询': 'Fresh resources, peers, and job-search guidance',
  '浏览/搜索/筛选': 'Browse / search / filter',
  '20次直申/3次内推': '20 direct applications / 3 referrals',
  '有限体验': 'Limited access',
  '开放': 'Included',
  '可申请': 'Eligible',
  '30-60分钟': '30–60 min',
  '1季度1次': 'Once per quarter',
  '语音 1V1 远程咨询': '1:1 remote voice consultation',
  '会员闭门交流优先参与': 'Priority access to private member events',
  '企业岗位发布与品牌传播支持额度': 'Employer job-posting and brand support credit',
  '精选岗位与申请路径': 'Curated roles and application paths',
  '持续查看精选远程岗位、申请入口及企业联系人线索。': 'Keep track of curated remote roles, application links, and company contact leads.',
  '可免费浏览、搜索和筛选基础岗位信息；可体验 20 次网络直申、3 次内推联系人解锁。': 'Browse, search, and filter foundational role information for free, with 20 direct applications and 3 referral-contact unlocks to try.',
  '可免费体验职业成长样例；完整 CEO 访谈、企业文化与远程准备内容面向 Club Starter / Member / Partner 开放。': 'Try free career-learning samples. Full CEO interviews, company insight, and remote-work preparation content are available with Club Starter, Member, and Partner.',
  '免费样例': 'Free samples',
  '开始体验': 'Try samples',
  '个性化诊断 & 远程准备材料': 'Personalized assessment & remote-work preparation',
  '提供一次方向判断、简历文字诊断、修改建议与 30 天行动清单。': 'Includes one direction assessment, written resume review, improvement suggestions, and a 30-day action list.',
  '提供方向与简历初步诊断，并配合个性化远程准备材料。': 'Includes initial direction and resume assessment, plus tailored remote-work preparation materials.',
  '个性化诊断与远程准备材料为 Club Starter / Member / Partner 服务。': 'Personalized assessment and preparation materials are available with Club Starter, Member, and Partner.',
  '语音 1V1 远程咨询 / 英文简历优化': '1:1 voice consultation / English resume refinement',
  '根据当前准备阶段，安排一次 30–60 分钟语音咨询或英文简历优化。': 'Arrange one 30–60 minute voice consultation or English resume refinement based on your current stage.',
  '语音咨询或英文简历优化为 Club Member / Partner 服务。': 'Voice consultation or English resume refinement is available with Club Member and Partner.',
  '定向远程岗位挖掘': 'Targeted remote role research',
  '围绕你的目标方向挖掘 5–10 个更匹配的远程岗位，并同步申请建议。': 'Research 5–10 better-matched remote roles around your target direction, with application guidance.',
  '定向远程岗位挖掘为 Club Member / Partner 服务。': 'Targeted remote role research is available with Club Member and Partner.',
  'Club Partner 专属，围绕长期职业目标、能力补齐与行动节奏展开。': 'Exclusive to Club Partner, focused on long-term goals, skill gaps, and a practical action rhythm.',
  '年度远程职业规划为 Club Partner 服务。': 'Annual remote-career planning is available with Club Partner.',
  '职业资源共建支持': 'Career-resource collaboration support',
  '可申请成为共建伙伴；入职远程企业后，可按规则申请岗位发布、人才连接与雇主品牌传播支持。': 'Apply to become a collaboration partner; after joining a remote company, you may request job-posting, talent-connection, and employer-brand support under the programme rules.',
  '共建伙伴申请、岗位发布与品牌传播支持为 Club Partner 服务。': 'Collaboration-partner applications, job posting, and employer-brand support are available with Club Partner.',
  '方向与简历诊断、准备材料、定向岗位挖掘及一次语音咨询支持在有效期内可安排。': 'Direction and resume assessment, preparation materials, targeted role research, and one voice consultation can be arranged during your term.',
  '一次方向判断、简历文字诊断、远程准备材料和网站工具，帮助你完成第一轮有效申请。': 'One direction assessment, written resume review, remote-work preparation materials, and site tools help you complete a first effective application.',
  '在长期求职支持之上，获得年度规划、主题交流与可申请的职业资源共建支持。': 'In addition to ongoing job-search support, receive annual planning, themed exchanges, and eligible career-resource collaboration.',
  '为什么需要添加顾问才能开通？': 'Why do I need to contact an advisor to join?',
  'Haigoo Remote Club 以咨询与社群服务为主，网站是配套工具。顾问会先了解你的阶段、目标与适配度，确认适合后再开通，避免盲目加入，对你和俱乐部都更负责。': 'An advisor checks your goals and recommends the right level of support before activation.',
  '这几项权益核心差别是什么？': 'What are the key differences between the plans?',
  'Club Starter 是工具型网站服务，适合远程入门、已经有明确目标、希望自己高效查资料和投递的人；Club Member 是社群陪伴型服务，适合在职准备或方向还不够清晰的人，可结合 1V1 咨询梳理准备路径；Club Partner 更适合 HR、品牌、商务或市场等有资源协作需求的人，Haigoo 会作为你的资源辅助与职业背书，帮助你放大工作优势。': 'Starter is self-service. Member adds ongoing support and a 1:1 session. Partner adds collaboration and professional-network benefits.',
  '加入会员后发现不适合自己怎么办？': 'What if the membership is not right for me?',
  '如果投递一段时间效果不理想，建议先找顾问复盘方向、简历和投递策略；再次尝试仍无改善，可按剩余有效时间申请退款。Haigoo 更希望长期陪伴并真正帮到你，而不是做一次性服务。': 'Review your direction and application strategy with an advisor first. If it is still not a fit, refunds may be requested for the unused period.',
  '语音咨询可以咨询哪些内容？': 'What can I discuss in a voice consultation?',
  '可以咨询在职如何提前准备、适合哪些远程方向、需要补哪些技能、转行路径、远程工作的五险一金、税务和沟通方式等问题。': 'Discuss career direction, skill gaps, transitions, benefits, taxes, and remote communication.',
  '远程求职规划是什么？会包含哪些内容？': 'What is included in remote career planning?',
  '我们会结合你的过往经历、能力优势、兴趣偏好和目标岗位，梳理适合发展的职业方向，并评估每个方向的落地性、成长性和可拓展性。报告通常包含核心定位、方向排序、适合岗位、人群/行业建议、简历优化重点、能力补充建议和阶段行动路径，帮助你判断适合往哪里走、怎么准备、下一步做什么。': 'A practical plan covering direction, target roles, resume priorities, skill gaps, and next steps.',
  '成为共建伙伴最大的作用是什么？': 'What is the value of becoming a community partner?',
  'Partner 可以更充分调用 Haigoo Remote Club 的网站、社媒、社群与合作资源，作为职业背书或求职优势。若有企业商务合作、岗位发布、品牌传播等需求，也会优先为 Partner 协同支持。': 'Partners receive priority access to Haigoo’s community, publishing, and collaboration resources.',
  '可使用': 'Available',
  '不可用': 'Unavailable',
  '有限可用': 'Limited access',
  '查看岗位': 'View jobs',
  '开始学习': 'Start learning',
  '使用工具': 'Use tools',
  '联系顾问': 'Contact advisor',
  '提交申请': 'Apply now',
  '申请发布': 'Request support',
  '查看预约': 'View appointment',
  '预约咨询': 'Book a consultation',
  '预约规划': 'Book planning session',
  '已预约': 'Scheduled',
  '未预约': 'Not scheduled',
  '已完成': 'Completed',
  '未申请': 'Not applied',
  '已通过': 'Approved',
  '未使用': 'Unused',
  '已发布': 'Published',
  '可参与': 'Available',
  '远程职业成长权益': 'Remote career learning',
  'AI简历优化、岗位订阅等工具': 'AI resume tools, job alerts, and more',
  '闭门交流优先参与': 'Priority access to private events',
  '会员期内可查看全部精选远程岗位资源。': 'Access every curated remote opportunity during your membership.',
  '查看岗位申请入口、企业联系人和直达线索。': 'View application links, company contacts, and direct leads.',
  'CEO访谈、企业文化、远程准备、英文面试等材料已开放。': 'Access CEO interviews, company culture, remote-work preparation, and English interview materials.',
  '当前会员类型暂不包含完整远程职业成长权益。': 'Your current plan does not include full remote career learning access.',
  '可使用 AI 简历分析/求职规划、订阅关注的岗位更新等工具。': 'Use AI resume analysis, career planning, and personalized job alerts.',
  '会员期内包含一次 30-60 分钟远程咨询。': 'Includes one 30–60 minute remote consultation during your membership.',
  '当前会员类型暂不包含语音咨询。': 'Your current plan does not include a voice consultation.',
  '年度会员专属，适合制定长期求职目标和行动计划。': 'Exclusive to annual members for long-term goals and an actionable career plan.',
  '年度会员可优先参与 Haigoo Remote Club 闭门交流。': 'Annual members receive priority access to private Haigoo Remote Club events.',
  '年度会员在会员期内成功入职远程企业后可申请。': 'Annual members may apply after joining a remote company during their membership.',
  '年度会员可申请岗位发布与雇主品牌传播支持，每季度 1 次免费发布/宣传。': 'Annual members may request one job-posting or employer-brand support credit per quarter.'
}

function translateClubCopy(value: string, isEnglish: boolean) {
  return isEnglish ? (CLUB_COPY_EN[value] || value) : value
}

const DEFAULT_CLUB_ADVISOR_COPY = {
  title: '添加顾问，了解适合你的支持',
  subtitle: '顾问会结合你的求职阶段说明服务内容、交付方式和下一步安排。',
  steps: ['添加 Haigoo 顾问', '发送注册邮箱和当前求职阶段', '顾问确认适合的服务路径与安排'],
  consultText: '远程求职建议、职业成长、简历优化与行动规划'
}

const MEMBER_BENEFIT_ADVISOR_COPY = {
  title: '联系小助手提交预约',
  subtitle: '尊敬的会员用户，如需预约咨询请联系海狗小助手。',
  steps: ['添加/联系 Haigoo 小助手', '发送注册邮箱和想咨询的内容', '跟小助手沟通后确认咨询时间'],
  consultText: '适合自己的远程工作、语言能力、社保等相关问题'
}

const MEMBER_SUPPORT_ADVISOR_COPY = {
  title: '向小助手咨询会员权益或使用问题',
  subtitle: '如果您对会员权益、费用或使用体验等存在问题，可以向小助手反馈。',
  steps: ['添加/联系 Haigoo 小助手', '发送注册邮箱和想反馈的问题', '小助手为您解答'],
  consultText: '会员权益、远程求职建议、职业成长、使用体验等'
}

const ANNUAL_PLANNING_ADVISOR_COPY = {
  title: '联系小助手预约年度规划',
  subtitle: '尊敬的年度会员用户，如需预约年度远程求职规划请联系海狗小助手。',
  steps: ['添加/联系 Haigoo 小助手', '发送注册邮箱和想规划的求职方向', '跟小助手沟通后确认规划时间'],
  consultText: '年度远程求职目标、申请节奏、能力补齐和行动计划'
}

const TARGETED_ROLE_RESEARCH_ADVISOR_COPY = {
  title: '联系小助手安排定向岗位挖掘',
  subtitle: 'Club Member / Partner 可结合目标方向，由小助手确认岗位挖掘的范围与交付安排。',
  steps: ['添加/联系 Haigoo 小助手', '发送注册邮箱、目标方向与当前背景', '确认 5–10 个岗位的挖掘范围与后续建议'],
  consultText: '定向远程岗位挖掘、岗位匹配与申请准备'
}

const CAREER_RESOURCE_ADVISOR_COPY = {
  title: '联系小助手了解职业资源共建',
  subtitle: 'Club Partner 可申请共建资格；入职远程企业后，也可按规则咨询岗位发布、人才连接与品牌传播支持。',
  steps: ['添加/联系 Haigoo 小助手', '发送注册邮箱与希望申请的支持事项', '确认资格、所需资料与审核安排'],
  consultText: '共建伙伴、岗位发布、人才连接与雇主品牌传播支持'
}

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

function formatDisplayName(name: string, memberType?: string | null) {
  const normalized = name.replace(/\s*\((Old Quarter|New Quarter|Quarter|VIP|Starter|Member|Partner)\)\s*/gi, '').trim()
  if ((memberType === 'quarter' || memberType === 'quarter_pro') && normalized) {
    return `${normalized}（VIP）`
  }
  if (memberType === 'starter' && normalized) {
    return `${normalized}（Starter）`
  }
  if (memberType === 'half_year' && normalized) {
    return `${normalized}（Member）`
  }
  if ((memberType === 'annual' || memberType === 'year') && normalized) {
    return `${normalized}（Partner）`
  }
  return normalized || name
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
  isMember,
  memberType = 'none'
}: {
  avatar?: string
  username?: string
  isMember?: boolean
  memberType?: EmbeddedMemberType | 'none'
}) {
    const fallback = (username || 'U').trim().charAt(0).toUpperCase()
    const ringClass = isMember ? 'border-[#d8d2ff] ring-2 ring-[#a9a3ff]' : 'border-indigo-100'
    const badgeClass = 'bg-[#6f63f6]'

  return (
    <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white shadow-sm ${ringClass}`}>
      {avatar ? (
        <img src={avatar} alt={username || '用户头像'} className="h-full w-full object-cover" loading="eager" decoding="async" draggable={false} />
      ) : (
        <span className="text-sm font-black text-slate-700">{fallback}</span>
      )}
      {isMember ? (
        <span className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white text-white shadow-sm ${badgeClass}`}>
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
  const { isEnglish, text } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const conversationScrollRef = useRef<HTMLDivElement>(null)
  const clubServicePlansRef = useRef<HTMLElement>(null)
  const memberBenefitsRef = useRef<HTMLElement>(null)
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

  useEffect(() => {
    if (publicAboutOnly || tab !== 'membership') return
    const hashTarget = location.hash === '#club-service-plans'
      ? clubServicePlansRef.current
      : location.hash === '#member-benefits'
        ? memberBenefitsRef.current
        : null
    if (!hashTarget) return
    window.setTimeout(() => {
      hashTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }, [location.hash, publicAboutOnly, tab])

  const [isUploading, setIsUploading] = useState(false)
  const [selectedCareerStage, setSelectedCareerStage] = useState<ClubServicePlanId | null>(null)
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
  const [favoriteSubTab, setFavoriteSubTab] = useState<'jobs' | 'audio'>('jobs')
  const [audioFavorites, setAudioFavorites] = useState<CorporateEnglishPublicClip[]>([])
  const [loadingAudioFavorites, setLoadingAudioFavorites] = useState<boolean>(false)
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
  const [showMembershipPlanChooserModal, setShowMembershipPlanChooserModal] = useState(false)
  const [showMembershipPaymentModal, setShowMembershipPaymentModal] = useState(false)
  const [returnToMembershipPlansOnPaymentClose, setReturnToMembershipPlansOnPaymentClose] = useState(false)
  const [showMembershipAssistantModal, setShowMembershipAssistantModal] = useState(false)
  const [clubAdvisorCopy, setClubAdvisorCopy] = useState(DEFAULT_CLUB_ADVISOR_COPY)
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
    if (!publicAboutOnly && tab !== 'about') return
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
  }, [publicAboutOnly, tab])

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
    if (publicAboutOnly || tab !== 'membership') return
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
    }, [publicAboutOnly, tab, token])

  useEffect(() => {
    if (tab !== 'membership' || !isAuthenticated || !isMember) {
      if (!isMember) setMemberRecommendedJobs([])
      return
    }

    let cancelled = false
    setLoadingMemberRecommendations(true)

    ;(async () => {
      try {
        const jobs = await fetchDailyMemberRecommendations(6, { hasResume: Boolean(latestResume?.id) })
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
  }, [authUser?.user_id, isAuthenticated, isMember, latestResume?.id, tab, token])

  const activeMemberType = membershipStatus?.memberType || authUser?.memberType
  const activeMembershipExpireAt = membershipStatus?.expireAt || authUser?.memberExpireAt
  const displayMembershipPlans = useMemo(() => {
    return (['starter', 'half_year', 'annual'] as EmbeddedMemberType[]).map((memberType) => {
      const clubPlan = CLUB_SERVICE_PLANS.find((item) => item.id === memberType)
      const plan = membershipPlans.find((plan) => plan.memberType === memberType)
        || ({
          id: memberType === 'starter' ? 'club_starter_monthly' : memberType === 'half_year' ? 'club_half_year' : 'club_annual',
          memberType,
          name: clubPlan?.title || (memberType === 'half_year' ? 'Club Member' : 'Club Partner'),
          shortLabel: memberType === 'starter' ? 'Starter' : memberType === 'half_year' ? 'Club Member' : 'Club Partner',
          price: memberType === 'starter' ? 99 : memberType === 'half_year' ? 499 : 998,
          currency: 'CNY',
          duration_days: memberType === 'starter' ? 31 : memberType === 'half_year' ? 183 : 365,
          discountLabel: memberType === 'starter' ? '工具服务' : memberType === 'half_year' ? '长期陪伴' : '推荐｜适合 HR / 品牌 / 市场 / 运营',
          description: clubPlan?.description || '',
          features: clubPlan?.features || []
        } as EmbeddedMembershipPlan)
      return plan
    })
  }, [membershipPlans])
  const isCurrentClubServicePlan = (planId: ClubServicePlanId) => {
    if (!isMember) return false
    const normalizedActiveType = activeMemberType === 'year' ? 'annual' : activeMemberType
    return normalizedActiveType === planId
  }

  const openMembershipPayment = (plan: EmbeddedMembershipPlan, options?: { returnToPlansOnClose?: boolean }) => {
    if (plan.comingSoon) return
    const planFeatureKey = plan.memberType === 'starter'
      ? 'membership_plan_starter'
      : plan.memberType === 'half_year'
      ? 'membership_plan_half_year'
      : plan.memberType === 'annual'
        ? 'membership_plan_annual'
        : plan.memberType === 'trial_week'
          ? 'membership_plan_trial_week'
          : plan.memberType === 'quarter'
            ? 'membership_plan_quarter'
            : plan.memberType === 'quarter_pro'
              ? 'membership_plan_quarter_pro'
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

    setSelectedMembershipPlan(plan)
    setReturnToMembershipPlansOnPaymentClose(Boolean(options?.returnToPlansOnClose))
    setClubAdvisorCopy(DEFAULT_CLUB_ADVISOR_COPY)
    setShowMembershipAssistantModal(true)
  }

  const closeMembershipPaymentToPlans = () => {
    setShowMembershipPaymentModal(false)
    if (returnToMembershipPlansOnPaymentClose && selectedMembershipPlan) {
      setShowMembershipPlanChooserModal(true)
    }
    setReturnToMembershipPlansOnPaymentClose(false)
  }

  const handleMembershipAdvisorAdded = async () => {
    setShowMembershipPaymentModal(false)
    setShowMembershipPlanChooserModal(false)
    setReturnToMembershipPlansOnPaymentClose(false)
    showSuccess('已记录顾问添加状态', '顾问会协助确认适合方案、服务边界和开通方式。')

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

    trackingService.track('membership_advisor_added_click', {
      page_key: 'profile',
      module: 'profile_membership_advisor',
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
    if (t && ['resume', 'favorites', 'applications', 'feedback', 'membership', 'about', 'settings'].includes(t)) {
      setTab(t as TabKey)
      if (t === 'favorites') {
        setFavoriteSubTab(sp.get('type') === 'audio' ? 'audio' : 'jobs')
      }
    }
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

  const switchFavoriteSubTab = (next: 'jobs' | 'audio') => {
    setFavoriteSubTab(next)
    const sp = new URLSearchParams(location.search)
    sp.set('tab', 'favorites')
    if (next === 'audio') {
      sp.set('type', 'audio')
    } else {
      sp.delete('type')
    }
    navigate({ pathname: '/profile', search: `?${sp.toString()}` }, { replace: true })
  }

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  useEffect(() => {
    if (tab !== 'favorites' || favoriteSubTab !== 'jobs') return
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
  }, [authUser?.user_id, favoriteSubTab, tab, token])

  useEffect(() => {
    if (tab !== 'favorites' || favoriteSubTab !== 'audio') return
    ; (async () => {
      try {
        if (!authUser || !token) {
          setAudioFavorites([])
          return
        }
        setLoadingAudioFavorites(true)
        const items = await corporateEnglishPublicService.listFavorites()
        setAudioFavorites(items)
      } catch (error) {
        console.error('[ProfileCenter] Failed to fetch audio favorites:', error)
        setAudioFavorites([])
      } finally {
        setLoadingAudioFavorites(false)
      }
    })()
  }, [authUser?.user_id, favoriteSubTab, tab, token])

  useEffect(() => {
    if (tab !== 'applications') return
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
  }, [authUser?.user_id, tab, token])

  // Fetch user resume on page load - FIXED: Read directly from resumes API
  useEffect(() => {
    if (tab !== 'resume' && tab !== 'custom-plan') {
      setIsResumeInitializing(false)
      return
    }
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
  }, [authUser, tab, token])

  // Fetch Copilot Plan
  useEffect(() => {
    const fetchPlan = async () => {
      if (tab !== 'custom-plan' || !authUser || !token) return
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

      const uploadResp = await trackingService.trackedFetch('/api/resumes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      }, {
        event_family: 'resume',
        feature_key: 'resume_upload',
        source_key: 'profile_resume',
        file_type: file.type,
        file_size_bucket: file.size < 1024 * 1024 ? 'lt_1mb' : file.size < 5 * 1024 * 1024 ? '1_to_5mb' : 'gte_5mb',
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
            const { parseResumeFileEnhanced } = await import('../services/resume-parser-enhanced')
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

      const resp = await trackingService.trackedFetch('/api/resumes', {
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
      }, {
        event_family: 'resume',
        feature_key: featureKey,
        source_key: 'profile_resume',
        entity_type: 'resume',
        entity_id: resumeIdToAnalyze,
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
                        <UserAvatar avatar={authUser?.avatar} username={authUser?.username || authUser?.profile?.fullName} isMember={isMember} memberType={activeMemberType || 'none'} />
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
                            {isUser ? <UserAvatar avatar={authUser?.avatar} username={authUser?.username || authUser?.profile?.fullName} isMember={isMember} memberType={activeMemberType || 'none'} /> : null}
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
          <p className="text-slate-500 mt-1">管理收藏的岗位和职业成长跟读音频。</p>
        </div>
        <span className="text-xs font-normal text-gray-400">岗位收藏仅保留近1年记录</span>
      </div>
      <div className="rounded-[24px] border border-[#e1e9f1] bg-white/86 p-2 shadow-sm">
        <div className="flex gap-2">
          {[
            { id: 'jobs', label: '岗位收藏', count: favoritesWithStatus.length, icon: Heart },
            { id: 'audio', label: '音频收藏', count: audioFavorites.length, icon: Volume2 }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => switchFavoriteSubTab(item.id as 'jobs' | 'audio')}
              className={`inline-flex items-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-black transition ${
                favoriteSubTab === item.id
                  ? 'bg-[#f0edff] text-[#6f63f6] shadow-sm'
                  : 'text-slate-500 hover:bg-[#f7fbff] hover:text-slate-900'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs">{item.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[300px]">
        {favoriteSubTab === 'jobs' ? (
          loadingFavorites ? (
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
          )
        ) : loadingAudioFavorites ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-36 rounded-[22px] bg-slate-100" />
              </div>
            ))}
          </div>
        ) : audioFavorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[220px] text-center">
            <Volume2 className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-lg font-bold text-slate-900">还没有收藏音频</p>
            <p className="text-sm text-slate-500 mt-1">在职业成长页面收藏跟读片段后，这里可以播放音频并查看字幕</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {audioFavorites.map((clip) => (
              <AudioFavoriteCard
                key={clip.clipId}
                clip={clip}
                onError={(message) => showError('音频加载失败', message)}
              />
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

  const rawDisplayName = authUser?.profile?.fullName || authUser?.username || authUser?.email?.split('@')[0] || '朋友'
  const displayName = formatDisplayName(rawDisplayName, activeMemberType)
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
        value: isMember ? (isTrialMember ? '短期体验' : '生效中') : '未加入',
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
      ? text('Trial（体验）', 'Trial')
      : activeMemberType === 'starter'
        ? text('Club Starter（月度）', 'Club Starter (monthly)')
      : activeMemberType === 'annual'
        ? text('Club Partner（年度）', 'Club Partner (annual)')
      : activeMemberType === 'half_year'
        ? text('Club Member（半年）', 'Club Member (6 months)')
      : activeMemberType === 'quarter'
        ? 'VIP'
      : activeMemberType === 'quarter_pro'
        ? 'VIP'
        : isMember
          ? text('Club Partner（年度）', 'Club Partner (annual)')
          : text('未加入', 'Not a member')
  const memberVisual = !isMember
    ? {
      shortName: 'Haigoo Club',
      iconText: 'text-[#6f63f6]',
      iconBg: 'bg-[#f0edff]',
      border: 'border-[#ddd7ff]',
      softBorder: 'border-[#ebe7ff]',
      cardBg: 'bg-white/92',
      glow: 'bg-[#d8d2ff]/24',
      statusBg: 'bg-[#f4f1ff]',
      statusText: 'text-[#6f63f6]',
      statusBorder: 'border-[#e5e0ff]',
      title: '了解 Club 服务，开启长期求职支持',
      description: '先浏览公开内容，再根据目标选择适合的会员服务。',
      items: [
        ['公开内容', '开放岗位与部分企业信息可先查看'],
        ['顾问协助', '添加顾问了解适合自己的服务方案'],
        ['网站工具', '会员服务配套求职工具集中在这里'],
        ['长期准备', '远程岗位、职业成长和企业文化同步推进']
      ]
    }
    : activeMemberType === 'trial_week'
    ? {
      shortName: 'Trial（体验）',
      iconText: 'text-[#6f63f6]',
      iconBg: 'bg-[#f0edff]',
      border: 'border-[#ddd7ff]',
      softBorder: 'border-[#ebe7ff]',
      cardBg: 'bg-white/92',
      glow: 'bg-[#d8d2ff]/22',
      statusBg: 'bg-[#f4f1ff]',
      statusText: 'text-[#6f63f6]',
      statusBorder: 'border-[#e5e0ff]',
      title: '体验权益已解锁，短期体验更高效',
        description: '短期求职工具已开放，适合明确方向后集中投递和优化材料。',
        items: [
          ['岗位申请权益', '短期开放高价值岗位、联系人和直申入口'],
          ['AI 求职工具', '简历优化、匹配分析和申请辅助可集中使用'],
          ['精选企业入口', '可快速了解重点企业名单和申请方向'],
          ['职业成长样例', '可先体验职业成长视频和跟读样例']
        ]
      }
    : activeMemberType === 'starter'
      ? {
        shortName: 'Club Starter（月度）',
        iconText: 'text-[#6f63f6]',
        iconBg: 'bg-[#f0edff]',
        border: 'border-[#ddd7ff]',
        softBorder: 'border-[#ebe7ff]',
        cardBg: 'bg-white/92',
        glow: 'bg-[#d8d2ff]/20',
        statusBg: 'bg-[#f4f1ff]',
        statusText: 'text-[#6f63f6]',
        statusBorder: 'border-[#e5e0ff]',
          title: 'Club Starter 服务已开启',
          description: '简历诊断、远程准备材料和网站工具可在有效期内使用。',
        items: [
          ['岗位与申请入口', '持续查看精选岗位，并使用申请入口与联系人线索'],
          ['内容资料', 'CEO 访谈、企业文化、远程准备、英文面试等材料可学习'],
          ['AI 辅助建议', '简历优化、匹配分析和求职辅助工具可使用'],
          ['服务边界', 'Starter 不包含语音咨询、求职规划和共建伙伴服务']
        ]
      }
    : activeMemberType === 'year' || activeMemberType === 'annual'
          ? {
            shortName: 'Club Partner（年度）',
        iconText: 'text-[#6f63f6]',
        iconBg: 'bg-[#f0edff]',
        border: 'border-[#ddd7ff]',
        softBorder: 'border-[#ebe7ff]',
        cardBg: 'bg-white/92',
        glow: 'bg-[#d8d2ff]/24',
        statusBg: 'bg-[#f4f1ff]',
        statusText: 'text-[#6f63f6]',
        statusBorder: 'border-[#e5e0ff]',
          title: 'Club Partner 服务已开启，长期资源持续沉淀',
          description: '包含长期求职支持、年度规划与可申请的职业资源共建支持。',
        items: [
          ['长期求职支持', '持续使用岗位、申请路径、诊断与人工支持'],
          ['远程职业成长内容', '跟着远程企业 CEO 了解真实商业语境和企业文化'],
          ['跟读音频与字幕素材', '完整跟读片段、字幕标签和口语训练素材已开放'],
          ['更多资料与 CEO 联系', '延伸阅读、收藏能力、CEO 邮箱和 LinkedIn 权限已开放']
        ]
      }
      : activeMemberType === 'half_year'
        ? {
        shortName: 'Club Member（半年）',
        iconText: 'text-[#6f63f6]',
        iconBg: 'bg-[#f0edff]',
        border: 'border-[#ddd7ff]',
        softBorder: 'border-[#ebe7ff]',
        cardBg: 'bg-white/92',
        glow: 'bg-[#d8d2ff]/20',
        statusBg: 'bg-[#f4f1ff]',
        statusText: 'text-[#6f63f6]',
        statusBorder: 'border-[#e5e0ff]',
          title: 'Club Member 服务已开启，长期求职支持持续推进',
          description: '方向诊断、申请准备、岗位挖掘与职业成长内容可持续使用。',
        items: [
          ['申请支持', '持续使用岗位申请路径、联系人线索与直申入口'],
          ['精选企业页面', '查看人工筛选企业名单和企业信息'],
          ['远程职业成长内容', '学习企业文化、使命愿景和真实商业表达'],
            ['CEO 商业思维', '视频、企业文化、CEO 思维和跟读素材已开放']
        ]
      }
      : {
        shortName: 'VIP',
        iconText: 'text-[#6f63f6]',
        iconBg: 'bg-[#f0edff]',
        border: 'border-[#ddd7ff]',
        softBorder: 'border-[#ebe7ff]',
        cardBg: 'bg-white/92',
        glow: 'bg-[#d8d2ff]/20',
        statusBg: 'bg-[#f4f1ff]',
        statusText: 'text-[#6f63f6]',
        statusBorder: 'border-[#e5e0ff]',
          title: '长期权益已解锁，申请和文化理解同步推进',
          description: '远程求职权益、精选企业和完整远程职业成长权益已开放。',
        items: [
          ['远程求职权益', '全部岗位申请、联系人信息和直申入口已开放'],
          ['精选企业页面', '完整查看人工筛选企业名单和企业信息'],
          ['远程职业成长权益', '学习企业文化、使命愿景和真实商业表达'],
            ['CEO 商业思维', '视频、企业文化、CEO 思维和跟读素材已开放']
        ]
      }
  const membershipExpireDate = activeMembershipExpireAt ? new Date(activeMembershipExpireAt) : null
  const membershipExpireLabel = membershipExpireDate && !Number.isNaN(membershipExpireDate.getTime())
    ? membershipExpireDate.toLocaleDateString(isEnglish ? 'en-US' : 'zh-CN')
    : text('长期有效', 'No expiration')
  const membershipStatusExpireLabel = isMember ? membershipExpireLabel : text('顾问协助开通', 'Contact an advisor')
  const membershipDaysRemaining = membershipExpireDate && !Number.isNaN(membershipExpireDate.getTime())
    ? Math.ceil((membershipExpireDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null
  const shouldShowRenewalPlans = !isMember || (membershipDaysRemaining !== null && membershipDaysRemaining <= 14)
  const isQuarterMember = activeMemberType === 'quarter' || activeMemberType === 'quarter_pro'
  const isAnnualClubMember = activeMemberType === 'annual' || activeMemberType === 'year'
  const isHalfYearClubMember = activeMemberType === 'half_year'
  const isStarterClubMember = activeMemberType === 'starter'
  const isTrialWeekMember = activeMemberType === 'trial_week'
  const membershipTone = !isMember
    ? 'guest'
    : isAnnualClubMember
      ? 'annual'
      : isHalfYearClubMember
        ? 'semester'
        : isStarterClubMember
          ? 'starter'
        : isQuarterMember
          ? 'quarter'
          : activeMemberType === 'trial_week'
            ? 'trial'
            : 'guest'
  const memberPrimaryButtonClass = 'bg-[#6f63f6] shadow-[0_18px_38px_-24px_rgba(95,99,246,0.48)] hover:bg-[#5d50df]'
  const memberWorkspaceShellClass = 'border-[#e1e8f4] bg-white/90 shadow-[0_24px_70px_-56px_rgba(64,78,102,0.24)]'
  const memberCardIconClass = 'bg-[#f4f1ff] text-[#6f63f6]'
  const memberIdentityLabel = activeMemberType === 'trial_week'
    ? text('Trial（体验）', 'Trial')
    : activeMemberType === 'starter'
      ? text('Club Starter（月度）', 'Club Starter (monthly)')
    : activeMemberType === 'quarter'
      ? 'VIP'
    : activeMemberType === 'half_year'
        ? text('Club Member（半年）', 'Club Member (6 months)')
        : activeMemberType === 'annual'
          ? text('Club Partner（年度）', 'Club Partner (annual)')
          : activeMemberType === 'quarter_pro'
            ? 'VIP'
            : activeMemberType === 'year'
              ? text('Club Partner（年度）', 'Club Partner (annual)')
              : text('未加入', 'Not a member')
  const membershipStatusLabel = isMember ? text('生效中', 'Active') : text('未加入', 'Not a member')
  const serviceEntitlements = authUser?.profile?.memberServiceEntitlements || {}
  const getServiceEntitlement = (key: string) => serviceEntitlements[key] || {}
  const serviceStatusLabels: Record<string, string> = {
    not_scheduled: '未预约',
    scheduled: '已预约',
    completed: '已完成',
    expired: '已失效',
    available: '可参与',
    registered: '已报名',
    attended: '已参与',
    not_applied: '未申请',
    reviewing: '审核中',
    approved: '已通过',
    rejected: '未通过',
    unused: '未使用',
    requested: '已申请',
    published: '已发布'
  }
  const getServiceStatusLabel = (key: string, fallback: string) => {
    const status = getServiceEntitlement(key).status
    return status ? (serviceStatusLabels[status] || status) : fallback
  }
  const formatServiceTime = (value?: string) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }
  const getServiceMeta = (key: string) => {
    const record = getServiceEntitlement(key)
    if (record.appointmentAt) return `${text('预约时间：', 'Scheduled: ')}${formatServiceTime(record.appointmentAt)}`
    if (record.completedAt) return `${text('完成时间：', 'Completed: ')}${formatServiceTime(record.completedAt)}`
    if (record.expiredAt) return `${text('失效时间：', 'Expired: ')}${formatServiceTime(record.expiredAt)}`
    return record.note || ''
  }
  const consultationStatus = getServiceStatusLabel('voice_consultation_30m', '未预约')
  const annualPlanningStatus = isAnnualClubMember ? getServiceStatusLabel('annual_career_planning', '未预约') : '不可用'
  const hasVoiceConsultationBenefit = isHalfYearClubMember || isAnnualClubMember
  const hasCorporateEnglishBenefit = isStarterClubMember || isQuarterMember || isHalfYearClubMember || isAnnualClubMember
  const hasClosedDoorBenefit = isAnnualClubMember
  const hasStarterServiceSupport = isStarterClubMember || isHalfYearClubMember || isAnnualClubMember
  const hasTargetedRoleResearchBenefit = isHalfYearClubMember || isAnnualClubMember
  const voiceConsultationStatus = hasVoiceConsultationBenefit ? consultationStatus : '不可用'
  const getVoiceConsultationCta = (status: string) => {
    if (status === '已预约') return '查看预约'
    if (status === '已完成') return '已完成'
    if (status === '不可用') return '不可用'
    return '预约咨询'
  }
  const memberHeroTitle = activeMemberType === 'half_year'
    ? text('Member 会员权益已开启', 'Your Club Member benefits are active')
    : isStarterClubMember
      ? text('Starter 网站工具权益已开启', 'Your Club Starter tools are active')
    : isAnnualClubMember
      ? text('Partner 会员权益已开启', 'Your Club Partner benefits are active')
      : isQuarterMember
        ? text('季度会员权益已开启', 'Your quarterly membership is active')
        : activeMemberType === 'trial_week'
          ? text('Trial 体验权益已开启', 'Your trial benefits are active')
          : text('会员权益已开启', 'Your membership benefits are active')
  const memberHeroSubtitle = activeMemberType === 'half_year'
    ? text('方向与简历诊断、准备材料、定向岗位挖掘及一次语音咨询支持在有效期内可安排。', 'Direction and resume assessment, preparation materials, targeted role research, and one voice consultation can be arranged during your term.')
    : isStarterClubMember
      ? text('一次方向判断、简历文字诊断、远程准备材料和网站工具，帮助你完成第一轮有效申请。', 'One direction assessment, written resume review, remote-work preparation materials, and site tools help you complete a first effective application.')
    : isAnnualClubMember
      ? text('在长期求职支持之上，获得年度规划、主题交流与可申请的职业资源共建支持。', 'In addition to ongoing job-search support, receive annual planning, themed exchanges, and eligible career-resource collaboration.')
      : isQuarterMember
        ? text('岗位申请、企业资料和职业成长权益已开放，原季度权益在有效期内继续可用。', 'Job applications, company insights, and career learning remain available through your current term.')
        : isTrialWeekMember
          ? text('短期体验权益已开放，你可以集中使用岗位、申请路径和简历优化能力。', 'Your trial includes job access, application paths, and resume tools for a focused application sprint.')
          : translateClubCopy(memberVisual.description, isEnglish)
  const memberBenefitCards = [
    {
      key: 'job_application_support',
      title: '精选岗位与申请路径',
      desc: '持续查看精选远程岗位、申请入口及企业联系人线索。',
      status: '可使用',
      cta: '查看岗位',
      icon: Briefcase,
      action: 'jobs'
    },
    {
      key: 'corporate_english',
      title: '远程职业成长内容',
      desc: hasCorporateEnglishBenefit ? 'CEO 访谈、企业文化、远程准备、英文面试等材料可持续学习。' : '当前会员类型暂不包含完整远程职业成长内容。',
      status: hasCorporateEnglishBenefit ? '可使用' : '不可用',
      cta: hasCorporateEnglishBenefit ? '开始学习' : '不可用',
      icon: Sparkles,
      action: 'english',
      disabled: !hasCorporateEnglishBenefit
    },
    {
      key: 'resume_ai_suggestion',
      title: 'AI 简历优化、岗位订阅等工具',
      desc: '可使用 AI 简历分析/求职规划、订阅关注的岗位更新等工具。',
      status: '可使用',
      cta: '使用工具',
      icon: FileText,
      action: 'resume'
    },
    {
      key: 'personalized_diagnosis',
      title: '个性化诊断 & 远程准备材料',
      desc: hasStarterServiceSupport
        ? (isStarterClubMember
          ? '提供一次方向判断、简历文字诊断、修改建议与 30 天行动清单。'
          : '提供方向与简历初步诊断，并配合个性化远程准备材料。')
        : '个性化诊断与远程准备材料为 Club Starter / Member / Partner 服务。',
      status: hasStarterServiceSupport ? '可使用' : '不可用',
      cta: hasStarterServiceSupport ? '联系顾问' : '不可用',
      icon: FileText,
      action: 'advisor',
      advisorCopy: MEMBER_BENEFIT_ADVISOR_COPY,
      disabled: !hasStarterServiceSupport
    },
    {
      key: 'voice_consultation_30m',
      title: '语音 1V1 远程咨询 / 英文简历优化',
      desc: hasVoiceConsultationBenefit ? '根据当前准备阶段，安排一次 30–60 分钟语音咨询或英文简历优化。' : '语音咨询或英文简历优化为 Club Member / Partner 服务。',
      status: voiceConsultationStatus,
      meta: getServiceMeta('voice_consultation_30m'),
      cta: getVoiceConsultationCta(voiceConsultationStatus),
      icon: MessageSquare,
      action: 'advisor',
      advisorCopy: MEMBER_BENEFIT_ADVISOR_COPY,
      disabled: voiceConsultationStatus === '不可用' || voiceConsultationStatus === '已完成'
    },
    {
      key: 'targeted_role_research',
      title: '定向远程岗位挖掘',
      desc: hasTargetedRoleResearchBenefit ? '围绕你的目标方向挖掘 5–10 个更匹配的远程岗位，并同步申请建议。' : '定向远程岗位挖掘为 Club Member / Partner 服务。',
      status: hasTargetedRoleResearchBenefit ? '可使用' : '不可用',
      cta: hasTargetedRoleResearchBenefit ? '联系顾问' : '不可用',
      icon: Eye,
      action: 'advisor',
      advisorCopy: TARGETED_ROLE_RESEARCH_ADVISOR_COPY,
      disabled: !hasTargetedRoleResearchBenefit
    },
    {
      key: 'annual_career_planning',
      title: '一次年度远程职业规划',
      desc: 'Club Partner 专属，围绕长期职业目标、能力补齐与行动节奏展开。',
      status: annualPlanningStatus,
      meta: getServiceMeta('annual_career_planning'),
      cta: annualPlanningStatus === '已预约' ? '查看预约' : annualPlanningStatus === '已完成' ? '已完成' : annualPlanningStatus === '不可用' ? '不可用' : '预约规划',
      icon: Calendar,
      action: 'advisor',
      advisorCopy: ANNUAL_PLANNING_ADVISOR_COPY,
      disabled: annualPlanningStatus === '不可用' || annualPlanningStatus === '已完成'
    },
    {
      key: 'closed_door_priority',
      title: '闭门交流优先参与',
      desc: 'Club Partner 可优先参与 Haigoo Remote Club 闭门交流。',
      status: hasClosedDoorBenefit ? '可参与' : '不可用',
      cta: hasClosedDoorBenefit ? '联系顾问' : '不可用',
      icon: Users,
      action: 'advisor',
      advisorCopy: MEMBER_SUPPORT_ADVISOR_COPY,
      disabled: !hasClosedDoorBenefit
    },
    {
      key: 'career_resource_collaboration',
      title: '职业资源共建支持',
      desc: '可申请成为共建伙伴；入职远程企业后，可按规则申请岗位发布、人才连接与雇主品牌传播支持。',
      status: isAnnualClubMember ? '可申请' : '不可用',
      cta: isAnnualClubMember ? '联系顾问' : '不可用',
      icon: Building2,
      action: 'advisor',
      advisorCopy: CAREER_RESOURCE_ADVISOR_COPY,
      disabled: !isAnnualClubMember
    }
  ]
  const freeBenefitCards = [
    {
      key: 'job_application_support',
      title: '精选岗位与申请路径',
      desc: '可免费浏览、搜索和筛选基础岗位信息；可体验 20 次网络直申、3 次内推联系人解锁。',
      status: '有限可用',
      cta: '查看岗位',
      icon: Briefcase,
      action: 'jobs'
    },
    {
      key: 'corporate_english',
      title: '远程职业成长内容',
      desc: '可免费体验职业成长样例；完整 CEO 访谈、企业文化与远程准备内容面向 Club Starter / Member / Partner 开放。',
      status: '免费样例',
      cta: '开始体验',
      icon: Sparkles,
      action: 'english'
    },
    {
      key: 'resume_ai_suggestion',
      title: 'AI 简历优化、岗位订阅等工具',
      desc: '可体验有限功能和内容。',
      status: '有限体验',
      cta: '使用工具',
      icon: FileText,
      action: 'resume'
    },
    {
      key: 'personalized_diagnosis',
      title: '个性化诊断 & 远程准备材料',
      desc: '个性化诊断与远程准备材料为 Club Starter / Member / Partner 服务。',
      status: '不可用',
      cta: '不可用',
      icon: FileText,
      disabled: true
    },
    {
      key: 'voice_consultation_30m',
      title: '语音 1V1 远程咨询 / 英文简历优化',
      desc: '语音咨询或英文简历优化为 Club Member / Partner 服务。',
      status: '不可用',
      cta: '不可用',
      icon: MessageSquare,
      disabled: true
    },
    {
      key: 'targeted_role_research',
      title: '定向远程岗位挖掘',
      desc: '定向远程岗位挖掘为 Club Member / Partner 服务。',
      status: '不可用',
      cta: '不可用',
      icon: Eye,
      disabled: true
    },
    {
      key: 'annual_career_planning',
      title: '一次年度远程职业规划',
      desc: '年度远程职业规划为 Club Partner 服务。',
      status: '不可用',
      cta: '不可用',
      icon: Calendar,
      disabled: true
    },
    {
      key: 'closed_door_priority',
      title: '闭门交流优先参与',
      desc: '闭门交流优先参与为 Club Partner 权益。',
      status: '不可用',
      cta: '不可用',
      icon: Users,
      disabled: true
    },
    {
      key: 'career_resource_collaboration',
      title: '职业资源共建支持',
      desc: '共建伙伴申请、岗位发布与品牌传播支持为 Club Partner 服务。',
      status: '不可用',
      cta: '不可用',
      icon: Building2,
      disabled: true
    }
  ]

  const openClubServiceAdvisor = (
    sourceKey: string,
    planId?: ClubServicePlanId,
    copy = DEFAULT_CLUB_ADVISOR_COPY
  ) => {
    if (planId) {
      const planMeta = planId === 'starter'
        ? { id: 'club_starter_monthly', name: '月度会员', featureKey: 'membership_plan_starter' }
        : planId === 'half_year'
          ? { id: 'club_half_year', name: '半年会员', featureKey: 'membership_plan_half_year' }
          : { id: 'club_annual', name: '年度会员', featureKey: 'membership_plan_annual' }
      trackingService.track('membership_plan_click', {
        page_key: 'membership',
        module: 'club_service',
        source_key: sourceKey,
        entity_type: 'plan',
        entity_id: planMeta.id,
        plan_id: planMeta.id,
        plan_name: planMeta.name,
        feature_key: planMeta.featureKey
      })
    }
    trackingService.track('membership_club_advisor_open', {
      page_key: 'profile',
      module: 'club_service',
      source_key: sourceKey,
      plan_id: planId,
      user_segment: isMember ? 'member' : 'free'
    })
    setClubAdvisorCopy(copy)
    setShowMembershipAssistantModal(true)
  }

  const openMembershipPlanChooser = () => {
    if (isMember) {
      trackingService.track('membership_benefit_workspace_scroll', {
        page_key: 'profile',
        module: 'profile_membership_status_card',
        source_key: 'profile_membership_status_card',
        user_segment: 'member'
      })
      memberBenefitsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    openClubServiceAdvisor('profile_membership_status_card')
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

  const handleMemberDashboardAction = (item: { key: string; action?: string; advisorCopy?: typeof DEFAULT_CLUB_ADVISOR_COPY; disabled?: boolean }) => {
    if (item.disabled) return
    if (item.action === 'jobs') {
      navigate('/jobs')
      return
    }
    if (item.action === 'resume') {
      navigate('/profile?tab=resume')
      return
    }
    if (item.action === 'english') {
      navigate('/careerlearning')
      return
    }
    if (item.action === 'companies') {
      navigate('/trusted-companies')
      return
    }
    openClubServiceAdvisor(`member_dashboard_${item.key}`, undefined, item.advisorCopy || MEMBER_BENEFIT_ADVISOR_COPY)
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
      trial_week: ['解锁全部高价值岗位信息', '企业联系人与直申入口', '会员推荐与 AI 简历优化', '职业成长免费样例体验'],
      quarter: ['远程求职权益完整开放', '精选企业页面权益开放', '远程职业成长全部视频内容', '企业文化与 CEO 商业思维', '跟读素材免费样例'],
      quarter_pro: ['包含长期权益全部内容', '职业成长全部跟读音频片段', '更多企业资料', '跟读音频收藏&下载功能', '企业CEO联系方式'],
      year: ['远程求职路径答疑', '个人背景与目标岗位分析', '英文简历 / 求职信定制', '职业路径规划与转型咨询'],
      starter: CLUB_SERVICE_PLANS.find((plan) => plan.id === 'starter')?.features || [],
      half_year: CLUB_SERVICE_PLANS.find((plan) => plan.id === 'half_year')?.features || [],
      annual: CLUB_SERVICE_PLANS.find((plan) => plan.id === 'annual')?.features || []
    }

  const membershipComparisonRows = [
    {
      label: '高价值岗位 / 企业联系人 / 企业直申',
      free: '部分',
      trial_week: '7 天',
      quarter: '开放',
      quarter_pro: '开放'
    },
    {
      label: '会员推荐 / AI 简历优化',
      free: '',
      trial_week: '开放',
      quarter: '开放',
      quarter_pro: '开放'
    },
    {
      label: '精选企业页面权限',
      free: '',
      trial_week: '',
      quarter: '开放',
      quarter_pro: '开放'
    },
    {
      label: '远程职业成长视频 / 企业文化 / CEO 思维',
      free: '免费样例',
      trial_week: '免费样例',
      quarter: '开放',
      quarter_pro: '开放'
    },
    {
      label: '职业成长跟读音频 / 字幕素材',
      free: '免费样例',
      trial_week: '免费样例',
      quarter: '免费样例',
      quarter_pro: '开放'
    },
    {
      label: '企业更多资料 / CEO联系方式',
      free: '',
      trial_week: '',
      quarter: '',
      quarter_pro: '开放'
    },
    {
      label: '跟读音频收藏 / 下载',
      free: '',
      trial_week: '',
      quarter: '',
      quarter_pro: '开放'
    }
  ]

  const membershipPlanTags: Record<EmbeddedMemberType | 'free', string> = {
    free: '基础体验',
      trial_week: '短期体验',
      quarter: '在职友好',
      quarter_pro: '长期支持',
      year: '量身定制',
      starter: '工具服务',
      half_year: '长期陪伴',
      annual: '推荐'
    }

  const membershipPlanDescriptions: Record<EmbeddedMemberType | 'free', string> = {
    free: '适合先判断方向，轻量体验岗位申请流程。',
      trial_week: '适合已有明确方向，希望短期体验岗位解锁与申请辅助的人。',
      quarter: '适合持续推进远程求职、深入了解企业文化的人。',
      quarter_pro: '适合同时准备口语、远程求职和深入了解企业文化的人。',
      year: '适合精力有限、需要人工一对一服务的高效能人士。',
      starter: CLUB_SERVICE_PLANS.find((plan) => plan.id === 'starter')?.description || '',
      half_year: CLUB_SERVICE_PLANS.find((plan) => plan.id === 'half_year')?.description || '',
      annual: CLUB_SERVICE_PLANS.find((plan) => plan.id === 'annual')?.description || ''
    }

  const getMembershipPlanCta = (memberType: EmbeddedMemberType, current = false) => {
      if (current) return '当前方案'
      if (memberType === 'trial_week') return '添加顾问体验'
      if (memberType === 'starter') return '了解 Club Starter'
      if (memberType === 'quarter') return '添加顾问开通'
      if (memberType === 'quarter_pro') return '咨询深度服务方案'
      if (memberType === 'half_year') return '了解 Club Member'
      if (memberType === 'annual') return '了解 Club Partner'
      return '添加顾问了解'
    }

  const getMembershipPlanTitle = (memberType: EmbeddedMemberType) => {
      if (memberType === 'trial_week') return '短期体验权益'
      if (memberType === 'starter') return 'Club Starter'
      if (memberType === 'quarter') return '旧长期权益'
      if (memberType === 'quarter_pro') return '旧深度权益'
      if (memberType === 'half_year') return 'Club Member'
      if (memberType === 'annual') return 'Club Partner'
      return '远程工作个性化咨询'
    }

  const getMembershipPlanUnit = (memberType: EmbeddedMemberType) => {
      if (memberType === 'trial_week') return '/ 7 天'
      if (memberType === 'starter') return '/ 月'
      if (memberType === 'quarter') return '/ 季度'
      if (memberType === 'quarter_pro') return '/ 季度'
      if (memberType === 'half_year') return '/ 半年'
      if (memberType === 'annual') return '/ 年'
      return ''
    }

  const visibleClubComparisonRows = CLUB_SERVICE_COMPARISON_FULL_ROWS

  const renderClubServicePlanCard = (plan: ClubServicePlan, sourceKey: string) => {
    const isCurrentPlan = isCurrentClubServicePlan(plan.id)
    const isSelected = selectedCareerStage === plan.id
    const planRank: Record<ClubServicePlanId, number> = { starter: 1, half_year: 2, annual: 3 }
    const normalizedActiveType = activeMemberType === 'year' ? 'annual' : activeMemberType
    const activePlanRank = normalizedActiveType && normalizedActiveType in planRank
      ? planRank[normalizedActiveType as ClubServicePlanId]
      : 0
    const isUpgradePlan = isMember && activePlanRank > 0 && !isCurrentPlan && planRank[plan.id] > activePlanRank
    const isRecommended = !isMember && Boolean(plan.highlighted)
    const accentClass = 'text-[#6f63f6]'
    const cardClass = isCurrentPlan
      ? 'border-[#cfc8ff] bg-white shadow-[0_28px_72px_-56px_rgba(111,99,246,0.28)]'
      : isRecommended
        ? 'border-[#ded8ff] bg-white shadow-[0_28px_72px_-58px_rgba(111,99,246,0.22)]'
        : 'border-[#e3e8ef] bg-white shadow-[0_22px_60px_-52px_rgba(64,78,102,0.2)]'
    const buttonLabel = isCurrentPlan
      ? text('当前方案', 'Current plan')
      : isUpgradePlan
        ? text(`升级为 ${plan.clubName}`, `Upgrade to ${plan.clubName}`)
        : translateClubCopy(plan.cta, isEnglish)
    const [priceAmount, pricePeriod] = translateClubCopy(plan.price, isEnglish).split(' / ')
    const buttonClass = isCurrentPlan
      ? 'cursor-default border border-slate-200 bg-slate-100 text-slate-400'
      : isSelected || isRecommended
        ? 'bg-[#6f63f6] text-white shadow-[0_18px_38px_-24px_rgba(95,99,246,0.52)] hover:bg-[#5d50df]'
        : 'bg-slate-950 text-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.34)] hover:bg-slate-800'

    return (
      <article
        key={plan.id}
        className={`relative flex min-w-0 flex-col overflow-hidden rounded-[24px] border p-5 transition-all ${isCurrentPlan ? '' : 'hover:-translate-y-0.5'} sm:p-6 ${cardClass} ${isSelected ? 'ring-2 ring-[#6f63f6] ring-offset-2' : ''}`}
      >
        {(isCurrentPlan || isUpgradePlan || isRecommended || isSelected) ? (
          <div className={`absolute right-5 top-5 z-10 rounded-full px-3 py-1 text-xs font-black ${isCurrentPlan ? 'border border-[#ded8ff] bg-[#f7f5ff] text-[#5f52de]' : 'bg-[#6f63f6] text-white'}`}>
            {isCurrentPlan ? text('当前方案', 'Current plan') : isSelected ? text('与你当前阶段匹配', 'Matches your stage') : isUpgradePlan ? text('可升级', 'Upgrade available') : text('推荐', 'Recommended')}
          </div>
        ) : null}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className={`mb-5 ${isCurrentPlan || isUpgradePlan || isRecommended || isSelected ? 'pr-20' : ''}`}>
            <h3 className="text-2xl font-black leading-tight text-slate-950">{plan.title}</h3>
            <div className="mt-1 text-sm font-black text-slate-500">{plan.clubName}</div>
            <div className="mt-5 flex items-end gap-2.5">
              <span className="text-[38px] font-black leading-[0.9] tracking-[-0.04em] text-slate-950 sm:text-[44px]">{priceAmount}</span>
              <span className="pb-0.5 text-sm font-bold leading-none text-slate-400">/ {pricePeriod}</span>
            </div>
          </div>

          <div className="space-y-4 rounded-[20px] border border-slate-100 bg-[#fcfcfd] p-4">
            <div>
              <div className="text-xs font-black tracking-[0.14em] text-slate-400">{text('适合谁', 'Best for')}</div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{translateClubCopy(plan.who, isEnglish)}</p>
            </div>
            <div>
              <div className="text-xs font-black tracking-[0.14em] text-slate-400">{text('你将得到', 'What you get')}</div>
              <div className="mt-2 grid gap-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm font-semibold leading-5 text-slate-700">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${accentClass}`} strokeWidth={3} />
                    <span>{translateClubCopy(feature, isEnglish)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-[18px] border border-[#e4e0ff] bg-[#faf9ff] p-4">
            <div className={`text-xs font-black tracking-[0.1em] ${accentClass}`}>{translateClubCopy(plan.outcomeTitle, isEnglish)}</div>
            <p className="mt-2 text-sm font-black leading-6 text-slate-800">{translateClubCopy(plan.outcome, isEnglish)}</p>
          </div>
          <button
            type="button"
            disabled={isCurrentPlan}
            onClick={() => {
              if (!isCurrentPlan) openClubServiceAdvisor(sourceKey, plan.id)
            }}
            className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-black transition-all ${buttonClass}`}
          >
            {buttonLabel}
            {!isCurrentPlan ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
          {plan.note ? <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-400">{translateClubCopy(plan.note, isEnglish)}</p> : null}
        </div>
      </article>
    )
  }

  const MembershipTab = () => (
    <div className="relative min-h-full overflow-hidden rounded-[22px] bg-[#fffdf9] px-3 py-4 sm:rounded-[30px] sm:px-5 sm:py-5">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[#fffdf9]" />
      </div>

      <div className="relative grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">

      <section className="relative mb-5 overflow-hidden rounded-[22px] border border-[#cfc8ff] bg-[linear-gradient(115deg,#f0edff_0%,#fbfbff_52%,#edf6ff_100%)] px-4 py-5 shadow-[0_34px_90px_-58px_rgba(75,73,145,0.38)] sm:mb-5 sm:rounded-[30px] sm:px-8 lg:px-9 lg:py-9">
        <div className="absolute inset-x-0 top-0 z-10 h-2 bg-[linear-gradient(90deg,#5546ed_0%,#8a6ff2_48%,#4f9fc4_100%)]" />
        <div className="pointer-events-none absolute inset-0">
          <img src="/pic_lists/Home_pics/background04.webp" alt="" className="absolute inset-0 h-full w-full scale-[1.03] object-cover object-[72%_54%] opacity-[0.28] saturate-[0.9]" />
          <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(246,244,255,0.82)_0%,rgba(255,255,255,0.76)_54%,rgba(241,248,255,0.8)_100%)]" />
        </div>
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-center">
          <div className="max-w-[820px]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#e5e0ff] bg-white/84 px-3 py-1 text-xs font-black text-[#6f63f6] shadow-sm">
              <Crown className="h-3.5 w-3.5" />
              {isMember ? `${memberIdentityLabel} · ${membershipStatusLabel}` : 'Haigoo Remote Club'}
            </div>
            {isMember ? (
              <h1 className="max-w-[800px] text-[30px] font-black leading-[1.12] tracking-normal text-slate-950 sm:text-[42px] xl:text-[50px]">
                {memberHeroTitle}
              </h1>
            ) : (
              <h1 className="max-w-[800px] text-[30px] font-black leading-[1.12] tracking-normal text-slate-950 sm:text-[42px] xl:text-[47px]">
                {text('打开全球机会，从远程工作开始', 'Global Opportunities, Starting with Remote Work.')}
              </h1>
            )}
            <p className="mt-4 max-w-[680px] text-sm leading-6 text-slate-600 sm:mt-5 sm:text-base sm:leading-7">
              {isMember ? memberHeroSubtitle : text('全站远程岗位信息免费开放。你可以先初步了解远程岗位情况，根据当前阶段，选择适合自己的职业支持或资源共建方案。', 'Basic job information remains open. Choose direction, career support, or resource collaboration for your current stage.')}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-[20px] border border-[#d6d0ff] bg-white/90 p-4 shadow-[0_28px_72px_-52px_rgba(75,73,145,0.42)] backdrop-blur sm:rounded-[24px] sm:p-5">
            <img src="/pic_lists/Jobs_pics/card_bg2.webp" alt="" aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-28 w-40 object-cover object-right-bottom opacity-[0.1]" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f0edff] text-[#6f63f6]">
                <Crown className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                  <div className="text-lg font-black text-slate-950">{isMember ? activeMemberLabel : text('未加入', 'Not a member')}</div>
                <div className="mt-0.5 text-xs font-bold text-slate-400">{text('当前会员状态', 'Membership status')}</div>
              </div>
            </div>
            <div className="relative mt-5 rounded-[20px] border border-[#ebe7ff] bg-white/78 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <div className="text-[11px] font-black tracking-[0.14em] text-slate-400">{isMember ? text('有效期至', 'Valid until') : text('开通方式', 'How to join')}</div>
              <div className="mt-1 text-2xl font-black text-slate-900">{membershipStatusExpireLabel}</div>
              {membershipDaysRemaining !== null ? (
                <div className="mt-1 text-xs font-bold text-[#6f63f6]">{text(`剩余 ${Math.max(membershipDaysRemaining, 0)} 天`, `${Math.max(membershipDaysRemaining, 0)} days remaining`)}</div>
              ) : null}
            </div>
            <div className={`mt-4 grid gap-2 ${isMember ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              <button
                type="button"
                onClick={openMembershipPlanChooser}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-black text-white transition-all hover:-translate-y-0.5 ${memberPrimaryButtonClass}`}
              >
                  {isMember ? text('查看我的权益', 'View my benefits') : text('添加顾问了解', 'Contact an advisor')}
                <ArrowRight className="h-4 w-4" />
              </button>
              {isMember ? (
                <button
                  type="button"
                  onClick={() => setShowCertificateModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#e5e0ff] bg-white px-4 py-2.5 text-sm font-black text-[#6f63f6] transition-all hover:-translate-y-0.5"
                >
                  {text('证书', 'Certificate')}
                  <Download className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

        {!isMember ? (
        <section className="relative mb-5 grid overflow-hidden rounded-[24px] border border-[#dfe8ef] bg-white/88 p-2 shadow-[0_26px_72px_-58px_rgba(64,78,102,0.28)] sm:mb-5 sm:rounded-[28px] sm:p-3 md:grid-cols-2 xl:grid-cols-5">
          {CLUB_VALUE_STRIP.map((item) => {
            const ItemIcon = item.icon
            return (
              <div key={item.title} className="group relative flex min-h-[112px] items-center gap-4 rounded-[20px] px-4 py-4 transition hover:bg-[#fbfdff] xl:after:absolute xl:after:right-0 xl:after:top-5 xl:after:h-16 xl:after:w-px xl:after:bg-[#edf2f6] xl:last:after:hidden">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f3f0ff] text-[#7b74ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <ItemIcon className="h-6 w-6 transition-transform group-hover:scale-110" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900 sm:text-base">{translateClubCopy(item.title, isEnglish)}</div>
                  <div className="mt-1 text-xs font-semibold leading-5 text-slate-500 sm:text-sm">{translateClubCopy(item.desc, isEnglish)}</div>
                </div>
              </div>
            )
          })}
        </section>
        ) : null}

        {!isMember ? (
          <section ref={memberBenefitsRef} id="member-benefits" className={`relative mb-5 scroll-mt-24 overflow-hidden rounded-[28px] border ${memberWorkspaceShellClass} p-5 sm:p-6`}>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{text('我的权益工作台', 'My benefits dashboard')}</h2>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {freeBenefitCards.map((item) => {
                const ItemIcon = item.icon
                const isDisabled = 'disabled' in item && Boolean(item.disabled)
                return (
                  <div key={item.key} className={`relative flex min-h-[210px] flex-col overflow-hidden rounded-[22px] border p-4 ${isDisabled ? 'border-slate-200 bg-slate-50/88 shadow-none' : 'border-[#edf2f6] bg-white/78 shadow-[0_16px_44px_-38px_rgba(64,78,102,0.34)]'}`}>
                    {!isDisabled ? <img src="/pic_lists/Jobs_pics/card_bg2.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="pointer-events-none absolute bottom-0 right-0 h-24 w-36 object-cover object-right-bottom opacity-[0.08]" /> : null}
                    <div className="flex items-start justify-between gap-3">
                      <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isDisabled ? 'bg-slate-100 text-slate-400' : memberCardIconClass}`}>
                        <ItemIcon className="h-5 w-5" />
                      </div>
                      <span className={`relative rounded-full border px-3 py-1 text-xs font-black shadow-sm ${item.status === '不可用' ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-[#e5e0ff] bg-white text-[#6f63f6]'}`}>{translateClubCopy(item.status, isEnglish)}</span>
                    </div>
                    <div className={`mt-4 text-base font-black ${isDisabled ? 'text-slate-500' : 'text-slate-950'}`}>{translateClubCopy(item.title, isEnglish)}</div>
                    <p className={`mt-2 flex-1 text-sm leading-6 ${isDisabled ? 'text-slate-400' : 'text-slate-500'}`}>{translateClubCopy(item.desc, isEnglish)}</p>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleMemberDashboardAction(item)}
                      className={`relative mt-4 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-black transition-all ${isDisabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : `${memberPrimaryButtonClass} text-white hover:-translate-y-0.5`}`}
                    >
                      {translateClubCopy(item.cta, isEnglish)}
                      {!isDisabled ? <ArrowRight className="h-4 w-4" /> : null}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        {isMember ? (
          <section className="relative mb-5 space-y-5 sm:mb-7">
            {isQuarterMember || isTrialWeekMember ? (
              <div className="overflow-hidden rounded-[22px] border border-[#ddd7ff] bg-[#fffdf8] p-4 shadow-[0_18px_52px_-44px_rgba(111,99,246,0.22)] sm:rounded-[26px] sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="inline-flex rounded-full border border-[#e5e0ff] bg-white/86 px-3 py-1 text-xs font-black text-[#6f63f6]">{text('会员方案升级提示', 'Membership update')}</div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                      {isTrialWeekMember
                        ? text('会员权益全新升级，原体验会员将不再开放。如需升级半年/年度会员可联系顾问。', 'Our membership plans have been updated. Contact an advisor to move to a six-month or annual plan.')
                        : text('会员权益全新升级，原季度会员将不再开放。为感谢您的支持，我们已特别赠送职业成长权益，如需升级半年/年度会员可联系顾问。', 'Our membership plans have been updated. Your career-learning access remains active; contact an advisor to upgrade.')}
                    </p>
                  </div>
                  <button
                  type="button"
                  onClick={() => openClubServiceAdvisor(isTrialWeekMember ? 'legacy_trial_upgrade' : 'legacy_quarter_upgrade')}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#6f63f6] px-5 py-3 text-sm font-black text-white shadow-[0_18px_38px_-24px_rgba(95,99,246,0.58)] transition-all hover:-translate-y-0.5"
                >
                  {text('咨询调整方案', 'Discuss plan options')}
                  <ArrowRight className="h-4 w-4" />
                </button>
                </div>
              </div>
            ) : null}

            <section ref={memberBenefitsRef} id="member-benefits" className={`relative scroll-mt-24 overflow-hidden rounded-[28px] border ${memberWorkspaceShellClass} p-5 sm:p-6`}>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{text('我的权益工作台', 'My benefits dashboard')}</h2>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {memberBenefitCards.map((item) => {
                  const ItemIcon = item.icon
                  const isDisabled = 'disabled' in item && Boolean(item.disabled)
                  return (
                    <div key={item.key} className={`relative flex min-h-[210px] flex-col overflow-hidden rounded-[22px] border p-4 ${isDisabled ? 'border-slate-200 bg-slate-50/88 shadow-none' : 'border-[#edf2f6] bg-white/78 shadow-[0_16px_44px_-38px_rgba(64,78,102,0.34)]'}`}>
                      {!isDisabled ? <img src="/pic_lists/Jobs_pics/card_bg2.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="pointer-events-none absolute bottom-0 right-0 h-24 w-36 object-cover object-right-bottom opacity-[0.08]" /> : null}
                      <div className="flex items-start justify-between gap-3">
                        <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isDisabled ? 'bg-slate-100 text-slate-400' : memberCardIconClass}`}>
                          <ItemIcon className="h-5 w-5" />
                        </div>
                        <span className={`relative rounded-full border px-3 py-1 text-xs font-black shadow-sm ${item.status === '不可用' ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-[#e5e0ff] bg-white text-[#6f63f6]'}`}>{translateClubCopy(item.status, isEnglish)}</span>
                      </div>
                      <div className={`mt-4 text-base font-black ${isDisabled ? 'text-slate-500' : 'text-slate-950'}`}>{translateClubCopy(item.title, isEnglish)}</div>
                      <p className={`mt-2 flex-1 text-sm leading-6 ${isDisabled ? 'text-slate-400' : 'text-slate-500'}`}>{translateClubCopy(item.desc, isEnglish)}</p>
                    {'meta' in item && item.meta ? (
                      <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-500 shadow-sm">{item.meta}</div>
                    ) : null}
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleMemberDashboardAction(item)}
                        className={`relative mt-4 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-black transition-all ${isDisabled ? 'cursor-not-allowed bg-slate-100 text-slate-400' : `${memberPrimaryButtonClass} text-white hover:-translate-y-0.5`}`}
                      >
                        {translateClubCopy(item.cta, isEnglish)}
                        {!isDisabled ? <ArrowRight className="h-4 w-4" /> : null}
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[28px] border border-[#e1e8f4] bg-white/92 p-5 shadow-[0_22px_62px_-54px_rgba(64,78,102,0.28)] sm:p-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{text('为你推荐', 'Recommended for you')}</h2>
                </div>
              </div>
              {loadingMemberRecommendations ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-[150px] animate-pulse rounded-[22px] border border-[#edf2f6] bg-white/72" />
                  ))}
                </div>
              ) : memberRecommendedJobs.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {memberRecommendedJobs.map((job) => (
                    <JobCardNew
                      key={job.id}
                      job={job}
                      variant="list"
                      compactFeatured
                      hideMemberBackdrop
                      onClick={openMembershipRecommendedJob}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[170px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#d8d2ff] bg-[#fbfaff] px-5 py-8 text-center">
                  <Briefcase className="h-9 w-9 text-[#6f63f6]" />
                  <div className="mt-3 text-base font-black text-slate-950">{text('暂时没有新的会员岗位推荐', 'No new member job recommendations yet')}</div>
                  <button
                    type="button"
                    onClick={() => navigate('/jobs')}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#6f63f6] px-5 py-2.5 text-sm font-black text-white shadow-[0_14px_30px_-22px_rgba(95,99,246,0.62)] transition hover:-translate-y-0.5 hover:bg-[#5d50df]"
                  >
                    {text('查看全部岗位', 'View all jobs')}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </section>

            <section ref={clubServicePlansRef} id="club-service-plans" className="relative scroll-mt-24 overflow-hidden rounded-[28px] border border-[#e1e8f4] bg-white/90 p-4 shadow-[0_24px_70px_-56px_rgba(64,78,102,0.28)] sm:p-5">
              <img src="/pic_lists/About_pics/about_bg.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="pointer-events-none absolute inset-x-0 top-0 h-44 w-full object-cover object-[58%_36%] opacity-[0.12]" />
              <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{text('下一阶段的服务路径', 'Your next service path')}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{text('根据当前目标选择探索、持续陪伴或长期职业共建。', 'Choose exploration, continued support, or long-term career collaboration.')}</p>
                </div>
              </div>
              <div className="relative grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
                {CLUB_SERVICE_PLANS.map((plan) => renderClubServicePlanCard(plan, 'member_plan_upgrade_card'))}
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[24px] border border-[#e6edf3] bg-white/92 shadow-[0_24px_64px_-54px_rgba(64,78,102,0.24)]">
              <div className="border-b border-[#eef3f7] px-5 py-4">
                <div>
                  <h3 className="text-base font-black text-slate-950">{text('权益明细', 'Benefit details')}</h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[1.45fr_repeat(4,minmax(140px,0.85fr))] border-b border-[#eef3f7] bg-[#fbfdff] px-5 py-3 text-xs font-black text-slate-500">
                    <span>{text('服务权益', 'Benefits')}</span>
                    <span className="text-center">{text('免费用户', 'Free')}</span>
                    <span className="text-center">Club Starter</span>
                    <span className="text-center">Club Member</span>
                    <span className="text-center">Club Partner</span>
                  </div>
                  {visibleClubComparisonRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[1.45fr_repeat(4,minmax(140px,0.85fr))] items-center border-b border-[#eef3f7] px-5 py-3 last:border-b-0">
                      <div className="pr-4 text-sm font-bold leading-6 text-slate-800">{translateClubCopy(row.label, isEnglish)}</div>
                      {(['free', 'starter', 'half_year', 'annual'] as const).map((key) => {
                        const value = row[key]
                        const isUnsupported = value === '不支持'
                        return (
                          <div key={key} className="flex justify-center">
                            {isUnsupported ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-400">
                                <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                                {translateClubCopy(value, isEnglish)}
                              </span>
                            ) : value ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f1ff] px-2.5 py-1 text-xs font-black text-[#6f63f6]">
                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                {translateClubCopy(value, isEnglish)}
                              </span>
                            ) : (
                              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-black text-slate-300">-</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="hidden">
              <div className="pointer-events-none absolute inset-0">
                <img src="/pic_lists/About_pics/background03.webp" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-bottom opacity-[0.18] saturate-[0.78]" />
                <div className="absolute inset-0 bg-white/92" />
                <div className="absolute inset-x-0 top-0 h-24 bg-white/86" />
              </div>
              <div className="relative">
                <h2 className="max-w-4xl text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{text('Club Partner 的长期价值', 'Club Partner: long-term career collaboration')}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  {text('适合希望长期沉淀远程职业资源，并在入职后继续申请共建、发布和品牌传播支持的用户。', 'For people building long-term remote-career resources who may apply for collaboration, job-posting, and employer-brand support after joining a company.')}
                </p>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {[
                    { title: text('可申请成为共建伙伴', 'Apply as a community partner'), desc: text('会员期内成功入职远程企业后，可申请参与 Haigoo 远程人才网络共建。', 'After joining a remote company during your membership, you may apply to help build the Haigoo remote talent network.'), icon: Users },
                    { title: text('企业招聘与传播支持', 'Employer hiring and brand support'), desc: text('可按规则申请岗位发布与雇主品牌传播支持。', 'Apply for job-posting and employer-brand support according to the program rules.'), icon: Briefcase },
                    { title: text('长期规划与闭门交流', 'Long-term planning and private events'), desc: text('获得远程求职规划支持，并优先参与会员闭门交流。', 'Receive remote career planning and priority access to private member events.'), icon: ShieldCheck }
                  ].map((item) => {
                    const ItemIcon = item.icon
                    return (
                      <div key={item.title} className="rounded-[20px] border border-[#e6edf3] bg-white/86 p-4 shadow-[0_16px_42px_-36px_rgba(64,78,102,0.22)]">
                        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#f0edff] text-[#6f63f6]">
                          <ItemIcon className="h-5 w-5" />
                        </div>
                        <div className="text-base font-black text-slate-950">{item.title}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{item.desc}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            <section className="relative overflow-hidden rounded-[24px] border border-[#e6edf3] bg-white/92 p-5 shadow-[0_24px_64px_-54px_rgba(64,78,102,0.24)] sm:p-6">
              <div className="mb-4">
                <h3 className="text-lg font-black text-slate-950">{text('会员 QA', 'Membership FAQ')}</h3>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {CLUB_MEMBERSHIP_FAQS.map((item) => (
                  <div key={item.question} className="rounded-[18px] border border-[#edf2f6] bg-[#fbfdff] p-4">
                    <div className="text-sm font-black leading-6 text-slate-900">{translateClubCopy(item.question, isEnglish)}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{translateClubCopy(item.answer, isEnglish)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid items-stretch gap-4 xl:grid-cols-[1fr_340px]">
              <div className="relative flex min-h-[236px] overflow-hidden rounded-[26px] border border-[#e6d7b9] bg-[#fffdf8] p-5 shadow-[0_24px_66px_-52px_rgba(139,101,54,0.32)]">
                <div className="pointer-events-none absolute inset-0">
                  <img src="/pic_lists/About_pics/thanks_bg.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-y-0 right-0 h-full w-1/2 object-cover object-right-bottom opacity-[0.12]" />
                  <div className="absolute inset-0 bg-[#fffdf8]/84" />
                </div>
                <div className="relative grid w-full gap-5 lg:grid-cols-[180px_1fr] lg:items-center">
                  <h3 className="text-2xl font-black text-slate-950">{text('我们的服务承诺', 'Our promise')}</h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { title: text('信息安全', 'Private by design'), desc: text('简历与个人信息仅用于岗位匹配和服务支持。', 'Your data is used only for matching and support.'), icon: ShieldCheck },
                      { title: text('持续更新', 'Always current'), desc: text('持续筛选远程岗位、企业资料和职业成长内容。', 'Fresh jobs, company insight, and learning content.'), icon: Sparkles },
                      { title: text('透明可靠', 'Clear scope'), desc: text('明确展示服务边界，不过度承诺录用结果。', 'Clear service boundaries and no hiring promises.'), icon: CheckCircle }
                    ].map((item) => {
                      const ItemIcon = item.icon
                      return (
                        <div key={item.title} className="flex min-h-[138px] flex-col justify-center rounded-[18px] border border-[#edf2f6] bg-white/88 p-4 shadow-[0_16px_42px_-36px_rgba(64,78,102,0.22)]">
                          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f4f1ff] text-[#6f63f6]">
                            <ItemIcon className="h-4 w-4" />
                          </div>
                          <div className="font-black text-slate-900">{item.title}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{item.desc}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="relative flex min-h-[236px] overflow-hidden rounded-[26px] border border-[#dfe8ef] bg-white p-5 shadow-[0_20px_56px_-44px_rgba(64,78,102,0.22)]">
                <img src="/pic_lists/Jobs_pics/card_bg2.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="pointer-events-none absolute bottom-0 right-0 h-28 w-44 object-cover object-right-bottom opacity-[0.1]" />
                <div className="relative flex w-full flex-col gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">{text('需要帮助？', 'Need help?')}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">
                      {text('无论是权益使用、服务安排还是账户问题，都可以通过微信或邮件联系我们。', 'For benefit use, service arrangements, or account questions, contact us via WeChat or email.')}
                    </p>
                  </div>
                  <div className="mt-auto flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => openClubServiceAdvisor('member_dashboard_support', undefined, MEMBER_SUPPORT_ADVISOR_COPY)}
                      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-black text-white transition-all hover:-translate-y-0.5 ${memberPrimaryButtonClass}`}
                    >
                      {text('联系海狗小助手', 'Contact the Haigoo assistant')}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <a href="mailto:hi@haigooremote.com" className="inline-flex items-center justify-center gap-2 text-sm font-black text-[#6f63f6] no-underline hover:no-underline">
                      {text('或试试 邮件联系', 'Contact by email')}
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </section>
          </section>
        ) : null}

        {!isMember ? (
        <>
        <section ref={clubServicePlansRef} id="club-service-plans" className="relative mb-5 scroll-mt-24 overflow-hidden rounded-[28px] border border-[#e1e8f4] bg-white/90 p-4 shadow-[0_24px_70px_-56px_rgba(64,78,102,0.28)] sm:mb-5 sm:p-5">
          <img src="/pic_lists/About_pics/about_bg.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="pointer-events-none absolute inset-x-0 top-0 h-44 w-full object-cover object-[58%_36%] opacity-[0.12]" />
          <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-950">{text('选择适合你的方案', 'Choose support for your current stage')}</h2>
            </div>
          </div>
          <div className="relative mb-5 rounded-[20px] border border-[#e6edf3] bg-white/78 p-3 sm:p-4">
            <div className="text-sm font-black text-slate-950">{text('你现在处在哪个阶段？', 'Where are you now?')}</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                { id: 'starter' as const, label: text('远程小白', 'Beginner'), desc: text('先完成第一轮有效申请', 'Start with a first effective application') },
                { id: 'half_year' as const, label: text('已有经验', 'Experienced'), desc: text('持续推进申请和复盘', 'Keep applying and reviewing') },
                { id: 'annual' as const, label: text('长期 / 终身远程', 'Long-term remote'), desc: text('沉淀职业资源与连接', 'Build career resources and connections') }
              ].map((stage) => {
                const isSelected = selectedCareerStage === stage.id
                return (
                  <button
                    key={stage.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedCareerStage(stage.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${isSelected ? 'border-[#b9afff] bg-[#f4f1ff] shadow-sm' : 'border-[#edf2f6] bg-white hover:border-[#d8d2ff]'}`}
                  >
                    <div className="text-sm font-black text-slate-900">{stage.label}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">{stage.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="relative grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
            {CLUB_SERVICE_PLANS.map((plan) => renderClubServicePlanCard(plan, 'club_service_plan_card'))}
          </div>
        </section>

        <section className="hidden">
          {[
            {
              title: text('Haigoo 提供什么', 'What Haigoo provides'),
              description: text('真实岗位信息、方向判断、申请准备、职业成长内容和必要的人工支持。', 'Real job information, direction assessment, application preparation, career content, and necessary human support.'),
              icon: CheckCircle,
              tone: 'border-[#dfe9ff] bg-[#f7f9ff] text-[#5f63d7]'
            },
            {
              title: text('Haigoo 不承诺什么', 'What Haigoo does not promise'),
              description: text('不承诺录用结果，不代替投递和面试，也不会过度包装申请远超当前能力的岗位。', 'We do not promise an offer, apply or interview on your behalf, or over-package someone into roles clearly beyond their current ability.'),
              icon: ShieldCheck,
              tone: 'border-[#eee4d5] bg-[#fffaf2] text-[#9a6a2d]'
            }
          ].map((item) => {
            const ItemIcon = item.icon
            return (
              <div key={item.title} className={`rounded-[22px] border p-5 shadow-[0_18px_46px_-40px_rgba(64,78,102,0.25)] ${item.tone}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/78 shadow-sm">
                    <ItemIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-950">{item.title}</h2>
                    <p className="mt-1.5 text-sm font-semibold leading-6 text-slate-600">{item.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </section>

        <section className="hidden">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950 sm:text-2xl">{text('服务如何推进', 'How the service moves forward')}</h2>
            </div>
          </div>
          <ol className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { title: text('提交背景', 'Share your background'), desc: text('说明经历、目标与当前卡点。', 'Your experience, goal, and current blocker.') },
              { title: text('获得判断', 'Get an assessment'), desc: text('明确方向、材料重点与优先级。', 'Direction, material priorities, and focus.') },
              { title: text('开始申请', 'Start applying'), desc: text('带着岗位建议与行动清单行动。', 'Move with role suggestions and a plan.') },
              { title: text('持续推进', 'Keep progressing'), desc: text('在支持与更新中复盘、调整。', 'Review and adjust with ongoing support.') }
            ].map((item, index) => (
              <li key={item.title} className="relative rounded-[20px] border border-[#edf2f6] bg-[#fbfdff] p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0edff] text-sm font-black text-[#6f63f6]">{index + 1}</span>
                <div className="mt-4 text-base font-black text-slate-950">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="hidden">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(240,237,255,0.8),rgba(255,255,255,0.35))]" />
          <div className="relative grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <h2 className="mt-3 text-xl font-black text-slate-950 sm:text-2xl">{text('你可以收获的是什么', 'What you receive is more than access')}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text('以下为一次远程求职启动支持的示例结构，具体内容会根据个人背景调整。', 'A sample structure for remote job-search support, tailored to each background.')}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['背景判断', '当前经历可优先转化为哪些远程价值'],
                ['推荐岗位', '更适合先投递的岗位方向与原因'],
                ['简历建议', '建议修改的表达与内容'],
                ['准备材料', '下一步该补的案例、作品或学习材料'],
                ['网站权限', '开通网站所有功能、内容&信息权限'],
                ['定制方案（6个月以上会员）', '根据个人背景制定的远程岗位、求职资料、资源等'],

              ].map(([title, detail]) => (
                <div key={title} className="rounded-[18px] border border-white/80 bg-white/88 p-4 shadow-[0_14px_38px_-34px_rgba(64,78,102,0.28)]">
                  <div className="text-sm font-black text-slate-950">{text(title, title)}</div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{text(detail, detail)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="hidden">
          <div className="pointer-events-none absolute inset-0">
            <img src="/pic_lists/About_pics/background03.webp" alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover object-bottom opacity-[0.18] saturate-[0.78]" />
            <div className="absolute inset-0 bg-white/92" />
            <div className="absolute inset-x-0 top-0 h-24 bg-white/86" />
          </div>
          <div className="relative">
            <h2 className="max-w-4xl text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{text('职业共建（年度方案）能延展什么', 'Partner value beyond the job search')}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              {text('如果你未来入职远程企业，Haigoo 可以成为你的外部人才与传播协作渠道。', 'Keep access to Haigoo’s network, publishing, and collaboration support after you land a remote role.')}
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                { title: text('可申请成为共建伙伴', 'Community partner'), desc: text('会员期内成功入职远程企业后，可申请参与 Haigoo 远程人才网络共建。', 'Apply to join Haigoo’s remote talent network.'), icon: Users },
                { title: text('企业招聘与传播支持', 'Employer support'), desc: text('年度会员可申请岗位发布与雇主品牌传播支持，每季度1次免费发布/宣传。', 'Use one job-posting or brand-support credit each quarter.'), icon: Briefcase },
                { title: text('可持续远程生态', 'Long-term network'), desc: text('Haigoo Remote Club 会持续邀请远程相关的企业、品牌和会员伙伴，共建良型远程生态。', 'Connect with remote companies, brands, and Club members.'), icon: ShieldCheck }
              ].map((item) => {
                const ItemIcon = item.icon
                return (
                  <div key={item.title} className="rounded-[20px] border border-[#e6edf3] bg-white/86 p-4 shadow-[0_16px_42px_-36px_rgba(64,78,102,0.22)]">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#f0edff] text-[#6f63f6]">
                      <ItemIcon className="h-5 w-5" />
                    </div>
                    <div className="text-base font-black text-slate-950">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="relative mb-5 overflow-hidden rounded-[24px] border border-[#e6edf3] bg-white/92 shadow-[0_24px_64px_-54px_rgba(64,78,102,0.24)]">
          <div className="border-b border-[#eef3f7] px-5 py-4">
            <div>
              <h3 className="text-base font-black text-slate-950">{text('权益明细', 'Benefit details')}</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[1.45fr_repeat(4,minmax(140px,0.85fr))] border-b border-[#eef3f7] bg-[#fbfdff] px-5 py-3 text-xs font-black text-slate-500">
                <span>{text('服务权益', 'Benefits')}</span>
                <span className="text-center">{text('免费用户', 'Free')}</span>
                <span className="text-center">Club Starter</span>
                <span className="text-center">Club Member</span>
                <span className="text-center">Club Partner</span>
              </div>
              {visibleClubComparisonRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[1.45fr_repeat(4,minmax(140px,0.85fr))] items-center border-b border-[#eef3f7] px-5 py-3 last:border-b-0">
                  <div className="pr-4 text-sm font-bold leading-6 text-slate-800">{translateClubCopy(row.label, isEnglish)}</div>
                      {(['free', 'starter', 'half_year', 'annual'] as const).map((key) => {
                    const value = row[key]
                    const isUnsupported = value === '不支持'
                    return (
                      <div key={key} className="flex justify-center">
                        {isUnsupported ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-400">
                            <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                            {translateClubCopy(value, isEnglish)}
                          </span>
                        ) : value ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f1ff] px-2.5 py-1 text-xs font-black text-[#6f63f6]">
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            {translateClubCopy(value, isEnglish)}
                          </span>
                        ) : (
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-black text-slate-300">-</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative mb-5 overflow-hidden rounded-[24px] border border-[#e6edf3] bg-white/92 p-5 shadow-[0_24px_64px_-54px_rgba(64,78,102,0.24)] sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-black text-slate-950">{text('会员 QA', 'Club FAQ')}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{text('关于开通方式、服务边界和退款规则的常见问题。', 'Short answers about plans, support, and refunds.')}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {CLUB_MEMBERSHIP_FAQS.map((item) => (
              <div key={item.question} className="rounded-[18px] border border-[#edf2f6] bg-[#fbfdff] p-4">
                <div className="text-sm font-black leading-6 text-slate-900">{translateClubCopy(item.question, isEnglish)}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{translateClubCopy(item.answer, isEnglish)}</p>
              </div>
            ))}
          </div>
        </section>

      <section className="relative mt-5 grid items-stretch gap-4 xl:grid-cols-[1fr_340px]">
        <div className="relative flex min-h-[260px] overflow-hidden rounded-[26px] border border-[#e6d7b9] bg-[#fffdf8] p-5 shadow-[0_24px_66px_-52px_rgba(139,101,54,0.32)]">
          <div className="pointer-events-none absolute inset-0">
            <img src="/pic_lists/About_pics/thanks_bg.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-y-0 right-0 h-full w-1/2 object-cover object-right-bottom opacity-[0.12]" />
            <div className="absolute inset-0 bg-[#fffdf8]/84" />
          </div>
          <div className="relative grid w-full gap-5 lg:grid-cols-[240px_1fr] lg:items-center">
              <div className="self-center">
                  <h3 className="text-2xl font-black text-slate-950">{text('我们的服务承诺', 'Our promise')}</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { title: text('信息安全', 'Private by design'), desc: text('简历与个人信息仅用于岗位匹配和会员服务支持。', 'Your data is used only for matching and support.'), icon: ShieldCheck },
                    { title: text('持续更新', 'Always current'), desc: text('持续筛选远程岗位、企业资料和职业成长内容。', 'Fresh jobs, company insight, and learning content.'), icon: Sparkles },
                    { title: text('透明可靠', 'Clear scope'), desc: text('明确展示服务边界，不过度或虚假承诺录用结果。', 'Clear service boundaries and no hiring promises.'), icon: CheckCircle }
                  ].map((item) => {
                  const ItemIcon = item.icon
                  return (
                  <div key={item.title} className="flex min-h-[150px] flex-col justify-center rounded-[18px] border border-[#edf2f6] bg-white/88 p-4 shadow-[0_16px_42px_-36px_rgba(64,78,102,0.22)]">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f4f1ff] text-[#6f63f6]">
                      <ItemIcon className="h-4 w-4" />
                    </div>
                    <div className="font-black text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{item.desc}</div>
                  </div>
                )})}
          </div>
        </div>
        </div>
        <div className="relative flex min-h-[260px] overflow-hidden rounded-[26px] border border-[#dfe8ef] bg-white p-5 shadow-[0_20px_56px_-44px_rgba(64,78,102,0.22)]">
          <img src="/pic_lists/Jobs_pics/card_bg2.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" className="pointer-events-none absolute bottom-0 right-0 h-28 w-44 object-cover object-right-bottom opacity-[0.1]" />
          <div className="relative flex w-full flex-col gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-black text-slate-950">{text('需要帮助？', 'Need help?')}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                {text('无论是权益使用、服务安排还是账户问题，都可以通过微信或邮件联系我们。', 'For benefit use, service arrangements, or account questions, contact us via WeChat or email.')}
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <div className="mx-auto w-full max-w-[128px] rounded-[18px] border border-[#f3e7c8] bg-white/92 p-2 text-center shadow-sm">
                <img
                  src="/series_assistant.png"
                  alt={text('微信咨询二维码', 'WeChat consultation QR code')}
                  loading="lazy"
                  decoding="async"
                  className="mx-auto h-24 w-24 object-contain"
                />
                <div className="mt-1 text-[11px] font-black text-slate-600">{text('微信咨询', 'WeChat')}</div>
              </div>
              <a
                href="mailto:hi@haigooremote.com"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6f63f6] px-4 py-2.5 text-sm font-black text-white no-underline shadow-[0_16px_34px_-24px_rgba(111,99,246,0.65)] transition-all hover:-translate-y-0.5 hover:no-underline"
              >
                {text('或试试 邮件联系', 'Contact by email')}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>
        </>
        ) : null}
      </div>

      <aside className="hidden">
        {!isMember ? (
          <>
            <section className="sticky top-0 space-y-5">
              <div className="overflow-hidden rounded-[28px] border border-[#dfe8ef] bg-white/88 p-5 shadow-[0_24px_70px_-58px_rgba(64,78,102,0.32)]">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-slate-950">{text('年度会员的长期价值', 'Partner value')}</h3>
                  <button
                    type="button"
                    onClick={() => openClubServiceAdvisor('club_value_rail', 'annual')}
                    className="inline-flex items-center gap-1 text-xs font-black text-[#6f63f6] transition hover:text-[#5148d8]"
                  >
                    {text('了解更多', 'Learn more')}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-4">
                  {[
                    { title: text('可申请成为共建伙伴', 'Community partner'), desc: text('会员期内成功入职远程企业后，可申请参与 Haigoo 远程人才网络共建。', 'Apply to join Haigoo’s remote talent network.'), icon: Users },
                    { title: text('带着资源进入企业', 'Employer support'), desc: text('年度会员可申请岗位发布与雇主品牌传播支持，每季度1次免费发布/宣传。', 'Use one job-posting or brand-support credit each quarter.'), icon: Briefcase },
                    { title: text('直接发布，边界清晰', 'Clear collaboration'), desc: text('岗位和企业内容需经 Haigoo 审核后发布，共建伙伴不代表雇佣、代理或合伙关系。', 'Haigoo reviews all published content and keeps partnership boundaries clear.'), icon: ShieldCheck }
                  ].map((item) => {
                    const ItemIcon = item.icon
                    return (
                      <div key={item.title} className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4f1ff] text-[#6f63f6]">
                          <ItemIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-black text-slate-900">{item.title}</div>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-[#dfe8ef] bg-white p-5 shadow-[0_20px_56px_-44px_rgba(64,78,102,0.22)]">
                <h3 className="text-lg font-black text-slate-950">{text('我们的服务承诺', 'Our promise')}</h3>
                <div className="mt-4 space-y-4">
                  {[
                    { title: text('信息安全', 'Private by design'), desc: text('简历与个人信息仅用于岗位匹配和会员服务支持。', 'Your data is used only for matching and support.'), icon: ShieldCheck },
                    { title: text('持续更新', 'Always current'), desc: text('持续筛选远程岗位、企业资料和职业成长内容。', 'Fresh jobs, company insight, and learning content.'), icon: Sparkles },
                    { title: text('透明可靠', 'Clear scope'), desc: text('明确展示服务边界，不过度或虚假承诺录用结果。', 'Clear service boundaries and no hiring promises.'), icon: CheckCircle }
                  ].map((item) => {
                    const ItemIcon = item.icon
                    return (
                      <div key={item.title} className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4f1ff] text-[#6f63f6]">
                          <ItemIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-900">{item.title}</div>
                          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[28px] border border-[#e4dfff] bg-[#fffdf8] p-5 shadow-[0_20px_56px_-44px_rgba(111,99,246,0.28)]">
                <img src="/pic_lists/Jobs_pics/card_bg2.webp" alt="" aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-28 w-40 object-cover object-right-bottom opacity-[0.1]" />
                <h3 className="relative text-lg font-black text-slate-950">{text('需要帮助？', 'Need help?')}</h3>
                <p className="relative mt-2 text-sm leading-6 text-slate-500">
                  {text('无论是权益使用、服务安排还是账户问题，都可以通过微信或邮件联系我们。', 'For benefit use, service arrangements, or account questions, contact us via WeChat or email.')}
                </p>
                <button
                  type="button"
                  onClick={() => openClubServiceAdvisor('club_help_rail')}
                  className="relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#6f63f6] px-5 py-3 text-sm font-black text-white shadow-[0_18px_38px_-24px_rgba(95,99,246,0.58)] transition-all hover:-translate-y-0.5"
                >
                  {text('添加顾问了解', 'Contact an advisor')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className="sticky top-0 space-y-5">
            <div className="overflow-hidden rounded-[28px] border border-[#e1e8f4] bg-white/90 p-5 shadow-[0_24px_70px_-58px_rgba(64,78,102,0.28)]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f0edff] text-[#6f63f6]">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-950">{text('快速入口', 'Quick access')}</h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{memberIdentityLabel} · {membershipStatusLabel}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {memberBenefitCards.slice(0, 4).map((item) => {
                  const ItemIcon = item.icon
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        if ('action' in item && item.action === 'jobs') {
                          navigate('/jobs')
                          return
                        }
                        if ('action' in item && item.action === 'resume') {
                          navigate('/profile?tab=resume')
                          return
                        }
                        if ('action' in item && item.action === 'english') {
                          navigate('/careerlearning')
                          return
                        }
                        openClubServiceAdvisor(`member_quick_rail_${item.key}`, undefined, 'advisorCopy' in item ? item.advisorCopy : MEMBER_BENEFIT_ADVISOR_COPY)
                      }}
                      className="flex w-full items-center gap-3 rounded-[18px] border border-white/80 bg-white/78 px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${memberCardIconClass}`}>
                        <ItemIcon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-slate-900">{translateClubCopy(item.title, isEnglish)}</span>
                        <span className="mt-0.5 block text-xs font-bold text-[#6f63f6]">{translateClubCopy(item.status, isEnglish)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-[#dfe8ef] bg-white/88 p-5 shadow-[0_20px_56px_-44px_rgba(64,78,102,0.22)]">
              <h3 className="text-lg font-black text-slate-950">{shouldShowRenewalPlans ? text('续费 / 升级咨询', 'Renewal / upgrade') : text('服务支持', 'Member support')}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {shouldShowRenewalPlans ? text('你的权益即将到期，可联系顾问了解续费或升级方案。', 'Your membership is ending soon. Contact an advisor to renew or upgrade.') : text('需要预约咨询、提交共建伙伴申请或确认权益状态，可以联系顾问处理。', 'Contact an advisor to book a consultation, submit a partner application, or confirm a benefit.')}
              </p>
              <button
                type="button"
                onClick={() => openClubServiceAdvisor('member_support_rail', undefined, MEMBER_SUPPORT_ADVISOR_COPY)}
                className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white transition-all hover:-translate-y-0.5 ${memberPrimaryButtonClass}`}
              >
                {text('添加顾问咨询', 'Contact an advisor')}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-[#dfe8ef] bg-white p-5 shadow-[0_20px_56px_-44px_rgba(64,78,102,0.22)]">
              <h3 className="text-lg font-black text-slate-950">{text('我们的服务承诺', 'Our service promise')}</h3>
              <div className="mt-4 space-y-4">
                {[
                    { title: text('信息安全', 'Data privacy'), desc: text('简历与个人信息仅用于岗位匹配和会员服务支持。', 'Your resume and personal data are used only for matching and member support.'), icon: ShieldCheck },
                    { title: text('持续更新', 'Fresh resources'), desc: text('持续筛选远程岗位、企业资料和职业成长内容。', 'We continually curate remote roles, company insights, and career content.'), icon: Sparkles },
                    { title: text('透明可靠', 'Clear expectations'), desc: text('明确展示服务边界，不过度或虚假承诺录用结果。', 'We state service boundaries clearly and never promise hiring outcomes.'), icon: CheckCircle }
                ].map((item) => {
                  const ItemIcon = item.icon
                  return (
                    <div key={item.title} className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f4f1ff] text-[#6f63f6]">
                        <ItemIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">{item.title}</div>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}
      </aside>
      </div>
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
    '从 2025 年下半年开始，我一边人工筛选和审核岗位，一边借助 AI 工具搭建数据链路，把全球远程机会收集起来，再整理成更适合中国用户理解、判断和申请的信息。与此同时，我也在逐步搭建社群私域网站、运营社区、连接用户和远程机会。',
    '**很感谢早期在这个过程中给予我帮助的朋友们，有些人参与了社群创建，有些人参与了产品设计，有些人参与了项目落地，有些人提供了宝贵的经验 @张小刀 @Priscilla @Jason @吴槿彦 @Suzy @Kia @Ada Xu @David**',
    '我们在一点点打磨，很多地方或许还不够成熟，但好在它已经让一些人看到了新的可能性，甚至获得了 offer。',
    '慢慢的，我逐渐发现，Haigoo 想做的，原来不只是一个找远程工作的社群。',
    '当我不断接触全球范围里那些 remote-first 的公司，我越来越被他们的工作方式和企业文化打动。**那些更尊重个体，更追求价值和结果创造，更看重工作与生活平衡的企业文化点亮了我，让我相信追求效率和增长，可以不必以牺牲人的生活和幸福感为代价。**',
    '工作可以很专业，也可以更灵活。公司可以跑得很快，也可以让人活得更舒展。',
    '这些让我相信，远程工作不只是打破地域限制。它代表一种新的协作方式，也是一种更值得被认真对待的生活选择。',
    '在当前阶段，Haigoo 最重要的事，是**帮助更多中国职场人，在不离开家的情况下，也能触达真实、可靠、优质的全球远程机会。**从资源连接、语言准备、企业文化到远程协作技能，我们都将逐步攻破，让你可以安心地待在自己喜欢的地方。',
    '在更长远的未来，我们希望能够用商业和企业运作的方式推动国内更灵活自由的工作方式繁荣发展，提升人们事业和生活的幸福感。这是我们正在规划的方向。',
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
              <h1 className="leading-none" aria-label="创始人的一封信">
                <span className="sr-only">创始人的一封信</span>
                <img
                  src="/pic_lists/Handwriting/hand-founder-letter.webp"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-auto w-[250px] max-w-full sm:w-[310px]"
                />
              </h1>
              <p className="mt-3 text-base font-bold leading-7 text-slate-600">来自 Haigoo Remote 的初心与坚持</p>
              <div className="mt-7" aria-label="Hi，朋友们：">
                <span className="sr-only">Hi，朋友们：</span>
                <img
                  src="/pic_lists/Handwriting/hand-hi-friends.webp"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-auto w-[190px] max-w-full"
                />
              </div>
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-4">
              <div className="max-w-[900px] space-y-5 text-[15px] leading-8 text-slate-600">
                {founderLetterParagraphs.map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 16)}`}>{renderFounderParagraph(paragraph)}</p>
                ))}
              </div>
            </div>

            <div className="mt-5 shrink-0 border-t border-dashed border-[#eadfcf] pt-5">
              <p className="flex items-center gap-3" aria-label="Good Day, Now and Future!">
                <img src="/pic_lists/Home_pics/grass_icon2-transparent.webp" alt="" className="h-9 w-9 object-contain opacity-70" />
                <span className="sr-only">Good Day, Now and Future!</span>
                <img
                  src="/pic_lists/Handwriting/hand-good-day.webp"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-auto w-[280px] max-w-full"
                />
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
                    <span aria-label="Caitlin Y.">
                      <span className="sr-only">Caitlin Y.</span>
                      <img
                        src="/pic_lists/Handwriting/hand-caitlin-y.webp"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="inline-block h-auto w-[120px] align-middle"
                      />
                    </span>
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
    <div className="relative mt-16 min-h-[calc(100vh-64px)] overflow-visible bg-[#fffdf9] font-haigoo-rounded lg:h-[calc(100vh-64px)] lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <img
          src="/pic_lists/About_pics/about_bg.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[58%_38%] opacity-[0.18] blur-[0.25px] saturate-[0.95]"
        />
        <div className="absolute inset-0 bg-[#fffdf9]/78" />
        <div className="absolute inset-x-0 top-0 h-[360px] bg-white/36" />
      </div>
      <div className="relative mx-auto min-h-full max-w-[1600px] px-2 py-3 sm:px-3 lg:h-full lg:px-4 lg:py-4">
        <div className="flex min-h-full flex-col gap-4 lg:h-full lg:flex-row lg:gap-5 lg:overflow-hidden">
          <nav className="lg:hidden" role="tablist" aria-label={text('Club 权益移动端目录', 'Club mobile navigation')}>
            <div className="flex gap-2 overflow-x-auto rounded-[22px] border border-[#e1e9f1] bg-white/86 p-2 shadow-[0_18px_48px_-42px_rgba(61,89,120,0.52)]">
              {[
                { id: 'resume', label: text('首页', 'Home'), icon: Home },
                { id: 'membership', label: text('Club 权益', 'Club benefits'), icon: Crown },
                { id: 'about', label: text('关于我们', 'About'), icon: Building2 },
                { id: 'favorites', label: text('收藏', 'Saved'), icon: Heart },
                { id: 'applications', label: text('申请', 'Applications'), icon: Briefcase },
                { id: 'feedback', label: text('反馈', 'Feedback'), icon: MessageSquare }
              ].map((item) => (
                <button
                  key={item.id}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-black transition-all ${
                    tab === item.id
                      ? 'bg-[#f0edff] text-[#6f63f6] shadow-sm'
                      : 'text-slate-500 hover:bg-[#f7fbff] hover:text-slate-900'
                  }`}
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => switchTab(item.id as TabKey)}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </nav>
          {/* Sidebar */}
          <aside className={`relative hidden flex-shrink-0 transition-all duration-300 ease-in-out lg:block ${isSidebarCollapsed ? 'w-full lg:w-[96px]' : 'w-full lg:w-[248px]'} lg:h-full`}>
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="absolute -right-3 top-5 z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-transform hover:scale-110 hover:text-indigo-600 lg:flex"
              >
                {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>

              {!isSidebarCollapsed ? (
                <div className="overflow-hidden rounded-[28px] border border-[#e1e9f1] bg-white/82 text-slate-900 shadow-[0_24px_70px_-58px_rgba(61,89,120,0.62)] backdrop-blur">
                  <div className="relative overflow-hidden border-b border-[#edf2f6] bg-white/92 px-4 py-3.5">
                    <div className="relative">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-black text-slate-950">{text('Haigoo Remote Club 权益', 'Haigoo Remote Club benefits')}</div>
                        {isMember ? <Crown className="h-4 w-4 shrink-0 text-[#6f63f6]" /> : null}
                      </div>
                      {isMember ? <div className="mt-0.5 text-xs text-slate-500">{text('权益与账号管理', 'Benefits and account')}</div> : null}
                    </div>
                  </div>

                  <div className="space-y-4 px-4 py-3.5">
                    {isMember ? (
                      <>
                        <div className="relative overflow-hidden rounded-[22px] border border-[#e1e8f4] bg-white/82 p-3.5 shadow-[0_18px_44px_-38px_rgba(64,78,102,0.3)]">
                          <img src="/pic_lists/Jobs_pics/card_bg2.webp" alt="" aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-24 w-36 object-cover object-right-bottom opacity-[0.08]" />
                          <div className="relative flex items-center gap-2">
                            <div className="min-w-0">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <div className="max-w-full truncate text-[15px] font-black leading-tight text-slate-950">{memberVisual.shortName}</div>
                                <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e5e0ff] bg-[#f4f1ff] px-2 py-0.5 text-[10px] font-black text-[#6f63f6]">
                                <CheckCircle className="h-3 w-3" />
                                {text('生效中', 'Active')}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="relative mt-3 rounded-[16px] border border-[#ebe7ff] bg-white/80 px-3 py-2.5">
                            <div className="text-[10px] font-black tracking-[0.12em] text-slate-400">{text('有效期至', 'Valid until')}</div>
                            <div className="mt-1 text-[17px] font-black leading-tight text-slate-900">{membershipStatusExpireLabel}</div>
                            {membershipDaysRemaining !== null ? (
                              <div className="mt-1 text-[11px] font-bold text-[#6f63f6]">{text(`剩余 ${Math.max(membershipDaysRemaining, 0)} 天`, `${Math.max(membershipDaysRemaining, 0)} days remaining`)}</div>
                            ) : null}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-[#edf2f6] bg-white/78 px-3.5 py-3 shadow-sm">
                        <div className="text-base font-black text-slate-950">{text('添加顾问了解', 'Contact an advisor')}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-500">
                          {text('解锁全部岗位申请、联系人信息和职业成长权益。', 'Unlock all application paths, contact details, and career learning benefits.')}
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
                      className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-[#e5e0ff] bg-[#f0edff] text-[#6f63f6] shadow-sm transition-all hover:-translate-y-0.5"
                      title="Club 权益"
                    >
                      <Crown className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-[28px] border border-[#e1e9f1] bg-white/82 p-3 shadow-[0_18px_55px_-48px_rgba(61,89,120,0.58)] backdrop-blur">
                <div className={`mb-3 px-2 text-xs font-bold tracking-[0.16em] text-slate-400 ${isSidebarCollapsed ? 'text-center px-0' : ''}`}>
                  {isSidebarCollapsed ? 'MENU' : text('Club 权益', 'Club benefits')}
                </div>
                <nav className="space-y-1" role="tablist">
                {[
                  // { id: 'custom-plan', label: '定制方案', icon: Sparkles, badge: 'AI' },
                  { id: 'resume', label: text('首页', 'Home'), icon: Home },
                  { id: 'membership', label: text('Club 权益', 'Club benefits'), icon: Crown },
                  { id: 'about', label: text('关于我们', 'About us'), icon: Building2 },
                  { id: 'favorites', label: text('我的收藏', 'Saved items'), icon: Heart },
                  { id: 'applications', label: text('我的申请', 'My applications'), icon: Briefcase },
                  { id: 'feedback', label: text('我要反馈', 'Feedback'), icon: MessageSquare },
                  { id: 'settings', label: text('注销账号', 'Delete account'), icon: Settings }
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
                          <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#6f63f6] rounded-md shadow-sm">
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
            <div className="pb-10 transition-all duration-300 lg:min-h-full lg:pr-1">
              {tab === 'resume' && (
                <>
                  <section className="relative mb-4 overflow-hidden rounded-[22px] border border-[#eadfcf] bg-[#fffdf8] p-5 shadow-[0_20px_56px_-48px_rgba(139,101,54,0.42)] lg:hidden">
                    <div className="pointer-events-none absolute inset-0">
                      <img src="/pic_lists/Home_pics/background04.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[68%_58%] opacity-45" />
                      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,253,248,0.98)_0%,rgba(255,253,248,0.9)_100%)]" />
                    </div>
                    <div className="relative">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#f3e7c8] bg-white/86 px-3 py-1 text-xs font-black text-[#bd7a12]">
                        <Sparkles className="h-3.5 w-3.5" />
                        移动端轻量模式
                      </div>
                      <h1 className="text-2xl font-black leading-tight text-slate-950">{greeting}，{displayName}</h1>
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        简历解析、AI 优化和复杂预览建议在电脑端使用；手机端可优先查看会员权益、添加顾问和管理申请记录。
                      </p>
                      <div className="mt-4 grid gap-2">
                        <button
                          type="button"
                          onClick={() => switchTab('membership')}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6f63f6] px-5 py-3 text-sm font-black text-white"
                        >
                          查看会员权益
                          <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => switchTab('applications')}
                          className="inline-flex items-center justify-center gap-2 rounded-full border border-[#dfe8ef] bg-white px-5 py-3 text-sm font-black text-slate-600"
                        >
                          查看我的申请
                        </button>
                      </div>
                    </div>
                  </section>
                  <div className="hidden lg:block">
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
                  </div>
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
                              <h4 className="font-bold text-indigo-900 text-sm">了解会员服务解锁更多功能</h4>
                              <p className="text-xs text-indigo-700/80">获取无限次 AI 优化、内推通道及专家服务</p>
                            </div>
                          </div>
                          <button
                            onClick={() => switchTab('membership')}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                          >
                            了解会员服务
                          </button>
                        </div>
                      )}
                      <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl bg-slate-100" />}>
                        <LazyGeneratedPlanView plan={copilotPlan} isGuest={false} showProfileCta={false} showSavedHint={false} />
                      </Suspense>
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
              {tab === 'resume' && <div className="hidden lg:block">{ResumeTab()}</div>}
              {tab === 'favorites' && <FavoritesTab />}
              {tab === 'applications' && (
                <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-slate-100" />}>
                  <LazyMyApplicationsTab />
                </Suspense>
              )}
              {tab === 'feedback' && <FeedbackTab />}
              {tab === 'membership' && <MembershipTab />}
              {tab === 'about' && <AboutTab />}
              {tab === 'settings' && <SettingsTab />}
            </div>
            {isJobDetailOpen && selectedJob && (
              <Suspense fallback={null}>
                <LazyJobDetailModal
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
              </Suspense>
            )}
          </main>
          {showUpgradeModal && (
            <Suspense fallback={null}>
              <LazyMembershipUpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                triggerSource={upgradeSource}
              />
            </Suspense>
          )}
          {authUser && showCertificateModal && (
            <Suspense fallback={null}>
              <LazyMembershipCertificateModal
                isOpen={showCertificateModal}
                onClose={() => setShowCertificateModal(false)}
                user={authUser}
              />
            </Suspense>
          )}
          {modalRoot && showAboutFeedbackModal && createPortal((
              <div className="fixed inset-0 z-[10000] isolate flex items-start justify-center overflow-y-auto p-4 sm:items-center">
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
            <div className="fixed inset-0 z-[10000] isolate flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
              <button
                type="button"
                aria-label="关闭方案选择弹窗"
                className="fixed inset-0 z-0 cursor-default bg-slate-950/62 backdrop-blur-md"
                onClick={() => setShowMembershipPlanChooserModal(false)}
              />
              <div className="relative z-10 my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-[24px] border border-white/20 bg-[#fffdf8] p-4 shadow-[0_34px_96px_-42px_rgba(15,23,42,0.74)] sm:my-4 sm:rounded-[30px] sm:p-6">
                <div className="pointer-events-none absolute inset-0">
                  <img src="/pic_lists/About_pics/about_bg.webp" alt="" className="absolute inset-x-0 top-0 h-56 w-full object-cover object-[55%_38%] opacity-25" />
                  <div className="absolute inset-0 bg-[#fffdf8]/88" />
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
                    {isMember ? '咨询续费 / 了解服务' : '添加顾问了解'}
                  </div>
                  <h3 className="mt-4 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">添加顾问了解 Haigoo Remote Club</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    根据你的远程求职阶段了解半年或年度服务，顾问会协助说明适合人群、服务边界和开通方式。
                  </p>
                </div>

                <div className="relative mt-5 grid gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-3">
                  {displayMembershipPlans.map((plan) => {
                    const isStarter = plan.memberType === 'starter'
                    const isHalfYear = plan.memberType === 'half_year'
                    const isAnnual = plan.memberType === 'annual'
                    const isCurrentPlan = isCurrentClubServicePlan(plan.memberType as ClubServicePlanId)
                    const planTitle = getMembershipPlanTitle(plan.memberType)
                    const ctaText = getMembershipPlanCta(plan.memberType, isCurrentPlan)
                    return (
                      <article
                        key={plan.id}
                        className={`relative flex flex-col rounded-[20px] border p-4 transition-all hover:-translate-y-0.5 sm:min-h-[320px] sm:rounded-[24px] sm:p-5 ${
                          isAnnual
                            ? 'border-[#cfc8ff] bg-[#fbfaff] shadow-[0_22px_54px_-40px_rgba(111,99,246,0.3)]'
                            : isStarter
                              ? 'border-[#dfe8ef] bg-white shadow-[0_20px_50px_-42px_rgba(64,78,102,0.22)]'
                              : 'border-[#eadfcf] bg-[#fffdf8] shadow-[0_20px_50px_-42px_rgba(139,101,54,0.22)]'
                        }`}
                      >
                        {isCurrentPlan ? (
                          <div className="absolute right-5 top-5 rounded-full bg-[#6f63f6] px-3 py-1 text-xs font-black text-white">生效中</div>
                        ) : isAnnual ? (
                          <div className="absolute right-5 top-5 rounded-full bg-[#6f63f6] px-3 py-1 text-xs font-black text-white">推荐</div>
                        ) : null}
                        <div className={`mb-4 inline-flex w-fit rounded-full px-3 py-1 text-xs font-black ${isHalfYear ? 'border border-[#eadfcf] bg-white/82 text-[#9a6a2d]' : 'bg-[#f1efff] text-[#6f63f6]'}`}>
                          {membershipPlanTags[plan.memberType]}
                        </div>
                        <h4 className="max-w-[86%] text-xl font-black leading-tight text-slate-950">{planTitle}</h4>
                        <p className="mt-3 text-sm leading-6 text-slate-500 sm:min-h-[48px]">{membershipPlanDescriptions[plan.memberType]}</p>
                        <div className="mt-4 flex items-end gap-1">
                          <span className="text-[30px] font-black leading-none text-slate-950 sm:text-[34px]">¥{plan.price}</span>
                          <span className="pb-1 text-sm font-bold text-slate-400">{getMembershipPlanUnit(plan.memberType)}</span>
                        </div>
                        <div className="mt-5 flex-1 space-y-2.5">
                          {membershipPlanFeatures[plan.memberType].slice(0, 5).map((feature) => (
                            <div key={feature} className="flex items-start gap-2 text-sm leading-5 text-slate-700">
                              <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isHalfYear ? 'text-[#9a6a2d]' : 'text-[#6f63f6]'}`} strokeWidth={3} />
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
                              : isAnnual
                                ? 'bg-[#6f63f6] text-white shadow-[0_18px_38px_-24px_rgba(95,99,246,0.52)] hover:bg-[#5d50df]'
                                : isStarter
                                  ? 'bg-[#30426b] text-white shadow-[0_18px_38px_-24px_rgba(48,66,107,0.34)] hover:bg-[#6f63f6]'
                                  : 'bg-slate-900 text-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.34)] hover:bg-[#6f63f6]'
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
              <div className="fixed inset-0 z-[10000] isolate flex items-start justify-center overflow-y-auto p-4 sm:items-center">
              <button
                type="button"
                aria-label="关闭咨询弹窗"
                className="fixed inset-0 z-0 cursor-default bg-slate-950/65 backdrop-blur-md"
                onClick={() => setShowMembershipAssistantModal(false)}
              />
                <div className="relative z-10 my-4 w-full max-w-3xl overflow-hidden rounded-[30px] border border-white/10 bg-white p-5 text-center shadow-[0_30px_90px_-40px_rgba(15,23,42,0.75)] sm:p-7">
                <button
                  type="button"
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xl leading-none text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
                  onClick={() => setShowMembershipAssistantModal(false)}
                >
                  ×
                </button>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0edff] text-[#6f63f6]">
                  <MessageSquare className="h-7 w-7" />
                </div>
                  <h3 className="text-2xl font-black text-slate-950">{clubAdvisorCopy.title}</h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                    {clubAdvisorCopy.subtitle}
                  </p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-[220px_1fr] sm:text-left">
                    <div>
                      <div className="mx-auto w-52 border border-slate-100 bg-slate-50 p-4 sm:mx-0">
                        <img src="/series_assistant.png" alt="企业微信顾问二维码" className="h-full w-full object-contain" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1 rounded-2xl border border-[#e8eef5] bg-white px-4 py-3 text-left text-xs leading-5 text-slate-600">
                        {clubAdvisorCopy.steps.map((step, index) => (
                          <div key={step} className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f0edff] text-[11px] font-black text-[#6f63f6]">{index + 1}</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-2xl border border-[#e8eef5] bg-[#fbfdff] px-4 py-3 text-xs leading-5 text-slate-600">
                        <div className="grid grid-cols-[72px_1fr] gap-3 py-1">
                          <span className="font-black text-slate-500">服务主体</span>
                          <span className="font-semibold text-slate-700">行渡科技（杭州）有限责任公司</span>
                        </div>
                        <div className="grid grid-cols-[72px_1fr] gap-3 py-1">
                          <span className="font-black text-slate-500">可咨询</span>
                          <span className="font-semibold text-slate-700">{clubAdvisorCopy.consultText}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                  type="button"
                  onClick={() => setShowMembershipAssistantModal(false)}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#6f63f6] px-6 py-3 text-sm font-black text-white shadow-[0_16px_36px_-24px_rgba(111,99,246,0.7)] transition-all hover:-translate-y-0.5"
                >
                  <CheckCircle className="h-5 w-5" />
                  我已添加顾问
                </button>
              </div>
            </div>
          ), modalRoot)}
          {modalRoot && showMembershipPaymentModal && selectedMembershipPlan && createPortal((
            <div className="fixed inset-0 z-[10000] isolate flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
              <button
                type="button"
                aria-label="关闭顾问服务弹窗"
                className="fixed inset-0 z-0 cursor-default bg-slate-950/65 backdrop-blur-md"
                onClick={closeMembershipPaymentToPlans}
              />
              <div className="relative z-10 my-3 grid max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-[24px] border border-white/10 bg-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.75)] sm:my-4 sm:rounded-[30px] md:grid-cols-[0.9fr_1.1fr]">
                <div className="relative overflow-hidden border-b border-[#edf2f6] bg-[#fbfdff] p-4 sm:p-6 md:border-b-0 md:border-r">
                  <img src="/pic_lists/Home_pics/background03.webp" alt="" className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full object-cover object-bottom opacity-35" />
                  <div className="relative">
                    <div className="mb-5 flex items-center justify-between gap-4">
                      <div className="inline-flex rounded-full bg-[#f0edff] px-3 py-1 text-xs font-black text-[#6f63f6]">会员服务方案</div>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-colors hover:text-slate-700 md:hidden"
                        onClick={closeMembershipPaymentToPlans}
                      >
                        ×
                      </button>
                    </div>
                    <h3 className="text-2xl font-black text-slate-950">{getMembershipPlanTitle(selectedMembershipPlan.memberType)}</h3>
                    <div className="mt-4 flex items-end gap-1">
                      <span className="text-4xl font-black text-slate-950">¥{selectedMembershipPlan.price}</span>
                      <span className="pb-1 text-sm font-bold text-slate-400">
                        {getMembershipPlanUnit(selectedMembershipPlan.memberType)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-500 sm:mt-4 sm:leading-7">{membershipPlanDescriptions[selectedMembershipPlan.memberType]}</p>

                    <p className="mt-5 rounded-[18px] border border-[#e6edf3] bg-white/82 px-4 py-3 text-xs font-semibold leading-5 text-slate-500">
                      添加 Haigoo 顾问后，可了解会员方案、适合人群和开通方式。
                    </p>
                  </div>
                </div>

                <div className="relative flex flex-col items-center justify-center p-4 text-center sm:p-8">
                  <button
                    type="button"
                    className="absolute right-5 top-5 hidden h-9 w-9 items-center justify-center rounded-full bg-[#f7fbff] text-slate-400 transition-colors hover:text-slate-700 md:flex"
                    onClick={closeMembershipPaymentToPlans}
                  >
                    ×
                  </button>

                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0edff] text-[#6f63f6]">
                    <MessageSquare className="h-7 w-7" />
                  </div>
                  <h4 className="text-2xl font-black text-slate-950">添加顾问，了解 Club 服务</h4>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    添加 Haigoo 顾问后，可了解会员方案、适合人群和开通方式。
                  </p>

                  <div className="mt-5 border border-[#edf2f6] bg-white p-4 shadow-[0_20px_55px_-42px_rgba(61,89,120,0.62)]">
                    <img
                      src="/series_assistant.png"
                      alt="企业微信顾问二维码"
                      className="h-40 w-40 object-contain sm:h-44 sm:w-44"
                    />
                  </div>
                  <div className="mt-4 w-full max-w-sm space-y-1 rounded-2xl border border-[#e8eef5] bg-white px-4 py-3 text-left text-xs leading-5 text-slate-600">
                    {[
                      '添加 Haigoo 顾问',
                      '发送注册邮箱和想了解的会员方案',
                      '顾问确认后开通对应网站权限'
                    ].map((step, index) => (
                      <div key={step} className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f0edff] text-[11px] font-black text-[#6f63f6]">{index + 1}</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                  {isQuarterMember && selectedMembershipPlan.memberType === 'quarter_pro' ? (
                    <div className="mt-4 w-full max-w-sm rounded-[18px] border border-[#d8d2ff] bg-[#fbfaff] px-4 py-3 text-left">
                        <div className="text-sm font-black text-[#5d50df]">咨询深度服务方案</div>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
                          你当前已开通长期权益，可联系顾问了解如何补差价调整为深度服务方案。
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <img src="/series_assistant.png" alt="企业微信顾问二维码" className="h-16 w-16 border border-[#e4dfff] bg-white object-contain p-1" />
                        <div className="min-w-0 text-xs font-semibold leading-5 text-slate-600">
                          <div>添加顾问咨询升级方式</div>
                          <a href="mailto:hi@haigooremote.com" className="font-black text-[#2f6ed8] no-underline hover:underline">hi@haigooremote.com</a>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleMembershipAdvisorAdded}
                    className="mt-5 inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[#6f63f6] px-6 py-3.5 text-sm font-black text-white shadow-[0_18px_40px_-24px_rgba(95,99,246,0.58)] transition-all hover:-translate-y-0.5 sm:mt-6"
                  >
                    <CheckCircle className="h-5 w-5" />
                    我已添加顾问
                  </button>
                </div>
              </div>
            </div>
          ), modalRoot)}
        </div>
      </div>
    </div>
  )
}
