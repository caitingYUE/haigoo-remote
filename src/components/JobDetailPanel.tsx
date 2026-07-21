import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Share2, Bookmark, MapPin, DollarSign, Building2, Briefcase, X, ChevronRight, ChevronLeft, CheckCircle2, Mail, Linkedin, Calendar, Lock, Star, Leaf, BookOpen, ChevronDown, PlayCircle, Video } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Job } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { SingleLineTags } from './SingleLineTags'
import { LocationTooltip } from './LocationTooltip'
import { ReferralApplicationModal } from './ReferralApplicationModal'
import { MatchDetailsPanel } from './MatchDetailsPanel'
import { EmailConnectModal } from './EmailConnectModal'
import { trustedCompaniesService, TrustedCompany, ReferralContact } from '../services/trusted-companies-service'
import { processedJobsService } from '../services/processed-jobs-service'
import { useNotificationHelpers } from './NotificationSystem'
import { getJobSourceType } from '../utils/job-source-helper'
import { trackingService } from '../services/tracking-service'
import { ShareJobModal } from './ShareJobModal'
import { getCompanyDetailPath } from '../utils/share-link-helper'
import { resolveMatchLevel } from '../utils/match-display'
import { buildJobDetailSections, type JobDetailBlock } from '../utils/job-detail-content'
import { formatSalaryForDisplay } from '../utils/salary-display'
import { findLocation } from '../data/locations'
import { corporateEnglishPublicService, type CorporateEnglishCompanyDetail, type CorporateEnglishPublicVideo } from '../services/corporate-english-public-service'
import { getCompanyLogoSources } from '../utils/company-logo'
import EmailVerificationRequiredModal from './EmailVerificationRequiredModal'
import { useLanguage } from '../contexts/LanguageContext'

interface JobDetailPanelProps {
    job: Job
    onSave?: (jobId: string) => void
    isSaved?: boolean
    onApply?: (jobId: string) => void
    onClose?: () => void
    showCloseButton?: boolean
    onNavigateJob?: (direction: 'prev' | 'next') => void
    canNavigatePrev?: boolean
    canNavigateNext?: boolean
    showInlineNavigation?: boolean
    trackingPageKey?: string
    trackingSourceKey?: string
    trackingModule?: string
    trackingExtra?: Record<string, unknown>
}

const EMPTY_TRACKING_EXTRA: Record<string, unknown> = {}

type PendingApplyWindow = Window | null

type WebsiteApplyState =
    | 'login_required'
    | 'website_available'
    | 'website_locked_member'
    | 'email_only'
    | 'unavailable'

type ReferralAccessMode =
    | 'unlocked'
    | 'guest'
    | 'verification_required'
    | 'member_only'
    | 'free_available'
    | 'free_exhausted'

const GuestMaskedInline = ({ className = 'w-20' }: { className?: string }) => {
    const { isEnglish } = useLanguage()
    const label = isEnglish ? 'Log in to view' : '登录后查看'
    return <span className={`inline-flex h-3.5 rounded-full bg-slate-300/80 blur-[2px] ${className}`} aria-label={label} title={label} />
}

const GuestMaskedStatValue = ({ className = 'w-24' }: { className?: string }) => {
    const { isEnglish } = useLanguage()
    const label = isEnglish ? 'Log in to view' : '登录后查看'
    return <span className={`mt-1 inline-flex h-4 rounded-full bg-slate-300/80 blur-[2px] ${className}`} aria-label={label} title={label} />
}

const JOB_TYPE_LABELS: Record<string, string> = {
    'full-time': '全职',
    full_time: '全职',
    fulltime: '全职',
    'part-time': '兼职',
    part_time: '兼职',
    parttime: '兼职',
    contract: '合同',
    freelance: '自由职业',
    internship: '实习',
    intern: '实习',
    remote: '远程'
}

const EXPERIENCE_LABELS: Record<string, string> = {
    Entry: '初级',
    entry: '初级',
    junior: '初级',
    Mid: '中级',
    mid: '中级',
    middle: '中级',
    Senior: '高级',
    senior: '高级',
    Lead: '专家',
    lead: '专家',
    expert: '专家',
    Executive: '高管'
}

const normalizeJobMetaValue = (value: unknown) => String(value || '').trim()

const resolveJobTypeLabel = (value: unknown) => {
    const raw = normalizeJobMetaValue(value)
    if (!raw) return ''
    const normalized = raw.toLowerCase().replace(/\s+/g, '-')
    const underscore = normalized.replace(/-/g, '_')
    return JOB_TYPE_LABELS[normalized] || JOB_TYPE_LABELS[underscore] || JOB_TYPE_LABELS[raw] || raw
}

const resolveExperienceLabel = (value: unknown) => {
    const raw = normalizeJobMetaValue(value)
    if (!raw) return ''
    const normalized = raw.toLowerCase().replace(/\s+/g, '-')
    const titleCase = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
    return EXPERIENCE_LABELS[raw] || EXPERIENCE_LABELS[normalized] || EXPERIENCE_LABELS[titleCase] || raw
}

const inferExperienceLabelFromText = (value: unknown) => {
    const text = normalizeJobMetaValue(value)
    if (!text) return ''
    if (/(实习|intern|internship)/i.test(text)) return '实习'
    if (/(初级|junior|entry)/i.test(text)) return '初级'
    if (/(中级|mid|middle)/i.test(text)) return '中级'
    if (/(高级|资深|senior)/i.test(text)) return '高级'
    if (/(专家|lead|staff|principal)/i.test(text)) return '专家'
    if (/(高管|executive|director|head|vp|chief|cxo)/i.test(text)) return '高管'
    return ''
}

const inferRoleLabelFromText = (value: unknown) => {
    const text = normalizeJobMetaValue(value)
    if (!text) return ''
    if (/(产品|product)/i.test(text)) return '产品'
    if (/(设计|designer|design)/i.test(text)) return '设计'
    if (/(运营|operation|ops)/i.test(text)) return '运营'
    if (/(市场|营销|marketing|growth)/i.test(text)) return '市场/营销'
    if (/(销售|sales|business development|bd)/i.test(text)) return '销售/商务'
    if (/(开发|工程|engineer|developer|frontend|backend|fullstack|software|devops|sre|qa|test)/i.test(text)) return '技术'
    if (/(数据|data|analytics|analyst|algorithm|ml|ai)/i.test(text)) return '数据/AI'
    if (/(客服|客户|support|success|customer)/i.test(text)) return '客户支持'
    if (/(招聘|人力|hr|talent|people)/i.test(text)) return '人力/招聘'
    return ''
}

const DETAIL_BACKGROUND_FALLBACK = '/pic_lists/Jobs_pics/background01.webp'
const TECH_BACKGROUND = '/pic_lists/Jobs_pics/job-tech-bg.webp'
const PRODUCT_BACKGROUND = '/pic_lists/Jobs_pics/job-product-bg.webp'
const NON_TECH_BACKGROUND = '/pic_lists/Jobs_pics/job-nontech-bg.webp'
const FREE_USAGE_CACHE_TTL_MS = 60 * 1000
const APPLICATION_GUIDE_MAX_COLLAPSED_CHARS = 260

function isConcreteLocationValue(location?: string | null) {
    const rawLocation = String(location || '').trim()
    if (!rawLocation) return false

    const normalized = rawLocation.toLowerCase()
    const exactGenericRemote = /^(remote|remote only|fully remote|worldwide|global|anywhere|work from anywhere|全球|全球远程|国内|国内远程|中国|中国远程|远程|不限地点|地点不限|remote in china|china remote|总部未知|未知|n\/a|na|not specified|not provided)$/i
    if (exactGenericRemote.test(rawLocation) || /^(apac|asia pacific|emea|americas|europe|north america|south america)\s*(remote|time zones?)?$/i.test(normalized)) {
        return false
    }
    return true
}

type FreeUsageSnapshot = {
    sharedData: any
    websiteApplyData: any
}

let freeUsageCache: {
    token: string
    expiresAt: number
    data: FreeUsageSnapshot | null
    promise: Promise<FreeUsageSnapshot> | null
} = {
    token: '',
    expiresAt: 0,
    data: null,
    promise: null
}

function clearFreeUsageCache() {
    freeUsageCache = {
        token: '',
        expiresAt: 0,
        data: null,
        promise: null
    }
}

function loadFreeUsageSnapshot(token: string): Promise<FreeUsageSnapshot> {
    const now = Date.now()
    if (freeUsageCache.token === token && freeUsageCache.data && freeUsageCache.expiresAt > now) {
        return Promise.resolve(freeUsageCache.data)
    }
    if (freeUsageCache.token === token && freeUsageCache.promise) {
        return freeUsageCache.promise
    }

    const headers = { 'Authorization': `Bearer ${token}` }
    const promise = Promise.all([
        fetch('/api/users?resource=free-usage&type=referral', { headers }).then(r => r.json()),
        fetch('/api/users?resource=free-usage&type=website-apply', { headers }).then(r => r.json()),
    ]).then(([sharedData, websiteApplyData]) => {
        const data = { sharedData, websiteApplyData }
        freeUsageCache = {
            token,
            expiresAt: Date.now() + FREE_USAGE_CACHE_TTL_MS,
            data,
            promise: null
        }
        return data
    }).catch((error) => {
        if (freeUsageCache.token === token) {
            freeUsageCache.promise = null
        }
        throw error
    })

    freeUsageCache = {
        token,
        expiresAt: 0,
        data: null,
        promise
    }

    return promise
}

function resolveDetailBackground(job: Job) {
    const primaryCategory = String(job.category || '').toLowerCase()
    if (/(招聘|人力|hr|财务|法务|行政|客服|客户服务|教育|课程|采购|心理|营养|非技术|综合)/i.test(primaryCategory)) {
        return NON_TECH_BACKGROUND
    }
    if (/(产品|设计|运营|市场|营销|销售|内容|商务|增长|品牌|用户)/i.test(primaryCategory)) {
        return PRODUCT_BACKGROUND
    }
    if (/(开发|工程|算法|数据|安全|运维|架构|技术支持|前端|后端|全栈|软件|测试)/i.test(primaryCategory)) {
        return TECH_BACKGROUND
    }

    const text = [
        job.category,
        job.companyIndustry,
        job.title,
        job.translations?.title,
        ...(job.skills || []),
        ...(job.tags || []),
    ].filter(Boolean).join(' ').toLowerCase()

    if (!text.trim()) return DETAIL_BACKGROUND_FALLBACK

    if (/(engineer|developer|frontend|backend|fullstack|software|devops|sre|qa|data|security|算法|工程|开发|前端|后端|全栈|测试|数据|安全|运维|架构|技术)/i.test(text)) {
        return TECH_BACKGROUND
    }

    if (/(product|design|operation|growth|marketing|sales|content|community|产品|设计|运营|增长|市场|营销|销售|内容|用户|商务)/i.test(text)) {
        return PRODUCT_BACKGROUND
    }

    if (/(hr|recruit|finance|legal|admin|support|customer|教育|行政|人事|招聘|财务|法务|客服|支持|非技术|综合)/i.test(text)) {
        return NON_TECH_BACKGROUND
    }

    return DETAIL_BACKGROUND_FALLBACK
}

function HotApplicationBadge({ count }: { count: number }) {
    const { isEnglish } = useLanguage()
    return (
        <span
            className="inline-flex h-6 shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-black text-amber-700 shadow-[0_10px_18px_-14px_rgba(245,158,11,0.5)]"
            title={isEnglish ? `${count} applicants` : `${count} 位用户已申请`}
        >
            🔥{isEnglish ? 'Hot' : '热门'}
        </span>
    )
}

type GuideAccessMode = 'unlocked' | 'guest' | 'verification_required' | 'member_only' | 'free_available' | 'free_exhausted'

function ApplicationGuidePanel({
    guide,
    accessMode,
    remaining,
    limit,
    isUnlocking,
    onUnlock,
    onUpgrade,
    className = ''
}: {
    guide: string
    accessMode: GuideAccessMode
    remaining: number
    limit: number
    isUnlocking?: boolean
    onUnlock?: () => void
    onUpgrade?: () => void
    className?: string
}) {
    const { text } = useLanguage()
    const [expanded, setExpanded] = useState(false)
    const isUnlocked = accessMode === 'unlocked'
    const shouldCollapse = guide.length > APPLICATION_GUIDE_MAX_COLLAPSED_CHARS
    const displayGuide = isUnlocked && shouldCollapse && !expanded
        ? `${guide.slice(0, APPLICATION_GUIDE_MAX_COLLAPSED_CHARS).trim()}...`
        : guide

    const actionLabel = accessMode === 'guest'
        ? text('登录后查看', 'Log in to view')
        : accessMode === 'verification_required'
            ? text('解锁指南（待验证）', 'Unlock guide (verification required)')
        : accessMode === 'member_only'
            ? text('了解 Club 权益', 'Explore Club benefits')
            : accessMode === 'free_exhausted'
                ? `${text('解锁指南', 'Unlock guide')} ${remaining}/${limit}`
                : `${text('解锁指南', 'Unlock guide')} ${remaining}/${limit}`

    const handleAction = () => {
        if (accessMode === 'free_available' || accessMode === 'guest' || accessMode === 'verification_required') {
            onUnlock?.()
            return
        }
        onUpgrade?.()
    }

    return (
        <section className={`rounded-[22px] border border-[#dce8ef] bg-white/92 p-5 shadow-[0_22px_52px_-42px_rgba(52,76,92,0.26)] ${className}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f1f8ff] text-[#5f83f7]">
                        <BookOpen className="h-4 w-4" />
                    </span>
                    <h4 className="truncate text-base font-black tracking-tight text-slate-900">{text('岗位申请指南', 'Application guide')}</h4>
                </div>
                {!isUnlocked ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d8d2ff] bg-[#f6f3ff] px-2 py-0.5 text-[10px] font-black text-[#6f63f6]">
                        <Lock className="h-3 w-3" />
                        Club
                    </span>
                ) : null}
            </div>

            {isUnlocked ? (
                <>
                    <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{displayGuide}</p>
                    {shouldCollapse ? (
                        <button
                            type="button"
                            onClick={() => setExpanded((value) => !value)}
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-[#6f63f6] transition hover:text-[#5f55e8]"
                        >
                            {expanded ? text('收起', 'Show less') : text('展开', 'Show more')}
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                    ) : null}
                </>
            ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <p className="text-sm leading-6 text-slate-600">{text('解锁后查看该岗位的投递重点、申请路径和准备建议。', 'Unlock the guide to see application priorities, steps, and preparation tips for this role.')}</p>
                    <button
                        type="button"
                        onClick={handleAction}
                        disabled={isUnlocking}
                        className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#6f63f6] px-4 text-sm font-black text-white shadow-[0_18px_32px_-24px_rgba(111,99,246,0.5)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Lock className="h-4 w-4" />
                        {isUnlocking ? text('解锁中...', 'Unlocking...') : actionLabel}
                    </button>
                </div>
            )}
        </section>
    )
}

function CorporateVideoShortcut({
    video,
    canAccess,
    canShowTitle,
    logoCandidates,
    companyName,
    onClick
}: {
    video: CorporateEnglishPublicVideo
    canAccess: boolean
    canShowTitle: boolean
    logoCandidates?: string[]
    companyName?: string
    onClick: () => void
}) {
    const sources = useMemo(() => Array.from(new Set((logoCandidates || []).map((item) => String(item || '').trim()).filter(Boolean))), [logoCandidates])
    const [logoIndex, setLogoIndex] = useState(0)
    useEffect(() => {
        setLogoIndex(0)
    }, [sources.join('|')])

    const displayTitle = canShowTitle ? (video.materialTitle || '企业 CEO 访谈') : 'CEO 访谈'
    const speakerName = String(video.speakerName || '').trim()
    const speakerRole = String(video.speakerRole || '').trim()
    const activeLogo = sources[logoIndex] || ''
    const companyInitial = String(companyName || speakerName || 'HG').slice(0, 2).toUpperCase()

    return (
        <button
            type="button"
            onClick={onClick}
            className="group mt-5 flex w-full items-center gap-4 overflow-hidden rounded-[22px] border border-[#e2d7ff] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(246,248,255,0.98))] p-3 text-left shadow-[0_18px_42px_-36px_rgba(79,70,229,0.34)] transition hover:-translate-y-0.5 hover:border-[#cdbfff] hover:bg-white"
        >
            <span className="relative flex aspect-video w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-950 text-white sm:w-40">
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(139,124,255,0.72),transparent_32%),linear-gradient(135deg,rgba(18,24,56,0.96),rgba(48,45,126,0.94))]" />
                <span className="absolute right-3 top-3 max-w-[72%] truncate text-xs font-black text-white/16 sm:text-sm">
                    {companyName || 'Haigoo'}
                </span>
                <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/18 bg-white/94 text-sm font-black text-[#6251f5] shadow-[0_18px_34px_-24px_rgba(0,0,0,0.65)] backdrop-blur sm:h-16 sm:w-16">
                    {activeLogo ? (
                        <img
                            src={activeLogo}
                            alt=""
                            className="h-full w-full object-contain p-2"
                            loading="lazy"
                            decoding="async"
                            onError={() => setLogoIndex((index) => index + 1)}
                        />
                    ) : companyInitial}
                </span>
                <span className="absolute bottom-2 left-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#6251f5] shadow-sm">
                    <PlayCircle className="h-6 w-6" />
                </span>
                {!canAccess ? (
                    <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/92 text-[#6f63f6]">
                        <Lock className="h-3.5 w-3.5" />
                    </span>
                ) : null}
            </span>
            <span className="min-w-0 flex-1">
                <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#6f63f6]">
                    <Video className="h-3 w-3" />
                    CEO 访谈
                </span>
                <span className="block line-clamp-2 text-base font-black leading-6 text-slate-950">{displayTitle}</span>
                {(speakerName || speakerRole) ? (
                    <span className="mt-1 block truncate text-sm font-semibold text-slate-500">
                        {[speakerName, speakerRole].filter(Boolean).join(' · ')}
                    </span>
                ) : null}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-[#6f63f6]" />
        </button>
    )
}

export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({
    job,
    onSave,
    isSaved = false,
    onApply,
    onClose,
    showCloseButton = false,
    onNavigateJob,
    canNavigatePrev = false,
    canNavigateNext = false,
    showInlineNavigation = true,
    trackingPageKey = 'job_detail',
    trackingSourceKey = 'job_detail',
    trackingModule,
    trackingExtra = EMPTY_TRACKING_EXTRA
}) => {
    const navigate = useNavigate()
    const { isMember, isAuthenticated, token, user } = useAuth()
    const { isEnglish, text } = useLanguage()
    const isEmailVerificationRequired = Boolean(isAuthenticated && user && !user.emailVerified)
    const sourceType = getJobSourceType(job)
    const shouldMaskGuestMeta = !isAuthenticated || isEmailVerificationRequired
    const trackingExtraSignature = JSON.stringify(trackingExtra)
    const trackingBase = useMemo(() => ({
        page_key: trackingPageKey,
        source_key: trackingSourceKey,
        ...trackingExtra
    }), [trackingPageKey, trackingSourceKey, trackingExtraSignature])

    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
    const [feedbackAccuracy, setFeedbackAccuracy] = useState<'accurate' | 'inaccurate' | 'unknown'>('unknown')
    const [feedbackContent, setFeedbackContent] = useState('')
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
    const [feedbackMessage, setFeedbackMessage] = useState('')
    const hasTranslation = !!(job?.translations?.title || job?.translations?.description)
    const [showTranslation, setShowTranslation] = useState(false)
    const [companyInfo, setCompanyInfo] = useState<TrustedCompany | null>(null)
    const [companyInfoLoading, setCompanyInfoLoading] = useState(false)
    const [companyOpenJobsCount, setCompanyOpenJobsCount] = useState<number | null>(null)
    const [companyOpenJobs, setCompanyOpenJobs] = useState<Job[]>([])
    const [activeDetailTab, setActiveDetailTab] = useState<'description' | 'company' | 'jobs'>('description')
    const [showHeadquartersLocationTooltip, setShowHeadquartersLocationTooltip] = useState(false)
    const [headquartersTooltipPosition, setHeadquartersTooltipPosition] = useState<{ left: number; top: number } | null>(null)
    const [isReferralModalOpen, setIsReferralModalOpen] = useState(false)
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)
    const [showEmailVerificationPrompt, setShowEmailVerificationPrompt] = useState(false)
    const [emailVerificationActionLabel, setEmailVerificationActionLabel] = useState('申请岗位')
    const [isEmailConnectOpen, setIsEmailConnectOpen] = useState(false)
    const [selectedReferralContact, setSelectedReferralContact] = useState<ReferralContact | null>(null)
    const [nestedJobIndex, setNestedJobIndex] = useState<number | null>(null)
    const [hasResume, setHasResume] = useState<boolean | null>(null)
    const [unlockingApplicationGuide, setUnlockingApplicationGuide] = useState(false)
    const [corporateEnglishDetail, setCorporateEnglishDetail] = useState<CorporateEnglishCompanyDetail | null>(null)
    const { showSuccess, showError, showInfo, showWarning } = useNotificationHelpers()
    const companyInfoRequestRef = useRef(0)
    const headquartersStatRef = useRef<HTMLDivElement | null>(null)
    const referralContactsScrollRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        setNestedJobIndex(null)
        setShowHeadquartersLocationTooltip(false)
        setHeadquartersTooltipPosition(null)
    }, [job.id])

    const usesCustomReferralContacts = job?.referralContactMode === 'custom'
    const hasExplicitSelectedReferralIds = Object.prototype.hasOwnProperty.call(job || {}, 'selectedReferralContactIds')
    const hasExplicitEffectiveReferralCount = Object.prototype.hasOwnProperty.call(job || {}, 'effectiveReferralContactCount')
    const selectedReferralContactIds = Array.isArray(job?.selectedReferralContactIds) ? job.selectedReferralContactIds : []
    const effectiveReferralContactCount = typeof job?.effectiveReferralContactCount === 'number'
        ? job.effectiveReferralContactCount
        : null
    const companyUsesCustomReferralContacts = companyInfo?.jobReferralContactMode === 'custom'
    const companyEffectiveReferralContactCount = typeof companyInfo?.jobEffectiveReferralContactCount === 'number'
        ? companyInfo.jobEffectiveReferralContactCount
        : null
    const fallbackHiringEmail = String(job?.hiringEmail || '').trim()
    const resolvedHiringEmail = String(companyInfo?.hiringEmail || fallbackHiringEmail || '').trim()
    const resolvedEmailType = String(companyInfo?.emailType || job?.emailType || (job as any)?.email_type || (job as any)?.trusted_email_type || '').trim()
    const shouldForceHideCustomReferralModule = companyUsesCustomReferralContacts
        ? companyEffectiveReferralContactCount === 0
        : (
            usesCustomReferralContacts && (
                (hasExplicitSelectedReferralIds && selectedReferralContactIds.length === 0) ||
                (hasExplicitEffectiveReferralCount && effectiveReferralContactCount === 0)
            )
        )

    const referralContacts = useMemo(() => {
        const source = Array.isArray(companyInfo?.referralContacts) ? companyInfo!.referralContacts : []
        return source.filter(contact => {
            const name = String(contact?.name || '').trim()
            const title = String(contact?.title || '').trim()
            return !!(name && title)
        })
    }, [companyInfo])

    const displayReferralContacts = useMemo(() => {
        if (shouldForceHideCustomReferralModule) return []
        if (referralContacts.length > 0) return referralContacts
        if (usesCustomReferralContacts || companyUsesCustomReferralContacts) return []
        const fallbackEmail = resolvedHiringEmail
        if (!fallbackEmail) return []
        return [{
            id: `fallback-${job.id}`,
            name: `${job.company || companyInfo?.name || '企业'} 联系人`,
            title: resolvedEmailType || '通用邮箱',
            emailType: resolvedEmailType || '通用邮箱',
            hiringEmail: fallbackEmail,
            linkedin: '',
        }]
    }, [shouldForceHideCustomReferralModule, referralContacts, usesCustomReferralContacts, companyUsesCustomReferralContacts, resolvedHiringEmail, resolvedEmailType, job.id, job.company, companyInfo?.name])

    const showReferralModule = displayReferralContacts.length > 0
    const translationPreferenceKey = `job_translation_preference_${job?.id || ''}`
    // Free usage quotas for non-members (lifetime cumulative, stored in DB)
    const DEFAULT_FREE_FEATURE_LIMIT = 3
    const [companyInfoUsageCount, setCompanyInfoUsageCount] = useState(DEFAULT_FREE_FEATURE_LIMIT) // conservative default -> locked until loaded
    const [emailApplyUsageCount, setEmailApplyUsageCount] = useState(DEFAULT_FREE_FEATURE_LIMIT)   // conservative default
    const [referralUsageCount, setReferralUsageCount] = useState(DEFAULT_FREE_FEATURE_LIMIT)        // conservative default
    const [referralFreeLimit, setReferralFreeLimit] = useState(DEFAULT_FREE_FEATURE_LIMIT)
    const [unlockedCompanies, setUnlockedCompanies] = useState<string[]>([])
    const DEFAULT_WEBSITE_APPLY_FREE_LIMIT = 20
    const [websiteApplyUsageCount, setWebsiteApplyUsageCount] = useState(DEFAULT_WEBSITE_APPLY_FREE_LIMIT)
    const [websiteApplyFreeLimit, setWebsiteApplyFreeLimit] = useState(DEFAULT_WEBSITE_APPLY_FREE_LIMIT)
    const [unlockedWebsiteApplyJobIds, setUnlockedWebsiteApplyJobIds] = useState<string[]>([])
    const [sharedFreeUsageReady, setSharedFreeUsageReady] = useState(false)
    const [websiteApplyUsageReady, setWebsiteApplyUsageReady] = useState(false)
    const exposureKeysRef = React.useRef<Set<string>>(new Set())

    const openUpgradeModal = (featureKey: string, sourceKey = trackingSourceKey) => {
        trackingService.track('upgrade_modal_view', {
            ...trackingBase,
            page_key: trackingPageKey,
            module: 'job_detail',
            feature_key: featureKey,
            source_key: sourceKey,
            entity_type: 'job',
            entity_id: job?.id,
        })
        navigate('/profile?tab=membership#club-service-plans')
    }

    useEffect(() => {
        // Reset state when job changes
        setIsFeedbackOpen(false)
        setFeedbackAccuracy('unknown')
        setFeedbackContent('')
        setFeedbackMessage('')
        setIsEmailConnectOpen(false)
        setSelectedReferralContact(null)
        setActiveDetailTab('description')

        const savedPreference = typeof window !== 'undefined' ? localStorage.getItem(translationPreferenceKey) : null
        const shouldShowTranslation = !isEnglish && hasTranslation && savedPreference !== 'original'
        setShowTranslation(shouldShowTranslation)

        // Track view job detail
        if (job?.id) {
            exposureKeysRef.current = new Set()
            trackingService.track('view_job_detail', {
                ...trackingBase,
                module: trackingModule || 'job_detail',
                entity_type: 'job',
                entity_id: job.id,
                job_id: job.id,
                job_title: job.title,
                company: job.company,
                source: sourceType
            })
        }
    }, [job?.id, hasTranslation, translationPreferenceKey, sourceType, job?.title, job?.company, trackingBase, trackingModule, isEnglish])

    useEffect(() => {
        let cancelled = false

        if (!isAuthenticated || !token) {
            setHasResume(false)
            return () => {
                cancelled = true
            }
        }

        fetch('/api/resumes', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then((response) => response.ok ? response.json() : null)
            .then((data) => {
                if (cancelled) return
                const resumes = Array.isArray(data?.data)
                    ? data.data
                    : (Array.isArray(data?.resumes) ? data.resumes : [])
                setHasResume(resumes.length > 0)
            })
            .catch(() => {
                if (!cancelled) setHasResume(false)
            })

        return () => {
            cancelled = true
        }
    }, [isAuthenticated, token])

    useEffect(() => {
        if (!job?.id) return
        const baseProps = {
            ...trackingBase,
            entity_type: 'job',
            entity_id: job.id,
        }

        const expose = (featureKey: string, extra: Record<string, any> = {}) => {
            const dedupeKey = `${job.id}:${featureKey}:${extra.entity_id || ''}`
            if (exposureKeysRef.current.has(dedupeKey)) return
            exposureKeysRef.current.add(dedupeKey)
            trackingService.featureExposure(featureKey, {
                ...baseProps,
                module: 'job_detail',
                ...extra,
            })
        }

        expose('favorite')
        if (hasTranslation) expose('translation')
        const hasJobScopedEmailPath = !usesCustomReferralContacts && !companyUsesCustomReferralContacts && Boolean(resolvedHiringEmail)
        if (job.url || job.sourceUrl || !hasJobScopedEmailPath) expose('website_apply')
        if (isAuthenticated && (job.company || companyInfo?.name)) expose('company_info', {
            entity_type: 'company',
            entity_id: String(job.company || companyInfo?.name || '').trim(),
        })
        if (!showReferralModule && hasJobScopedEmailPath) expose('email_apply', {
            entity_type: 'company',
            entity_id: String(job.company || companyInfo?.name || '').trim(),
        })
        if (job.canRefer || showReferralModule) expose('referral', {
            entity_type: 'company',
            entity_id: String(job.company || companyInfo?.name || '').trim(),
        })
    }, [job?.id, hasTranslation, companyInfo?.name, resolvedHiringEmail, showReferralModule, job?.url, job?.sourceUrl, job?.canRefer, usesCustomReferralContacts, companyUsesCustomReferralContacts, isAuthenticated])

    // Load free feature usage counts from server (company info + email apply + referral)
    useEffect(() => {
        if (isAuthenticated && !isEmailVerificationRequired && !isMember) {
            const token = localStorage.getItem('haigoo_auth_token');
            if (!token) return;
            loadFreeUsageSnapshot(token).then(({ sharedData, websiteApplyData }) => {
                if (sharedData.success) {
                    syncSharedFreeAccessState(sharedData.usage, sharedData.unlocked_companies || [], sharedData.limit);
                    setSharedFreeUsageReady(true)
                }
                if (websiteApplyData.success) {
                    syncWebsiteApplyState(websiteApplyData.usage, websiteApplyData.unlocked_job_ids || [], websiteApplyData.limit)
                    setWebsiteApplyUsageReady(true)
                }
            }).catch(err => console.error('[free-usage] Failed to load quotas:', err));
        } else if (isMember && !isEmailVerificationRequired) {
            // Members have no limits
            syncSharedFreeAccessState(0, []);
            syncWebsiteApplyState(0, [])
            setSharedFreeUsageReady(true)
            setWebsiteApplyUsageReady(true)
        } else {
            setSharedFreeUsageReady(false)
            setWebsiteApplyUsageReady(false)
        }
    }, [isAuthenticated, isEmailVerificationRequired, isMember]);

    useEffect(() => {
        const requestId = companyInfoRequestRef.current + 1
        companyInfoRequestRef.current = requestId
        setCompanyInfo(null)

        if (!job?.companyId) {
            setCompanyInfoLoading(false)
            return () => {
                companyInfoRequestRef.current = requestId
            }
        }

        let cancelled = false
        setCompanyInfoLoading(true)
        trustedCompaniesService.getCompanyById(job.companyId, job.id)
            .then((nextCompanyInfo) => {
                if (cancelled) return
                if (companyInfoRequestRef.current !== requestId) return
                setCompanyInfo(nextCompanyInfo)
                setCompanyInfoLoading(false)
            })
            .catch(() => {
                if (cancelled) return
                if (companyInfoRequestRef.current !== requestId) return
                setCompanyInfo(null)
                setCompanyInfoLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [job?.companyId, job?.id])

    useEffect(() => {
        let cancelled = false
        const loadCompanyOpenJobsCount = async () => {
            try {
                const jobsQuery = job?.companyId
                    ? { companyId: job.companyId, isApproved: true, skipAggregations: true as const }
                    : { company: job.company, isApproved: true, skipAggregations: true as const }
                const jobsResponse = await processedJobsService.getProcessedJobs(1, 100, jobsQuery)
                if (!cancelled) {
                    const openJobs = Array.isArray(jobsResponse.jobs) ? jobsResponse.jobs : []
                    setCompanyOpenJobs(openJobs)
                    setCompanyOpenJobsCount(openJobs.length)
                }
            } catch (error) {
                if (!cancelled) {
                    setCompanyOpenJobsCount(null)
                    setCompanyOpenJobs([])
                }
            }
        }

        if (activeDetailTab !== 'jobs') {
            setCompanyOpenJobsCount(null)
            setCompanyOpenJobs([])
        } else if (job?.companyId || job?.company) {
            loadCompanyOpenJobsCount()
        } else {
            setCompanyOpenJobsCount(null)
            setCompanyOpenJobs([])
        }

        return () => {
            cancelled = true
        }
    }, [activeDetailTab, job?.companyId, job?.company])

    useEffect(() => {
        let cancelled = false

        if (activeDetailTab !== 'company' || !job?.companyId) {
            setCorporateEnglishDetail(null)
            return () => {
                cancelled = true
            }
        }

        corporateEnglishPublicService.getCompany(job.companyId)
            .then((nextDetail) => {
                if (cancelled) return
                setCorporateEnglishDetail(nextDetail)
            })
            .catch(() => {
                if (cancelled) return
                setCorporateEnglishDetail(null)
            })
            .finally(() => {
                // No loading UI is needed; this card is an optional shortcut.
            })

        return () => {
            cancelled = true
        }
    }, [activeDetailTab, job?.companyId])

    const matchLevel = useMemo(() => {
        return resolveMatchLevel(job?.matchScore, job?.matchLevel)
    }, [job])
    const isHighDisplayBand = job?.displayBand === 'high'
    const hasHighTrueScore = Number(job?.trueMatchScore || 0) >= 82
    const showHighMatchDetails = isHighDisplayBand && hasHighTrueScore && matchLevel === 'high'
    const matchDetails = job?.matchDetails
    const hasUploadedResume = hasResume === true
    const hasApplicationGuide = String(job?.featuredReason || '').trim().length > 0
    const applicationGuide = String(job?.featuredReason || '').trim()
    const showMatchDetails = hasUploadedResume && showHighMatchDetails
    const showResumeUploadPrompt = hasResume === false && isSaved
    const syncSharedFreeAccessState = (usage: number, unlockedCompaniesList: string[] = [], limit?: number) => {
        const normalizedUsage = Math.max(0, Number(usage) || 0)
        const normalizedUnlocked = Array.isArray(unlockedCompaniesList) ? unlockedCompaniesList : []
        const normalizedLimit = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : DEFAULT_FREE_FEATURE_LIMIT

        setCompanyInfoUsageCount(normalizedUsage)
        setEmailApplyUsageCount(normalizedUsage)
        setReferralUsageCount(normalizedUsage)
        setReferralFreeLimit(normalizedLimit)
        setUnlockedCompanies(normalizedUnlocked)
    }

    const syncWebsiteApplyState = (usage: number, unlockedJobIds: string[] = [], limit?: number) => {
        setWebsiteApplyUsageCount(Math.max(0, Number(usage) || 0))
        setWebsiteApplyFreeLimit(Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : DEFAULT_WEBSITE_APPLY_FREE_LIMIT)
        setUnlockedWebsiteApplyJobIds(Array.isArray(unlockedJobIds) ? unlockedJobIds.map((item) => String(item)) : [])
    }

    const openPendingWebsiteApplyWindow = (): PendingApplyWindow => {
        const url = String(job?.url || job?.sourceUrl || '').trim()
        if (!url) return null

        const popup = window.open('', '_blank')
        if (!popup) return null

        try {
            popup.opener = null
            popup.document.title = text('正在跳转申请页面...', 'Opening application page...')
            popup.document.body.style.margin = '0'
            popup.document.body.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
            popup.document.body.style.display = 'flex'
            popup.document.body.style.alignItems = 'center'
            popup.document.body.style.justifyContent = 'center'
            popup.document.body.style.minHeight = '100vh'
            popup.document.body.style.color = '#475569'
            popup.document.body.innerHTML = `<div style="font-size:14px;">${text('正在打开岗位申请页面...', 'Opening the job application page...')}</div>`
        } catch (_error) {
            // Ignore cross-window DOM errors and continue with navigation handoff.
        }

        return popup
    }

    const isMemberRestrictedJob = Boolean(job?.memberOnly || companyInfo?.memberOnly);

    const jobDetailSections = useMemo(() => {
        const originalDesc = typeof job?.description === 'string' ? job.description : (job?.description ? String(job.description) : '')
        const translatedDesc = typeof job?.translations?.description === 'string' ? job.translations.description : (job?.translations?.description ? String(job.translations.description) : '')

        return buildJobDetailSections({
            description: originalDesc,
            translatedDescription: translatedDesc,
            requirements: job?.requirements || [],
            translatedRequirements: job?.translations?.requirements || [],
            responsibilities: job?.responsibilities || [],
            translatedResponsibilities: job?.translations?.responsibilities || [],
            benefits: job?.benefits || [],
            translatedBenefits: job?.translations?.benefits || [],
            preferTranslated: showTranslation,
            language: isEnglish ? 'en' : 'zh'
        })
    }, [job, showTranslation, isEnglish])

    const goToLogin = (message = '登录后可以继续使用岗位功能。') => {
        const returnPath = typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search || ''}`
            : '/jobs'
        showWarning('请先登录', message)
        navigate(`/login?redirect=${encodeURIComponent(returnPath)}`)
    }

    const reportBundleApplicationStarted = (method: 'website' | 'email') => {
        const bundleId = Number(trackingExtra?.bundle_id)
        if (trackingPageKey !== 'job_bundle_detail' || !Number.isInteger(bundleId) || bundleId <= 0) return
        window.dispatchEvent(new CustomEvent('haigoo:bundle-application-started', {
            detail: {
                bundleId,
                jobId: String(job.id || ''),
                method
            }
        }))
    }

    const promptEmailVerificationIfNeeded = (actionLabel = '申请岗位') => {
        if (!isEmailVerificationRequired) return false
        setEmailVerificationActionLabel(actionLabel)
        setShowEmailVerificationPrompt(true)
        return true
    }

    const handleApply = async () => {
        trackingService.track('click_apply_init', {
            ...trackingBase,
            module: 'job_detail_apply',
            entity_type: 'job',
            entity_id: job.id,
            job_id: job.id,
            job_title: job.title,
            company: job.company,
            source: sourceType,
            is_authenticated: isAuthenticated,
            is_member: isMember
        })

        // 0. Enforce Login first
        if (!isAuthenticated) {
            goToLogin()
            return
        }

        if (promptEmailVerificationIfNeeded()) return

        if (isMemberRestrictedJob && !isMember) {
            openUpgradeModal('member_only_job_apply', 'job_detail_apply_member_only')
            return
        }

        const hasWebsiteApply = Boolean(job.url || job.sourceUrl)
        const hasEmailApply = !usesCustomReferralContacts && !companyUsesCustomReferralContacts && Boolean(resolvedHiringEmail)
        const websiteApplyUnlocked = isMember || unlockedWebsiteApplyJobIds.includes(String(job.id || ''))
        const canWebsiteApplyFree = !isMember && !websiteApplyUnlocked && websiteApplyUsageCount < websiteApplyFreeLimit
        const canUseWebsiteApply = isMember || websiteApplyUnlocked || canWebsiteApplyFree

        if (hasWebsiteApply) {
            if (!canUseWebsiteApply) {
                openUpgradeModal('website_apply', 'job_detail_apply_direct')
                return
            }
            await executeApply('website', openPendingWebsiteApplyWindow())
            return
        }

        if (!showReferralModule && hasEmailApply) {
            const accessCompanyName = String(job.company || companyInfo?.name || '').trim()
            const isCompanyAccessUnlocked = isMember || (!isMemberRestrictedJob && unlockedCompanies.includes(accessCompanyName))
            const canEmailFree = !isMember && !isMemberRestrictedJob && isAuthenticated && !isCompanyAccessUnlocked && emailApplyUsageCount < DEFAULT_FREE_FEATURE_LIMIT
            const canUseEmailApply = isMember || isCompanyAccessUnlocked || canEmailFree

            if (!canUseEmailApply) {
                openUpgradeModal(isMemberRestrictedJob ? 'member_only_job_apply' : 'email_apply', 'job_detail_apply_email')
                return
            }
            await executeApply('email')
            return
        }

        if (showReferralModule) {
            showInfo('仅支持邮箱申请', '该岗位不支持官网网申，请使用上方联系人入口继续申请。')
            return
        }

        if (job.canRefer) {
            if (isMember) {
                setIsReferralModalOpen(true)
                return
            }
            openUpgradeModal('referral', 'job_detail_apply_referral')
            return
        }

        onApply?.(job.id)
    }

    const executeApply = async (method: 'website' | 'email', pendingWindow: PendingApplyWindow = null) => {
        if (method === 'email' && resolvedHiringEmail) {
            trackingService.track('click_apply', {
                ...trackingBase,
                module: 'job_detail_footer',
                feature_key: 'email_apply',
                entity_type: 'job',
                entity_id: job.id,
                job_id: job.id,
                job_title: job.title,
                company: job.company,
                apply_method: 'email',
                source: sourceType
            });

            reportBundleApplicationStarted('email')

            window.location.href = `mailto:${resolvedHiringEmail}?subject=${encodeURIComponent(`Application for ${job.title || ''}`)}`;
            trackingService.track('email_apply_success', {
                ...trackingBase,
                module: 'job_detail_footer',
                feature_key: 'email_apply',
                entity_type: 'job',
                entity_id: job.id,
                job_id: job.id,
                company: job.company,
            })

            if (isAuthenticated) {
                try {
                    const token = localStorage.getItem('haigoo_auth_token');
                    await trackingService.trackedFetch('/api/user-profile?action=record_interaction', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            jobId: job.id,
                            type: 'email',
                            notes: 'Applied via Email',
                            source: 'email'
                        })
                    }, {
                        event_family: 'application',
                        feature_key: 'email_apply',
                        entity_type: 'job',
                        entity_id: job.id,
                    })
                    window.dispatchEvent(new CustomEvent('haigoo:applications-updated', { detail: { jobId: job.id } }));
                    showSuccess('已为你记录申请，可在「我的投递」查看');
                } catch (error) {
                    console.error('Failed to record interaction:', error);
                }
            }
            return
        }

        const canProceed = await consumeWebsiteApplyIfNeeded()
        if (!canProceed) {
            if (pendingWindow && !pendingWindow.closed) {
                pendingWindow.close()
            }
            return
        }

        const url = job.url || job.sourceUrl;

        trackingService.track('click_apply', {
            ...trackingBase,
            module: 'job_detail_footer',
            feature_key: 'website_apply',
            entity_type: 'job',
            entity_id: job.id,
            job_id: job.id,
            job_title: job.title,
            company: job.company,
            apply_method: url ? 'external_link' : 'internal_apply',
            source: sourceType
        });

        reportBundleApplicationStarted('website')

        if (url) {
            trackingService.track('click_apply_external', {
                ...trackingBase,
                module: 'job_detail_footer',
                feature_key: 'website_apply',
                entity_type: 'job',
                entity_id: job.id,
                job_id: job.id,
                job_title: job.title,
                company: job.company,
                external_url: url,
                source: sourceType
            });

            if (pendingWindow && !pendingWindow.closed) {
                pendingWindow.location.href = url
            } else {
                window.open(url, '_blank', 'noopener,noreferrer');
            }

            // For authenticated users, auto-record the application
            if (isAuthenticated) {
                try {
                    const token = localStorage.getItem('haigoo_auth_token');

                    await trackingService.trackedFetch('/api/user-profile?action=record_interaction', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            jobId: job.id,
                            type: 'apply_redirect',
                            notes: '',
                            source: sourceType
                        })
                    }, {
                        event_family: 'application',
                        feature_key: 'website_apply',
                        entity_type: 'job',
                        entity_id: job.id,
                    })
                    window.dispatchEvent(new CustomEvent('haigoo:applications-updated', { detail: { jobId: job.id } }));
                    showSuccess('已为你记录申请，可在「我的投递」查看');
                } catch (error) {
                    console.error('Failed to record interaction:', error);
                }
            }
        } else {
            onApply?.(job.id);
        }
    }

    const formatMaskedName = (name?: string) => {
        const normalized = String(name || '').trim()
        if (!normalized) return '＊'
        return normalized.charAt(0).toUpperCase()
    }

    const resolveReferralDisplayEmailType = (contact: ReferralContact) => {
        const rawEmailType = String(contact.emailType || resolvedEmailType || '').trim()
        const normalizedEmailType = rawEmailType.toLowerCase()
        const emailTypeHaystack = `${normalizedEmailType} ${rawEmailType}`
        if (/(boss|ceo|chief|founder|vp|head|director|executive|高管|老板|创始|负责人|企业领导|领导邮箱)/i.test(emailTypeHaystack)) return 'BOSS邮箱'
        if (/(hr|human resources|people|人力|人事|hr邮箱)/i.test(emailTypeHaystack)) return 'HR邮箱'
        if (/(招聘|recruit|recruiter|hiring|career|talent|talent acquisition)/i.test(emailTypeHaystack)) return '招聘邮箱'
        if (/(员工|employee|staff|teammate|team)/i.test(emailTypeHaystack)) return '员工邮箱'
        if (/(通用|general|generic|support)/i.test(emailTypeHaystack)) return '通用邮箱'
        if (rawEmailType.endsWith('邮箱')) return rawEmailType

        const title = String(contact.title || '').trim()
        const titleHaystack = `${title.toLowerCase()} ${title}`
        if (/(boss|ceo|chief|founder|vp|head|director|executive|\blead\b|决策|业务负责人|负责人|高管|老板|创始|企业领导)/i.test(titleHaystack)) return 'BOSS邮箱'
        if (/(hr|human resources|people|人力|人事|talent acquisition|talent partner|talent)/i.test(titleHaystack)) return 'HR邮箱'
        if (/(招聘|recruit|recruiter|hiring|career)/i.test(titleHaystack)) return '招聘邮箱'
        if (/(员工|employee|staff|teammate|partner|manager)/i.test(titleHaystack)) return '员工邮箱'
        return ''
    }

    const getReferralEmailActionLabel = (contact: ReferralContact) => {
        const baseLabel = resolveReferralDisplayEmailType(contact)
        if (!baseLabel) return '邮箱直申'
        return baseLabel.endsWith('邮箱') ? `${baseLabel}直申` : `${baseLabel}邮箱直申`
    }

    const getReferralAvatarLabel = (contact: ReferralContact) => {
        const displayType = resolveReferralDisplayEmailType(contact)
        if (displayType === 'BOSS邮箱') return 'BOSS'
        if (displayType === 'HR邮箱') return 'HR'
        if (displayType === '招聘邮箱') return 'HIRE'
        if (displayType === '员工邮箱') return 'TEAM'
        return 'GEN'
    }

    const handleUnlockReferralPreview = async () => {
        const token = localStorage.getItem('haigoo_auth_token');
        const companyName = String(job.company || companyInfo?.name || '').trim()
        if (!token) {
            goToLogin('登录后可以查看企业联系信息。')
            return
        }
        if (promptEmailVerificationIfNeeded()) return
        if (isMemberRestrictedJob && !isMember) {
            goToMembershipPayment('member_only_job_apply', 'job_detail_referral_member_only_unlock')
            return
        }
        try {
            const res = await trackingService.trackedFetch('/api/users?resource=free-usage&type=referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    companyName,
                    page_key: trackingPageKey,
                    source_key: trackingSourceKey === 'job_detail' ? 'job_detail_referral_preview' : trackingSourceKey,
                    entity_type: 'company',
                    entity_id: companyName,
                    flow_id: `referral_preview_${job.id}`
                })
            }, {
                event_family: 'application',
                feature_key: 'referral',
                entity_type: 'job',
                entity_id: job.id,
            });
            const data = await res.json();
            if (data.success) {
                clearFreeUsageCache()
                syncSharedFreeAccessState(data.usage, data.unlocked_companies || [], data.limit);
                showSuccess('已解锁该企业人脉', `当前还可免费查看 ${Math.max(0, (Number(data.limit) || referralFreeLimit) - (Number(data.usage) || 0))} 次`)
                if (data.remaining === 0) showInfo('免费次数已用完', '了解会员服务后可解锁全部人脉');
            } else {
                showError('解锁失败', data.error || '服务器错误');
            }
        } catch (err) {
            showError('解锁失败', '网络错误');
        }
    }

    const goToMembershipPayment = (featureKey = 'referral', sourceKey = 'job_detail_referral') => {
        trackingService.track('upgrade_cta_click', {
            ...trackingBase,
            module: 'job_detail_referral',
            feature_key: featureKey,
            source_key: sourceKey,
            entity_type: 'job',
            entity_id: job?.id,
        })
        openUpgradeModal(featureKey, sourceKey)
    }

    const openReferralEmailAssistant = (contact: ReferralContact) => {
        const refCompanyName = job.company || companyInfo?.name || ''
        const isReferralUnlocked = isMember || unlockedCompanies.includes(refCompanyName)
        if (!isAuthenticated) {
            goToLogin()
            return
        }
        if (promptEmailVerificationIfNeeded()) return

        if (!isReferralUnlocked) {
            goToMembershipPayment('referral', 'job_detail_referral_locked_apply')
            return
        }

        const email = String(contact?.hiringEmail || '').trim()
        if (!email) {
            showError('该联系人暂未配置工作邮箱')
            return
        }

        trackingService.featureClick('referral', {
            ...trackingBase,
            module: 'job_detail_referral',
            entity_type: 'company',
            entity_id: refCompanyName,
        })
        setSelectedReferralContact(contact)
        setIsEmailConnectOpen(true)
    }

    const toSafeExternalUrl = (url?: string) => {
        const raw = String(url || '').trim()
        if (!raw) return '#'
        if (/^https?:\/\//i.test(raw)) return raw
        return `https://${raw}`
    }

    const handleReferralEmailOpen = async (contact: ReferralContact, resumeId: string, resumeName: string) => {
        trackingService.track('click_apply', {
            ...trackingBase,
            module: 'job_detail_referral',
            feature_key: 'referral',
            entity_type: 'job',
            entity_id: job.id,
            job_id: job.id,
            job_title: job.title,
            company: job.company,
            apply_method: 'referral_contact_email',
            source: 'referral'
        })

        if (!isAuthenticated || promptEmailVerificationIfNeeded()) return

        try {
            const token = localStorage.getItem('haigoo_auth_token')
            await fetch('/api/user-profile?action=record_interaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    jobId: job.id,
                    type: 'email',
                    notes: `Opened referral email template: ${contact.name || ''}${resumeId ? ` | resume: ${resumeName || resumeId}` : ''}`,
                    source: 'referral_contact_email'
                })
            })
            window.dispatchEvent(new CustomEvent('haigoo:applications-updated', { detail: { jobId: job.id } }))
            showSuccess('已为你记录申请，可在「我的投递」查看')
        } catch (error) {
            console.error('Failed to record interaction:', error)
        }
    }

    const consumeWebsiteApplyIfNeeded = async () => {
        if (!isAuthenticated || isMember || !job?.id) return true

        const jobId = String(job.id)
        if (unlockedWebsiteApplyJobIds.includes(jobId)) return true

        const token = localStorage.getItem('haigoo_auth_token')
        if (!token) return false

        try {
            const data = await trackingService.trackedFetch('/api/users?resource=free-usage&type=website-apply', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jobId,
                    page_key: trackingPageKey,
                    source_key: trackingSourceKey,
                    entity_type: 'job',
                    entity_id: jobId,
                    flow_id: `website_apply_${jobId}`
                })
            }, {
                event_family: 'application',
                feature_key: 'website_apply',
                entity_type: 'job',
                entity_id: jobId,
            }).then(async (response) => {
                const payload = await response.json()
                if (!response.ok) {
                    const error = new Error(payload.error || '次数校验失败') as Error & {
                        status?: number
                        payload?: any
                    }
                    error.status = response.status
                    error.payload = payload
                    throw error
                }
                return payload
            })

            clearFreeUsageCache()
            syncWebsiteApplyState(data.usage, data.unlocked_job_ids || [], data.limit)
            return true
        } catch (error) {
            console.error('[free-usage] website-apply consume failed:', error)
            const status = typeof error === 'object' && error && 'status' in error ? Number((error as any).status) : 0
            const payload = typeof error === 'object' && error && 'payload' in error ? (error as any).payload : null

            if (payload && typeof payload.usage !== 'undefined') {
                syncWebsiteApplyState(payload.usage, payload.unlocked_job_ids || [], payload.limit)
            }

            if (status === 403) {
                openUpgradeModal('website_apply')
                showInfo('前往申请次数已用完', '了解会员服务后可继续查看并申请更多岗位')
                return false
            }

            showError('前往申请失败', '请稍后重试')
            return false
        }
    }

    const handleReferralSuccess = () => {
        showSuccess('申请已提交，请耐心等待审核');
    }

    const handleShare = () => {
        setIsShareModalOpen(true)
        trackingService.track('click_share_button', {
            job_id: job.id,
            from: 'detail_panel'
        });
    }

    const handleSave = () => {
        if (!isAuthenticated) {
            goToLogin('登录后可以收藏职位。')
            return
        }
        if (promptEmailVerificationIfNeeded('收藏岗位')) return

        trackingService.track('click_save_job', {
            ...trackingBase,
            module: 'job_detail_header',
            feature_key: 'favorite',
            entity_type: 'job',
            entity_id: job.id,
            job_id: job.id,
            action: isSaved ? 'unsave' : 'save'
        })
        onSave?.(job.id)
    }

    const submitFeedback = async () => {
        if (!feedbackContent.trim()) {
            setFeedbackMessage('请填写反馈内容')
            return
        }
        try {
            setFeedbackSubmitting(true)
            setFeedbackMessage('')
            const token = localStorage.getItem('haigoo_auth_token') || ''
            const res = await fetch('/api/user-profile?action=submit_feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    jobId: job.id,
                    accuracy: feedbackAccuracy,
                    content: feedbackContent,
                    source: job.source || '',
                    sourceUrl: job.sourceUrl || ''
                })
            })
            const data = await res.json().catch(() => ({ success: false }))
            if (res.ok && data?.success) {
                setFeedbackMessage('反馈已提交，感谢你的帮助！')
                setTimeout(() => { setIsFeedbackOpen(false) }, 1200)
                setFeedbackAccuracy('unknown')
                setFeedbackContent('')
            } else {
                setFeedbackMessage(data?.error || '提交失败，请稍后重试')
            }
        } catch (e: any) {
            setFeedbackMessage('提交失败，请检查网络连接')
        } finally {
            setFeedbackSubmitting(false)
        }
    }

    const displayText = (originalText: string, translatedText?: string): string => {
        if (showTranslation && translatedText) {
            return translatedText
        }
        return originalText || ''
    }

    const setTranslationMode = (nextShowTranslation: boolean) => {
        setShowTranslation(nextShowTranslation)
        if (typeof window !== 'undefined') {
            localStorage.setItem(translationPreferenceKey, nextShowTranslation ? 'translated' : 'original')
        }
        trackingService.track('feature_click', {
            ...trackingBase,
            module: 'job_detail',
            feature_key: 'translation',
            entity_type: 'job',
            entity_id: job.id,
            language: nextShowTranslation ? 'zh' : 'en'
        })
    }

    const locationDisplayText = displayText(job.location || '', job.translations?.location)
    const renderSectionBlocks = (blocks: JobDetailBlock[]) => {
        if (!Array.isArray(blocks) || blocks.length === 0) return null

        return blocks.map((block, index) => {
            if (block.type === 'list') {
                const ListTag = block.ordered ? 'ol' : 'ul'
                return (
                    <ListTag
                        key={`list-${index}`}
                        className={`space-y-2 pl-5 text-slate-700 leading-7 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
                    >
                        {block.items.map((item, itemIndex) => (
                            <li key={`item-${index}-${itemIndex}`} className="pl-1 marker:text-slate-400">
                                {renderInlineFormatting(item)}
                            </li>
                        ))}
                    </ListTag>
                )
            }

            if (block.type === 'subheading') {
                return (
                    <h4 key={`subheading-${index}`} className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {renderInlineFormatting(block.text)}
                    </h4>
                )
            }

            if (block.type === 'note') {
                return (
                    <div key={`note-${index}`} className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-900">
                        {renderInlineFormatting(block.text)}
                    </div>
                )
            }

            return (
                <p key={`paragraph-${index}`} className="text-slate-700 text-[15px] leading-7 lg:leading-8">
                    {renderInlineFormatting(block.text)}
                </p>
            )
        })
    }

    const renderInlineFormatting = (text: string) => {
        const boldRegex = /\*\*(.*?)\*\*/g
        const parts = text.split(boldRegex)
        return parts.map((part, index) => {
            if (index % 2 === 1) {
                return <strong key={index} className="font-semibold text-slate-900">{part}</strong>
            }
            return part
        })
    }

    const handleCompanyClick = () => {
        if (!isAuthenticated) {
            goToLogin('登录后可查看企业信息。')
            return
        }
        if (promptEmailVerificationIfNeeded('查看企业信息')) return
        // Navigate to company detail page using company name as identifier
        navigate(getCompanyDetailPath(job.company || ''))
    }

    const companyIndustryLabel = companyInfo?.industry || job.companyIndustry || job.category || text('未分类', 'Uncategorized')
    const rawCompanyJobCount = Number(companyInfo?.jobCount)
    const trustedCompanyJobCount = Number.isFinite(rawCompanyJobCount) && rawCompanyJobCount > 0 ? rawCompanyJobCount : null
    const companyOpenJobCount = companyOpenJobsCount ?? trustedCompanyJobCount
    const companyDescription = String(companyInfo?.description || job.companyDescription || '').trim() || text('该企业暂无公开简介信息，Haigoo 正在持续补充。', 'No public company description is available yet. Haigoo is working to add one.')
    const companySpecialties = Array.isArray(companyInfo?.specialties) ? companyInfo!.specialties.filter(Boolean).slice(0, 8) : []
    const companyFactCards = [
        { label: text('官网', 'Website'), value: companyInfo?.website || job.companyWebsite || '', href: companyInfo?.website || job.companyWebsite || '' },
        { label: text('员工规模', 'Company size'), value: companyInfo?.employeeCount || text('规模未知', 'Unknown') },
        { label: text('总部地址', 'Headquarters'), value: companyInfo?.address || job.companyAddress || text('总部未知', 'Unknown') },
        { label: text('成立年份', 'Founded'), value: companyInfo?.foundedYear ? `${companyInfo.foundedYear}` : text('年份未知', 'Unknown') },
        { label: text('企业评分', 'Company rating'), value: companyInfo?.companyRating || job.companyRating ? `${companyInfo?.companyRating || job.companyRating}${(companyInfo?.ratingSource || job.ratingSource) ? ` · ${companyInfo?.ratingSource || job.ratingSource}` : ''}` : text('暂无评分', 'Not rated') },
        { label: text('行业类型', 'Industry'), value: companyIndustryLabel },
        { label: text('在招岗位', 'Open roles'), value: companyOpenJobCount != null ? `${companyOpenJobCount}` : text('统计中', 'Loading') }
    ].filter((item) => item.value)
    const websiteApplyUnlocked = isMember || unlockedWebsiteApplyJobIds.includes(String(job.id || ''))
    const websiteApplyFreeRemaining = Math.max(0, websiteApplyFreeLimit - websiteApplyUsageCount)
    const canWebsiteApplyFree = !isMember && isAuthenticated && !websiteApplyUnlocked && websiteApplyUsageCount < websiteApplyFreeLimit
    const shouldShowWebsiteApplyTrialStatus = Boolean(job.url || job.sourceUrl) && isAuthenticated && !isMember && !isMemberRestrictedJob && websiteApplyUsageReady
    const refCompanyName = String(job.company || companyInfo?.name || '').trim()
    const isReferralCompanyUnlocked = isMember || (!isMemberRestrictedJob && unlockedCompanies.includes(refCompanyName))
    const applicationGuideFreeRemaining = Math.max(0, referralFreeLimit - referralUsageCount)
    const applicationGuideAccessMode: GuideAccessMode = isEmailVerificationRequired
        ? 'verification_required'
        : isReferralCompanyUnlocked
        ? 'unlocked'
        : !isAuthenticated
            ? 'guest'
            : isMemberRestrictedJob
                ? 'member_only'
                : referralUsageCount < referralFreeLimit
                    ? 'free_available'
                    : 'free_exhausted'
    const firstCorporateVideo = corporateEnglishDetail?.videos?.[0] || null
    const canAccessCorporateVideo = Boolean(firstCorporateVideo && !firstCorporateVideo.isVideoLocked)
    const referralFreeRemaining = Math.max(0, referralFreeLimit - referralUsageCount)
    const hasWebsiteApply = Boolean(job.url || job.sourceUrl)
    const hasEmailApply = !usesCustomReferralContacts && !companyUsesCustomReferralContacts && Boolean(resolvedHiringEmail)
    const hasAnyEmailPath = hasEmailApply || showReferralModule
    const canUseWebsiteApply = hasWebsiteApply && (isMember || websiteApplyUnlocked || canWebsiteApplyFree)
    const resolveWebsiteApplyState = (): WebsiteApplyState => {
        if (hasWebsiteApply) {
            if (!isAuthenticated) return 'login_required'
            if (canUseWebsiteApply) return 'website_available'
            return 'website_locked_member'
        }
        if (hasAnyEmailPath) return 'email_only'
        return 'unavailable'
    }
    const websiteApplyState = resolveWebsiteApplyState()
    const lockedCompanyPreviewFields = [
        { label: '行业类型', widthClass: 'w-20' },
        { label: '官方网站', widthClass: 'w-28' },
        { label: '团队规模', widthClass: 'w-16' },
        { label: '总部地区', widthClass: 'w-24' },
    ]
    const getReferralAccessMode = (): ReferralAccessMode => {
        if (isEmailVerificationRequired) return 'verification_required'
        if (isReferralCompanyUnlocked) return 'unlocked'
        if (!isAuthenticated) return 'guest'
        if (isMemberRestrictedJob) return 'member_only'
        if (referralUsageCount < referralFreeLimit) return 'free_available'
        return 'free_exhausted'
    }
    const referralAccessMode = getReferralAccessMode()
    const hasMultipleReferralContacts = displayReferralContacts.length > 1
    const hasScrollableReferralContacts = displayReferralContacts.length >= 3
    const scrollReferralContacts = (direction: 'previous' | 'next') => {
        const container = referralContactsScrollRef.current
        if (!container) return
        const pageWidth = Math.max(Math.round(container.clientWidth * 0.8), 280)
        container.scrollBy({
            left: direction === 'previous' ? -pageWidth : pageWidth,
            behavior: 'smooth'
        })
    }
    const shouldShowUnifiedReferralUnlock = hasMultipleReferralContacts && referralAccessMode !== 'unlocked'
    const mayHaveReferralPath = Boolean(
        fallbackHiringEmail ||
        job.canRefer ||
        (typeof effectiveReferralContactCount === 'number' && effectiveReferralContactCount > 0)
    )
    const showReferralLoadingPlaceholder = isAuthenticated && !showReferralModule && companyInfoLoading && mayHaveReferralPath
    const getUnifiedReferralUnlockLabel = () => {
        if (referralAccessMode === 'guest') return '帮我内推（需登录）'
        if (referralAccessMode === 'verification_required') return '一键解锁（待验证）'
        if (referralAccessMode === 'member_only') return '了解解锁方式'
        if (referralAccessMode === 'free_available') return `一键解锁 ${referralFreeRemaining}/${referralFreeLimit}`
        if (referralAccessMode === 'free_exhausted') return `一键解锁 ${referralFreeRemaining}/${referralFreeLimit}`
        return ''
    }
    const handleUnifiedReferralUnlock = (event?: React.MouseEvent) => {
        event?.preventDefault()
        event?.stopPropagation()
        if (referralAccessMode === 'guest') {
            goToLogin()
            return
        }
        if (promptEmailVerificationIfNeeded()) return
        if (referralAccessMode === 'member_only') {
            goToMembershipPayment('member_only_job_apply', 'job_detail_referral_member_only_group')
            return
        }
        if (referralAccessMode === 'free_available') {
            handleUnlockReferralPreview()
            return
        }
        if (referralAccessMode === 'free_exhausted') {
            goToMembershipPayment('referral', 'job_detail_referral_group_exhausted')
        }
    }
    const companyRatingText = String(companyInfo?.companyRating || job.companyRating || '').trim()
    const handleUploadResumeFromDetail = () => {
        trackingService.featureClick('resume_upload', {
            ...trackingBase,
            module: 'job_detail_match_analysis',
            source_key: 'job_detail_match_upload',
            entity_type: 'job',
            entity_id: job.id
        })
        navigate('/profile?tab=resume')
    }
    const handleUnlockApplicationGuide = async () => {
        if (applicationGuideAccessMode === 'guest') {
            goToLogin()
            return
        }
        if (promptEmailVerificationIfNeeded()) return
        if (applicationGuideAccessMode === 'member_only' || applicationGuideAccessMode === 'free_exhausted') {
            goToMembershipPayment('application_guide', 'job_detail_application_guide')
            return
        }
        if (applicationGuideAccessMode !== 'free_available' || unlockingApplicationGuide) return

        const authToken = localStorage.getItem('haigoo_auth_token')
        if (!authToken) {
            goToLogin()
            return
        }

        setUnlockingApplicationGuide(true)
        try {
            const res = await trackingService.trackedFetch('/api/users?resource=free-usage&type=referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({
                    companyName: refCompanyName,
                    page_key: trackingPageKey,
                    source_key: 'job_detail_application_guide',
                    entity_type: 'company',
                    entity_id: refCompanyName,
                    flow_id: `application_guide_${job.id}`
                })
            }, {
                event_family: 'application',
                feature_key: 'application_guide',
                entity_type: 'job',
                entity_id: job.id,
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success) {
                if (res.status === 403) {
                    syncSharedFreeAccessState(data.usage, data.unlocked_companies || [], data.limit)
                    goToMembershipPayment('application_guide', 'job_detail_application_guide_exhausted')
                    return
                }
                throw new Error(data.error || '解锁失败')
            }

            clearFreeUsageCache()
            syncSharedFreeAccessState(data.usage, data.unlocked_companies || [], data.limit)
            showSuccess('已解锁岗位申请指南', `当前还可免费解锁 ${Math.max(0, (Number(data.limit) || referralFreeLimit) - (Number(data.usage) || 0))} 次`)
        } catch (error: any) {
            showError('解锁失败', error?.message || '请稍后重试')
        } finally {
            setUnlockingApplicationGuide(false)
        }
    }
    const handleCorporateVideoShortcut = () => {
        if (!firstCorporateVideo || !job.companyId) return
        trackingService.featureClick('corporate_english_video', {
            ...trackingBase,
            module: 'job_detail_company_video',
            source_key: 'job_detail_company_video',
            entity_type: 'corporate_english_material',
            entity_id: firstCorporateVideo.materialId,
            company_id: job.companyId
        })

        const query = new URLSearchParams({
            companyId: job.companyId,
            materialId: firstCorporateVideo.materialId
        })
        window.open(`/careerlearning?${query.toString()}`, '_blank', 'noopener,noreferrer')
    }
    const getApplyButtonLabel = () => {
        if (!isAuthenticated) return text('前往申请（需登录）', 'Apply (login required)')
        if (isEmailVerificationRequired) return text('前往申请（待验证）', 'Apply (email verification required)')

        switch (websiteApplyState) {
            case 'login_required':
                return text('前往申请（需登录）', 'Apply (login required)')
            case 'website_available':
                if (isMemberRestrictedJob && !isMember) return text('解锁申请入口', 'Unlock application')
                if (isMemberRestrictedJob) return text('前往申请', 'Apply now')
                if (websiteApplyUnlocked && !isMember) return text('前往申请（已解锁）', 'Apply now (unlocked)')
                return shouldShowWebsiteApplyTrialStatus && !websiteApplyUnlocked
                    ? `${text('前往申请', 'Apply now')} ${websiteApplyFreeRemaining}/${websiteApplyFreeLimit}`
                    : text('前往申请', 'Apply now')
            case 'website_locked_member':
                if (isMemberRestrictedJob && !isMember) return text('解锁申请入口', 'Unlock application')
                if (isMemberRestrictedJob) return text('前往申请', 'Apply now')
                return `${text('前往申请', 'Apply now')} ${websiteApplyFreeRemaining}/${websiteApplyFreeLimit}`
            case 'email_only':
                if (isMemberRestrictedJob && !isMember) return text('解锁申请入口', 'Unlock application')
                if (isReferralCompanyUnlocked && !isMember) return text('仅支持邮箱申请（已解锁）', 'Apply by email (unlocked)')
                return text('仅支持邮箱申请', 'Apply by email')
            default:
                return text('暂无申请入口', 'Application unavailable')
        }
    }
    const getApplyButtonClassName = () => {
        if (isMemberRestrictedJob && !isMember && websiteApplyState !== 'unavailable') {
            return 'border border-[#d8d2ff] bg-[linear-gradient(135deg,#8b7cff_0%,#6f63f6_100%)] text-white shadow-[0_20px_40px_-24px_rgba(111,99,246,0.56)] hover:shadow-[0_24px_46px_-24px_rgba(111,99,246,0.64)] hover:brightness-[1.03]'
        }

        if (!isAuthenticated && websiteApplyState !== 'unavailable') {
            return 'border border-[#d7dcff] bg-[linear-gradient(135deg,#7f78ff_0%,#5f83f7_100%)] text-white shadow-[0_20px_38px_-24px_rgba(95,131,247,0.58)] hover:shadow-[0_24px_44px_-24px_rgba(111,99,246,0.54)] hover:brightness-[1.03]'
        }

        switch (websiteApplyState) {
            case 'login_required':
            case 'website_available':
            case 'website_locked_member':
                return 'border border-[#d7dcff] bg-[linear-gradient(135deg,#7f78ff_0%,#5f83f7_100%)] text-white shadow-[0_20px_38px_-24px_rgba(95,131,247,0.58)] hover:shadow-[0_24px_44px_-24px_rgba(111,99,246,0.54)] hover:brightness-[1.03]'
            case 'email_only':
                return 'border border-[#e1e8f4] bg-white/86 text-slate-500 hover:border-[#d8d2ff] hover:text-[#6f63f6]'
            default:
                return 'border border-slate-200 bg-slate-50 text-slate-400'
        }
    }
    const handleApplyButtonClick = () => {
        trackingService.featureClick('website_apply', {
            ...trackingBase,
            module: 'job_detail_header',
            source_key: trackingSourceKey === 'job_detail' ? 'job_detail_top' : trackingSourceKey,
            entity_type: 'job',
            entity_id: job.id
        })

        if (promptEmailVerificationIfNeeded()) return

        if (websiteApplyState === 'login_required') {
            goToLogin()
            return
        }

        if (websiteApplyState === 'website_locked_member') {
            openUpgradeModal(isMemberRestrictedJob ? 'member_only_job_apply' : 'website_apply')
            return
        }

        if (websiteApplyState === 'email_only') {
            if (!isAuthenticated) {
                goToLogin()
                return
            }
            if (!showReferralModule && hasEmailApply) {
                handleApply()
                return
            }
            showInfo('仅支持邮箱申请', '该岗位不支持官网网申，请使用下方联系人入口继续申请。')
            return
        }

        if (websiteApplyState === 'unavailable') {
            showInfo('暂无申请入口', '该岗位暂未配置官网申请或邮箱直申入口。')
            return
        }

        handleApply()
    }
    const jobAny = job as any
    const rawType = String(
        job.type ||
        jobAny.positionType ||
        jobAny.position_type ||
        jobAny.jobType ||
        jobAny.job_type ||
        jobAny.jobTypeLabel ||
        jobAny.job_type_label ||
        jobAny.typeLabel ||
        jobAny.type_label ||
        ''
    ).trim()
    const titleMetaText = [
        job.title,
        job.translations?.title,
        job.category,
        job.companyIndustry,
        ...(Array.isArray(job.tags) ? job.tags : []),
        ...(Array.isArray(job.skills) ? job.skills : [])
    ].filter(Boolean).join(' ')
    const inferredExperienceLabel = inferExperienceLabelFromText(titleMetaText)
    const jobTypeLabel = resolveJobTypeLabel(rawType) || (inferredExperienceLabel === '实习' ? '实习' : '')
    const roleCandidates = [
        jobAny.role,
        jobAny.roleLabel,
        jobAny.role_label,
        jobAny.role_type,
        jobAny.roleType,
        jobAny.roleCategory,
        jobAny.role_category,
        jobAny.jobDirection,
        jobAny.job_direction,
        jobAny.direction,
        jobAny.professionDirection,
        jobAny.profession_direction,
        jobAny.careerDirection,
        jobAny.career_direction,
        job.category,
        jobAny.category
    ].map((item) => String(item || '').trim()).filter(Boolean)
    const roleLabel = roleCandidates[0] || inferRoleLabelFromText(titleMetaText)
    const rawExperienceLevel = String(
        job.experienceLevel ||
        jobAny.experienceLevel ||
        jobAny.experienceLevelLabel ||
        jobAny.experience_level_label ||
        jobAny.experience_level ||
        jobAny.experience ||
        jobAny.level ||
        jobAny.levelLabel ||
        jobAny.level_label ||
        jobAny.job_level ||
        jobAny.jobLevel ||
        ''
    ).trim()
    const experienceLabel = resolveExperienceLabel(rawExperienceLevel) || inferredExperienceLabel
    const categoryLabel = String(job.category || jobAny.category || '').trim()

    const headerTags = [
        jobTypeLabel ? { label: jobTypeLabel, type: 'normal' } : null,
        roleLabel ? { label: roleLabel, type: 'normal' } : null,
        categoryLabel ? { label: categoryLabel, type: 'normal' } : null,
        experienceLabel ? { label: experienceLabel, type: 'normal' } : null
    ].filter(Boolean).reduce((items, item) => {
        const tag = item as { label: string, type: 'normal' }
        if (!items.some((existing) => existing.label.toLowerCase() === tag.label.toLowerCase())) {
            items.push(tag)
        }
        return items
    }, [] as { label: string, type: 'normal' }[])

    const headquartersAddress = companyInfo?.address || job.companyAddress || jobAny.company_address || jobAny.trustedAddress || jobAny.trusted_address || text('总部未知', 'Unknown')
    const headquartersLocationData = useMemo(() => {
        return isConcreteLocationValue(headquartersAddress) ? findLocation(headquartersAddress) : null
    }, [headquartersAddress])
    const canShowHeadquartersLocationTooltip = Boolean(headquartersLocationData)
    const detailBackgroundSrc = resolveDetailBackground(job)
    const iconStats = [
        { label: text('薪资范围', 'Salary'), value: formatSalaryForDisplay(job.salary, text('具体面议', 'Negotiable')), icon: DollarSign, maskForGuest: true, maskWidth: 'w-24' },
        { label: text('发布时间', 'Published'), value: job.publishedAt ? new Date(job.publishedAt).toLocaleDateString(isEnglish ? 'en' : 'zh-CN') : text('未知', 'Unknown'), icon: Calendar, maskForGuest: true, maskWidth: 'w-20' },
        { label: text('总部地址', 'Headquarters'), value: headquartersAddress, icon: MapPin, maskForGuest: true, maskWidth: 'w-24', locationTooltip: canShowHeadquartersLocationTooltip ? 'headquarters' as const : undefined },
        { label: text('行业类型', 'Industry'), value: companyIndustryLabel || text('未知', 'Unknown'), icon: Building2, maskForGuest: true, maskWidth: 'w-20' }
    ]
    const positionHeadquartersTooltip = () => {
        if (typeof window === 'undefined') return
        const rect = headquartersStatRef.current?.getBoundingClientRect()
        if (!rect) return
        const margin = 12
        const tooltipWidth = 320
        const left = Math.max(margin, Math.min(rect.left, window.innerWidth - tooltipWidth - margin))
        setHeadquartersTooltipPosition({ left, top: rect.bottom + 6 })
    }

    const detailTabs = [
        { key: 'description' as const, label: text('职位详情', 'Job details') },
        { key: 'company' as const, label: text('企业信息', 'Company') },
        { key: 'jobs' as const, label: `${text('在招职位', 'Open roles')} ${companyOpenJobCount != null ? companyOpenJobCount : ''}`.trim() }
    ]
    const companyJobsForTab = useMemo(() => {
        const seen = new Set<string>()
        const items = [job, ...companyOpenJobs].filter(Boolean).reduce((acc, item) => {
            if (!item?.id || seen.has(item.id)) return acc
            seen.add(item.id)
            acc.push(item)
            return acc
        }, [] as Job[])
        return items.slice(0, 8)
    }, [companyOpenJobs, job])
    const nestedJob = nestedJobIndex == null ? null : companyJobsForTab[nestedJobIndex] || null

    return (
        <div className="flex flex-col overflow-hidden bg-[#fbfaf6] pb-[env(safe-area-inset-bottom)]">
            <header className="relative z-20 flex-shrink-0 overflow-hidden border-b border-[#e8f0f4] bg-[#fffdf9] px-4 pb-0 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-6 sm:pt-6 xl:px-8">
                <img
                    src={detailBackgroundSrc}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[58%] object-cover object-right-bottom opacity-[0.52] saturate-[0.98] lg:block"
                    loading="lazy"
                    decoding="async"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[60%] bg-[radial-gradient(circle_at_82%_14%,rgba(255,238,190,0.28),transparent_28%),linear-gradient(90deg,rgba(255,253,249,0.99)_0%,rgba(255,253,249,0.78)_42%,rgba(255,255,255,0.1)_100%)] lg:block" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.36)_0%,rgba(255,250,239,0.4)_100%)]" />
                {showCloseButton && (
                    <div className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] z-40 flex items-center gap-1 sm:top-4">
                        {showInlineNavigation && (
                            <>
                                <button onClick={() => onNavigateJob?.('prev')} disabled={!canNavigatePrev} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/80 disabled:opacity-30">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button onClick={() => onNavigateJob?.('next')} disabled={!canNavigateNext} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/80 disabled:opacity-30">
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </>
                        )}
                        {onClose && (
                            <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#dce8ef] bg-white/92 text-slate-500 shadow-sm hover:bg-white hover:text-slate-900">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Top Row: Title & Actions */}
                <div className="relative z-10 mb-3 flex min-w-0 items-start gap-3 pr-12 sm:pr-36 xl:pr-[320px]">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5">
                        <h1 className="line-clamp-2 min-w-0 max-w-full break-words text-[22px] font-black leading-[1.16] tracking-tight text-slate-950 [text-wrap:balance] sm:text-[25px] xl:text-[28px] 2xl:text-[30px]">
                            {displayText(job.title, job.translations?.title)}
                        </h1>

                        {hasTranslation && !isEnglish ? (
                            <div className="inline-flex h-6 shrink-0 items-center rounded-full border border-[#d7e2ff] bg-[#f8faff] px-0.5 text-[11px] font-black text-slate-400 shadow-[0_8px_20px_-18px_rgba(47,81,140,0.5)]" aria-label="切换岗位详情语言">
                                <button
                                    type="button"
                                    onClick={() => setTranslationMode(true)}
                                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 transition-colors ${showTranslation ? 'bg-[#6f63f6] text-white shadow-sm' : 'text-[#6f63f6] hover:bg-white'}`}
                                    aria-pressed={showTranslation}
                                >
                                    译
                                </button>
                                <span className="px-0.5 text-slate-300">/</span>
                                <button
                                    type="button"
                                    onClick={() => setTranslationMode(false)}
                                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 transition-colors ${!showTranslation ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-400 hover:bg-white hover:text-slate-700'}`}
                                    aria-pressed={!showTranslation}
                                >
                                    原
                                </button>
                            </div>
                        ) : null}
                        {Number(job.applicationCount || 0) >= 10 || job.isHotApplication ? (
                            <HotApplicationBadge count={Number(job.applicationCount || 0)} />
                        ) : null}
                    </div>

                    <div className="absolute right-16 top-0 hidden shrink-0 items-center gap-2 sm:flex xl:fixed xl:right-auto xl:top-auto xl:hidden">
                        <button
                            onClick={handleSave}
                            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border px-3.5 text-[13px] font-bold transition-colors ${
                                isSaved ? 'border-[#d8d2ff] bg-white text-[#6f63f6]' : 'border-[#dce8ef] bg-white/90 text-slate-600 hover:border-[#d8d2ff] hover:text-[#6f63f6]'
                            }`}
                        >
                            <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`} />
                            <span>{isSaved ? text('已收藏', 'Saved') : text('收藏', 'Save')}</span>
                        </button>
                        <button
                            onClick={handleShare}
                            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-[#dce8ef] bg-white/90 px-3.5 text-[13px] font-bold text-slate-600 transition-colors hover:border-[#d8d2ff] hover:text-[#6f63f6]"
                        >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>{text('分享', 'Share')}</span>
                        </button>
                    </div>
                </div>

                <div className="absolute right-8 top-6 z-30 hidden shrink-0 items-center gap-2 xl:flex">
                        <button
                            onClick={handleSave}
                            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border px-3.5 text-[13px] font-bold transition-colors ${
                            isSaved ? 'border-[#d8d2ff] bg-white text-[#6f63f6]' : 'border-[#dce8ef] bg-white/90 text-slate-600 hover:border-[#d8d2ff] hover:text-[#6f63f6]'
                        }`}
                    >
                        <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`} />
                        <span>{isSaved ? text('已收藏', 'Saved') : text('收藏', 'Save')}</span>
                    </button>
                    <button
                        onClick={handleShare}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl border border-[#dce8ef] bg-white/90 px-3.5 text-[13px] font-bold text-slate-600 transition-colors hover:border-[#d8d2ff] hover:text-[#6f63f6]"
                    >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>{text('分享', 'Share')}</span>
                    </button>
                </div>

                {/* Company & Location Row */}
                <div className="relative z-10 mb-4 flex items-center gap-3 xl:max-w-[calc(100%-380px)]">
                    <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500 font-medium sm:text-[14px]">
                        <span className="font-bold text-slate-700">{displayText(job.company || '')}</span>
                        {companyRatingText && (
                            <>
                                <span className="text-slate-300">·</span>
                                <span className="flex items-center gap-0.5 font-bold text-amber-500">
                                    <Star className="h-3.5 w-3.5 fill-current" />
                                    {shouldMaskGuestMeta ? <GuestMaskedInline className="w-8" /> : companyRatingText}
                                </span>
                            </>
                        )}
                        <span className="text-slate-300">·</span>
                        <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span>{locationDisplayText}</span>
                        </span>
                    </div>
                </div>

                {/* Tags & Apply Row */}
                <div className="relative z-20 mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
                    {/* Tags */}
                    <div className="flex min-h-[44px] min-w-0 flex-wrap items-center gap-2">
                        {headerTags.map((tag, idx) => (
                            <span
                                key={idx}
                                className={`rounded-full px-3 py-1 text-[13px] font-bold shadow-[0_10px_20px_-16px_rgba(52,76,92,0.42)] ${
                                    'border border-[#e0e9ef] bg-white/92 text-slate-700'
                                }`}
                            >
                                {tag.label}
                            </span>
                        ))}
                    </div>

                    {/* Apply Button Group */}
                    <div className="flex min-h-[44px] w-full shrink-0 items-end xl:-translate-y-2 xl:justify-self-end">
                        {(hasWebsiteApply || hasAnyEmailPath || onApply) && (
                            <button
                                onClick={handleApplyButtonClick}
                            className={`inline-flex h-[44px] w-full items-center justify-center gap-2 rounded-[18px] px-4 text-[15px] font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${getApplyButtonClassName()}`}
                        >
                                <span className="flex items-center gap-1.5">
                                    {getApplyButtonLabel()}
                                </span>
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Icon Stats Row */}
                <div className="relative z-10 grid max-w-full grid-cols-2 gap-2 border-t border-[#e8f0f4]/70 pb-4 pt-3 sm:gap-2.5 sm:pb-5 sm:pt-4 md:grid-cols-4">
                    {iconStats.map((stat, idx) => {
                        const canShowHeadquartersTooltip = stat.locationTooltip === 'headquarters' && !shouldMaskGuestMeta && canShowHeadquartersLocationTooltip
                        return (
                            <div
                                key={idx}
                                ref={stat.locationTooltip === 'headquarters' ? headquartersStatRef : undefined}
                                className={`relative flex min-h-[58px] min-w-0 items-center gap-2 rounded-[16px] border border-white/90 bg-white/86 px-2.5 py-2 shadow-[0_14px_34px_-28px_rgba(52,76,92,0.25)] backdrop-blur-[3px] sm:min-h-[64px] sm:rounded-[18px] ${canShowHeadquartersTooltip ? 'cursor-help transition-colors hover:border-[#c9dcf6] hover:bg-white' : ''}`}
                                onMouseEnter={() => {
                                    if (canShowHeadquartersTooltip) {
                                        positionHeadquartersTooltip()
                                        setShowHeadquartersLocationTooltip(true)
                                    }
                                }}
                                onClick={(event) => {
                                    if (!canShowHeadquartersTooltip) return
                                    event.stopPropagation()
                                    positionHeadquartersTooltip()
                                    setShowHeadquartersLocationTooltip((value) => !value)
                                }}
                            >
                                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#eef7ff] text-[#6a91c3] ${canShowHeadquartersTooltip ? 'ring-1 ring-[#c9dcf6]' : ''}`}>
                                    <stat.icon className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <span className="block whitespace-nowrap text-[10px] font-semibold text-slate-400">{stat.label}</span>
                                    {shouldMaskGuestMeta && stat.maskForGuest ? (
                                        <GuestMaskedStatValue className={stat.maskWidth} />
                                    ) : (
                                        <span className="mt-0.5 block truncate text-[12px] font-black leading-snug text-slate-900" title={stat.value}>{stat.value}</span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </header>

            {/* Content - Flat layout, no internal scroll */}
            <main className="flex-1 bg-[#fbfaf6]">
                <div className="sticky top-0 z-30 border-b border-[#e8f0f4] bg-white/92 px-4 py-2.5 sm:px-6">
                    <div className="flex items-center justify-start gap-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {detailTabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveDetailTab(tab.key)}
                                className={`relative whitespace-nowrap pb-2 text-sm font-semibold transition-colors ${
                                    activeDetailTab === tab.key ? 'text-[#6f63f6]' : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                {tab.label}
                                {activeDetailTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#6f63f6]" />}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="space-y-4 bg-[#fbfaf6] px-4 py-4 sm:px-6 sm:py-5">
                    {activeDetailTab === 'description' && (
                        <>
                    {(showReferralModule || isMemberRestrictedJob) && isAuthenticated && !isMember && (
                            <button
                                type="button"
                                onClick={() => goToMembershipPayment('referral', 'job_detail_member_value_panel')}
                                className="group flex w-full items-center justify-between gap-3 rounded-[18px] border border-[#f1d9a5] bg-[linear-gradient(135deg,rgba(255,252,242,0.98)_0%,rgba(246,251,255,0.96)_100%)] px-3.5 py-2.5 text-left shadow-[0_18px_46px_-40px_rgba(82,112,136,0.42)] transition-all hover:-translate-y-0.5 hover:border-[#e9c775] hover:shadow-[0_24px_54px_-42px_rgba(154,100,16,0.35)]"
                            >
                                <div className="flex min-w-0 items-center gap-2.5">
                                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fff3d6] text-[#bd7a12]">
                                        <Lock className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-[13px] font-black text-slate-900">{text('Club 会员可解锁联系人与申请入口', 'Club members can unlock contacts and application access')}</span>
                                        <span className="block truncate text-[12px] font-semibold text-slate-500">{text('了解适合你的服务方案，加入后可开通网站对应权限。', 'Explore a plan that fits your needs and unlock the relevant tools.')}</span>
                                    </span>
                                </div>
                                <span className="inline-flex h-8 shrink-0 items-center rounded-full bg-slate-950 px-3.5 text-[12px] font-black text-white transition-colors group-hover:bg-[#6f63f6]">
                                    {text('了解解锁方式', 'See unlock options')}
                                </span>
                            </button>
                    )}
                    {showReferralLoadingPlaceholder && (
                        <section className="rounded-[26px] border border-[#dce8ef] bg-white/88 p-5 shadow-[0_22px_52px_-42px_rgba(52,76,92,0.26)] md:p-6">
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="h-6 w-44 rounded-full bg-slate-200/90" />
                                    <div className="mt-3 h-4 w-full max-w-[560px] rounded-full bg-slate-100" />
                                </div>
                                <div className="hidden h-10 w-28 rounded-2xl bg-slate-100 md:block" />
                            </div>
                            <div className="mt-5 grid gap-3 md:grid-cols-2">
                                {[0, 1].map((item) => (
                                    <div key={item} className="h-[148px] rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-12 w-12 rounded-2xl bg-slate-200/80" />
                                            <div className="min-w-0 flex-1 space-y-2">
                                                <div className="h-4 w-24 rounded-full bg-slate-200/90" />
                                                <div className="h-3 w-36 rounded-full bg-slate-100" />
                                            </div>
                                        </div>
                                        <div className="mt-6 h-10 rounded-xl bg-white" />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                    {/* 帮我内推 — placed ABOVE AI match analysis */}
                    {showReferralModule && (
                        <section>
                            <div className="rounded-[22px] border border-[#dce8ef] bg-white/92 p-4 shadow-[0_22px_52px_-42px_rgba(52,76,92,0.34)] sm:rounded-[26px] sm:p-5 md:p-6">
                                <div className="min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="min-w-0 text-[18px] md:text-[20px] font-black tracking-tight text-slate-900">
                                            帮我内推 <span className="font-black text-[#6f63f6]">@{job.company || companyInfo?.name || '该企业'}</span>
                                        </h3>
                                        {hasScrollableReferralContacts && (
                                            <div className="mt-0.5 flex shrink-0 items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => scrollReferralContacts('previous')}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d8d2ff] bg-[#f6f3ff] text-[#6f63f6] transition-colors hover:bg-[#ede9fe]"
                                                    aria-label="查看上一位联系人"
                                                    title="上一位"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => scrollReferralContacts('next')}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d8d2ff] bg-[#f6f3ff] text-[#6f63f6] transition-colors hover:bg-[#ede9fe]"
                                                    aria-label="查看下一位联系人"
                                                    title="下一位"
                                                >
                                                    <ChevronRight className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <p className={`mt-2 text-xs leading-6 text-slate-600 md:text-[13px] ${showCloseButton && !showInlineNavigation ? 'sm:truncate' : ''}`}>
                                        Haigoo 为你找到了本岗位的直接招聘 HR /业务负责人，简历邮件直达关键决策方，申请效率提升3倍。
                                    </p>
                                </div>

                                {(() => {
                                    const isReferralUnlocked = isReferralCompanyUnlocked

                                    const contactThemes = [
                                        {
                                            art: '/pic_lists/Jobs_pics/card_bg1.webp',
                                            shell: 'border-[#c9dcf6] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,251,255,0.96))]',
                                            glow: 'from-[#8eb8f0] via-[#5bb6e8] to-[#6cd4bd]',
                                            avatar: 'border-[#d8d2ff] bg-[linear-gradient(135deg,#7f78ff_0%,#5f83f7_100%)] text-white',
                                            icon: 'border-[#d8d2ff] bg-[#f6f3ff] text-[#6f63f6]',
                                            chip: 'border-[#d8d2ff] bg-[#f6f3ff] text-[#6f63f6]'
                                        },
                                        {
                                            art: '/pic_lists/Jobs_pics/card_bg2.webp',
                                            shell: 'border-sky-100/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,250,255,0.96))]',
                                            glow: 'from-sky-500 via-cyan-400 to-teal-400',
                                            avatar: 'border-sky-200 bg-[linear-gradient(135deg,#1d9bf0_0%,#4dd4ff_100%)] text-white',
                                            icon: 'border-sky-100 bg-sky-50 text-sky-700',
                                            chip: 'border-sky-100 bg-sky-50 text-sky-700'
                                        },
                                        {
                                            art: '/pic_lists/Jobs_pics/card_bg1.webp',
                                            shell: 'border-emerald-100/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,252,248,0.96))]',
                                            glow: 'from-emerald-500 via-teal-400 to-cyan-400',
                                            avatar: 'border-emerald-200 bg-[linear-gradient(135deg,#22c55e_0%,#14b8a6_100%)] text-white',
                                            icon: 'border-emerald-100 bg-emerald-50 text-emerald-700',
                                            chip: 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                        },
                                        {
                                            art: '/pic_lists/Jobs_pics/card_bg2.webp',
                                            shell: 'border-violet-100/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,246,255,0.96))]',
                                            glow: 'from-violet-500 via-fuchsia-400 to-pink-400',
                                            avatar: 'border-violet-200 bg-[linear-gradient(135deg,#8b5cf6_0%,#ec4899_100%)] text-white',
                                            icon: 'border-violet-100 bg-violet-50 text-violet-700',
                                            chip: 'border-violet-100 bg-violet-50 text-violet-700'
                                        }
                                    ]

                                    const handleLockedContactClick = (event: React.MouseEvent, mode: 'guest' | 'verification_required' | 'member_only' | 'free_available' | 'free_exhausted') => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        if (mode === 'guest') {
                                            goToLogin()
                                            return
                                        }
                                        if (promptEmailVerificationIfNeeded()) return
                                        if (mode === 'member_only') {
                                            goToMembershipPayment('member_only_job_apply', 'job_detail_referral_member_only_card')
                                            return
                                        }
                                        if (mode === 'free_available') {
                                            handleUnlockReferralPreview()
                                            return
                                        }
                                        goToMembershipPayment('referral', 'job_detail_referral_exhausted')
                                    }

                                    return (
                                        <div ref={referralContactsScrollRef} className="mt-4 flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
                                            {displayReferralContacts.map((contact, index) => {
                                                const theme = contactThemes[index % contactThemes.length]
                                                const isUnlockedCard = referralAccessMode === 'unlocked'
                                                const displayName = isUnlockedCard ? (contact.name || '-') : `${formatMaskedName(contact.name)}*`
                                                const displayTitle = contact.title || 'Hiring Contact'
                                                const avatarLabel = getReferralAvatarLabel(contact)
                                                const shouldShowReferralTrialCount = !isUnlockedCard && isAuthenticated && !isMember && !isMemberRestrictedJob && sharedFreeUsageReady
                                                const emailButtonLabel = isUnlockedCard
                                                    ? !isMember
                                                        ? `${getReferralEmailActionLabel(contact)}（已解锁）`
                                                        : getReferralEmailActionLabel(contact)
                                                    : shouldShowUnifiedReferralUnlock
                                                        ? getUnifiedReferralUnlockLabel()
                                                            : referralAccessMode === 'guest'
                                                                ? '帮我内推（需登录）'
                                                            : referralAccessMode === 'verification_required'
                                                                ? '一键解锁（待验证）'
                                                            : referralAccessMode === 'member_only'
                                                                ? '了解解锁方式'
                                                                : referralAccessMode === 'free_exhausted'
                                                                    ? `一键解锁 ${referralFreeRemaining}/${referralFreeLimit}`
                                                                    : shouldShowReferralTrialCount
                                                                        ? `${getReferralEmailActionLabel(contact)} ${referralFreeRemaining}/${referralFreeLimit}`
                                                                        : getReferralEmailActionLabel(contact)

                                                return (
                                                    <div
                                                        key={`ref-contact-${index}`}
                                                        onClick={referralAccessMode === 'guest' || referralAccessMode === 'verification_required' ? (event) => handleLockedContactClick(event, referralAccessMode) : undefined}
                                                        className={`relative min-w-[min(260px,calc(100vw-72px))] basis-[78%] shrink-0 snap-start overflow-hidden rounded-2xl border ${
                                                            hasScrollableReferralContacts
                                                                ? 'sm:min-w-[260px] sm:basis-[calc((100%_-_2rem)/2.5)]'
                                                                : 'sm:min-w-[340px] sm:basis-[calc((100%_-_1rem)/2)]'
                                                        } ${theme.shell} ${
                                                            referralAccessMode === 'guest' || referralAccessMode === 'verification_required' ? 'cursor-pointer' : ''
                                                        } shadow-[0_10px_25px_-12px_rgba(15,23,42,0.12)]`}
                                                    >
                                                        <img
                                                            src={theme.art}
                                                            alt=""
                                                            aria-hidden="true"
                                                            className="pointer-events-none absolute bottom-0 right-0 h-[86px] w-[128px] object-cover object-right-bottom opacity-[0.13]"
                                                            loading="lazy"
                                                        />
                                                        <div className={`pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-gradient-to-b ${theme.glow}`} />
                                                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.28),transparent_34%,rgba(255,255,255,0.12)_68%,transparent)] opacity-90" />
                                                        <div className="relative p-5">
                                                            <div className="flex items-center gap-3 mb-6">
                                                                <div className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] border text-center font-black uppercase tracking-[-0.02em] ${theme.avatar} shadow-sm`}>
                                                                    <span className="block text-[14px] leading-none">{avatarLabel}</span>
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-[17px] font-black tracking-tight text-slate-900 leading-tight">
                                                                        {displayName}
                                                                    </div>
                                                                    <div className="truncate text-[13px] font-bold text-slate-500 mt-1">
                                                                        {displayTitle}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                        type="button"
                                                                        onClick={(event) => {
                                                                            if (!isUnlockedCard) {
                                                                                if (shouldShowUnifiedReferralUnlock) {
                                                                                    handleUnifiedReferralUnlock(event)
                                                                                    return
                                                                                }
                                                                                handleLockedContactClick(event, referralAccessMode)
                                                                                return
                                                                            }
                                                                            event.stopPropagation()
                                                                            openReferralEmailAssistant(contact)
                                                                        }}
                                                                        className={`flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-bold shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[1] ${
                                                                            isUnlockedCard
                                                                                ? 'border-[#6f63f6] bg-[linear-gradient(135deg,#7f78ff_0%,#5f83f7_100%)] text-white shadow-[0_18px_32px_-24px_rgba(111,99,246,0.5)]'
                                                                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900'
                                                                        }`}
                                                                >
                                                                    {isUnlockedCard && <Mail className="h-4 w-4 shrink-0 opacity-80" />}
                                                                    {!isUnlockedCard && <Lock className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                                                                    <span>{emailButtonLabel}</span>
                                                                </button>

                                                                {contact.linkedin ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(event) => {
                                                                            if (!isUnlockedCard) {
                                                                                handleLockedContactClick(event, referralAccessMode)
                                                                                return
                                                                            }
                                                                            event.stopPropagation()
                                                                            if (promptEmailVerificationIfNeeded()) return
                                                                            window.open(toSafeExternalUrl(contact.linkedin), '_blank', 'noopener,noreferrer')
                                                                        }}
                                                                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all hover:scale-[1.02] ${
                                                                            isUnlockedCard
                                                                                ? `${theme.icon} shadow-sm hover:brightness-95`
                                                                                : 'border-slate-200 bg-slate-100 text-slate-500'
                                                                        }`}
                                                                        title="LinkedIn"
                                                                    >
                                                                        <Linkedin className="h-4 w-4 shrink-0" />
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                })()}
                            </div>
                        </section>
                    )}

                    {(showMatchDetails || (showResumeUploadPrompt && !hasApplicationGuide)) && (
                        <div className="mb-6">
                            <MatchDetailsPanel
                                matchLevel={matchLevel}
                                matchDetails={matchDetails}
                                hasResume={hasUploadedResume}
                                onUploadResume={handleUploadResumeFromDetail}
                            />
                        </div>
                    )}

                    {hasApplicationGuide && (
                        <div className="mb-6 space-y-3">
                            <ApplicationGuidePanel
                                guide={applicationGuide}
                                accessMode={applicationGuideAccessMode}
                                remaining={applicationGuideFreeRemaining}
                                limit={referralFreeLimit}
                                isUnlocking={unlockingApplicationGuide}
                                onUnlock={handleUnlockApplicationGuide}
                                onUpgrade={() => goToMembershipPayment('application_guide', 'job_detail_application_guide')}
                            />
                            {showResumeUploadPrompt && (
                                <MatchDetailsPanel
                                    matchLevel={matchLevel}
                                    matchDetails={matchDetails}
                                    hasResume={false}
                                    compactUploadPrompt
                                    onUploadResume={handleUploadResumeFromDetail}
                                />
                            )}
                        </div>
                    )}

                    {/* Job Description Sections */}
                    {jobDetailSections.map((section, index) => (
                        <section key={index} className="last:mb-0 rounded-[26px] border border-[#dce8ef] bg-white/88 px-5 py-5 shadow-[0_22px_48px_-42px_rgba(52,76,92,0.24)]">
                            <div className="mb-4 flex items-start gap-3">
                                <div className="mt-0.5 h-7 w-1.5 rounded-full bg-[#7fbf91]"></div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-slate-900 leading-7">
                                        {section.displayTitle}
                                    </h3>
                                    {!showTranslation && section.rawTitle && section.rawTitle !== section.displayTitle && (
                                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400 break-words">
                                            {section.rawTitle}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                {renderSectionBlocks(section.activeBlocks)}
                            </div>
                        </section>
                    ))}

                    {/* Skills/Tags */}
                    {((job.tags && job.tags.length > 0) || (job.skills && job.skills.length > 0)) && (
                        <section className="rounded-[26px] border border-[#dce8ef] bg-white/88 px-5 py-5 shadow-[0_22px_48px_-42px_rgba(52,76,92,0.24)]">
                            <h3 className="text-base font-semibold text-slate-900 mb-3">
                                {text('技能要求', 'Skills')}
                            </h3>
                            <SingleLineTags
                                tags={(Array.isArray(job.tags) && job.tags.length > 0
                                    ? job.tags
                                    : (job.skills || [])) as string[]}
                                size="sm"
                            />
                        </section>
                    )}
                    <div className="mx-auto flex max-w-[760px] items-center justify-center gap-2 rounded-full border border-[#dce8ef] bg-white/72 px-4 py-2 text-center text-[12px] font-medium text-slate-500 shadow-[0_16px_34px_-32px_rgba(52,76,92,0.3)]">
                        <Leaf className={`h-3.5 w-3.5 shrink-0 ${isMember ? 'text-[#7fbf91]' : 'text-[#7fbf91]'}`} aria-hidden="true" />
                        <span>
                            {isMember
                                ? '心若安定，路自清明；慢慢走，也会抵达适合自己的远方。'
                                : '迷茫的时候，不妨换个地方，给自己一点时间和空间。你想要的生活正在路上。'}
                        </span>
                    </div>
                        </>
                    )}

                    {activeDetailTab === 'company' && (
                        <section className="rounded-[26px] border border-slate-100 bg-white/92 p-5 shadow-[0_22px_48px_-42px_rgba(15,23,42,0.22)]">
                            <div className="mb-5 flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h3 className="truncate text-xl font-black text-slate-950">{displayText(job.company || '')}</h3>
                                    <p className="mt-2 text-sm leading-7 text-slate-600">{companyDescription}</p>
                                </div>
                            </div>

                            {firstCorporateVideo && (
                                <CorporateVideoShortcut
                                    video={firstCorporateVideo}
                                    canAccess={canAccessCorporateVideo}
                                    canShowTitle={isAuthenticated}
                                    logoCandidates={getCompanyLogoSources({
                                        companyId: job.companyId,
                                        cachedLogoUrl: String(
                                            corporateEnglishDetail?.company?.cachedLogoUrl ||
                                            (companyInfo as any)?.cachedLogoUrl ||
                                            (job as any)?.cachedCompanyLogoUrl ||
                                            (job as any)?.cachedLogoUrl ||
                                            ''
                                        ).trim(),
                                        originalLogoUrl: String(
                                            corporateEnglishDetail?.company?.originalLogoUrl ||
                                            corporateEnglishDetail?.company?.logo ||
                                            (companyInfo as any)?.logo ||
                                            job.logo ||
                                            job.companyLogo ||
                                            ''
                                        ).trim(),
                                        version: String((companyInfo as any)?.updatedAt || job.updatedAt || job.publishedAt || '').trim()
                                    })}
                                    companyName={job.company || companyInfo?.name || ''}
                                    onClick={handleCorporateVideoShortcut}
                                />
                            )}

                            {isAuthenticated ? (
                                <>
                                    <div className={`${firstCorporateVideo ? 'mt-5' : ''} grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3`}>
                                        {companyFactCards.map((item) => (
                                            <div key={item.label} className="flex min-w-0 flex-col justify-center rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_2px_8px_-4px_rgba(15,23,42,0.06)] transition-colors hover:border-slate-200">
                                                <div className="mb-1 text-[12px] font-medium text-slate-400">{item.label}</div>
                                                {item.href ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => window.open(toSafeExternalUrl(item.href), '_blank', 'noopener,noreferrer')}
                                                        className="block max-w-full truncate text-left text-[14px] font-bold text-[#6f63f6] hover:text-[#5f55e8] hover:underline"
                                                        title={item.value}
                                                    >
                                                        {item.value}
                                                    </button>
                                                ) : (
                                                    <div className="truncate text-[14px] font-bold text-slate-800" title={item.value}>{item.value}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {companySpecialties.length > 0 && (
                                        <div className="mt-6 border-t border-slate-100 pt-5">
                                            <div className="text-[13px] font-semibold text-slate-400">{text('企业领域/专长', 'Company specialties')}</div>
                                            <div className="mt-3 flex flex-wrap gap-2.5">
                                                {companySpecialties.map((item) => (
                                                    <span key={item} className="rounded-full border border-slate-200/80 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-slate-600 shadow-sm">
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="mt-4">
                                    <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-white p-3 text-xs shadow-sm sm:grid-cols-4">
                                        {lockedCompanyPreviewFields.map((field) => (
                                            <div key={field.label} className="min-w-0">
                                                <div className="font-medium text-slate-400">{field.label}</div>
                                                <div className={`mt-2 h-3.5 rounded-full bg-slate-300/80 blur-[2px] ${field.widthClass}`} aria-hidden="true" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {activeDetailTab === 'jobs' && (
                        <section className="rounded-[26px] border border-slate-100 bg-white/88 p-5 shadow-[0_22px_48px_-42px_rgba(15,23,42,0.22)]">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{text('企业在招岗位', 'Open roles at this company')}</h3>
                                    <p className="mt-1 text-sm text-slate-500">{text('包含当前岗位；点击其他岗位可在弹窗中查看详情', 'Includes this role; select another role to view its details.')}</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                    {companyOpenJobCount != null ? `${companyOpenJobCount}` : text('统计中', 'Loading')}
                                </span>
                            </div>
                            {companyJobsForTab.length > 0 ? (
                                <div className="space-y-2">
                                    {companyJobsForTab.map((item, index) => {
                                        const isCurrentJob = item.id === job.id
                                        return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => {
                                                if (isCurrentJob) {
                                                    setActiveDetailTab('description')
                                                    return
                                                }
                                                setNestedJobIndex(index)
                                            }}
                                            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                                                isCurrentJob
                                                    ? 'border-[#d8d2ff] bg-[#f6f3ff]/70'
                                                    : 'border-slate-200 bg-white hover:border-[#d8d2ff] hover:bg-[#f6f3ff]/45'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <div className="truncate text-sm font-bold text-slate-900">{isEnglish ? item.title : (item.translations?.title || item.title)}</div>
                                                    {isCurrentJob ? (
                                                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-[#6f63f6]">{text('当前', 'Current')}</span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                    <span>{isEnglish ? (item.type || 'Job') : (JOB_TYPE_LABELS[item.type] || item.type || '岗位')}</span>
                                                    <span>·</span>
                                                    <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString(isEnglish ? 'en' : 'zh-CN') : text('未知时间', 'Unknown date')}</span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                        </button>
                                    )})}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                    暂无其他公开在招岗位
                                </div>
                            )}
                        </section>
                    )}

                </div>
            </main>

            {/* Feedback Modal */}
            {
                isFeedbackOpen && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
                        <div className="w-full max-w-[430px] overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_40px_120px_-48px_rgba(15,23,42,0.55)] mx-4">
                            <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#312e81_55%,#155e75_100%)] px-5 py-5 text-white">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                                <div className="relative z-10 flex items-center justify-between">
                                    <div>
                                        <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">{text('岗位反馈', 'Job feedback')}</div>
                                        <h3 className="mt-3 text-lg font-bold">{text('告诉我们这条岗位信息是否准确', 'Tell us whether this job information is accurate')}</h3>
                                    </div>
                                    <button onClick={() => setIsFeedbackOpen(false)} className="rounded-full border border-white/12 bg-slate-900/10 p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-5 space-y-4">
                                <p className="text-sm text-slate-500">{text('你的反馈会帮助我们继续优化岗位质量与展示准确度。', 'Your feedback helps us improve job quality and accuracy.')}</p>
                                <div>
                                    <label className="block text-sm font-medium mb-2">{text('该岗位信息是否准确？', 'Is this job information accurate?')}</label>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-sm">
                                            <input type="radio" name="accuracy" value="accurate" checked={feedbackAccuracy === 'accurate'} onChange={() => setFeedbackAccuracy('accurate')} />
                                            {text('准确', 'Accurate')}
                                        </label>
                                        <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-sm">
                                            <input type="radio" name="accuracy" value="inaccurate" checked={feedbackAccuracy === 'inaccurate'} onChange={() => setFeedbackAccuracy('inaccurate')} />
                                            {text('不准确', 'Inaccurate')}
                                        </label>
                                        <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-sm">
                                            <input type="radio" name="accuracy" value="unknown" checked={feedbackAccuracy === 'unknown'} onChange={() => setFeedbackAccuracy('unknown')} />
                                            {text('不确定', 'Not sure')}
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">{text('反馈内容', 'Feedback')}</label>
                                    <textarea value={feedbackContent} onChange={(e) => setFeedbackContent(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm" placeholder={text('请描述你发现的问题或建议', 'Describe the issue or suggestion')}></textarea>
                                </div>
                                {feedbackMessage && <div className="text-sm text-[#6f63f6]">{feedbackMessage}</div>}
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setIsFeedbackOpen(false)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">{text('取消', 'Cancel')}</button>
                                    <button onClick={submitFeedback} disabled={feedbackSubmitting} className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-50">{text('提交', 'Submit')}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            <ReferralApplicationModal
                isOpen={isReferralModalOpen}
                onClose={() => setIsReferralModalOpen(false)}
                job={job}
                onSubmitSuccess={handleReferralSuccess}
            />
            <EmailConnectModal
                isOpen={isEmailConnectOpen}
                onClose={() => {
                    setIsEmailConnectOpen(false)
                    setSelectedReferralContact(null)
                }}
                contact={selectedReferralContact}
                job={job}
                onOpenEmail={({ contact, resumeId, resumeName }) => {
                    handleReferralEmailOpen(contact, resumeId, resumeName)
                }}
            />
            {/* Share Modal */}
            <ShareJobModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                jobId={job.id}
                jobTitle={isEnglish ? job.title : (job.translations?.title || job.title)}
                companyName={isEnglish ? (job.company || '') : (job.translations?.company || job.company || '')}
            />
            <EmailVerificationRequiredModal
                isOpen={showEmailVerificationPrompt}
                onClose={() => setShowEmailVerificationPrompt(false)}
                actionLabel={emailVerificationActionLabel}
            />

            {showHeadquartersLocationTooltip && headquartersTooltipPosition && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed z-[10000] w-80"
                    style={{
                        left: `${headquartersTooltipPosition.left}px`,
                        top: `${headquartersTooltipPosition.top}px`
                    }}
                    onMouseLeave={() => setShowHeadquartersLocationTooltip(false)}
                    onClick={(event) => event.stopPropagation()}
                >
                    <LocationTooltip
                        location={headquartersAddress}
                        floating
                        onClose={() => setShowHeadquartersLocationTooltip(false)}
                    />
                </div>,
                document.body
            )}

            {nestedJob && createPortal(
                <div
                    className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm"
                    onClick={() => setNestedJobIndex(null)}
                >
                    <div
                        className="relative h-[88vh] w-full max-w-[1120px] overflow-hidden rounded-[30px] border border-white/70 bg-[#fbfaf6] shadow-[0_42px_120px_-42px_rgba(15,23,42,0.62)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setNestedJobIndex(null)}
                            className="absolute right-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe7ef] bg-white/92 text-slate-500 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.45)] transition-colors hover:text-slate-900"
                            aria-label="关闭岗位详情"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            disabled={nestedJobIndex == null || nestedJobIndex <= 0}
                            onClick={() => setNestedJobIndex((current) => current == null ? current : Math.max(0, current - 1))}
                            className="absolute left-4 top-1/2 z-40 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#dbe7ef] bg-white/92 text-slate-500 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.45)] transition-colors hover:text-slate-900 disabled:pointer-events-none disabled:opacity-25 md:inline-flex"
                            aria-label="上一个岗位"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            disabled={nestedJobIndex == null || nestedJobIndex >= companyJobsForTab.length - 1}
                            onClick={() => setNestedJobIndex((current) => current == null ? current : Math.min(companyJobsForTab.length - 1, current + 1))}
                            className="absolute right-4 top-1/2 z-40 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#dbe7ef] bg-white/92 text-slate-500 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.45)] transition-colors hover:text-slate-900 disabled:pointer-events-none disabled:opacity-25 md:inline-flex"
                            aria-label="下一个岗位"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                        <div className="h-full overflow-y-auto">
                            <JobDetailPanel
                                key={nestedJob.id}
                                job={nestedJob}
                                onSave={onSave}
                                isSaved={isSaved}
                                onApply={onApply}
                                showCloseButton={false}
                                showInlineNavigation={false}
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Apply Selection Modal (Removed as per optimization request) */}
            {/* Direct Apply Buttons integrated below */}
        </div >
    )
}
