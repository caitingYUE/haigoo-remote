import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, Check, Lock, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { VideoNotesModal, type VideoNotesModalVideo } from './VideoNotesModal'
import { withReturnTo } from '../hooks/useReturnNavigation'
import { corporateEnglishPublicService, type CorporateEnglishFeaturedVideo } from '../services/corporate-english-public-service'

function formatPublishedDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function AccessPill({ accessTier, unlocked }: { accessTier?: string; unlocked: boolean }) {
  if (accessTier === 'free') {
    return <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#2f6ed8] shadow-sm">Free</span>
  }
  if (unlocked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/95 px-2.5 py-1 text-xs font-black text-white shadow-sm backdrop-blur">
        <Check className="h-3 w-3" />Club
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#6251f5]/90 px-2.5 py-1 text-xs font-black text-white shadow-sm backdrop-blur">
      <Lock className="h-3 w-3" />Club
    </span>
  )
}

export default function HomeCareerGuides() {
  const { membershipCapabilities } = useAuth()
  const [videos, setVideos] = useState<CorporateEnglishFeaturedVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [notesVideo, setNotesVideo] = useState<VideoNotesModalVideo | null>(null)

  useEffect(() => {
    let cancelled = false
    corporateEnglishPublicService.listFeaturedVideos(4)
      .then((items) => {
        if (!cancelled) setVideos(items)
      })
      .catch(() => {
        if (!cancelled) setVideos([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && videos.length === 0) return null

  return (
    <section
      className="relative z-10 mt-6 overflow-hidden rounded-[28px] border border-[#dce8f1] bg-white px-5 py-6 shadow-[0_22px_55px_-46px_rgba(39,65,91,0.42)] sm:px-6 lg:px-7 lg:py-7"
      aria-labelledby="home-career-guides-title"
    >
      <div className="mb-5 flex flex-col gap-4 border-b border-[#e8eff5] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 id="home-career-guides-title" className="text-[28px] font-black leading-tight text-slate-950 sm:text-[32px]">职业成长</h2>
            <p className="text-sm font-semibold leading-6 text-slate-500 sm:text-[15px]">远程工作必备技能、认知、求职攻略和远程企业文化</p>
          </div>
        </div>
        <Link
          to="/careerlearning"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full border border-[#d7e5f0] bg-[#f9fbfd] px-4 text-sm font-black text-slate-700 transition hover:border-[#6251f5] hover:bg-white hover:text-[#6251f5] hover:no-underline sm:self-auto"
        >
          查看更多视频<ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        {loading ? Array.from({ length: 4 }, (_, index) => (
          <div key={`career-guide-skeleton-${index}`} className="overflow-hidden rounded-lg border border-[#e3edf4] bg-white">
            <div className="aspect-video animate-pulse bg-slate-100" />
            <div className="space-y-3 p-4"><div className="h-5 animate-pulse rounded bg-slate-100" /><div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" /><div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" /></div>
          </div>
        )) : videos.map((video) => {
          const videoHref = withReturnTo(video.href, '/')
          const metadata = [video.source, video.difficultyLevelLabel || video.category || video.industry, ...(video.tags || [])]
            .map((item) => String(item || '').trim())
            .filter((item, index, items) => item && items.indexOf(item) === index)
            .slice(0, 3)
          return (
          <article key={`${video.kind}-${video.id}`} className="group relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#d9e6f0] bg-white text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#b9ccdc] hover:shadow-[0_16px_34px_rgba(70,93,125,0.12)]">
            <Link to={videoHref} target="_blank" rel="noreferrer" className="absolute inset-0 z-10" aria-label={`在新页面查看视频：${video.title}`} />
            <div className="relative aspect-video overflow-hidden bg-slate-100">
              {video.coverImageUrl ? <img src={video.coverImageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <span className="flex h-full items-center justify-center text-slate-300"><BookOpen className="h-9 w-9" /></span>}
              <span className="absolute left-3 top-3 rounded-md border border-white/20 bg-slate-950/85 px-2.5 py-1 text-xs font-black text-white shadow-sm backdrop-blur-sm">{video.moduleLabel}</span>
              <span className="absolute right-3 top-3"><AccessPill accessTier={video.accessTier} unlocked={membershipCapabilities.canAccessCorporateEnglishVideos} /></span>
              {video.hasVideoNotes && video.noteHref ? (
                <button
                  type="button"
                  onClick={() => setNotesVideo({ videoId: video.id, title: video.title })}
                  className="absolute bottom-3 right-3 z-30 inline-flex h-8 items-center gap-1.5 rounded-full border border-[#d8d0ff] bg-white px-3 text-xs font-black text-[#5142df] shadow-[0_8px_22px_rgba(34,27,104,0.2)] transition hover:border-[#6251f5] hover:bg-[#6251f5] hover:text-white hover:no-underline"
                  aria-label={`查看${video.title}的视频笔记`}
                >
                  <BookOpen className="h-3.5 w-3.5" />视频笔记
                </button>
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 transition group-hover:bg-slate-950/10"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-[#6251f5] opacity-0 shadow transition group-hover:opacity-100"><Play className="h-4 w-4 fill-current" /></span></span>
            </div>
            <div className="flex min-h-[160px] flex-1 flex-col p-4">
              {metadata.length ? (
                <div className="mb-2 min-w-0 truncate whitespace-nowrap text-[11px] font-black text-[#2f6ed8]" title={metadata.join(' · ')}>{metadata.join(' · ')}</div>
              ) : null}
              <h3 className="line-clamp-2 min-h-[48px] text-base font-black leading-6 text-slate-950 transition-colors group-hover:text-[#5142df]">{video.title}</h3>
              <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-xs font-bold text-slate-500">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{formatPublishedDate(video.publishedAt) || '近期更新'}</span>
                </span>
                <Link
                  to={videoHref}
                  target="_blank"
                  rel="noreferrer"
                  className="relative z-30 inline-flex shrink-0 items-center gap-1 text-[#6251f5] transition-opacity hover:text-[#5142df] hover:no-underline group-hover:opacity-0"
                  aria-label={`在新页面查看视频：${video.title}`}
                >
                  查看 <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
            {video.description ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex h-[160px] translate-y-full flex-col border-t border-[#e4ebf2] bg-white px-4 py-3.5 opacity-0 shadow-[0_-14px_32px_-26px_rgba(15,23,42,0.28)] transition duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-black text-[#6251f5]"><BookOpen className="h-3.5 w-3.5" />视频简介</div>
                <p className="line-clamp-5 whitespace-pre-line text-sm font-semibold leading-5 text-slate-600">{video.description}</p>
              </div>
            ) : null}
          </article>
        )})}
      </div>
      {notesVideo ? <VideoNotesModal video={notesVideo} onClose={() => setNotesVideo(null)} /> : null}
    </section>
  )
}
