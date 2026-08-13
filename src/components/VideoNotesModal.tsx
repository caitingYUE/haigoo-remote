import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, BookOpen, Loader2, Lock, Share2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useNotificationHelpers } from './NotificationSystem'
import { VideoNotesArticle } from './VideoNotesArticle'
import { corporateEnglishPublicService, type CorporateEnglishPublicModuleVideo } from '../services/corporate-english-public-service'
import { COMPLIANCE_FEATURES } from '../config/compliance'

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
    <div className="hg-video-notes-backdrop fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="video-notes-dialog-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="hg-video-notes-dialog flex h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden sm:h-[calc(100dvh-3rem)]">
        <header className="hg-video-notes-header flex shrink-0 items-start gap-4 px-5 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0 flex-1">
            <div className="hg-video-notes-meta flex items-center gap-2 text-xs font-black"><BookOpen className="h-4 w-4" />视频笔记{notesCharacterCount ? <span>{notesCharacterCount.toLocaleString('zh-CN')} 字</span> : null}</div>
            <h2 id="video-notes-dialog-title" className="mt-1.5 line-clamp-2 text-xl font-black leading-tight text-slate-950 sm:text-2xl">{video.title}</h2>
          </div>
          <div className="hg-video-notes-toolbar flex shrink-0 gap-2">
            <button type="button" onClick={copyShareLink} aria-label="复制视频笔记分享链接" title="复制分享链接"><Share2 className="h-4 w-4" /></button>
            <button type="button" onClick={onClose} aria-label="关闭视频笔记"><X className="h-5 w-5" /></button>
          </div>
        </header>
        <div className="hg-video-notes-body min-h-0 flex-1 overflow-y-auto px-5 pb-12 pt-6 sm:px-10 sm:pb-16">
          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div>
          ) : loadError ? (
            <div className="hg-video-notes-state flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
              <h3 className="text-xl font-black text-slate-950">视频笔记加载失败</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{loadError}</p>
              <button type="button" className="hg-video-notes-primary mt-5 inline-flex h-10 items-center px-5 text-sm font-black" onClick={() => window.location.reload()}>重新加载</button>
            </div>
          ) : detail?.isLocked ? (
            <div className="hg-career-notes-lock flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
              <Lock className="h-8 w-8" />
              <h3 className="mt-4 text-xl font-black text-slate-950">{detail.loginRequired ? '登录后查看视频笔记' : '当前内容暂未开放'}</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">{detail.loginRequired ? '登录后即可继续查看该视频笔记。' : '你仍可浏览当前已开放的职业成长内容。'}</p>
              {detail.loginRequired || COMPLIANCE_FEATURES.membershipPromotionBanners ? <Link
                to={detail.loginRequired ? `/login?redirect=${encodeURIComponent(notePath)}` : '/profile?tab=membership#club-service-plans'}
                onClick={onClose}
                className="hg-video-notes-primary mt-5 inline-flex h-10 items-center gap-2 px-5 text-sm font-black hover:text-white hover:no-underline"
              >
                {detail.loginRequired ? '前往登录' : '查看 Private 内容'}
                <ArrowRight className="h-4 w-4" />
              </Link> : null}
            </div>
          ) : (
            <VideoNotesArticle notes={detail?.videoNotes || []} />
          )}
        </div>
        <footer className="hg-video-notes-footer flex shrink-0 justify-end px-5 py-4 sm:px-7">
          <Link to={notePath} className="hg-video-notes-primary inline-flex h-10 items-center px-5 text-sm font-black hover:text-white hover:no-underline">进入笔记主页</Link>
        </footer>
      </div>
    </div>,
    document.body
  )
}
