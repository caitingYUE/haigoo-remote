import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Loader2, Lock, Play, Share2 } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { VideoNotesArticle } from '../components/VideoNotesArticle'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { corporateEnglishPublicService, type CorporateEnglishPublicModuleVideo } from '../services/corporate-english-public-service'
import { useReturnNavigation, withReturnTo } from '../hooks/useReturnNavigation'
import { COMPLIANCE_FEATURES } from '../config/compliance'

function formatDateLabel(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function CorporateEnglishVideoNotesPage() {
  const { id = '' } = useParams<{ id: string }>()
  const location = useLocation()
  const handleBack = useReturnNavigation('/careerlearning')
  const { showError, showSuccess } = useNotificationHelpers()
  const [video, setVideo] = useState<CorporateEnglishPublicModuleVideo | null>(null)
  const [noteVideos, setNoteVideos] = useState<CorporateEnglishPublicModuleVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    corporateEnglishPublicService.getModuleVideo(id)
      .then((data) => {
        if (!cancelled) setVideo(data.video)
      })
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : '请稍后重试'
          setLoadError(message)
          showError('视频笔记加载失败', message)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, showError])

  useEffect(() => {
    let cancelled = false
    corporateEnglishPublicService.listModuleVideos({ module: 'remote_preparation', limit: 96 })
      .then((data) => {
        if (!cancelled) setNoteVideos(data.videos.filter((item) => item.hasVideoNotes))
      })
      .catch(() => {
        if (!cancelled) setNoteVideos([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!video?.noteTitle) return
    const previousTitle = document.title
    document.title = `${video.noteTitle} - 视频笔记 | Haigoo Remote`
    return () => {
      document.title = previousTitle
    }
  }, [video?.noteTitle])

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showSuccess('笔记链接已复制')
    } catch {
      showError('复制失败', '请从浏览器地址栏复制当前链接。')
    }
  }

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#466f9d]" /></div>
  }

  if (!video || !video.hasVideoNotes) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <BookOpen className="h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-3xl font-black text-slate-950">{loadError ? '视频笔记加载失败' : '视频笔记不存在'}</h1>
        {loadError ? <p className="mt-3 text-sm leading-6 text-slate-600">{loadError}</p> : null}
        {loadError ? <button type="button" onClick={() => window.location.reload()} className="mt-6 inline-flex h-10 items-center rounded-full bg-[#466f9d] px-5 text-sm font-black text-white">重新加载</button> : null}
        <button type="button" onClick={handleBack} className="mt-6 inline-flex items-center gap-2 font-black text-[#466f9d]"><ArrowLeft className="h-4 w-4" />返回</button>
      </div>
    )
  }

  const currentPath = `${location.pathname}${location.search}`
  const videoPath = withReturnTo(`/careerlearning/watch/module/${encodeURIComponent(video.videoId)}`, currentPath)
  return (
    <div className="hg-career-notes-page min-h-screen px-4 pb-20 pt-24 sm:px-8 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden lg:pb-6">
      <div className="mx-auto grid max-w-[1480px] gap-8 lg:h-full lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:min-h-0 lg:overflow-hidden">
          <div className="hg-career-notes-index p-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-[#e7eef6] pb-3 text-sm font-black text-slate-950"><BookOpen className="h-4 w-4 text-[#466f9d]" />全部视频笔记</div>
            {noteVideos.length ? (
              <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0">
                {noteVideos.map((item) => {
                  const active = item.videoId === video.videoId
                  return (
                    <Link
                      key={item.videoId}
                      to={`/careerlearning/notes/${encodeURIComponent(item.videoId)}`}
                      className={`hg-career-notes-index-link w-[240px] shrink-0 border px-3 py-3 text-sm leading-5 transition hover:no-underline lg:w-full ${active ? 'is-active' : ''}`}
                    >
                      <span className="line-clamp-2 font-black">{item.noteTitle || item.title}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-400">{item.difficultyLevelLabel || '远程准备'}</span>
                    </Link>
                  )
                })}
              </nav>
            ) : <p className="py-8 text-center text-sm font-semibold text-slate-400">暂无其他视频笔记</p>}
          </div>
        </aside>

        <article className="hg-career-notes-document min-w-0 max-w-5xl lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pb-20 lg:pr-3">
        <header className="border-b border-[#dbe8f4] pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button type="button" onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-[#466f9d]"><ArrowLeft className="h-4 w-4" />返回</button>
            <div className="flex flex-wrap items-center gap-2">
              <a href={videoPath} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#466f9d] px-4 text-sm font-black text-white shadow-sm hover:bg-[#345d88] hover:text-white hover:no-underline"><Play className="h-4 w-4 fill-current" />查看完整视频<ArrowRight className="h-4 w-4" /></a>
              <button type="button" onClick={copyShareLink} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dbe8f4] bg-white px-4 text-sm font-black text-slate-700 transition hover:border-[#466f9d] hover:text-[#466f9d]"><Share2 className="h-4 w-4" />分享笔记</button>
            </div>
          </div>
          <div className="mt-10 flex items-center gap-2 text-sm font-black tracking-[0.08em] text-[#466f9d]"><BookOpen className="h-4 w-4" />{video.noteCategory || '远程准备'} · 视频笔记</div>
          <h1 className="mt-4 text-4xl font-black leading-tight text-slate-950 md:text-5xl">{video.noteTitle || video.title}</h1>
          {video.noteOriginalTitle && video.noteOriginalTitle !== video.noteTitle ? <p className="mt-3 text-lg font-semibold text-slate-500">{video.noteOriginalTitle}</p> : null}
          {video.noteSummary ? <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{video.noteSummary}</p> : null}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-slate-500">
            <span>{video.difficultyLevelLabel || '远程准备'}</span>
            {formatDateLabel(video.notePublishedAt) ? <span>{formatDateLabel(video.notePublishedAt)}</span> : null}
            {video.noteAuthor ? <span>{video.noteAuthor}</span> : null}
            {video.noteSourceUrl ? <a href={video.noteSourceUrl} target="_blank" rel="noreferrer" className="text-[#466f9d]">来源：{video.noteSourceName || '原内容'}</a> : video.noteSourceName ? <span>来源：{video.noteSourceName}</span> : null}
          </div>
        </header>

        {video.coverImageUrl ? <img src={video.coverImageUrl} alt="" className="mt-8 aspect-video w-full max-w-5xl rounded-xl object-cover" /> : null}

        <section className="py-10">
          {video.noteIsLocked ? (
            <div className="hg-career-notes-lock flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eff5fb] text-[#466f9d]"><Lock className="h-7 w-7" /></span>
              <h2 className="mt-5 text-2xl font-black text-slate-950">{video.loginRequired ? '登录后查看视频笔记' : '会员可阅读完整笔记'}</h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-slate-600">{video.loginRequired ? '登录后即可继续查看该视频笔记。' : '开通会员后可阅读正文，视频播放权限仍独立计算。'}</p>
              {video.loginRequired || COMPLIANCE_FEATURES.membershipPromotionBanners ? <Link
                to={video.loginRequired ? `/login?redirect=${encodeURIComponent(currentPath)}` : '/profile?tab=membership#club-service-plans'}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#466f9d] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#345d88] hover:text-white hover:no-underline"
              >
                {video.loginRequired ? '前往登录' : '查看 Private 内容'}
                <ArrowRight className="h-4 w-4" />
              </Link> : null}
            </div>
          ) : video.hasVideoNotes ? (
            <VideoNotesArticle notes={video.videoNotes || []} />
          ) : (
            <VideoNotesArticle notes={[]} />
          )}
        </section>
        </article>
      </div>
    </div>
  )
}
