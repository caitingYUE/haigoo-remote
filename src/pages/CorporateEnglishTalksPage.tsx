import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type TouchEvent, type WheelEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Loader2, Lock, Play, Video } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'
import {
  CorporateEnglishPublicCategory,
  CorporateEnglishPublicCeoVideo,
  CorporateEnglishPublicModuleVideo,
  corporateEnglishPublicService
} from '../services/corporate-english-public-service'
import type { CorporateEnglishModuleKey } from '../services/corporate-english-service'
import { trackingService } from '../services/tracking-service'

type TalkSectionKey = 'ceo' | 'english_interview' | 'remote_preparation' | 'foreign_meeting'
type PosterTone = 'ceo' | 'interview' | 'remote' | 'meeting'

const SECTION_LABELS: Record<TalkSectionKey, string> = {
  ceo: 'CEO访谈',
  english_interview: '英语面试',
  remote_preparation: '远程准备',
  foreign_meeting: '远程会议'
}

const SECTION_TONE: Record<TalkSectionKey, PosterTone> = {
  ceo: 'ceo',
  english_interview: 'interview',
  remote_preparation: 'remote',
  foreign_meeting: 'meeting'
}

const TONE_STYLES: Record<PosterTone, { tag: string; surface: string; title: string; accent: string }> = {
  ceo: {
    tag: 'text-[#2f6ed8]',
    surface: 'bg-[linear-gradient(135deg,#f8fbff_0%,#f1f7ff_58%,#fbfcff_100%)]',
    title: 'text-slate-950',
    accent: 'bg-[#7a6cf5]'
  },
  interview: {
    tag: 'text-[#5f7f54]',
    surface: 'bg-[linear-gradient(135deg,#fbfff8_0%,#f2faf1_58%,#ffffff_100%)]',
    title: 'text-slate-950',
    accent: 'bg-[#7fb069]'
  },
  remote: {
    tag: 'text-[#9a5b1f]',
    surface: 'bg-[linear-gradient(135deg,#fffaf0_0%,#fff4db_58%,#ffffff_100%)]',
    title: 'text-slate-950',
    accent: 'bg-[#f0a11f]'
  },
  meeting: {
    tag: 'text-[#2f6ed8]',
    surface: 'bg-[linear-gradient(135deg,#f7fbff_0%,#f0f4ff_58%,#ffffff_100%)]',
    title: 'text-slate-950',
    accent: 'bg-[#6a9eea]'
  }
}

const CEO_PAGE_SIZE = 8
const MODULE_PAGE_SIZE = 8
const SWIPE_PAGE_MIN_DISTANCE = 56
const SWIPE_PAGE_VERTICAL_RATIO = 1.25
const WHEEL_PAGE_MIN_DISTANCE = 44
const WHEEL_PAGE_COOLDOWN_MS = 460

function formatDateLabel(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function formatDuration(ms?: number) {
  const minutes = Math.round(Number(ms || 0) / 60000)
  if (!minutes) return ''
  return `${minutes} MIN`
}

function truncateText(value: string | undefined, maxLength = 260) {
  const text = String(value || '').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trim()}...`
}

function getPublishedTime(value?: string) {
  const time = value ? new Date(value).getTime() : 0
  return Number.isNaN(time) ? 0 : time
}

function sortForAudience<T extends { accessTier?: string; publishedAt?: string; updatedAt?: string; sortOrder?: number }>(
  videos: T[],
  canViewMemberVideos: boolean
) {
  const nextVideos = [...videos]
  if (canViewMemberVideos) {
    return nextVideos.sort((a, b) => getPublishedTime(b.publishedAt || b.updatedAt) - getPublishedTime(a.publishedAt || a.updatedAt))
  }
  return nextVideos.sort((a, b) => {
    const aFree = a.accessTier === 'free'
    const bFree = b.accessTier === 'free'
    if (aFree !== bFree) return aFree ? -1 : 1
    return getPublishedTime(b.publishedAt || b.updatedAt) - getPublishedTime(a.publishedAt || a.updatedAt)
  })
}

function useSwipePager({
  currentPage,
  pageCount,
  disabled,
  onPrev,
  onNext
}: {
  currentPage: number
  pageCount: number
  disabled?: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)
  const wheelLockedRef = useRef(false)
  const enabled = !disabled && pageCount > 1

  const suppressNextClick = useCallback(() => {
    suppressClickRef.current = true
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 320)
  }, [])

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!enabled || event.touches.length !== 1) return
    const touch = event.touches[0]
    startRef.current = { x: touch.clientX, y: touch.clientY }
    suppressClickRef.current = false
  }, [enabled])

  const onTouchEnd = useCallback((event: TouchEvent<HTMLElement>) => {
    const start = startRef.current
    startRef.current = null
    if (!enabled || !start || event.changedTouches.length !== 1) return

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    if (absX < SWIPE_PAGE_MIN_DISTANCE || absX < absY * SWIPE_PAGE_VERTICAL_RATIO) return

    if (deltaX < 0 && currentPage < pageCount - 1) {
      suppressNextClick()
      onNext()
    } else if (deltaX > 0 && currentPage > 0) {
      suppressNextClick()
      onPrev()
    }
  }, [currentPage, enabled, onNext, onPrev, pageCount, suppressNextClick])

  const onTouchCancel = useCallback(() => {
    startRef.current = null
  }, [])

  const onWheel = useCallback((event: WheelEvent<HTMLElement>) => {
    if (!enabled || wheelLockedRef.current) return
    const absX = Math.abs(event.deltaX)
    const absY = Math.abs(event.deltaY)
    if (absX < WHEEL_PAGE_MIN_DISTANCE || absX < absY * SWIPE_PAGE_VERTICAL_RATIO) return

    if (event.deltaX > 0 && currentPage < pageCount - 1) {
      wheelLockedRef.current = true
      onNext()
    } else if (event.deltaX < 0 && currentPage > 0) {
      wheelLockedRef.current = true
      onPrev()
    } else {
      return
    }

    window.setTimeout(() => {
      wheelLockedRef.current = false
    }, WHEEL_PAGE_COOLDOWN_MS)
  }, [currentPage, enabled, onNext, onPrev, pageCount])

  const onClickCapture = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
  }, [])

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    onWheel,
    onClickCapture
  }
}

function AccessPill({ locked, accessTier }: { locked?: boolean; accessTier?: string }) {
  if (locked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#6251f5]/90 px-2.5 py-1 text-xs font-black text-white shadow-sm backdrop-blur">
        <Lock className="h-3 w-3" />
        Club
      </span>
    )
  }
  if (accessTier !== 'free') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2.5 py-1 text-xs font-black text-white shadow-sm backdrop-blur">
        <Check className="h-3 w-3" />
        Club
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#2f6ed8] shadow-sm">
      {accessTier === 'free' ? 'Free' : '会员'}
    </span>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[#dbe8f4] bg-white px-6 py-5 shadow-[0_14px_32px_rgba(47,111,216,0.06)]">
      <span className="pointer-events-none absolute right-6 top-5 h-14 w-14 rounded-full bg-[#7fb069]/10" />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-5">
        <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">{title}</h2>
        {subtitle ? <p className="max-w-xl text-sm font-semibold leading-6 text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  )
}

function PlayOverlay({ label = '' }: { label?: string }) {
  return (
    <span className="inline-flex h-14 min-w-14 items-center justify-center gap-2 rounded-full bg-white/92 px-4 text-[#6251f5] shadow-[0_16px_40px_rgba(98,81,245,0.22)] transition group-hover:scale-105">
      {label ? <Lock className="h-5 w-5" /> : <Play className="ml-1 h-6 w-6 fill-current" />}
      {label ? <span className="text-sm font-black">{label}</span> : null}
    </span>
  )
}

function SummaryPreviewText({ children }: { children: string }) {
  return (
    <p
      className="mt-4 whitespace-pre-line break-words text-[13px] leading-6 text-slate-700"
      style={{
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 7,
        overflow: 'hidden'
      }}
    >
      {children}
    </p>
  )
}

function PosterFrame({
  src,
  title,
  eyebrow,
  className = '',
  loading = 'lazy',
  tone = 'ceo'
}: {
  src?: string
  title: string
  eyebrow?: string
  className?: string
  loading?: 'eager' | 'lazy'
  tone?: PosterTone
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const imageSrc = String(src || '').trim()

  useEffect(() => {
    setImageFailed(false)
  }, [imageSrc])

  if (imageSrc && !imageFailed) {
    return (
      <img
        src={imageSrc}
        alt={title}
        className={`h-full w-full object-cover ${className}`}
        loading={loading}
        onError={() => setImageFailed(true)}
      />
    )
  }
  const toneStyle = TONE_STYLES[tone]
  return (
    <div className={`relative flex h-full w-full flex-col justify-center overflow-hidden ${toneStyle.surface} p-5 ${className}`}>
      <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/70" />
      <span className={`pointer-events-none absolute bottom-0 left-0 h-1.5 w-24 ${toneStyle.accent}`} />
      <div className={`absolute left-5 top-5 text-xs font-black uppercase tracking-[0.08em] ${toneStyle.tag}`}>{eyebrow || 'Video'}</div>
      <div className={`relative mt-8 line-clamp-3 max-w-[92%] text-xl font-black leading-tight tracking-tight ${toneStyle.title} md:text-2xl`}>{title}</div>
    </div>
  )
}

function trackVideoOpen(section: TalkSectionKey, entityId: string, position: string, category = '') {
  trackingService.track('corporate_english_video_open', {
    page_key: 'corporate_english',
    module: 'corporate_english_video',
    feature_key: 'corporate_english_video_open',
    entity_type: section === 'ceo' ? 'corporate_english_material' : 'corporate_english_module_video',
    entity_id: entityId,
    corporate_english_section: section,
    module_key: section,
    position,
    category
  })
}

function getModuleVideoEyebrow(video: CorporateEnglishPublicModuleVideo, section: Exclude<TalkSectionKey, 'ceo'>) {
  if (section === 'remote_preparation') return video.difficultyLevelLabel || SECTION_LABELS[section]
  return video.category || SECTION_LABELS[section]
}

function trackModuleView(section: TalkSectionKey, videoCount: number, isAuthenticated: boolean, isMember: boolean) {
  trackingService.track('corporate_english_module_view', {
    page_key: 'corporate_english',
    module: 'corporate_english_module',
    feature_key: 'corporate_english_module_view',
    entity_type: 'corporate_english_module',
    entity_id: section,
    corporate_english_section: section,
    module_key: section,
    module_label: SECTION_LABELS[section],
    video_count: videoCount,
    audience_state: !isAuthenticated ? 'guest' : isMember ? 'member' : 'free',
    path: '/careerlearning'
  })
}

function LoginPosterOverlay({ label = '登录后播放' }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/20 text-white">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-sm font-black text-[#6251f5] shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur">
        <Lock className="h-4 w-4" />
        {label}
      </span>
    </div>
  )
}

function CeoHero({ video, isGuest }: { video: CorporateEnglishPublicCeoVideo; isGuest: boolean }) {
  const href = isGuest ? '/login' : `/careerlearning/watch/ceo/${encodeURIComponent(video.materialId)}`
  return (
    <section className="relative grid gap-8 overflow-hidden rounded-[28px] border border-[#dbe8f4] bg-white p-6 shadow-[0_18px_48px_rgba(47,111,216,0.07)] lg:grid-cols-[minmax(0,0.85fr)_minmax(520px,1fr)] lg:items-center lg:p-8">
      <span className="pointer-events-none absolute right-10 top-8 h-20 w-20 rounded-full bg-[#7fb069]/10" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-1.5 w-40 bg-[#6251f5]" />
      <div className="relative min-w-0">
        <div className="text-sm font-black uppercase tracking-[0.08em] text-[#2f6ed8]">远程企业 CEO 访谈</div>
        <h1 className="mt-3 text-4xl font-black leading-[1.06] tracking-tight text-slate-950 md:text-5xl">
          {video.materialTitle}
        </h1>
        {!isGuest ? <p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-7 text-slate-700">
          {truncateText(video.videoSummary, 220) || `跟随 ${video.speakerName} 的真实访谈，理解企业文化、商业思维和外企表达。`}
        </p> : null}
        <div className="mt-4 text-base font-semibold text-slate-500">
          {isGuest ? `${video.speakerRole}${video.companyName ? ` · ${video.companyName}` : ''}` : `${video.speakerName} · ${video.speakerRole}${video.companyName ? ` · ${video.companyName}` : ''}`}
        </div>
        <div className="mt-6">
          <Link
            to={href}
            onClick={() => !isGuest && trackVideoOpen('ceo', video.materialId, 'hero')}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[#6251f5] px-6 text-sm font-black !text-white shadow-[0_14px_30px_rgba(98,81,245,0.22)] transition hover:bg-[#6251f5] hover:!text-white hover:shadow-[0_12px_26px_rgba(98,81,245,0.16)] hover:no-underline focus:!text-white active:!text-white"
          >
            {isGuest ? '登录后播放' : '开始观看'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <Link
        to={href}
        onClick={() => !isGuest && trackVideoOpen('ceo', video.materialId, 'hero_cover')}
        className="group relative block aspect-video overflow-hidden rounded-[22px] border border-[#dbe8f4] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.08)] hover:no-underline"
      >
        <PosterFrame
          src={video.coverImageUrl}
          title={video.materialTitle}
          eyebrow={video.companyName}
          className="transition duration-500 group-hover:scale-[1.025]"
          loading="eager"
          tone="ceo"
        />
        <div className={`absolute inset-0 ${isGuest ? 'bg-gradient-to-t from-slate-950/20 via-transparent to-white/10' : 'bg-gradient-to-t from-slate-950/10 via-transparent to-transparent'}`} />
        {!isGuest ? <div className="absolute right-4 top-4">
          <AccessPill locked={video.isVideoLocked} accessTier={video.accessTier} />
        </div> : null}
        {isGuest ? <LoginPosterOverlay /> : (
          <div className="absolute inset-0 flex items-center justify-center">
            <PlayOverlay />
          </div>
        )}
        {formatDuration(video.durationMs) ? (
          <div className="absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1 text-sm font-black text-slate-700 shadow-sm">{formatDuration(video.durationMs)}</div>
        ) : null}
      </Link>
    </section>
  )
}

function CeoCard({ video, index, isGuest }: { video: CorporateEnglishPublicCeoVideo; index: number; isGuest: boolean }) {
  const href = isGuest ? '/login' : `/careerlearning/watch/ceo/${encodeURIComponent(video.materialId)}`
  return (
    <Link
      to={href}
      onClick={() => !isGuest && trackVideoOpen('ceo', video.materialId, `ceo_card_${index}`)}
      className="group relative block min-w-[250px] overflow-hidden rounded-[18px] border border-[#dbe8f4] bg-white p-2.5 text-slate-950 shadow-[0_8px_22px_rgba(47,111,216,0.05)] transition hover:-translate-y-1 hover:no-underline"
    >
      <div className="relative aspect-video overflow-hidden rounded-[14px] bg-white">
        <PosterFrame
          src={video.coverThumbnailUrl || video.coverImageUrl}
          title={video.materialTitle}
          eyebrow={video.companyName}
          className="transition duration-500 group-hover:scale-[1.04]"
          tone="ceo"
        />
        <div className={`absolute inset-0 transition ${isGuest ? 'bg-slate-950/10' : 'bg-gradient-to-t from-slate-950/25 via-transparent to-transparent opacity-0 group-hover:opacity-100'}`} />
        {!isGuest ? <div className="absolute right-2 top-2">
          <AccessPill locked={video.isVideoLocked} accessTier={video.accessTier} />
        </div> : null}
        {isGuest ? <LoginPosterOverlay label="登录后播放" /> : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-xs font-black uppercase tracking-[0.08em] text-[#2f6ed8]">{video.companyName}</div>
        {formatDuration(video.durationMs) ? (
          <span className="shrink-0 rounded-full bg-[#f4f7fb] px-2.5 py-1 text-xs font-black text-slate-500">{formatDuration(video.durationMs)}</span>
        ) : null}
      </div>
      <h3 className="mt-2 line-clamp-2 min-h-[3rem] text-lg font-black leading-tight tracking-tight">{video.materialTitle}</h3>
      <p className="mt-2 truncate text-sm font-semibold text-slate-500">{isGuest ? '登录后播放' : `${video.speakerName} · ${formatDateLabel(video.publishedAt) || '精选访谈'}`}</p>
      <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-400">{video.speakerRole}</p>
      {!isGuest ? <div className="pointer-events-none absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-white p-5 opacity-0 shadow-[inset_0_0_0_1px_rgba(219,232,244,0.9)] transition duration-200 group-hover:opacity-100">
        <div className="line-clamp-2 text-sm font-black leading-5 text-slate-950">{video.materialTitle}</div>
        <div className="mt-2 shrink-0 truncate text-sm font-semibold text-[#e11d48]">{video.companyName} · {video.speakerName}</div>
        <SummaryPreviewText>{video.videoSummary || `${video.speakerName} 分享 ${video.companyName} 的文化、业务和表达方式。`}</SummaryPreviewText>
      </div> : null}
    </Link>
  )
}

function CeoVideoGrid({ videos, isGuest }: { videos: CorporateEnglishPublicCeoVideo[]; isGuest: boolean }) {
  const [activePage, setActivePage] = useState(0)
  const pages = useMemo(() => {
    const nextPages: CorporateEnglishPublicCeoVideo[][] = []
    for (let index = 0; index < videos.length; index += CEO_PAGE_SIZE) {
      nextPages.push(videos.slice(index, index + CEO_PAGE_SIZE))
    }
    return nextPages
  }, [videos])
  const pageCount = Math.max(1, pages.length)
  const currentPage = Math.min(activePage, pageCount - 1)
  const goPrev = useCallback(() => setActivePage((page) => Math.max(0, page - 1)), [])
  const goNext = useCallback(() => setActivePage((page) => Math.min(pageCount - 1, page + 1)), [pageCount])
  const swipeHandlers = useSwipePager({
    currentPage,
    pageCount,
    disabled: isGuest,
    onPrev: goPrev,
    onNext: goNext
  })

  useEffect(() => {
    if (activePage > pageCount - 1) setActivePage(Math.max(0, pageCount - 1))
  }, [activePage, pageCount])

  if (!videos.length) return null

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-5">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">更多 CEO 访谈</h2>
          <p className="max-w-xl text-sm font-semibold leading-6 text-slate-500">
            了解远程企业，提升认知、口语与申请成功率
          </p>
        </div>
        {!isGuest ? <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentPage === 0}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe8f4] bg-white text-slate-600 shadow-sm transition enabled:hover:border-[#6251f5] enabled:hover:text-[#6251f5] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="上一页 CEO 访谈"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[72px] text-center text-sm font-black text-slate-500">{currentPage + 1} / {pageCount}</span>
          <button
            type="button"
            onClick={goNext}
            disabled={currentPage >= pageCount - 1}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe8f4] bg-white text-slate-600 shadow-sm transition enabled:hover:border-[#6251f5] enabled:hover:text-[#6251f5] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="下一页 CEO 访谈"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div> : null}
      </div>
      <div className="flex gap-5 overflow-x-auto pb-2 md:hidden">
        {(isGuest ? videos.slice(0, CEO_PAGE_SIZE) : videos).map((video, index) => (
          <div key={video.materialId} className="w-[72vw] min-w-[260px] max-w-[320px] shrink-0">
            <CeoCard video={video} index={index} isGuest={isGuest} />
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto pb-2 touch-pan-y md:block" {...swipeHandlers}>
        <div className="grid min-w-full grid-cols-4 gap-5">
          {(pages[currentPage] || []).map((video, index) => (
            <CeoCard key={video.materialId} video={video} index={currentPage * CEO_PAGE_SIZE + index} isGuest={isGuest} />
          ))}
        </div>
      </div>
    </section>
  )
}
function ModuleTalkCard({
  video,
  section,
  index,
  featured = false,
  isGuest,
  showDescription = false
}: {
  video: CorporateEnglishPublicModuleVideo
  section: Exclude<TalkSectionKey, 'ceo'>
  index: number
  featured?: boolean
  isGuest: boolean
  showDescription?: boolean
}) {
  const href = isGuest ? '/login' : `/careerlearning/watch/module/${encodeURIComponent(video.videoId)}`
  return (
    <Link
      to={href}
      onClick={() => !isGuest && trackVideoOpen(section, video.videoId, `${section}_${featured ? 'featured' : 'card'}_${index}`, section === 'remote_preparation' ? video.difficultyLevel || '' : video.category)}
      className={`group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#dbe8f4] bg-white p-3 text-slate-950 shadow-[0_10px_28px_rgba(47,111,216,0.06)] transition hover:-translate-y-1 hover:no-underline ${featured ? '' : ''}`}
    >
      <div className={`relative shrink-0 overflow-hidden rounded-[18px] bg-white ${featured ? 'aspect-[16/9]' : 'aspect-video'}`}>
        <PosterFrame
          src={video.coverThumbnailUrl || video.coverImageUrl}
          title={video.title}
          eyebrow={getModuleVideoEyebrow(video, section)}
          className="transition duration-500 group-hover:scale-[1.04]"
          loading={featured ? 'eager' : 'lazy'}
          tone={SECTION_TONE[section]}
        />
        <div className={`absolute inset-0 ${isGuest ? 'bg-slate-950/10' : 'bg-gradient-to-t from-slate-950/8 via-transparent to-transparent opacity-80'}`} />
        {!isGuest ? <div className="absolute right-3 top-3"><AccessPill locked={video.isLocked} accessTier={video.accessTier} /></div> : null}
        {isGuest ? <LoginPosterOverlay label="登录后播放" /> : (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100"><PlayOverlay /></div>
        )}
      </div>
      <div className={`${section === 'foreign_meeting' ? 'mt-3' : 'mt-4'} flex items-center justify-between gap-3`}>
        <div className="min-w-0 truncate text-sm font-black uppercase tracking-[0.08em] text-[#2f6ed8]">{getModuleVideoEyebrow(video, section)}</div>
        {formatDuration(video.durationMs) ? (
          <span className="shrink-0 rounded-full bg-[#f4f7fb] px-2.5 py-1 text-xs font-black text-slate-500">{formatDuration(video.durationMs)}</span>
        ) : null}
      </div>
      <h3 className={`${featured ? 'mt-2 text-2xl md:text-3xl' : section === 'foreign_meeting' ? 'mt-1.5 line-clamp-2 text-xl' : section === 'remote_preparation' ? 'mt-2 line-clamp-2 text-xl' : 'mt-2 line-clamp-2 min-h-[3.5rem] text-xl'} font-black leading-tight tracking-tight`}>{video.title}</h3>
      {!isGuest && (featured || showDescription) ? <p className={`${featured ? 'mt-3 text-base' : section === 'remote_preparation' ? 'mt-2 text-sm leading-6' : section === 'foreign_meeting' ? 'mt-3 text-sm' : 'mt-3 text-sm leading-7'} line-clamp-3 max-w-full text-slate-700`}>{video.description}</p> : null}
      <p className={`${section === 'remote_preparation' ? 'mt-2' : section === 'foreign_meeting' ? 'mt-3' : 'mt-2'} text-sm font-semibold text-slate-500 ${featured ? '' : 'mt-auto pt-1'}`}>{isGuest ? '登录后播放' : (formatDateLabel(video.publishedAt) || '精选视频')}</p>
      {!isGuest ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex min-h-0 translate-y-6 flex-col overflow-hidden bg-white p-5 opacity-0 shadow-[inset_0_0_0_1px_rgba(219,232,244,0.9)] transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <div className="line-clamp-2 text-sm font-black leading-5 text-slate-950">{video.title}</div>
          <div className="mt-2 shrink-0 truncate text-sm font-semibold text-[#e11d48]">{getModuleVideoEyebrow(video, section)} · {formatDateLabel(video.publishedAt) || '精选视频'}</div>
          <SummaryPreviewText>{video.description || `${SECTION_LABELS[section]}精选视频，帮助你理解真实远程工作场景和表达方式。`}</SummaryPreviewText>
        </div>
      ) : null}
    </Link>
  )
}

function PagerControls({
  currentPage,
  pageCount,
  onPrev,
  onNext,
  disabled = false,
  label
}: {
  currentPage: number
  pageCount: number
  onPrev: () => void
  onNext: () => void
  disabled?: boolean
  label: string
}) {
  if (disabled || pageCount <= 1) return null
  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentPage === 0}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe8f4] bg-white text-slate-600 shadow-sm transition enabled:hover:border-[#6251f5] enabled:hover:text-[#6251f5] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`上一页${label}`}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-[72px] text-center text-sm font-black text-slate-500">{currentPage + 1} / {pageCount}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={currentPage >= pageCount - 1}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#dbe8f4] bg-white text-slate-600 shadow-sm transition enabled:hover:border-[#6251f5] enabled:hover:text-[#6251f5] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`下一页${label}`}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}

function CategoryRail({
  title,
  categories,
  activeCategory,
  onChange
}: {
  title: string
  categories: CorporateEnglishPublicCategory[]
  activeCategory: string
  onChange: (value: string) => void
}) {
  const normalized = useMemo(() => {
    const values = categories.length ? categories : [{ label: '全部', value: '全部', count: 0 }]
    return values
  }, [categories])
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[#dbe8f4] bg-white px-4 py-4 text-slate-950 shadow-[0_10px_28px_rgba(47,111,216,0.06)] sm:px-6">
      <span className="pointer-events-none absolute right-5 top-4 h-12 w-12 rounded-full bg-[#7fb069]/10" />
      <div className="relative flex items-center gap-5 overflow-x-auto">
        <h2 className="shrink-0 text-3xl font-black tracking-tight md:text-4xl">{title}</h2>
        <div className="flex min-w-max items-center gap-3">
          {normalized.map((category) => {
            const active = activeCategory === category.value
            return (
              <button
                key={category.value}
                type="button"
                onClick={() => onChange(category.value)}
                className={`relative h-11 rounded-full border px-5 text-sm font-black transition ${active ? 'border-[#6251f5] bg-[#6251f5] text-white shadow-[0_10px_24px_rgba(98,81,245,0.22)]' : 'border-[#dbe8f4] bg-white/80 text-slate-700 hover:border-[#9ebff0] hover:text-[#2f6ed8]'}`}
              >
                {category.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ModuleSection({
  section,
  videos,
  emptyText,
  featuredLayout = true,
  loading = false,
  isGuest
}: {
  section: Exclude<TalkSectionKey, 'ceo'>
  videos: CorporateEnglishPublicModuleVideo[]
  emptyText: string
  featuredLayout?: boolean
  loading?: boolean
  isGuest: boolean
}) {
  const [activePage, setActivePage] = useState(0)
  const shouldUseFeaturedLayout = section === 'english_interview' && featuredLayout && videos.length <= 5 && !isGuest
  const pageSize = MODULE_PAGE_SIZE
  const pages = useMemo(() => {
    const nextPages: CorporateEnglishPublicModuleVideo[][] = []
    for (let index = 0; index < videos.length; index += pageSize) {
      nextPages.push(videos.slice(index, index + pageSize))
    }
    return nextPages
  }, [pageSize, videos])
  const pageCount = Math.max(1, pages.length)
  const currentPage = Math.min(activePage, pageCount - 1)
  const [hero, ...rest] = videos
  const goPrev = useCallback(() => setActivePage((page) => Math.max(0, page - 1)), [])
  const goNext = useCallback(() => setActivePage((page) => Math.min(pageCount - 1, page + 1)), [pageCount])
  const swipeHandlers = useSwipePager({
    currentPage,
    pageCount,
    disabled: isGuest,
    onPrev: goPrev,
    onNext: goNext
  })

  useEffect(() => {
    setActivePage(0)
  }, [section, videos])

  useEffect(() => {
    if (activePage > pageCount - 1) setActivePage(Math.max(0, pageCount - 1))
  }, [activePage, pageCount])

  if (loading) {
    return (
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="h-[420px] rounded-[22px] border border-[#dbe8f4] bg-white shadow-[0_10px_28px_rgba(47,111,216,0.06)]" />
        <div className="grid content-start gap-6 md:grid-cols-2 xl:grid-cols-1">
          {[0, 1].map((item) => (
            <div key={item} className="h-[220px] rounded-[22px] border border-[#dbe8f4] bg-white shadow-[0_10px_28px_rgba(47,111,216,0.06)]" />
          ))}
        </div>
      </div>
    )
  }
  if (!hero) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        <Video className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-3 text-sm font-semibold">{emptyText}</p>
      </div>
    )
  }

  if (shouldUseFeaturedLayout) {
    return (
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.04fr)_minmax(520px,0.96fr)]">
        <ModuleTalkCard video={hero} section={section} index={0} featured isGuest={isGuest} />
        <div className="grid content-start gap-6 sm:grid-cols-2">
          {rest.slice(0, 4).map((video, index) => (
            <ModuleTalkCard key={video.videoId} video={video} section={section} index={index + 1} isGuest={isGuest} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PagerControls
        currentPage={currentPage}
        pageCount={pageCount}
        disabled={isGuest}
        label={SECTION_LABELS[section]}
        onPrev={goPrev}
        onNext={goNext}
      />
      <div
        className={`${section === 'foreign_meeting' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4' : 'grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'} touch-pan-y`}
        {...swipeHandlers}
      >
        {(pages[currentPage] || []).map((video, index) => (
          <ModuleTalkCard
            key={video.videoId}
            video={video}
            section={section}
            index={currentPage * pageSize + index}
            isGuest={isGuest}
            showDescription={section !== 'foreign_meeting' && !shouldUseFeaturedLayout}
          />
        ))}
      </div>
    </div>
  )
}

function RemotePreparationSection({
  videos,
  loading,
  isGuest
}: {
  videos: CorporateEnglishPublicModuleVideo[]
  loading: boolean
  isGuest: boolean
}) {
  if (loading) {
    return (
      <section className="space-y-5">
        <SectionHeader title="远程准备" subtitle="熟悉远程工作所需的一切，不打无准备的仗" />
        <div className="flex gap-5 overflow-hidden">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-[300px] min-w-[280px] flex-1 rounded-[22px] border border-[#f1dfbe] bg-white shadow-[0_10px_28px_rgba(240,161,31,0.08)]" />
          ))}
        </div>
      </section>
    )
  }

  if (!videos.length) {
    return (
      <section className="space-y-5">
        <SectionHeader title="远程准备" subtitle="熟悉远程工作所需的一切，不打无准备的仗" />
        <div className="rounded-2xl border border-dashed border-[#e8d4ad] bg-white p-10 text-center text-slate-500">
          后台发布远程准备视频后，这里会展示远程求职与协作准备内容。
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-[26px] border border-[#ead8b9] bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_52%,#f6fbff_100%)] px-6 py-5 shadow-[0_16px_36px_rgba(151,101,34,0.08)]">
        <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#f0a11f]/12" />
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-5">
          <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">远程准备</h2>
          <p className="max-w-xl text-sm font-semibold leading-6 text-slate-500">
            熟悉远程工作所需的一切，不打无准备的仗
          </p>
        </div>
      </div>
      <div className="flex items-stretch gap-6 overflow-x-auto pb-3">
        {(isGuest ? videos.slice(0, 6) : videos).map((video, index) => (
          <div key={video.videoId} className="w-[78vw] min-w-[280px] shrink-0 md:w-[31%] md:min-w-[300px] lg:w-[30%] xl:w-[28.5%] 2xl:w-[28%]">
            <ModuleTalkCard
              video={video}
              section="remote_preparation"
              index={index}
              isGuest={isGuest}
              showDescription={!isGuest}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function CorporateEnglishTalksPage() {
  const { isAuthenticated, isMember, membershipCapabilities } = useAuth()
  const { showError } = useNotificationHelpers()
  const showErrorRef = useRef(showError)
  const [ceoLoading, setCeoLoading] = useState(true)
  const [interviewLoading, setInterviewLoading] = useState(true)
  const [remoteLoading, setRemoteLoading] = useState(true)
  const [meetingLoading, setMeetingLoading] = useState(true)
  const [ceoVideos, setCeoVideos] = useState<CorporateEnglishPublicCeoVideo[]>([])
  const [interviewVideos, setInterviewVideos] = useState<CorporateEnglishPublicModuleVideo[]>([])
  const [interviewCategories, setInterviewCategories] = useState<CorporateEnglishPublicCategory[]>([])
  const [remoteVideos, setRemoteVideos] = useState<CorporateEnglishPublicModuleVideo[]>([])
  const [meetingVideos, setMeetingVideos] = useState<CorporateEnglishPublicModuleVideo[]>([])
  const [activeInterviewCategory, setActiveInterviewCategory] = useState('全部')
  const trackedModuleViewsRef = useRef<Set<TalkSectionKey>>(new Set())

  const loadModule = useCallback(async (module: CorporateEnglishModuleKey, category = '全部') => {
    return corporateEnglishPublicService.listModuleVideos({ module, category })
  }, [])

  useEffect(() => {
    showErrorRef.current = showError
  }, [showError])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setCeoLoading(true)
        const ceoData = await corporateEnglishPublicService.listCeoVideos()
        if (cancelled) return
        setCeoVideos(ceoData)
      } catch (error) {
        console.error('Failed to load CEO talks:', error)
        if (!cancelled) showErrorRef.current('CEO访谈加载失败', error instanceof Error ? error.message : '请稍后重试')
      } finally {
        if (!cancelled) setCeoLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setInterviewLoading(true)
        const interviewData = await loadModule('english_interview', activeInterviewCategory)
        if (cancelled) return
        setInterviewVideos(interviewData.videos)
        setInterviewCategories(interviewData.categories)
      } catch (error) {
        console.error('Failed to load English interview videos:', error)
        if (!cancelled) showErrorRef.current('英语面试加载失败', error instanceof Error ? error.message : '请稍后重试')
      } finally {
        if (!cancelled) setInterviewLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [activeInterviewCategory, loadModule])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setRemoteLoading(true)
        const remoteData = await loadModule('remote_preparation', '全部')
        if (cancelled) return
        setRemoteVideos(remoteData.videos)
      } catch (error) {
        console.error('Failed to load remote preparation videos:', error)
        if (!cancelled) showErrorRef.current('远程准备加载失败', error instanceof Error ? error.message : '请稍后重试')
      } finally {
        if (!cancelled) setRemoteLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [loadModule])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setMeetingLoading(true)
        const meetingData = await loadModule('foreign_meeting', '全部')
        if (cancelled) return
        setMeetingVideos(meetingData.videos)
      } catch (error) {
        console.error('Failed to load foreign meeting videos:', error)
        if (!cancelled) showErrorRef.current('远程会议加载失败', error instanceof Error ? error.message : '请稍后重试')
      } finally {
        if (!cancelled) setMeetingLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [loadModule])

  useEffect(() => {
    const maybeTrack = (section: TalkSectionKey, loading: boolean, count: number) => {
      if (loading || trackedModuleViewsRef.current.has(section)) return
      trackedModuleViewsRef.current.add(section)
      trackModuleView(section, count, isAuthenticated, isMember)
    }
    maybeTrack('ceo', ceoLoading, ceoVideos.length)
    maybeTrack('english_interview', interviewLoading, interviewVideos.length)
    maybeTrack('remote_preparation', remoteLoading, remoteVideos.length)
    maybeTrack('foreign_meeting', meetingLoading, meetingVideos.length)
  }, [
    ceoLoading,
    ceoVideos.length,
    interviewLoading,
    interviewVideos.length,
    isAuthenticated,
    isMember,
    meetingLoading,
    meetingVideos.length,
    remoteLoading,
    remoteVideos.length
  ])

  const canViewMemberVideos = Boolean(membershipCapabilities.canAccessCorporateEnglishVideos)
  const sortedCeoVideos = useMemo(() => sortForAudience(ceoVideos, canViewMemberVideos), [ceoVideos, canViewMemberVideos])
  const sortedInterviewVideos = useMemo(() => sortForAudience(interviewVideos, canViewMemberVideos), [interviewVideos, canViewMemberVideos])
  const sortedRemoteVideos = useMemo(() => sortForAudience(remoteVideos, canViewMemberVideos), [remoteVideos, canViewMemberVideos])
  const sortedMeetingVideos = useMemo(() => sortForAudience(meetingVideos, canViewMemberVideos), [meetingVideos, canViewMemberVideos])
  const isGuest = !isAuthenticated
  const heroVideo = sortedCeoVideos[0]
  const otherCeoVideos = sortedCeoVideos.slice(1)

  return (
    <div className="min-h-screen bg-[#fbfaf6] font-haigoo-rounded text-slate-950">
      <div className="mx-auto max-w-[1640px] px-4 pb-10 pt-24 sm:px-8">
        <div className="space-y-10">
            {ceoLoading ? (
              <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-[#dbe8f4] bg-white shadow-[0_10px_28px_rgba(47,111,216,0.06)]">
                <Loader2 className="h-7 w-7 animate-spin text-[#6251f5]" />
              </div>
            ) : heroVideo ? (
              <>
                <CeoHero video={heroVideo} isGuest={isGuest} />
                <CeoVideoGrid videos={otherCeoVideos} isGuest={isGuest} />
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                后台发布 CEO 访谈后，这里会展示最新内容。
              </div>
            )}

            <RemotePreparationSection
              videos={sortedRemoteVideos}
              loading={remoteLoading}
              isGuest={isGuest}
            />

            <section className="space-y-4">
              <CategoryRail
                title="英语面试"
                categories={interviewCategories}
                activeCategory={activeInterviewCategory}
                onChange={setActiveInterviewCategory}
              />
              <ModuleSection
                section="english_interview"
                videos={sortedInterviewVideos}
                emptyText="后台发布英语面试视频后，这里会按岗位类型展示。"
                featuredLayout={activeInterviewCategory === '全部'}
                loading={interviewLoading}
                isGuest={isGuest}
              />
            </section>

            <section className="space-y-4">
              <SectionHeader title="远程会议" subtitle="提前适应远程工作环境，丝滑过渡" />
              <ModuleSection section="foreign_meeting" videos={sortedMeetingVideos} emptyText="后台发布远程会议视频后，这里会展示最新会议内容。" loading={meetingLoading} isGuest={isGuest} />
            </section>
          </div>
      </div>
    </div>
  )
}
