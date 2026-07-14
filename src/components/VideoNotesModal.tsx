import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, BookOpen, Loader2, Lock, Share2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotificationHelpers } from './NotificationSystem'
import { VideoNotesArticle } from './VideoNotesArticle'
import { corporateEnglishPublicService, type CorporateEnglishPublicModuleVideo } from '../services/corporate-english-public-service'

export interface VideoNotesModalVideo {
  videoId: string
  title: string
}

export function VideoNotesModal({ video, onClose }: { video: VideoNotesModalVideo; onClose: () => void }) {
  const { showError, showSuccess } = useNotificationHelpers()
  const [detail, setDetail] = useState<CorporateEnglishPublicModuleVideo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const notePath = `/careerlearning/notes/${encodeURIComponent(video.videoId)}`
  const notesCharacterCount = useMemo(() => (detail?.videoNotes || []).reduce((sum, block) => sum + (block.text?.length || 0) + (block.items || []).reduce((itemSum, item) => itemSum + item.length, 0), 0), [detail?.videoNotes])

  useEffect(() => {
    let cancelled = false
    setDetail(null)
    setLoading(true)
    setLoadError('')
    corporateEnglishPublicService.getModuleVideo(video.videoId)
      .then((data) => {
        if (!cancelled) setDetail(data.video)
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
  }, [showError, video.videoId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${notePath}`)
      showSuccess('笔记链接已复制', '获得链接的人将直接进入视频笔记页面。')
    } catch {
      showError('复制失败', '请进入笔记主页后从浏览器地址栏复制链接。')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`${video.title}视频笔记`} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.32)] sm:h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-start gap-4 border-b border-[#dbe8f4] px-5 py-4 sm:px-7">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-black tracking-[0.08em] text-[#6251f5]"><BookOpen className="h-4 w-4" />视频笔记{notesCharacterCount ? <span className="font-semibold tracking-normal text-slate-400">· {notesCharacterCount.toLocaleString('zh-CN')} 字</span> : null}</div>
            <h2 className="mt-1 line-clamp-2 text-xl font-black leading-tight text-slate-950 sm:text-2xl">{video.title}</h2>
          </div>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dbe8f4] text-slate-600 transition hover:border-[#6251f5] hover:text-[#6251f5]" onClick={copyShareLink} aria-label="复制视频笔记分享链接" title="复制分享链接"><Share2 className="h-4 w-4" /></button>
          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dbe8f4] text-slate-600 transition hover:border-slate-400 hover:text-slate-950" onClick={onClose} aria-label="关闭视频笔记"><X className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-12 pt-6 sm:px-10 sm:pb-16">
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#6251f5]" /></div>
          ) : loadError ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-rose-100 bg-rose-50/50 px-6 text-center">
              <h3 className="text-xl font-black text-slate-950">视频笔记加载失败</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{loadError}</p>
              <button type="button" className="mt-5 inline-flex h-10 items-center rounded-full bg-[#6251f5] px-5 text-sm font-black text-white transition hover:bg-[#5142df]" onClick={() => window.location.reload()}>重新加载</button>
            </div>
          ) : detail?.isLocked ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-[#e2dcff] bg-[#faf9ff] px-6 text-center">
              <Lock className="h-8 w-8 text-[#6251f5]" />
              <h3 className="mt-4 text-xl font-black text-slate-950">{detail.loginRequired ? '登录后查看视频笔记' : '开通 Club 查看完整笔记'}</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{detail.loginRequired ? '登录后即可继续查看该视频笔记。' : '该视频笔记为 Club 权益内容，升级后可查看。'}</p>
              <Link
                to={detail.loginRequired ? `/login?redirect=${encodeURIComponent(notePath)}` : '/profile?tab=membership#club-service-plans'}
                onClick={onClose}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#6251f5] px-5 text-sm font-black text-white shadow-sm hover:bg-[#5142df] hover:text-white hover:no-underline"
              >
                {detail.loginRequired ? '前往登录' : '前往开通 Club'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <VideoNotesArticle notes={detail?.videoNotes || []} />
          )}
        </div>
        <footer className="flex shrink-0 justify-end border-t border-[#dbe8f4] bg-[#fbfcfe] px-5 py-4 sm:px-7">
          <Link to={notePath} className="inline-flex h-10 items-center rounded-full bg-[#6251f5] px-5 text-sm font-black text-white shadow-sm hover:bg-[#5142df] hover:text-white hover:no-underline">进入笔记主页</Link>
        </footer>
      </div>
    </div>,
    document.body
  )
}
