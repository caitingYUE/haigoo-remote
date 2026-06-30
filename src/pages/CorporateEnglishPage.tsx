import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Briefcase,
  Building2,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Headphones,
  Lightbulb,
  Lock,
  Loader2,
  Link2,
  Linkedin,
  Mail,
  Menu,
  PlayCircle,
  Sparkles,
  Video,
  Volume2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'
import {
  CorporateEnglishCompanyDetail,
  CorporateEnglishPublicClip,
  CorporateEnglishPublicCompany,
  CorporateEnglishPublicVideo,
  corporateEnglishPublicService
} from '../services/corporate-english-public-service'
import type { CorporateEnglishPronunciationMark, CorporateEnglishPronunciationMarkType } from '../services/corporate-english-service'
import { trackingService } from '../services/tracking-service'
import { getCompanyDetailPath } from '../utils/share-link-helper'
import { getCompanyLogoSources } from '../utils/company-logo'

const FALLBACK_COMPANY: CorporateEnglishPublicCompany = {
  companyId: 'corporate-english-coming-soon',
  name: '外企英语内容准备中',
  industry: '企业英语学习',
  videoCount: 0,
  clipCount: 0
}

function formatTime(ms?: number) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function normalizeExternalUrl(url?: string) {
  const value = String(url || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

function getVideoDisplayTitle(video: CorporateEnglishPublicVideo, index?: number, canShowLockedTitle = false) {
  if (!video.isVideoLocked || canShowLockedTitle) return video.materialTitle
  return typeof index === 'number' ? `会员视频 ${index + 1}` : '会员视频'
}

const pronunciationTypeMeta: Record<CorporateEnglishPronunciationMarkType, {
  label: string
  className: string
  hint: string
}> = {
  stress: {
    label: '重读',
    className: 'rounded-md bg-[#eeeaff] px-1 font-black text-[#4f46e5] shadow-[inset_0_-2px_0_rgba(79,70,229,0.20)]',
    hint: '语义重心，读清楚'
  },
  weak: {
    label: '弱读',
    className: 'rounded-md bg-slate-100 px-1 text-slate-500',
    hint: '快速带过，不要重读'
  },
  linking: {
    label: '连读',
    className: 'text-emerald-700',
    hint: '两个词要连在一起读'
  },
  keyword: {
    label: '关键词',
    className: 'rounded-md bg-[#fff1cf] px-1 font-bold text-[#9a6417]',
    hint: '听力时优先抓取的信息'
  },
  pause: {
    label: '停顿',
    className: '',
    hint: '短停顿 / 长停顿'
  }
}

const pronunciationPriority: CorporateEnglishPronunciationMarkType[] = ['stress', 'keyword', 'weak', 'linking', 'pause']
const pronunciationTypeOrder: CorporateEnglishPronunciationMarkType[] = ['stress', 'weak', 'linking', 'keyword', 'pause']

function normalizeMarkToken(value: string) {
  return value.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, '')
}

function markContainsToken(mark: CorporateEnglishPronunciationMark, token: string) {
  const normalizedToken = normalizeMarkToken(token)
  if (!normalizedToken) return null
  const markTokens = String(mark.text || '')
    .split(/\s+/g)
    .map(normalizeMarkToken)
    .filter(Boolean)
  return markTokens.includes(normalizedToken)
}

function findPrimaryPronunciationMark(token: string, marks: CorporateEnglishPronunciationMark[]) {
  const candidates = marks.filter((mark) => mark.type !== 'linking' && mark.type !== 'pause' && markContainsToken(mark, token))
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => pronunciationPriority.indexOf(a.type) - pronunciationPriority.indexOf(b.type))[0]
}

function getWordTokens(text: string) {
  return text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []
}

function hasLinkingAfter(token: string, nextWord: string | undefined, marks: CorporateEnglishPronunciationMark[]) {
  if (!nextWord) return false
  const current = normalizeMarkToken(token)
  const next = normalizeMarkToken(nextWord)
  return marks.some((mark) => {
    if (mark.type !== 'linking') return false
    const tokens = getWordTokens(mark.text).map(normalizeMarkToken)
    return tokens.some((word, index) => word === current && tokens[index + 1] === next)
  })
}

function getPauseMark(token: string, marks: CorporateEnglishPronunciationMark[]) {
  const candidates = marks.filter((mark) => mark.type === 'pause' && markContainsToken(mark, token))
  if (candidates.length === 0) return null
  return candidates.find((mark) => /长|long|\/\//i.test(mark.note || mark.text)) || candidates[0]
}

function renderMarkedLine(
  line: string,
  marks: CorporateEnglishPronunciationMark[],
  activeTypes: CorporateEnglishPronunciationMarkType[]
) {
  const activeSet = new Set(activeTypes)
  const visibleMarks = marks.filter((mark) => activeSet.has(mark.type))
  const parts = line.split(/(\s+|[,.!?;:()[\]"“”]+)/g).filter((part) => part.length > 0)
  let wordIndex = 0
  let lastWordIndex = -1
  const words = parts.filter((part) => /^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(part))
  const linkedWordIndexes = new Set<number>()
  words.forEach((word, index) => {
    if (hasLinkingAfter(word, words[index + 1], visibleMarks)) linkedWordIndexes.add(index)
  })

  return parts.map((part, index) => {
    if (/^\s+$/.test(part)) return linkedWordIndexes.has(lastWordIndex) ? null : part
    const isWord = /^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(part)
    const currentWordIndex = isWord ? wordIndex++ : -1
    if (isWord) lastWordIndex = currentWordIndex
    const primaryMark = isWord ? findPrimaryPronunciationMark(part, visibleMarks) : null
    const shouldLinkAfter = isWord && linkedWordIndexes.has(currentWordIndex)
    const pauseMark = isWord && activeSet.has('pause') ? getPauseMark(part, visibleMarks) : null
    if (!primaryMark && !shouldLinkAfter && !pauseMark) return <span key={`${part}-${index}`}>{part}</span>
    const meta = primaryMark ? pronunciationTypeMeta[primaryMark.type] : null
    return (
      <span key={`${part}-${index}`} className="inline-flex items-baseline">
        <span className="inline-flex flex-col items-start leading-none">
          <span
            className={`inline-block leading-7 ${meta?.className || ''}`}
            title={primaryMark ? `${meta?.label}：${primaryMark.text}${primaryMark.note ? `，${primaryMark.note}` : ''}` : undefined}
          >
            {part}
          </span>
        </span>
        {shouldLinkAfter ? (
          <span className="inline-flex translate-y-[-1px] px-0.5 text-[1.12em] font-black leading-none text-rose-600" title="连读">
            ‿
          </span>
        ) : null}
        {pauseMark ? (
          <span className="px-0.5 text-base font-black text-slate-500" title={pauseMark.note || '停顿'}>
            {/长|long|\/\//i.test(pauseMark.note || pauseMark.text) ? '//' : '/'}
          </span>
        ) : null}
      </span>
    )
  })
}

function CompanyLogo({ company }: { company: CorporateEnglishPublicCompany }) {
  const logoSources = useMemo(() => getCompanyLogoSources({
    companyId: company.companyId,
    cachedLogoUrl: company.cachedLogoUrl,
    originalLogoUrl: company.originalLogoUrl || company.logo,
    version: company.latestUpdatedAt
  }), [company.cachedLogoUrl, company.companyId, company.latestUpdatedAt, company.logo, company.originalLogoUrl])
  const [logoIndex, setLogoIndex] = useState(0)
  useEffect(() => {
    setLogoIndex(0)
  }, [logoSources.join('|')])
  const activeLogo = logoSources[logoIndex] || ''

  if (activeLogo) {
    return (
      <img
        src={activeLogo}
        alt={company.name}
        className="h-11 w-11 rounded-2xl border border-[#eadff8] bg-white object-contain p-1.5 shadow-[0_8px_20px_rgba(105,82,190,0.08)]"
        loading="lazy"
        onError={() => setLogoIndex((index) => index + 1)}
      />
    )
  }
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#eadff8] bg-[#fff7e8] text-[#8b6f42] shadow-[0_8px_20px_rgba(105,82,190,0.08)]">
      <Building2 className="h-5 w-5" />
    </div>
  )
}

function AccessBadge({ tier, sampleLabel = false }: { tier?: 'free' | 'vip'; sampleLabel?: boolean }) {
  const isFree = tier === 'free'
  return (
    <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-black tracking-wide ${
      isFree
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-[#eadff8] bg-[#f5f2ff] text-[#6251f5]'
    }`}>
      {isFree ? (sampleLabel ? '免费样例' : 'FREE') : 'Club'}
    </span>
  )
}

function MemberOnlyHint() {
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-black text-slate-500">
      仅会员
    </span>
  )
}

function UpgradeLockOverlay({
  title,
  description,
  ctaLabel,
  onUpgrade,
  variant = 'soft'
}: {
  title?: string
  description: string
  ctaLabel: string
  onUpgrade: () => void
  variant?: 'soft' | 'video'
}) {
  const isVideo = variant === 'video'
  const usePurpleTone = true
  return (
    <div className={`absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] px-4 ${
      isVideo
        ? 'bg-white/82 backdrop-blur-[5px]'
        : 'bg-[#f3f0ff]/24 backdrop-blur-[3px]'
    }`}>
      <div className={`max-w-[320px] text-center ${
        isVideo
          ? 'rounded-[22px] border border-white/90 bg-white p-5 shadow-[0_18px_54px_-34px_rgba(15,23,42,0.5)]'
          : 'rounded-[18px] border border-[#d8d2ff]/80 bg-white/86 p-4 shadow-[0_16px_44px_-34px_rgba(95,81,245,0.34)] backdrop-blur-xl'
      }`}>
        <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full shadow-sm ${
          usePurpleTone
            ? 'bg-[#f5f2ff] text-[#6251f5]'
            : 'bg-emerald-50 text-emerald-600'
        }`}>
          <Lock className="h-4 w-4" />
        </div>
        {title ? <h3 className="mt-3 text-sm font-black text-slate-900">{title}</h3> : null}
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-slate-700">{description}</p>
        <button
          type="button"
          onClick={onUpgrade}
          className={`mt-3 inline-flex h-9 items-center justify-center rounded-full px-4 text-xs font-black text-white transition ${
            usePurpleTone ? 'bg-[#6d5dfc] hover:bg-[#5a49e8]' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}

function LearningPanelLockOverlay({
  ctaLabel,
  onUpgrade
}: {
  ctaLabel: string
  onUpgrade: () => void
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-[#fbfcff] px-6">
      <div className="w-full max-w-[250px] text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#ded6ff] bg-white text-[#6251f5] shadow-[0_12px_28px_-22px_rgba(78,64,180,0.45)]">
          <Lock className="h-4 w-4" />
        </div>
        <h3 className="mt-4 text-base font-black leading-6 text-slate-950">企业文化、CEO商业思维等内容</h3>
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-[#6d5dfc] px-6 text-sm font-black text-white shadow-[0_16px_32px_-22px_rgba(109,93,252,0.72)] transition hover:bg-[#5a49e8]"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}

type LearningPanelTabKey = 'culture' | 'ceo' | 'resources' | 'jobs' | 'favorites'

function LearningSidePanel({
  cultureSections,
  ceoThinkingSections,
  resources,
  jobs,
  companyDetailPath,
  favorites,
  isAuthenticated,
  profileLocked,
  resourcesLocked,
  ctaLabel,
  onUpgrade,
  onNavigateLogin,
  onNavigateFavorites
}: {
  cultureSections: Array<{ title: string; body: string }>
  ceoThinkingSections: Array<{ title: string; body: string }>
  resources: Array<{ title: string; url: string }>
  jobs: CorporateEnglishCompanyDetail['jobs']
  companyDetailPath: string
  favorites: CorporateEnglishCompanyDetail['favorites']
  isAuthenticated: boolean
  profileLocked?: boolean
  resourcesLocked?: boolean
  ctaLabel: string
  onUpgrade: () => void
  onNavigateLogin: () => void
  onNavigateFavorites: () => void
}) {
  const [activeTab, setActiveTab] = useState<LearningPanelTabKey>('culture')
  const [activeInsightIndexes, setActiveInsightIndexes] = useState({ culture: 0, ceo: 0 })
  const visibleResources = resources.filter((resource) => resource.url)
  const tabs: Array<{
    key: LearningPanelTabKey
    title: string
    count: number
    icon: ReactNode
    locked?: boolean
  }> = [
    {
      key: 'culture',
      title: '企业文化',
      count: cultureSections.length,
      icon: <Building2 className="h-4 w-4" />,
      locked: profileLocked
    },
    {
      key: 'ceo',
      title: 'CEO 商业思维',
      count: ceoThinkingSections.length,
      icon: <Sparkles className="h-4 w-4" />,
      locked: profileLocked
    },
    {
      key: 'resources',
      title: '其他资料',
      count: visibleResources.length,
      icon: <ExternalLink className="h-4 w-4" />,
      locked: resourcesLocked
    },
    {
      key: 'jobs',
      title: '在招岗位',
      count: jobs.length,
      icon: <Briefcase className="h-4 w-4" />
    },
    {
      key: 'favorites',
      title: '个人收藏',
      count: favorites.length,
      icon: <BookmarkCheck className="h-4 w-4" />
    }
  ]
  const currentTab = tabs.find((tab) => tab.key === activeTab) || tabs[0]
  const activeSections = activeTab === 'culture' ? cultureSections : ceoThinkingSections
  const activeInsightTab = activeTab === 'culture' || activeTab === 'ceo' ? activeTab : null
  const activeInsightIndex = activeInsightTab ? Math.min(activeInsightIndexes[activeInsightTab] || 0, Math.max(activeSections.length - 1, 0)) : 0
  const totalInsightCount = cultureSections.length + ceoThinkingSections.length
  const isResourceTab = activeTab === 'resources'
  const isJobTab = activeTab === 'jobs'
  const isFavoriteTab = activeTab === 'favorites'
  const emptyText = isResourceTab
    ? '更丰富的补充资料。'
    : activeTab === 'culture'
      ? '从视频里学习到的企业文化、愿景、使命、成长等内容。'
      : activeTab === 'ceo'
        ? '从视频里学习到的 CEO 商业思维和认知。'
        : isJobTab
          ? '暂无已同步在招岗位。'
          : '收藏跟读片段后会显示在这里。'

  return (
    <section className="flex h-full min-h-0 overflow-hidden rounded-[24px] border border-[#efe5d8] bg-white/92 shadow-[0_18px_55px_rgba(122,92,56,0.07)] backdrop-blur">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={`relative min-h-0 flex-1 overflow-hidden ${currentTab.locked ? 'min-h-[320px]' : ''}`}>
          <div className={`h-full overflow-y-auto px-4 py-4 ${currentTab.locked ? 'pointer-events-none select-none opacity-0' : ''}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-950">{currentTab.title}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {activeTab === 'culture' ? '使命、价值观与工作方式' : activeTab === 'ceo' ? '增长、管理与长期判断' : activeTab === 'resources' ? '可继续阅读的外部材料' : activeTab === 'jobs' ? '与公司页同步的在招岗位' : '已收藏的跟读片段'}
                </p>
              </div>
              <span className="rounded-full border border-[#eadff8] bg-[#f7f4ff] px-3 py-1 text-xs font-black text-[#6251f5]">
                {currentTab.count} 条
              </span>
            </div>

            {isJobTab ? (
              jobs.length ? (
                <div className="space-y-2">
                  {companyDetailPath ? (
                    <a
                      href={companyDetailPath}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#eadff8] bg-white px-3 py-2 text-xs font-black text-[#6251f5] no-underline hover:border-[#cbbfff] hover:bg-[#f6f2ff] hover:no-underline"
                    >
                      进入企业页
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  {jobs.map((job) => (
                    <a
                      key={job.id}
                      href={`${companyDetailPath}?jobId=${encodeURIComponent(job.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="group block w-full rounded-2xl border border-[#f0e8dc] bg-[#fffdf8] p-3 text-left no-underline transition hover:border-[#d8ccff] hover:bg-[#f6f2ff] hover:no-underline focus:outline-none focus:ring-2 focus:ring-[#d8ccff]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="line-clamp-2 text-sm font-bold text-slate-900">{job.title}</div>
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-[#6251f5]" />
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{job.location || '远程'} · {job.category || job.jobType || '岗位'}</div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-[#f0e8dc] bg-[#fffdf8] px-4 py-8 text-center text-sm leading-6 text-slate-500">{emptyText}</p>
              )
            ) : isFavoriteTab ? (
              !isAuthenticated ? (
                <button type="button" onClick={onNavigateLogin} className="w-full rounded-2xl border border-[#eadff8] bg-[#fffdf8] px-3 py-3 text-sm font-bold text-slate-700 hover:border-[#cbbfff] hover:text-[#6251f5]">
                  登录后查看收藏片段
                </button>
              ) : favorites.length ? (
                <div className="space-y-2">
                  {favorites.map((clip) => (
                    <button
                      key={clip.clipId}
                      type="button"
                      onClick={onNavigateFavorites}
                      className="w-full rounded-2xl border border-[#f0e8dc] bg-[#fffdf8] p-3 text-left hover:border-[#d8ccff] hover:bg-[#f6f2ff]"
                    >
                      <div className="line-clamp-2 text-sm font-bold text-slate-900">{clip.clipTitle || clip.materialTitle}</div>
                      <div className="mt-1 text-xs text-slate-500">{clip.companyName} · {formatTime(clip.startMs)}</div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={onNavigateFavorites}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[#eadff8] bg-white px-3 py-2 text-xs font-black text-[#6251f5] hover:border-[#cbbfff] hover:bg-[#f6f2ff]"
                  >
                    查看全部音频收藏
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-[#f0e8dc] bg-[#fffdf8] px-4 py-8 text-center text-sm leading-6 text-slate-500">{emptyText}</p>
              )
            ) : isResourceTab ? (
              visibleResources.length ? (
                <div className="space-y-2">
                  {visibleResources.map((resource, index) => (
                    <a
                      key={`${resource.title}-${index}`}
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex min-h-[92px] items-start justify-between gap-3 rounded-2xl border border-[#f0e8dc] bg-[#fffdf8] p-3 text-sm font-bold text-[#6251f5] no-underline transition hover:border-[#d8ccff] hover:bg-[#f6f2ff] hover:text-[#4f46e5] hover:no-underline focus:outline-none focus:ring-2 focus:ring-[#d8ccff]"
                    >
                      <span className="flex min-w-0 gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#8a7bff]">
                          <Link2 className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-2">{resource.title || resource.url}</span>
                          <span className="mt-2 block truncate text-xs font-semibold text-slate-400">{normalizeExternalUrl(resource.url)}</span>
                        </span>
                      </span>
                      <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-[#8a7bff] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-[#f0e8dc] bg-[#fffdf8] px-4 py-8 text-center text-sm leading-6 text-slate-500">{emptyText}</p>
              )
            ) : activeSections.length ? (
              <div className="space-y-3">
                {activeSections.map((section, index) => (
                  <button
                    key={`${section.title}-${index}`}
                    type="button"
                    onClick={() => {
                      if (!activeInsightTab) return
                      setActiveInsightIndexes((prev) => ({ ...prev, [activeInsightTab]: index }))
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition hover:border-[#d7ccff] hover:bg-[#f7f4ff] focus:outline-none focus:ring-2 focus:ring-[#d8ccff] ${
                      index === activeInsightIndex
                        ? 'border-[#d7ccff] bg-[#f7f4ff]'
                        : 'border-[#f0e8dc] bg-[#fffdf8]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                        index === activeInsightIndex ? 'bg-[#6d5dfc] text-white' : 'bg-white text-[#8a7bff]'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-slate-950">{section.title}</h4>
                        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{section.body}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-[#f0e8dc] bg-[#fffdf8] px-4 py-8 text-center text-sm leading-6 text-slate-500">{emptyText}</p>
            )}
          </div>
          {currentTab.locked ? (
            <LearningPanelLockOverlay
              ctaLabel={ctaLabel}
              onUpgrade={onUpgrade}
            />
          ) : null}
        </div>
      </div>
      <div className="w-[74px] shrink-0 border-l border-[#e5eaf2] bg-[#f2f5fa] p-2" role="tablist" aria-label="外企英语资料分类">
        <div className="space-y-2">
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex h-[70px] w-full flex-col items-center justify-center gap-1 rounded-2xl border text-[11px] font-black transition ${
                  isActive
                    ? 'border-[#d7ccff] bg-white text-[#6251f5] shadow-[0_14px_30px_-24px_rgba(109,93,252,0.75)]'
                    : 'border-transparent bg-transparent text-slate-500 hover:border-[#e3ddff] hover:bg-white/70 hover:text-[#6251f5]'
                }`}
                title={tab.title}
              >
                {tab.icon}
                <span className="leading-none">{tab.title.replace('CEO ', '')}</span>
                <span className={`absolute right-1.5 top-1.5 rounded-full px-1 text-[10px] leading-4 ${
                  isActive ? 'bg-[#f3f0ff] text-[#6251f5]' : 'bg-white text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ClipCard({
  clip,
  index,
  onToggleFavorite,
  onPlay,
  onUpgrade,
  lockCtaLabel,
  showSampleLabel = false
}: {
  clip: CorporateEnglishPublicClip
  index: number
  onToggleFavorite: (clip: CorporateEnglishPublicClip) => void
  onPlay?: (clip: CorporateEnglishPublicClip) => void
  onUpgrade: () => void
  lockCtaLabel: string
  showSampleLabel?: boolean
}) {
  const tagGroups = (clip.clipTags || []).filter((group) => group.title && Array.isArray(group.tags) && group.tags.length > 0)
  const pronunciationMarks = useMemo(
    () => (clip.pronunciationMarks || []).filter((mark) => mark.text),
    [clip.pronunciationMarks]
  )
  const pronunciationTypes = useMemo(
    () => pronunciationTypeOrder.filter((type) => pronunciationMarks.some((mark) => mark.type === type)),
    [pronunciationMarks]
  )
  const [activePronunciationTypes, setActivePronunciationTypes] = useState<CorporateEnglishPronunciationMarkType[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [playableAudioUrl, setPlayableAudioUrl] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [showScript, setShowScript] = useState(true)
  const [showTranslation, setShowTranslation] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const scriptLines = useMemo(() => (clip.subtitleText || '').split('\n').map((line) => line.trim()).filter(Boolean), [clip.subtitleText])
  const translationLines = useMemo(() => (clip.translationText || '').split('\n').map((line) => line.trim()).filter(Boolean), [clip.translationText])
  const subtitleCues = useMemo(
    () => (clip.subtitleCues || [])
      .map((cue) => ({
        startMs: Number(cue.startMs || 0),
        endMs: Number(cue.endMs || 0)
      }))
      .filter((cue) => Number.isFinite(cue.startMs) && Number.isFinite(cue.endMs) && cue.endMs > cue.startMs)
      .sort((a, b) => a.startMs - b.startMs),
    [clip.subtitleCues]
  )
  const fallbackDuration = useMemo(() => Math.max(1, (clip.endMs - clip.startMs) / 1000), [clip.endMs, clip.startMs])
  const activeLineIndex = useMemo(() => {
    const lineCount = Math.max(scriptLines.length, translationLines.length)
    if (!lineCount) return 0
    if (subtitleCues.length > 0) {
      const currentMs = currentTime * 1000
      const exactIndex = subtitleCues.findIndex((cue) => currentMs >= cue.startMs && currentMs < cue.endMs)
      if (exactIndex >= 0) return Math.min(lineCount - 1, exactIndex)
      let previousIndex = -1
      for (let cueIndex = subtitleCues.length - 1; cueIndex >= 0; cueIndex -= 1) {
        if (currentMs >= subtitleCues[cueIndex].startMs) {
          previousIndex = cueIndex
          break
        }
      }
      return Math.min(lineCount - 1, Math.max(0, previousIndex))
    }
    const duration = Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : fallbackDuration
    if (!duration) return 0
    const progress = Math.min(0.999, Math.max(0, currentTime / duration))
    return Math.min(lineCount - 1, Math.floor(progress * lineCount))
  }, [audioDuration, currentTime, fallbackDuration, scriptLines.length, subtitleCues, translationLines.length])
  const stopProgressLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])
  const syncAudioProgress = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(audio.currentTime || 0)
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setAudioDuration(audio.duration)
    }
  }, [])
  const startProgressLoop = useCallback(() => {
    stopProgressLoop()
    const tick = () => {
      syncAudioProgress()
      const audio = audioRef.current
      if (audio && !audio.paused && !audio.ended) {
        animationFrameRef.current = window.requestAnimationFrame(tick)
      }
    }
    tick()
  }, [stopProgressLoop, syncAudioProgress])

  useEffect(() => stopProgressLoop, [stopProgressLoop])
  useEffect(() => {
    setActivePronunciationTypes([])
    setCurrentTime(0)
    setAudioDuration(0)
  }, [clip.clipId])
  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    setPlayableAudioUrl('')
    setAudioError('')
    if (clip.isLocked || !clip.hasAudio) return () => undefined
    const loadAudio = async () => {
      try {
        setAudioLoading(true)
        const blob = await corporateEnglishPublicService.downloadClipAudio(clip.clipId)
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setPlayableAudioUrl(objectUrl)
      } catch (error) {
        if (!cancelled) setAudioError(error instanceof Error ? error.message : '音频加载失败')
      } finally {
        if (!cancelled) setAudioLoading(false)
      }
    }
    loadAudio()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [clip.clipId, clip.hasAudio, clip.isLocked])
  const visiblePronunciationTypes = useMemo(
    () => activePronunciationTypes.filter((type) => pronunciationTypes.includes(type)),
    [activePronunciationTypes, pronunciationTypes]
  )
  const togglePronunciationType = (type: CorporateEnglishPronunciationMarkType) => {
    setActivePronunciationTypes((current) => (
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    ))
  }

  return (
    <article className="rounded-[24px] border border-[#d9ccff] bg-white/90 p-4 shadow-[0_16px_48px_rgba(103,84,186,0.09)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#6d5dfc]">
            <Headphones className="h-4 w-4" />
            <span>{formatTime(clip.startMs)} - {formatTime(clip.endMs)}</span>
          </div>
          <h3 className="mt-1 flex flex-wrap items-center gap-2 text-base font-black text-slate-900">
            <span>{clip.clipTitle || `跟读片段 ${index + 1}`}</span>
            {showSampleLabel ? <AccessBadge tier="free" sampleLabel /> : null}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onToggleFavorite(clip)}
          disabled={clip.isLocked}
          className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-bold transition ${clip.isFavorited
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : clip.isLocked
              ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
            : 'border-[#eadff8] bg-white text-slate-600 hover:border-[#cbbfff] hover:text-[#6251f5]'
            }`}
        >
          {clip.isFavorited ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          {clip.isFavorited ? '已收藏' : '收藏'}
        </button>
      </div>

      {clip.isLocked ? (
        <div className="mt-4 flex h-12 items-center gap-3 rounded-full bg-slate-100 px-5 text-sm font-bold text-slate-400">
          <PlayCircle className="h-5 w-5" />
          <div className="h-1 flex-1 rounded-full bg-slate-200" />
          <Lock className="h-4 w-4" />
        </div>
      ) : !clip.hasAudio ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          {clip.audioUnavailableReason || '该片段音频暂不可用，请稍后重试。'}
        </div>
      ) : audioLoading || !playableAudioUrl ? (
        <div className="mt-4 flex h-12 items-center gap-3 rounded-full bg-slate-100 px-5 text-sm font-bold text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          音频加载中...
        </div>
      ) : audioError ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {audioError}
        </div>
      ) : (
      <audio
        key={playableAudioUrl || clip.clipId || clip.id}
        ref={audioRef}
        className="mt-4 w-full rounded-full"
        controls
        src={playableAudioUrl}
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration
          setAudioDuration(Number.isFinite(duration) && duration > 0 ? duration : fallbackDuration)
        }}
        onPlay={() => {
          startProgressLoop()
          onPlay?.(clip)
        }}
        onPause={stopProgressLoop}
        onSeeked={syncAudioProgress}
        onTimeUpdate={syncAudioProgress}
        onEnded={() => {
          stopProgressLoop()
          setCurrentTime(0)
        }}
      >
        <track kind="captions" />
      </audio>
      )}

      {tagGroups.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tagGroups.map((group) => (
            <span key={group.title} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#ded6ff] bg-[#f5f2ff] px-3 py-1.5 text-xs font-bold text-[#6251f5]">
              <span className="shrink-0 text-[#8a7bff]">{group.title}</span>
              <span className="min-w-0 truncate">{group.tags.map((tag) => `#${tag}`).join(' ')}</span>
            </span>
          ))}
        </div>
      )}

      <div className="relative mt-3 overflow-hidden rounded-2xl">
      <div className={`space-y-3 ${clip.isLocked ? 'pointer-events-none select-none blur-[3px]' : ''}`}>
        <div className="rounded-2xl border border-[#eee7dd] bg-[#fffdf8] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
                <BookOpen className="h-4 w-4 text-[#8a7bff]" />
                Script
            </div>
            {pronunciationTypes.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                {pronunciationTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => togglePronunciationType(type)}
                    className={`rounded-full border px-3 py-1.5 transition ${
                      activePronunciationTypes.includes(type)
                        ? 'border-[#cfc5ff] bg-[#6d5dfc] text-white shadow-[0_8px_18px_-14px_rgba(109,93,252,0.8)]'
                        : 'border-[#eadff8] bg-white text-slate-700 shadow-sm hover:border-[#cbbfff] hover:bg-[#f6f2ff] hover:text-[#6251f5]'
                    }`}
                    title={`${pronunciationTypeMeta[type].label}：${pronunciationTypeMeta[type].hint}，点击${activePronunciationTypes.includes(type) ? '关闭' : '开启'}`}
                  >
                    {pronunciationTypeMeta[type].label}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setShowScript((value) => !value)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#ded6ff] bg-white text-[#6251f5] transition hover:bg-[#f5f2ff]"
              title={showScript ? '隐藏原文' : '显示原文'}
              aria-label={showScript ? '隐藏原文' : '显示原文'}
            >
              {showScript ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          {showScript ? (
            scriptLines.length > 0 ? (
              <div className="space-y-2 text-[15px] leading-8 text-slate-800 md:text-base">
                {scriptLines.map((line, lineIndex) => (
                  <p
                    key={`${line}-${lineIndex}`}
                    className={`relative rounded-xl px-3 py-2 transition ${lineIndex === activeLineIndex ? 'pl-5 text-slate-950' : ''}`}
                  >
                    {lineIndex === activeLineIndex ? <span className="absolute bottom-2 left-1 top-2 w-0.5 rounded-full bg-[#6d5dfc]" /> : null}
                    {renderMarkedLine(line, pronunciationMarks, visiblePronunciationTypes)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-800">暂无英文字幕</p>
            )
          ) : (
            <p className="rounded-xl border border-dashed border-[#eee7dd] bg-white/70 px-3 py-6 text-center text-sm text-slate-400">原文已隐藏</p>
          )}
        </div>
        <div className="rounded-2xl border border-[#f3ddb6] bg-[#fffaf0] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-500">
              <Lightbulb className="h-4 w-4" />
              中文翻译
            </div>
            <button
              type="button"
              onClick={() => setShowTranslation((value) => !value)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#f3ddb6] bg-white text-[#b7791f] transition hover:bg-[#fff7e8]"
              title={showTranslation ? '隐藏中文翻译' : '显示中文翻译'}
              aria-label={showTranslation ? '隐藏中文翻译' : '显示中文翻译'}
            >
              {showTranslation ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          {showTranslation ? (
            translationLines.length > 0 ? (
              <div className="space-y-1 text-sm leading-6 text-slate-700">
                {translationLines.map((line, lineIndex) => (
                  <p
                    key={`${line}-${lineIndex}`}
                    className={`rounded-lg px-2 py-1 transition ${lineIndex === activeLineIndex ? 'bg-[#fff1cf] font-semibold text-[#9a6417]' : ''}`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-700">暂无中文翻译</p>
            )
          ) : (
            <p className="rounded-xl border border-dashed border-[#f3ddb6] bg-white/70 px-3 py-6 text-center text-sm text-amber-400">中文翻译已隐藏</p>
          )}
        </div>
      </div>
      {clip.isLocked ? (
        <UpgradeLockOverlay
          description={lockCtaLabel.includes('需登录')
            ? '跟读音频、翻译等口语练习素材。'
            : (clip.lockReason || '人工精选和剪辑后的跟读音频、口语练习重点、字幕等内容。')}
          ctaLabel={lockCtaLabel}
          onUpgrade={onUpgrade}
        />
      ) : null}
      </div>
    </article>
  )
}

export default function CorporateEnglishPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const { showSuccess, showWarning, showError } = useNotificationHelpers()
  const [companies, setCompanies] = useState<CorporateEnglishPublicCompany[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [detail, setDetail] = useState<CorporateEnglishCompanyDetail | null>(null)
  const [activeVideoId, setActiveVideoId] = useState('')
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [isCompanyListCollapsed, setIsCompanyListCollapsed] = useState(false)
  const [activeClipId, setActiveClipId] = useState('')
  const videoSectionRef = useRef<HTMLElement | null>(null)
  const trackedVideoIdsRef = useRef<Set<string>>(new Set())
  const queryTargets = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return {
      companyId: params.get('companyId') || params.get('company_id') || '',
      materialId: params.get('materialId') || params.get('material_id') || ''
    }
  }, [location.search])

  useEffect(() => {
    let cancelled = false
    const loadCompanies = async () => {
      try {
        setLoadingCompanies(true)
        const nextCompanies = await corporateEnglishPublicService.listCompanies()
        if (cancelled) return
        setCompanies(nextCompanies)
        setSelectedCompanyId((current) => {
          if (queryTargets.companyId && nextCompanies.some((company) => company.companyId === queryTargets.companyId)) {
            return queryTargets.companyId
          }
          return current || nextCompanies[0]?.companyId || ''
        })
      } catch (error) {
        console.error('Failed to load corporate English companies:', error)
        showError('外企英语加载失败', error instanceof Error ? error.message : '请稍后重试')
      } finally {
        if (!cancelled) setLoadingCompanies(false)
      }
    }
    loadCompanies()
    return () => {
      cancelled = true
    }
  }, [queryTargets.companyId, showError])

  useEffect(() => {
    if (!selectedCompanyId) {
      setDetail(null)
      return
    }
    let cancelled = false
    const loadDetail = async () => {
      try {
        setLoadingDetail(true)
        const nextDetail = await corporateEnglishPublicService.getCompany(selectedCompanyId)
        if (cancelled) return
        setDetail(nextDetail)
        setActiveVideoId(() => {
          if (queryTargets.materialId && nextDetail.videos.some((video) => video.materialId === queryTargets.materialId)) {
            return queryTargets.materialId
          }
          return nextDetail.videos[0]?.materialId || ''
        })
      } catch (error) {
        console.error('Failed to load corporate English detail:', error)
        if (!cancelled) {
          setDetail(null)
          showError('企业内容加载失败', error instanceof Error ? error.message : '请稍后重试')
        }
      } finally {
        if (!cancelled) setLoadingDetail(false)
      }
    }
    loadDetail()
    return () => {
      cancelled = true
    }
  }, [queryTargets.materialId, selectedCompanyId, showError])

  const activeVideo = useMemo<CorporateEnglishPublicVideo | null>(() => {
    if (!detail) return null
    return detail.videos.find((video) => video.materialId === activeVideoId) || detail.videos[0] || null
  }, [activeVideoId, detail])

  useEffect(() => {
    if (!activeVideo?.clips.length) {
      setActiveClipId('')
      return
    }
    setActiveClipId((current) => {
      if (current && activeVideo.clips.some((clip) => clip.clipId === current)) return current
      return activeVideo.clips[0]?.clipId || ''
    })
  }, [activeVideo])

  const activeClip = useMemo(() => {
    if (!activeVideo?.clips.length) return null
    return activeVideo.clips.find((clip) => clip.clipId === activeClipId) || activeVideo.clips[0] || null
  }, [activeClipId, activeVideo])

  useEffect(() => {
    if (!activeVideo || activeVideo.isVideoLocked || !activeVideo.tencentVideoUrl) return
    if (trackedVideoIdsRef.current.has(activeVideo.materialId)) return
    trackedVideoIdsRef.current.add(activeVideo.materialId)
    trackingService.track('corporate_english_video_play', {
      page_key: 'corporate_english',
      module: 'corporate_english_video',
      feature_key: 'corporate_english_video_play',
      entity_type: 'corporate_english_material',
      entity_id: activeVideo.materialId,
      company_id: selectedCompanyId
    })
  }, [activeVideo, selectedCompanyId])

  useEffect(() => {
    if (!queryTargets.companyId && !queryTargets.materialId) return
    if (!detail || !activeVideo) return
    window.setTimeout(() => {
      videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }, [activeVideo, detail, queryTargets.companyId, queryTargets.materialId])

  const visibleCompanies = companies.length > 0 ? companies : [FALLBACK_COMPANY]
  const companyDetailPath = detail?.company.name ? getCompanyDetailPath(detail.company.name) : ''
  const activeSourceVideoUrl = activeVideo && !activeVideo.isVideoLocked ? normalizeExternalUrl(activeVideo.sourceVideoUrl) : ''

  const refreshDetail = useCallback(async () => {
    if (!selectedCompanyId) return
    const nextDetail = await corporateEnglishPublicService.getCompany(selectedCompanyId)
    setDetail(nextDetail)
  }, [selectedCompanyId])

  const openMembershipModal = useCallback((_preferredPlan: 'half_year' | 'annual' = 'half_year') => {
    navigate('/profile?tab=membership#club-service-plans')
  }, [navigate])
  const handleLockedAction = useCallback(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    openMembershipModal('half_year')
  }, [isAuthenticated, navigate, openMembershipModal])
  const lockedCtaLabel = isAuthenticated ? '了解会员服务' : '需登录'

  const trackClipPlay = useCallback((clip: CorporateEnglishPublicClip) => {
    trackingService.track('corporate_english_clip_play', {
      page_key: 'corporate_english',
      module: 'corporate_english_clip',
      feature_key: 'corporate_english_clip_play',
      entity_type: 'corporate_english_clip',
      entity_id: clip.clipId,
      material_id: activeVideo?.materialId || '',
      company_id: selectedCompanyId
    })
  }, [activeVideo?.materialId, selectedCompanyId])

  const toggleFavorite = async (clip: CorporateEnglishPublicClip) => {
    if (clip.isLocked) {
      showWarning(isAuthenticated ? '了解会员服务' : '请先登录', isAuthenticated ? '人工精选和剪辑后的跟读音频、口语练习重点、字幕等内容。' : '登录后可以收藏跟读片段')
      handleLockedAction()
      return
    }
    if (!isAuthenticated) {
      showWarning('请先登录', '登录后可以收藏跟读片段')
      navigate('/login')
      return
    }
    try {
      if (clip.isFavorited) {
        await corporateEnglishPublicService.removeFavorite(clip.clipId)
        showSuccess('已取消收藏')
      } else {
        await corporateEnglishPublicService.addFavorite(clip.clipId)
        showSuccess('已收藏')
      }
      await refreshDetail()
    } catch (error) {
      showError('收藏失败', error instanceof Error ? error.message : '请稍后重试')
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] pt-16 font-haigoo-rounded text-slate-900 lg:h-screen lg:overflow-hidden">
      <div className="mx-auto max-w-[1680px] px-3 py-3 sm:px-4 lg:h-[calc(100vh-4rem)] lg:overflow-hidden">
        {loadingCompanies ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-[#e5edf3] bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <>
            <div className={`grid gap-3 lg:h-full lg:min-h-0 ${isCompanyListCollapsed ? 'lg:grid-cols-[72px_minmax(0,1fr)_400px]' : 'lg:grid-cols-[320px_minmax(0,1fr)_400px]'}`}>
            <aside className="hidden h-full min-h-0 overflow-hidden rounded-[24px] border border-[#e5eaf2] bg-white/94 shadow-[0_16px_48px_rgba(36,47,76,0.08)] backdrop-blur lg:flex lg:flex-col">
              <div className={`shrink-0 border-b border-[#edf1f7] ${isCompanyListCollapsed ? 'p-3' : 'px-4 py-4'}`}>
                <div className={`flex items-start ${isCompanyListCollapsed ? 'justify-center' : 'justify-between gap-3'}`}>
                {!isCompanyListCollapsed ? (
                  <div className="min-w-0">
                    <div className="flex items-start gap-2">
                      <h1 className="text-2xl font-black tracking-tight text-slate-950">外企英语</h1>
                      <span className="mt-0.5 rounded-full border border-[#cfc5ff] bg-[#f4f0ff] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#6251f5]">
                        New
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      看 CEO 访谈，了解企业文化、提升商业认知，轻松搞定外企英语。
                    </p>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsCompanyListCollapsed((value) => !value)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#eadff8] bg-white text-slate-500 transition hover:border-[#cbbfff] hover:text-[#6251f5]"
                  aria-label={isCompanyListCollapsed ? '展开企业列表' : '收起企业列表'}
                  title={isCompanyListCollapsed ? '展开企业列表' : '收起企业列表'}
                >
                  {isCompanyListCollapsed ? <Menu className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rotate-180" />}
                </button>
                </div>
              </div>
              <div className={`min-h-0 flex-1 space-y-2 overflow-y-auto ${isCompanyListCollapsed ? 'p-2' : 'p-3'}`}>
                {!isCompanyListCollapsed ? (
                  <div className="mb-1 flex items-center gap-2 px-1 text-xs font-black uppercase tracking-wide text-slate-400">
                    <Menu className="h-3.5 w-3.5 text-[#6251f5]" />
                    企业列表
                  </div>
                ) : null}
                {visibleCompanies.map((company) => (
                  <button
                    key={company.companyId}
                    type="button"
                    onClick={() => {
                      if (companies.length > 0) setSelectedCompanyId(company.companyId)
                    }}
                    className={`flex w-full items-center rounded-2xl border text-left transition ${isCompanyListCollapsed ? 'justify-center p-2' : 'gap-3 p-3'} ${selectedCompanyId === company.companyId || companies.length === 0
                      ? 'border-[#d7ccff] bg-[#f4f0ff]'
                      : 'border-transparent hover:border-[#efe5d8] hover:bg-[#fffaf0]'
                    }`}
                    title={company.name}
                  >
                    <CompanyLogo company={company} />
                    {!isCompanyListCollapsed ? (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-slate-900">{company.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{company.industry || '精选企业'}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <AccessBadge tier={company.accessTier} />
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[#6251f5]">{company.clipCount || 0}</span>
                        </span>
                      </>
                    ) : null}
                  </button>
                ))}
              </div>
            </aside>
            <main className="min-w-0 space-y-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              {loadingDetail ? (
                <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-[#e5edf3] bg-white">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                </div>
              ) : detail && activeVideo ? (
                <>
                  <section ref={videoSectionRef} className="rounded-[28px] border border-[#efe5d8] bg-white/90 p-4 shadow-[0_18px_55px_rgba(122,92,56,0.08)]">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <CompanyLogo company={detail.company} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-black text-slate-950">{detail.company.name}</h2>
                            <AccessBadge tier={detail.company.accessTier} sampleLabel />
                          </div>
                          <p className="text-sm text-slate-500">{detail.company.industry || '外企英语素材'} · {detail.videos.length} 个视频 · {activeVideo.clips.length} 个跟读片段</p>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                      {detail.videos.map((video, videoIndex) => {
                        const isLoginLockedVideoTab = !isAuthenticated && videoIndex > 0
                        return (
                        <button
                          key={video.materialId}
                          type="button"
                          disabled={isLoginLockedVideoTab}
                          onClick={() => {
                            if (!isLoginLockedVideoTab) setActiveVideoId(video.materialId)
                          }}
                          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${isLoginLockedVideoTab
                            ? 'cursor-not-allowed border-[#eadff8] bg-white/70 text-slate-300'
                            : activeVideo.materialId === video.materialId
                            ? 'border-[#d7ccff] bg-[#6d5dfc] text-white shadow-[0_10px_24px_rgba(109,93,252,0.20)]'
                            : 'border-[#eadff8] bg-white text-slate-600 hover:border-[#cbbfff] hover:text-[#6251f5]'
                            }`}
                        >
                          {isLoginLockedVideoTab ? <Lock className="h-3.5 w-3.5" /> : null}
                          {getVideoDisplayTitle(video, videoIndex, isAuthenticated)}
                        </button>
                      )})}
                    </div>

                    {activeVideo.isVideoLocked ? (
                      <div className="relative mx-auto aspect-video w-full max-w-[860px] overflow-hidden rounded-[22px] border border-[#dccff7] bg-slate-950">
                        <div className="h-full w-full pointer-events-none select-none blur-[4px]">
                          {activeVideo.tencentVideoUrl ? (
                            <iframe
                              src={activeVideo.tencentVideoUrl}
                              title={getVideoDisplayTitle(activeVideo, undefined, isAuthenticated)}
                              className="h-full w-full"
                              frameBorder="0"
                              allowFullScreen
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-[#fffaf0] text-slate-500">
                              <div className="text-center">
                                <PlayCircle className="mx-auto h-10 w-10 text-[#8a7bff]" />
                                <p className="mt-2 text-sm font-bold">该内容暂未配置腾讯视频</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <UpgradeLockOverlay
                          description={activeVideo.videoLockReason || (isAuthenticated ? '外企英语材料为会员配套英语练习工具。' : 'CEO 访谈视频')}
                          ctaLabel={lockedCtaLabel}
                          onUpgrade={handleLockedAction}
                          variant="video"
                        />
                      </div>
                    ) : activeVideo.tencentVideoUrl ? (
                      <div className="relative mx-auto aspect-video w-full max-w-[860px] overflow-hidden rounded-[22px] bg-slate-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                        {activeSourceVideoUrl ? (
                          <a
                            href={activeSourceVideoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-xs font-black text-[#6251f5] shadow-[0_12px_30px_rgba(15,23,42,0.16)] backdrop-blur transition hover:bg-white hover:text-[#4f46e5] hover:no-underline"
                          >
                            视频来源
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        <iframe
                          src={activeVideo.tencentVideoUrl}
                          title={getVideoDisplayTitle(activeVideo, undefined, isAuthenticated)}
                          className="h-full w-full"
                          frameBorder="0"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="relative flex aspect-video items-center justify-center rounded-[22px] border border-dashed border-[#dccff7] bg-[#fffaf0] text-slate-500">
                        {activeSourceVideoUrl ? (
                          <a
                            href={activeSourceVideoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[#eadff8] bg-white px-3 py-1.5 text-xs font-black text-[#6251f5] shadow-sm transition hover:bg-[#f6f2ff] hover:text-[#4f46e5] hover:no-underline"
                          >
                            视频来源
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                        <div className="text-center">
                          <PlayCircle className="mx-auto h-10 w-10 text-[#8a7bff]" />
                          <p className="mt-2 text-sm font-bold">该内容暂未配置腾讯视频</p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      {(!activeVideo.isVideoLocked || isAuthenticated) ? (
                        <h3 className="text-lg font-black text-slate-950">{activeVideo.materialTitle}</h3>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-6 text-slate-500">
                        <span>{activeVideo.speakerName} · {activeVideo.speakerRole}</span>
                        {!detail.permissions?.canViewVideos ? <MemberOnlyHint /> : null}
                        {activeVideo.speakerEmail ? (
                          <a
                            href={`mailto:${activeVideo.speakerEmail}`}
                            className="inline-flex items-center gap-1 font-bold text-[#6251f5] no-underline hover:text-[#4f46e5]"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            Email
                          </a>
                        ) : null}
                        {activeVideo.speakerLinkedin ? (
                          <a
                            href={normalizeExternalUrl(activeVideo.speakerLinkedin)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-[#6251f5] no-underline hover:text-[#4f46e5]"
                          >
                            <Linkedin className="h-3.5 w-3.5" />
                            LinkedIn
                          </a>
                        ) : null}
                          {!detail.permissions?.canViewSpeakerContacts && (activeVideo.hasSpeakerEmail || activeVideo.hasSpeakerLinkedin) ? (
                          <span className="flex flex-wrap items-center gap-2">
                            {activeVideo.hasSpeakerEmail ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-400">
                                <Mail className="h-3.5 w-3.5" />
                                Email
                              </span>
                            ) : null}
                            {activeVideo.hasSpeakerLinkedin ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-400">
                                <Linkedin className="h-3.5 w-3.5" />
                                LinkedIn
                              </span>
                            ) : null}
                            {detail.permissions?.canViewVideos ? <MemberOnlyHint /> : null}
                          </span>
                        ) : null}
                      </div>
                      {activeVideo.videoSummary ? (
                        <p className="mt-2 text-sm leading-6 text-slate-500">{activeVideo.videoSummary}</p>
                      ) : null}
                    </div>
                  </section>

                  <section className="space-y-4 rounded-[28px] border border-[#efe5d8] bg-white/70 p-5 shadow-[0_18px_55px_rgba(122,92,56,0.06)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-5 w-5 text-[#8a7bff]" />
                          <h2 className="text-xl font-black text-slate-950">跟读素材</h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">影子跟读是练习口语最高效的方法，以下素材均由人工精选剪辑</p>
                      </div>
                      <span className="rounded-full border border-[#eadff8] bg-white px-3 py-1 text-xs font-bold text-[#6251f5]">
                        {activeVideo.clips.length} 个片段
                      </span>
                    </div>
                    {activeVideo.clips.length > 0 ? (
                      <>
                        {activeVideo.clips.length > 1 ? (
                          <div className="-mx-1 overflow-x-auto px-1 pb-1">
                            <div className="flex min-w-max gap-2">
                              {activeVideo.clips.map((clip, index) => (
                                <button
                                  key={clip.clipId}
                                  type="button"
                                  onClick={() => setActiveClipId(clip.clipId)}
                                  className={`flex max-w-[220px] shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-left text-sm transition ${
                                    activeClip?.clipId === clip.clipId
                                      ? 'border-[#cfc5ff] bg-[#6d5dfc] text-white shadow-[0_12px_28px_-22px_rgba(109,93,252,0.65)]'
                                      : 'border-[#eadff8] bg-white text-slate-600 hover:border-[#cbbfff] hover:bg-[#f6f2ff] hover:text-[#6251f5]'
                                  }`}
                                  title={clip.clipTitle || `片段 ${index + 1}`}
                                >
                                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                    activeClip?.clipId === clip.clipId ? 'bg-white/18 text-white' : 'bg-[#f5f2ff] text-[#6251f5]'
                                  }`}>
                                    {index + 1}
                                  </span>
                                  <span className="min-w-0 truncate font-bold">{clip.clipTitle || `片段 ${index + 1}`}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {activeClip ? (
                          <ClipCard
                            key={activeClip.clipId}
                            clip={activeClip}
                            index={Math.max(0, activeVideo.clips.findIndex((clip) => clip.clipId === activeClip.clipId))}
                            onToggleFavorite={toggleFavorite}
                            onPlay={trackClipPlay}
                            onUpgrade={handleLockedAction}
                            lockCtaLabel={lockedCtaLabel}
                            showSampleLabel={detail.company.accessTier === 'free' && activeVideo.clips[0]?.clipId === activeClip.clipId}
                          />
                        ) : null}
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#d8e4ee] bg-white p-8 text-center text-sm text-slate-500">这个视频还没有已发布跟读片段。</div>
                    )}
                  </section>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#d8e4ee] bg-white p-12 text-center">
                  <Video className="mx-auto h-10 w-10 text-indigo-500" />
                  <h2 className="mt-4 text-xl font-black text-slate-900">外企英语内容准备中</h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    后台保存并发布企业视频和跟读片段后，这里会自动展示视频、音频、字幕和标签。
                  </p>
                </div>
              )}
            </main>

            <aside className="min-h-[520px] lg:h-full lg:min-h-0">
              {detail ? (
                <LearningSidePanel
                  cultureSections={detail.profile.cultureSections || []}
                  ceoThinkingSections={detail.profile.ceoThinkingSections || []}
                  resources={detail.profile.otherResources || []}
                  jobs={detail.jobs || []}
                  companyDetailPath={companyDetailPath}
                  favorites={detail.favorites || []}
                  isAuthenticated={isAuthenticated}
                  profileLocked={!detail.permissions?.canViewProfile}
                  resourcesLocked={!detail.permissions?.canViewResources}
                  ctaLabel={lockedCtaLabel}
                  onUpgrade={handleLockedAction}
                  onNavigateLogin={() => navigate('/login')}
                  onNavigateFavorites={() => navigate('/profile?tab=favorites&type=audio')}
                />
              ) : null}
            </aside>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
