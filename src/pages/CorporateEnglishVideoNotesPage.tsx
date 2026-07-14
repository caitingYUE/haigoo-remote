import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Briefcase, Loader2, Lock, Play, Share2 } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { VideoNotesArticle } from '../components/VideoNotesArticle'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { corporateEnglishPublicService, type CorporateEnglishPublicModuleVideo } from '../services/corporate-english-public-service'
import { useReturnNavigation, withReturnTo } from '../hooks/useReturnNavigation'

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
    if (!video?.title) return
    const previousTitle = document.title
    document.title = `${video.title} - 视频笔记 | Haigoo Remote`
    return () => {
      document.title = previousTitle
    }
  }, [video?.title])

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showSuccess('笔记链接已复制')
    } catch {
      showError('复制失败', '请从浏览器地址栏复制当前链接。')
    }
  }

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#6251f5]" /></div>
  }

  if (!video) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-6 text-center">
        <BookOpen className="h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-3xl font-black text-slate-950">{loadError ? '视频笔记加载失败' : '视频笔记不存在'}</h1>
        {loadError ? <p className="mt-3 text-sm leading-6 text-slate-600">{loadError}</p> : null}
        {loadError ? <button type="button" onClick={() => window.location.reload()} className="mt-6 inline-flex h-10 items-center rounded-full bg-[#6251f5] px-5 text-sm font-black text-white">重新加载</button> : null}
        <button type="button" onClick={handleBack} className="mt-6 inline-flex items-center gap-2 font-black text-[#6251f5]"><ArrowLeft className="h-4 w-4" />返回</button>
      </div>
    )
  }

  const currentPath = `${location.pathname}${location.search}`
  const videoPath = withReturnTo(`/careerlearning/watch/module/${encodeURIComponent(video.videoId)}`, currentPath)
  return (
    <main className="min-h-screen bg-[#fbfaf6] px-4 pb-20 pt-24 sm:px-8 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden lg:pb-6">
      <div className="mx-auto grid max-w-[1480px] gap-8 lg:h-full lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:min-h-0 lg:overflow-hidden">
          <div className="rounded-[20px] border border-[#dbe8f4] bg-white p-4 shadow-[0_10px_28px_rgba(70,93,125,0.06)] lg:flex lg:h-full lg:min-h-0 lg:flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-[#e7eef6] pb-3 text-sm font-black text-slate-950"><BookOpen className="h-4 w-4 text-[#6251f5]" />全部视频笔记</div>
            {noteVideos.length ? (
              <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0">
                {noteVideos.map((item) => {
                  const active = item.videoId === video.videoId
                  return (
                    <Link
                      key={item.videoId}
                      to={`/careerlearning/notes/${encodeURIComponent(item.videoId)}`}
                      className={`w-[240px] shrink-0 rounded-xl border px-3 py-3 text-sm leading-5 transition hover:no-underline lg:w-full ${active ? 'border-[#cfc5ff] bg-[#f5f2ff] text-[#5142df]' : 'border-transparent text-slate-700 hover:border-[#dbe8f4] hover:bg-slate-50'}`}
                    >
                      <span className="line-clamp-2 font-black">{item.title}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-400">{item.difficultyLevelLabel || '远程准备'}</span>
                    </Link>
                  )
                })}
              </nav>
            ) : <p className="py-8 text-center text-sm font-semibold text-slate-400">暂无其他视频笔记</p>}
          </div>
        </aside>

        <article className="min-w-0 max-w-5xl lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pb-20 lg:pr-3">
        <header className="border-b border-[#dbe8f4] pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button type="button" onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-[#6251f5]"><ArrowLeft className="h-4 w-4" />返回</button>
            <div className="flex flex-wrap items-center gap-2">
              <a href="/jobs" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dbe8f4] bg-white px-4 text-sm font-black text-slate-700 hover:border-[#6251f5] hover:text-[#6251f5] hover:no-underline"><Briefcase className="h-4 w-4" />找远程工作</a>
              <a href={videoPath} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#6251f5] px-4 text-sm font-black text-white shadow-sm hover:bg-[#5142df] hover:text-white hover:no-underline"><Play className="h-4 w-4 fill-current" />查看完整视频<ArrowRight className="h-4 w-4" /></a>
              <button type="button" onClick={copyShareLink} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#dbe8f4] bg-white px-4 text-sm font-black text-slate-700 transition hover:border-[#6251f5] hover:text-[#6251f5]"><Share2 className="h-4 w-4" />分享笔记</button>
            </div>
          </div>
          <div className="mt-10 flex items-center gap-2 text-sm font-black tracking-[0.08em] text-[#6251f5]"><BookOpen className="h-4 w-4" />远程准备 · 视频笔记</div>
          <h1 className="mt-4 text-4xl font-black leading-tight text-slate-950 md:text-5xl">{video.title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-slate-500">
            <span>{video.difficultyLevelLabel || '远程准备'}</span>
            {formatDateLabel(video.publishedAt) ? <span>{formatDateLabel(video.publishedAt)}</span> : null}
            {video.videoSource ? <span>视频来自 {video.videoSource}</span> : null}
          </div>
        </header>

        <section className="py-10">
          {video.isLocked ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-[#e2dcff] bg-white px-6 text-center shadow-[0_12px_32px_rgba(70,93,125,0.06)]">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f3f0ff] text-[#6251f5]"><Lock className="h-7 w-7" /></span>
              <h2 className="mt-5 text-2xl font-black text-slate-950">{video.loginRequired ? '登录后查看视频笔记' : '开通 Club 查看完整笔记'}</h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-slate-600">{video.lockReason?.replace('升级后可播放', '升级后可查看') || '视频笔记与完整视频使用相同的访问权限。'}</p>
            </div>
          ) : video.hasVideoNotes ? (
            <VideoNotesArticle notes={video.videoNotes || []} />
          ) : (
            <VideoNotesArticle notes={[]} />
          )}
        </section>
        </article>
      </div>
    </main>
  )
}
