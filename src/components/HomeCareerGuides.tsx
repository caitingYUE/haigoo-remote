import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, CalendarDays, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { VideoNotesModal, type VideoNotesModalVideo } from './VideoNotesModal'
import { withReturnTo } from '../hooks/useReturnNavigation'
import { corporateEnglishPublicService, type CorporateEnglishFeaturedVideo } from '../services/corporate-english-public-service'
import { useLanguage } from '../contexts/LanguageContext'

function formatPublishedDate(value?: string, isEnglish = false) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return isEnglish ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `${date.getMonth() + 1}月${date.getDate()}日`
}

function AccessPill({ accessTier, unlocked, isEnglish }: { accessTier?: string; unlocked: boolean; isEnglish: boolean }) {
  const isOpen = accessTier === 'free' || unlocked
  return (
    <span className={`hg-career-access ${isOpen ? 'hg-career-access--open' : 'hg-career-access--closed'}`}>
      {isOpen ? (isEnglish ? 'Open' : '开放') : (isEnglish ? 'Private' : '不开放')}
    </span>
  )
}

export default function HomeCareerGuides() {
  const { membershipCapabilities } = useAuth()
  const { isEnglish, text } = useLanguage()
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
      className="haigoo-career [content-visibility:auto] [contain-intrinsic-size:auto_520px]"
      aria-labelledby="home-career-guides-title"
    >
      <div className="haigoo-career__header">
        <div className="min-w-0">
          <p className="haigoo-editorial-label">Career learning</p>
          <h2 id="home-career-guides-title">{text('职业成长', 'Career growth')}</h2>
          <p>{text('持续学习远程工作需要的技能和方法。', 'Keep learning the skills and methods that remote work requires.')}</p>
        </div>
        <Link
          to="/careerlearning"
          className="haigoo-home__section-link"
        >
          {text('浏览职业成长内容', 'Explore career learning')}<ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="haigoo-career__grid">
        {loading ? Array.from({ length: 4 }, (_, index) => (
          <div key={`career-guide-skeleton-${index}`} className="haigoo-career__skeleton" aria-hidden="true">
            <div className="aspect-video animate-pulse bg-slate-100" />
            <div className="space-y-3 px-5 py-4"><div className="h-5 animate-pulse bg-slate-100" /><div className="h-5 w-2/3 animate-pulse bg-slate-100" /><div className="h-4 w-1/2 animate-pulse bg-slate-100" /></div>
          </div>
        )) : videos.map((video) => {
          const videoHref = withReturnTo(video.href, '/')
          const metadata = [video.source, video.difficultyLevelLabel || video.category || video.industry, ...(video.tags || [])]
            .map((item) => String(item || '').trim())
            .filter((item, index, items) => item && items.indexOf(item) === index)
            .slice(0, 3)
          return (
          <article key={`${video.kind}-${video.id}`} className="haigoo-career__card group relative flex min-w-0 flex-col overflow-hidden text-left">
            <Link to={videoHref} target="_blank" rel="noreferrer" className="absolute inset-0 z-10" aria-label={text(`在新页面查看视频：${video.title}`, `Open video in a new page: ${video.title}`)} />
            <div className="haigoo-career__media relative aspect-video overflow-hidden bg-slate-100">
              {video.coverImageUrl ? <img src={video.coverImageUrl} alt="" width={640} height={360} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <span className="flex h-full items-center justify-center text-slate-300"><BookOpen className="h-9 w-9" /></span>}
              <span className="haigoo-career__media-label">{video.moduleLabel}</span>
              <span className="absolute right-3 top-3"><AccessPill accessTier={video.accessTier} unlocked={membershipCapabilities.canAccessCorporateEnglishVideos} isEnglish={isEnglish} /></span>
              {video.hasVideoNotes && video.noteHref ? (
                <button
                  type="button"
                  onClick={() => setNotesVideo({ videoId: video.id, title: video.title })}
                  className="haigoo-career__notes-link"
                  aria-label={text(`查看${video.title}的视频笔记`, `View notes for ${video.title}`)}
                >
                  <BookOpen className="h-3.5 w-3.5" />{text('视频笔记', 'Video notes')}
                </button>
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 transition group-hover:bg-slate-950/10"><span className="flex h-10 w-10 items-center justify-center border border-white/60 bg-white/92 text-[#466f9d] opacity-0 transition group-hover:opacity-100"><Play className="h-4 w-4 fill-current" /></span></span>
            </div>
            <div className="haigoo-career__content flex min-h-[168px] flex-1 flex-col px-5 pb-5 pt-4">
              {metadata.length ? (
                <div className="mb-2 line-clamp-2 min-w-0 text-[11px] font-black leading-5 text-[#2f6ed8]" title={metadata.join(' · ')}>{metadata.join(' · ')}</div>
              ) : null}
              <h3 className="line-clamp-2 min-h-[48px] text-base font-black leading-6 text-slate-950 transition-colors group-hover:text-[#345d88]">{video.title}</h3>
              <div className="mt-auto flex items-center justify-between gap-3 pt-3 text-xs font-bold text-slate-500">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{formatPublishedDate(video.publishedAt, isEnglish) || text('近期更新', 'Recently updated')}</span>
                </span>
                <Link
                  to={videoHref}
                  target="_blank"
                  rel="noreferrer"
                  className="relative z-30 inline-flex shrink-0 items-center gap-1 text-[#466f9d] transition-opacity hover:text-[#345d88] hover:no-underline group-hover:opacity-0"
                  aria-label={text(`在新页面查看视频：${video.title}`, `Open video in a new page: ${video.title}`)}
                >
                  {text('查看', 'View')} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
            {video.description ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex h-[160px] translate-y-full flex-col border-t border-[#e4ebf2] bg-white px-4 py-3.5 opacity-0 shadow-[0_-14px_32px_-26px_rgba(15,23,42,0.28)] transition duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-black text-[#466f9d]"><BookOpen className="h-3.5 w-3.5" />{text('视频简介', 'About this video')}</div>
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
