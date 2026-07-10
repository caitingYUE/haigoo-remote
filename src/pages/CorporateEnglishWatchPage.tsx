import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Bookmark, BookmarkCheck, Briefcase, Building2, ExternalLink, Eye, EyeOff, FolderOpen, Headphones, Linkedin, Loader2, Lock, Mail, Play, Sparkles, Volume2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'
import {
  CorporateEnglishCompanyDetail,
  CorporateEnglishPublicClip,
  CorporateEnglishPublicModuleVideo,
  CorporateEnglishPublicVideo,
  corporateEnglishPublicService
} from '../services/corporate-english-public-service'
import type { CorporateEnglishPronunciationMark, CorporateEnglishPronunciationMarkType } from '../services/corporate-english-service'
import { trackingService } from '../services/tracking-service'
import { getCompanyDetailPath } from '../utils/share-link-helper'

function normalizeExternalUrl(url?: string) {
  const value = String(url || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

function formatDateLabel(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const SECTION_LABEL: Record<string, string> = {
  ceo: 'CEO 访谈',
  english_interview: '英语面试',
  remote_preparation: '远程准备',
  foreign_meeting: '远程会议'
}

function getModuleVideoMetaLabel(video: CorporateEnglishPublicModuleVideo) {
  if (video.moduleKey === 'remote_preparation') return video.difficultyLevelLabel || SECTION_LABEL[video.moduleKey] || '远程准备'
  return video.category || SECTION_LABEL[video.moduleKey] || '外企英语'
}

const SOFT_PANEL_CLASS = 'rounded-[24px] border border-[#dbe8f4] bg-white shadow-[0_10px_28px_rgba(70,93,125,0.06)]'

const pronunciationTypeMeta: Record<CorporateEnglishPronunciationMarkType, { label: string; className: string; hint: string }> = {
  stress: { label: '重读', className: 'rounded-md bg-[#eeeaff] px-1 font-black text-[#4f46e5] shadow-[inset_0_-2px_0_rgba(79,70,229,0.20)]', hint: '语义重心，读清楚' },
  weak: { label: '弱读', className: 'rounded-md bg-slate-100 px-1 text-slate-500', hint: '快速带过，不要重读' },
  linking: { label: '连读', className: 'text-emerald-700', hint: '两个词要连在一起读' },
  keyword: { label: '关键词', className: 'rounded-md bg-amber-100 px-1 font-bold text-amber-700', hint: '表达重点词' },
  pause: { label: '停顿', className: 'border-b-2 border-dashed border-[#6d5dfc]', hint: '这里可以短暂停顿' }
}

const pronunciationTypeOrder: CorporateEnglishPronunciationMarkType[] = ['stress', 'weak', 'linking', 'keyword', 'pause']

function formatClipTime(ms?: number) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getDetailTitleClass(title: string) {
  const length = String(title || '').length
  if (length > 90) return 'text-2xl leading-tight'
  if (length > 58) return 'text-3xl leading-tight'
  return 'text-3xl leading-tight md:text-4xl'
}

function markContainsToken(mark: CorporateEnglishPronunciationMark, token: string) {
  const markText = String(mark.text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const tokenText = String(token || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return Boolean(markText && tokenText && (markText === tokenText || markText.includes(tokenText) || tokenText.includes(markText)))
}

function renderMarkedLine(line: string, marks: CorporateEnglishPronunciationMark[], activeTypes: CorporateEnglishPronunciationMarkType[]) {
  if (!line) return null
  const visibleMarks = marks.filter((mark) => activeTypes.includes(mark.type))
  if (!visibleMarks.length) return line
  return line.split(/(\s+|[,.!?;:()[\]"'“”‘’]+)/).map((part, index) => {
    const mark = visibleMarks.find((item) => markContainsToken(item, part))
    if (!mark) return <span key={`${part}-${index}`}>{part}</span>
    const meta = pronunciationTypeMeta[mark.type]
    return (
      <span key={`${part}-${index}`} className={meta.className} title={mark.note || meta.hint}>
        {part}
      </span>
    )
  })
}

function PosterFrame({
  src,
  title,
  eyebrow,
  loading = 'lazy'
}: {
  src?: string
  title: string
  eyebrow?: string
  loading?: 'eager' | 'lazy'
}) {
  if (src) {
    return <img src={src} alt={title} className="h-full w-full object-cover" loading={loading} />
  }
  return (
    <div
      className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[linear-gradient(135deg,#f8fbff_0%,#f2f7ff_56%,#ffffff_100%)] p-5 text-slate-950"
    >
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#7c6dff]/10" />
      <div className="absolute bottom-0 left-0 h-1.5 w-24 bg-[#6251f5]" />
      <div className="relative text-xs font-black tracking-[0.08em] text-[#6251f5]">{eyebrow || 'Video'}</div>
      <div className="relative max-w-[88%] text-2xl font-black leading-tight tracking-tight md:text-3xl">{title}</div>
    </div>
  )
}

function LockedPanel({ message, onAction }: { message: string; onAction: () => void }) {
  return (
    <button
      type="button"
      onClick={onAction}
      className="flex aspect-video w-full flex-col items-center justify-center gap-4 bg-[#f7f6ff] text-center text-slate-950"
    >
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#6251f5] shadow-sm">
        <Lock className="h-7 w-7" />
      </span>
      <span className="max-w-md px-6 text-lg font-black">{message}</span>
    </button>
  )
}

function VideoFrame({
  title,
  src,
  poster,
  locked,
  lockReason,
  onLockedAction,
  overlay,
  className = ''
}: {
  title: string
  src?: string
  poster?: string
  locked?: boolean
  lockReason?: string
  onLockedAction: () => void
  overlay?: ReactNode
  className?: string
}) {
  if (locked) {
    return <LockedPanel message={lockReason || '该视频为会员内容'} onAction={onLockedAction} />
  }
  if (src) {
    return (
      <div className={`relative aspect-video w-full overflow-hidden rounded-[24px] bg-slate-950 shadow-[0_14px_36px_rgba(15,23,42,0.12)] ${className}`}>
        <iframe src={src} title={title} className="h-full w-full" frameBorder="0" allowFullScreen />
        {overlay}
      </div>
    )
  }
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-[24px] bg-[#f8fbff] shadow-[0_14px_36px_rgba(15,23,42,0.08)] ${className}`}>
      {overlay}
      <PosterFrame src={poster} title={title} loading="eager" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/28 text-white">
        <Play className="h-10 w-10 fill-current" />
        <span className="text-base font-black">该内容暂未配置视频</span>
      </div>
    </div>
  )
}

function VideoBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-4 top-4 z-20 inline-flex h-10 items-center gap-2 rounded-full border border-white/80 bg-white/95 px-4 text-sm font-black text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition hover:border-[#6251f5] hover:text-[#6251f5]"
    >
      <ArrowLeft className="h-4 w-4" />
      返回
    </button>
  )
}

function InlineBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#dbe8f4] bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-[#6251f5] hover:text-[#6251f5]"
    >
      <ArrowLeft className="h-4 w-4" />
      返回
    </button>
  )
}

function TrackVideoView({ section, entityId, category = '' }: { section: string; entityId: string; category?: string }) {
  useEffect(() => {
    if (!entityId) return
    trackingService.track('corporate_english_video_play', {
      page_key: 'corporate_english',
      module: 'corporate_english_video',
      feature_key: 'corporate_english_video_play',
      entity_type: section === 'ceo' ? 'corporate_english_material' : 'corporate_english_module_video',
      entity_id: entityId,
      corporate_english_section: section,
      module_key: section,
      category
    })
  }, [category, entityId, section])
  return null
}

function TrackDetailView({
  section,
  entityId,
  category = '',
  accessTier = '',
  locked = false,
  companyId = '',
  companyName = ''
}: {
  section: string
  entityId: string
  category?: string
  accessTier?: string
  locked?: boolean
  companyId?: string
  companyName?: string
}) {
  useEffect(() => {
    if (!entityId) return
    trackingService.track('corporate_english_detail_view', {
      page_key: 'corporate_english',
      module: 'corporate_english_detail',
      feature_key: 'corporate_english_detail_view',
      entity_type: section === 'ceo' ? 'corporate_english_material' : 'corporate_english_module_video',
      entity_id: entityId,
      corporate_english_section: section,
      module_key: section,
      category,
      access_tier: accessTier,
      is_locked: locked,
      company_id: companyId,
      company_name: companyName
    })
  }, [accessTier, category, companyId, companyName, entityId, locked, section])
  return null
}

function AuthenticatedClipAudio({ clip, onPlay }: { clip: CorporateEnglishPublicClip; onPlay: (clip: CorporateEnglishPublicClip) => void }) {
  const [objectUrl, setObjectUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let createdUrl = ''
    setObjectUrl('')
    setError('')
    if (!clip.audioUrl || clip.isLocked) return undefined
    setLoading(true)

    corporateEnglishPublicService.downloadClipAudio(clip.clipId)
      .then((blob) => {
        if (cancelled) return
        createdUrl = URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '音频加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [clip.audioUrl, clip.clipId, clip.isLocked])

  if (loading) {
    return (
      <div className="flex h-12 items-center gap-3 rounded-full bg-slate-100 px-4 text-sm font-bold text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        音频加载中...
      </div>
    )
  }

  if (error || !objectUrl) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
        {error || clip.audioUnavailableReason || '该片段音频暂不可用，请稍后重试。'}
      </div>
    )
  }

  return (
    <audio controls src={objectUrl} className="w-full" onPlay={() => onPlay(clip)}>
      <track kind="captions" />
    </audio>
  )
}

function ClipPracticeSection({
  clips,
  onPlay,
  onLocked,
  onToggleFavorite
}: {
  clips: CorporateEnglishPublicClip[]
  onPlay: (clip: CorporateEnglishPublicClip) => void
  onLocked: () => void
  onToggleFavorite: (clip: CorporateEnglishPublicClip) => void
}) {
  const [activeClipId, setActiveClipId] = useState('')
  const [showScript, setShowScript] = useState(true)
  const [activePronunciationTypes, setActivePronunciationTypes] = useState<CorporateEnglishPronunciationMarkType[]>([])
  const activeClip = useMemo(() => (
    clips.find((clip) => clip.clipId === activeClipId) || clips[0] || null
  ), [activeClipId, clips])

  useEffect(() => {
    if (!clips.length) {
      setActiveClipId('')
      return
    }
    if (!clips.some((clip) => clip.clipId === activeClipId)) {
      setActiveClipId(clips[0].clipId)
    }
  }, [activeClipId, clips])

  useEffect(() => {
    setActivePronunciationTypes([])
    setShowScript(true)
  }, [activeClip?.clipId])

  if (!clips.length || !activeClip) {
    return (
      <section className={`${SOFT_PANEL_CLASS} mt-6 p-6 md:p-8`}>
        <div className="flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-[#6251f5]" />
          <h2 className="text-2xl font-black text-slate-950">跟读素材</h2>
        </div>
        <p className="mt-4 text-sm text-slate-500">这个视频还没有已发布跟读片段。</p>
      </section>
    )
  }

  const pronunciationTypes = pronunciationTypeOrder.filter((type) =>
    activeClip.pronunciationMarks?.some((mark) => mark.type === type)
  )
  const visibleTypes = activePronunciationTypes.filter((type) => pronunciationTypes.includes(type))
  const scriptLines = String(activeClip.subtitleText || '').split('\n').map((line) => line.trim()).filter(Boolean)
  const translationLines = String(activeClip.translationText || '').split('\n').map((line) => line.trim()).filter(Boolean)
  const tagGroups = Array.isArray(activeClip.clipTags) ? activeClip.clipTags : []

  const togglePronunciationType = (type: CorporateEnglishPronunciationMarkType) => {
    setActivePronunciationTypes((current) => (
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    ))
  }

  return (
    <section className={`${SOFT_PANEL_CLASS} mt-5 overflow-hidden p-5 md:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-[#6251f5]" />
            <h2 className="text-2xl font-black text-slate-950">跟读素材</h2>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-slate-500">影子跟读是练习口语最高效的方法，以下素材均由人工精选剪辑</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#ded6ff] bg-white px-4 py-2 text-xs font-black text-[#6251f5]">{clips.length} 个片段</span>
        </div>
      </div>

      <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
        {clips.map((clip, index) => {
          const active = clip.clipId === activeClip.clipId
          return (
            <button
              key={clip.clipId}
              type="button"
              onClick={() => setActiveClipId(clip.clipId)}
              className={`flex h-12 min-w-[220px] items-center gap-3 rounded-full border px-4 text-left transition ${
                active
                  ? 'border-[#6251f5] bg-[#6251f5] text-white shadow-[0_18px_28px_rgba(98,81,245,0.18)]'
                  : 'border-[#eadff8] bg-white text-slate-600 hover:border-[#cfc5ff] hover:text-[#6251f5]'
              }`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${active ? 'bg-white/18 text-white' : 'bg-[#f5f2ff] text-[#6251f5]'}`}>{index + 1}</span>
              <span className="min-w-0 truncate text-sm font-semibold">{clip.clipTitle || clip.subtitleText || '跟读片段'}</span>
            </button>
          )
        })}
      </div>

      <article className="relative mt-4 rounded-[24px] border border-[#ded6ff] bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#6251f5]">
              <Headphones className="h-4 w-4" />
              <span className="text-xs font-black">{formatClipTime(activeClip.startMs)} - {formatClipTime(activeClip.endMs)}</span>
            </div>
            <h3 className="mt-2 text-xl font-black text-slate-950">{activeClip.clipTitle || '跟读片段'}</h3>
          </div>
          {activeClip.isLocked ? (
            <button type="button" onClick={onLocked} className="inline-flex h-11 items-center rounded-full bg-[#6251f5] px-5 text-sm font-black text-white shadow-sm">
              解锁跟读
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggleFavorite(activeClip)}
              className={`inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-black transition ${
                activeClip.isFavorited
                  ? 'border-[#ded6ff] bg-[#f5f2ff] text-[#6251f5] hover:bg-white'
                  : 'border-[#ded6ff] bg-white text-slate-700 hover:border-[#6251f5] hover:text-[#6251f5]'
              }`}
            >
              {activeClip.isFavorited ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {activeClip.isFavorited ? '已收藏' : '收藏'}
            </button>
          )}
        </div>

        <div className="mt-4">
          {activeClip.isLocked ? (
            <div className="flex h-12 items-center gap-3 rounded-full bg-slate-100 px-4 text-sm font-bold text-slate-400">
              <Lock className="h-4 w-4" />
              跟读音频和字幕需解锁后使用
            </div>
          ) : activeClip.audioUrl ? (
            <AuthenticatedClipAudio clip={activeClip} onPlay={onPlay} />
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              {activeClip.audioUnavailableReason || '该片段音频暂不可用，请稍后重试。'}
            </div>
          )}
        </div>

        {tagGroups.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tagGroups.map((group) => (
              <span key={group.title} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#ded6ff] bg-[#f5f2ff] px-3 py-1.5 text-xs font-bold text-[#6251f5]">
                <span className="shrink-0 text-[#8a7bff]">{group.title}</span>
                <span className="min-w-0 truncate">{group.tags.map((tag) => `#${tag}`).join(' ')}</span>
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-[#eee7dd] bg-[#fffdf8] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-400">
              <BookOpen className="h-4 w-4 text-[#8a7bff]" />
              Script
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pronunciationTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => togglePronunciationType(type)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    activePronunciationTypes.includes(type)
                      ? 'border-[#cfc5ff] bg-[#6d5dfc] text-white'
                      : 'border-[#eadff8] bg-white text-slate-700 hover:border-[#cbbfff] hover:text-[#6251f5]'
                  }`}
                  title={`${pronunciationTypeMeta[type].label}：${pronunciationTypeMeta[type].hint}`}
                >
                  {pronunciationTypeMeta[type].label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowScript((value) => !value)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#ded6ff] bg-white text-[#6251f5] transition hover:bg-[#f5f2ff]"
                aria-label={showScript ? '隐藏原文' : '显示原文'}
              >
                {showScript ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {showScript ? (
            <div className={`space-y-2 text-base leading-8 text-slate-800 ${activeClip.isLocked ? 'pointer-events-none select-none blur-[3px]' : ''}`}>
              {scriptLines.length ? scriptLines.map((line, index) => (
                <p key={`${line}-${index}`} className="rounded-xl px-3 py-1.5">
                  {renderMarkedLine(line, activeClip.pronunciationMarks || [], visibleTypes)}
                </p>
              )) : <p className="text-sm text-slate-500">暂无英文字幕</p>}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[#eee7dd] bg-white/70 px-3 py-6 text-center text-sm text-slate-400">原文已隐藏</p>
          )}
        </div>

        {translationLines.length ? (
          <div className="mt-4 rounded-2xl border border-[#f3ddb6] bg-[#fffaf0] p-4">
            <div className="mb-3 text-xs font-black uppercase tracking-wide text-amber-500">中文翻译</div>
            <div className="space-y-2 text-sm leading-7 text-slate-700">
              {translationLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)}
            </div>
          </div>
        ) : null}
      </article>
    </section>
  )
}

function ModuleInfoPanel({ video }: { video: CorporateEnglishPublicModuleVideo }) {
  const section = video.moduleKey || 'english_interview'
  const sectionLabel = SECTION_LABEL[section] || '外企英语'
  const metaLabel = getModuleVideoMetaLabel(video)
  return (
    <aside className={`${SOFT_PANEL_CLASS} flex h-full min-h-0 flex-col overflow-hidden`}>
      <div className="border-b border-[#dbe8f4] px-6 py-5">
        <div className="text-sm font-black tracking-[0.08em] text-[#6251f5]">{metaLabel}</div>
        <h2 className="mt-2 text-3xl font-black leading-tight text-slate-950">{sectionLabel}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <h1 className="text-2xl font-black leading-tight tracking-tight text-slate-950">{video.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-slate-500">
          <span>{formatDateLabel(video.publishedAt) || '精选内容'}</span>
          {video.videoSource ? <span>视频来自 {video.videoSource}</span> : null}
        </div>
        {video.description ? (
          <p className="mt-5 whitespace-pre-line break-words text-base leading-8 text-slate-700">{video.description}</p>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-[#dbe8f4] p-5 text-sm font-semibold text-slate-500">暂无视频简介。</p>
        )}
        {video.tags.length ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {video.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[#f3f0ff] px-3 py-1.5 text-xs font-black text-[#6251f5]">{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  )
}

type DetailTabKey = 'culture' | 'thinking' | 'jobs' | 'resources' | 'favorites'

function LockedDetailGate({
  title,
  eyebrow,
  message,
  actionLabel,
  onAction,
  onBack
}: {
  title: string
  eyebrow: string
  message: string
  actionLabel: string
  onAction: () => void
  onBack: () => void
}) {
  return (
    <section className="grid h-full min-h-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className={`${SOFT_PANEL_CLASS} overflow-hidden`}>
        <div className="relative flex aspect-video flex-col items-center justify-center gap-4 bg-[#f5f2ff] text-center">
          <VideoBackButton onClick={onBack} />
          <Lock className="h-12 w-12 text-[#6251f5]" />
          <div>
            <div className="text-sm font-black text-[#6251f5]">{eyebrow}</div>
            <h1 className="mt-2 max-w-3xl px-8 text-3xl font-black leading-tight text-slate-950 md:text-5xl">{title}</h1>
          </div>
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-12 items-center rounded-full bg-[#6251f5] px-6 text-sm font-black text-white shadow-[0_14px_30px_rgba(98,81,245,0.22)] transition hover:bg-[#4f46e5]"
          >
            {actionLabel}
          </button>
        </div>
      </div>
      <aside className={`${SOFT_PANEL_CLASS} flex min-h-[320px] flex-col justify-center p-7`}>
        <div className="text-sm font-black tracking-[0.08em] text-[#6251f5]">访问权限</div>
        <h2 className="mt-3 text-2xl font-black text-slate-950">内容暂不可见</h2>
        <p className="mt-4 text-base leading-8 text-slate-600">{message}</p>
      </aside>
    </section>
  )
}

function CompanyInfoTabs({
  detail,
  companyPath,
  favoriteCount
}: {
  detail: CorporateEnglishCompanyDetail
  companyPath: string
  favoriteCount?: number
}) {
  const [activeTab, setActiveTab] = useState<DetailTabKey>('culture')
  const cultureSections = detail.profile.cultureSections || []
  const thinkingSections = detail.profile.ceoThinkingSections || []
  const resourceLinks = detail.profile.otherResources || []
  const jobs = detail.jobs || []
  const favorites = detail.favorites || []
  const favoritesCount = favoriteCount ?? favorites.length
  const tabs: Array<{ key: DetailTabKey; label: string; subtitle: string; count: number }> = [
    { key: 'culture', label: '企业文化', subtitle: '使命、价值观与工作方式', count: cultureSections.length },
    { key: 'thinking', label: '商业思维', subtitle: 'CEO 视角下的业务判断', count: thinkingSections.length },
    { key: 'jobs', label: '在招岗位', subtitle: '与公司页同步的在招岗位', count: jobs.length },
    { key: 'resources', label: '其他资料', subtitle: '延伸阅读与外部资料', count: resourceLinks.length },
    { key: 'favorites', label: '个人收藏', subtitle: '已收藏的跟读片段', count: favoritesCount }
  ]
  const activeTabMeta = tabs.find((tab) => tab.key === activeTab) || tabs[0]

  const renderTabIcon = (key: DetailTabKey, className = 'h-5 w-5') => {
    if (key === 'culture') return <Building2 className={className} />
    if (key === 'thinking') return <Sparkles className={className} />
    if (key === 'jobs') return <Briefcase className={className} />
    if (key === 'favorites') return <BookOpen className={className} />
    return <FolderOpen className={className} />
  }

  const renderSections = (sections: Array<{ title: string; body: string }>) => (
    sections.length ? (
      <div className="space-y-3">
        {sections.map((section, index) => (
          <article key={`${section.title}-${index}`} className="rounded-[20px] border border-[#eadff8] bg-[#fbf8ff] p-4 shadow-[0_10px_22px_rgba(98,81,245,0.035)]">
            <div className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6251f5] text-sm font-black text-white">{index + 1}</span>
              <div>
                <h3 className="text-base font-black text-slate-950">{section.title}</h3>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-600">{section.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    ) : <p className="rounded-2xl border border-dashed border-[#dbe8f4] p-6 text-sm font-semibold text-slate-500">暂无已发布内容。</p>
  )

  return (
    <aside className={`${SOFT_PANEL_CLASS} flex h-full min-h-0 overflow-hidden`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-[#dbe8f4] px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black leading-tight text-slate-950">{activeTabMeta.label}</h2>
              <p className="mt-1.5 text-sm font-semibold text-slate-500">{activeTabMeta.subtitle}</p>
            </div>
            <span className="rounded-full border border-[#eadff8] bg-[#f9f4ff] px-3 py-1.5 text-sm font-black text-[#6251f5]">
              {activeTabMeta.count} 条
            </span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {activeTab === 'culture' ? renderSections(cultureSections) : null}
        {activeTab === 'thinking' ? renderSections(thinkingSections) : null}
        {activeTab === 'jobs' ? (
          jobs.length ? (
            <div className="space-y-3">
              {companyPath ? (
                <Link to={companyPath} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-[#eadff8] bg-white px-4 py-3 text-base font-black text-[#6251f5] hover:border-[#6251f5] hover:no-underline">
                  进入企业页
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
              {jobs.map((job) => (
                <a
                  key={job.id}
                  href={`/j/${encodeURIComponent(job.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-[18px] border border-[#f1dfc2] bg-[#fffdf8] p-4 text-slate-950 transition hover:border-[#9ebff0] hover:no-underline hover:shadow-sm"
                >
                  <h3 className="line-clamp-2 text-base font-black text-slate-950">{job.title}</h3>
                  <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-500">{job.location || 'Remote'} · {job.category || job.jobType || 'Full-time'}</p>
                </a>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {companyPath ? (
                <Link to={companyPath} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-[#eadff8] bg-white px-4 py-3 text-base font-black text-[#6251f5] hover:border-[#6251f5] hover:no-underline">
                  进入企业页
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
              <p className="rounded-2xl border border-dashed border-[#dbe8f4] p-6 text-sm font-semibold text-slate-500">暂无在招岗位。</p>
            </div>
          )
        ) : null}
        {activeTab === 'resources' ? (
          resourceLinks.length ? (
            <div className="space-y-3">
              {resourceLinks.map((link) => (
                <a key={link.url} href={normalizeExternalUrl(link.url)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-[#dbe8f4] p-4 text-sm font-black text-slate-700 hover:border-[#6251f5] hover:text-[#6251f5] hover:no-underline">
                  {link.title}
                  <ExternalLink className="h-4 w-4" />
                </a>
              ))}
            </div>
          ) : <p className="rounded-2xl border border-dashed border-[#dbe8f4] p-6 text-sm font-semibold text-slate-500">暂无其他资料。</p>
        ) : null}
        {activeTab === 'favorites' ? (
          favorites.length ? (
            <div className="space-y-3">
              {favorites.map((clip) => (
                <article key={clip.clipId} className="rounded-[18px] border border-[#eadff8] bg-white p-4">
                  <div className="text-xs font-black text-[#6251f5]">{clip.companyName || detail.company.name}</div>
                  <h3 className="mt-2 line-clamp-2 text-base font-black text-slate-950">{clip.clipTitle || clip.materialTitle || '跟读片段'}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{clip.subtitleText}</p>
                </article>
              ))}
            </div>
          ) : <p className="rounded-2xl border border-dashed border-[#dbe8f4] p-6 text-sm font-semibold text-slate-500">暂无个人收藏。</p>
        ) : null}
      </div>
      </div>
      <nav className="flex w-20 shrink-0 flex-col items-center gap-3 border-l border-[#dbe8f4] bg-[#f8fbff] py-5">
        {tabs.map((tab) => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex min-h-[70px] w-14 flex-col items-center justify-center gap-1.5 rounded-2xl border text-center transition ${
                active
                  ? 'border-[#ded6ff] bg-white text-[#6251f5] shadow-[0_10px_24px_rgba(98,81,245,0.12)]'
                  : 'border-transparent bg-transparent text-slate-500 hover:bg-white hover:text-[#6251f5]'
              }`}
            >
              <span className="relative">
                {renderTabIcon(tab.key, 'h-5 w-5')}
                <span className={`absolute -right-3 -top-3 rounded-full px-1.5 py-0.5 text-[10px] font-black ${active ? 'bg-[#f5f2ff] text-[#6251f5]' : 'bg-white text-slate-400'}`}>{tab.count}</span>
              </span>
              <span className="text-xs font-black leading-4">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

function CeoWatchContent({
  detail,
  materialId,
  onLockedAction,
  onBack
}: {
  detail: CorporateEnglishCompanyDetail
  materialId: string
  onLockedAction: () => void
  onBack: () => void
}) {
  const activeVideo = useMemo<CorporateEnglishPublicVideo | null>(() => {
    return detail.videos.find((video) => video.materialId === materialId) || detail.videos[0] || null
  }, [detail.videos, materialId])
  const companyPath = detail.company.name ? getCompanyDetailPath(detail.company.name) : ''

  const trackClipPlay = useCallback((clip: CorporateEnglishPublicClip) => {
    trackingService.track('corporate_english_clip_play', {
      page_key: 'corporate_english',
      module: 'corporate_english_clip',
      feature_key: 'corporate_english_clip_play',
      entity_type: 'corporate_english_clip',
      entity_id: clip.clipId,
      material_id: activeVideo?.materialId || '',
      company_id: detail.company.companyId,
      corporate_english_section: 'ceo',
      module_key: 'ceo'
    })
  }, [activeVideo?.materialId, detail.company.companyId])

  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({})
  const canViewDetail = Boolean(activeVideo && detail.permissions?.isAuthenticated && !activeVideo.isVideoLocked)
  const clipCount = detail.company.clipCount || activeVideo?.clips.length || 0
  const clipsWithFavoriteState = useMemo(() => (
    (activeVideo?.clips || []).map((clip) => ({
      ...clip,
      isFavorited: favoriteOverrides[clip.clipId] ?? clip.isFavorited
    }))
  ), [activeVideo?.clips, favoriteOverrides])
  const favoritesCount = useMemo(() => {
    const ids = new Set((detail.favorites || []).map((clip) => clip.clipId))
    for (const [clipId, isFavorited] of Object.entries(favoriteOverrides)) {
      if (isFavorited) ids.add(clipId)
      else ids.delete(clipId)
    }
    return ids.size
  }, [detail.favorites, favoriteOverrides])
  const detailViewTracker = activeVideo ? (
    <TrackDetailView
      section="ceo"
      entityId={activeVideo.materialId}
      accessTier={activeVideo.accessTier}
      locked={!canViewDetail}
      companyId={detail.company.companyId}
      companyName={detail.company.name}
    />
  ) : null

  useEffect(() => {
    if (!activeVideo?.materialId) return
    setFavoriteOverrides({})
  }, [activeVideo?.materialId])

  const handleToggleFavorite = useCallback((clip: CorporateEnglishPublicClip) => {
    const nextFavorited = !clip.isFavorited
    setFavoriteOverrides((current) => ({ ...current, [clip.clipId]: nextFavorited }))
    const request = nextFavorited
      ? corporateEnglishPublicService.addFavorite(clip.clipId)
      : corporateEnglishPublicService.removeFavorite(clip.clipId)
    request.catch((error) => {
      console.error('Failed to update corporate English favorite:', error)
      setFavoriteOverrides((current) => ({ ...current, [clip.clipId]: clip.isFavorited }))
    })
  }, [])

  if (!activeVideo) return null

  if (!canViewDetail) {
    return (
      <>
        {detailViewTracker}
        <LockedDetailGate
          title={activeVideo.materialTitle}
          eyebrow={detail.company.name || 'CEO 访谈'}
          message={detail.permissions?.isAuthenticated ? '该访谈为 Club 内容，开通后可查看视频、企业文化、商业思维、跟读片段和岗位信息。' : '登录后可播放外企英语内容。未登录状态下，视频、企业文化、商业思维和跟读素材均不可见。'}
          actionLabel={detail.permissions?.isAuthenticated ? '开通 Club' : '登录后播放'}
          onAction={onLockedAction}
          onBack={onBack}
        />
      </>
    )
  }

  return (
    <>
      {detailViewTracker}
      {!activeVideo.isVideoLocked && activeVideo.tencentVideoUrl ? (
        <TrackVideoView section="ceo" entityId={activeVideo.materialId} />
      ) : null}
      <div className="grid h-full min-h-0 gap-6 overflow-hidden xl:grid-cols-[minmax(0,2fr)_520px] 2xl:grid-cols-[minmax(0,2fr)_540px]">
        <main className="min-h-0 min-w-0 overflow-y-auto pr-1">
          <section className={`${SOFT_PANEL_CLASS} overflow-hidden p-5`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <InlineBackButton onClick={onBack} />
                {detail.company.logo ? (
                  <img src={detail.company.logo} alt={detail.company.name} className="h-10 w-10 shrink-0 rounded-2xl border border-[#dbe8f4] bg-white object-contain p-2" />
                ) : null}
                <div className="min-w-0">
                  <div className="truncate text-lg font-black text-slate-950">{detail.company.name}</div>
                  <div className="mt-0.5 truncate text-xs font-bold tracking-[0.08em] text-[#6251f5]">
                    {detail.company.industry || '远程企业 CEO 访谈'} · {clipCount} 个跟读片段
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-[#dbe8f4] bg-white px-3 py-1.5 text-xs font-black text-slate-500">{formatDateLabel(activeVideo.publishedAt) || '精选内容'}</span>
                <span className="rounded-full border border-[#ded6ff] bg-[#f5f2ff] px-3 py-1.5 text-xs font-black text-[#6251f5]">CEO 访谈</span>
              </div>
            </div>
            <div className="mb-4 inline-flex max-w-full rounded-full bg-[#6251f5] px-4 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(98,81,245,0.18)]">
              <span className="block truncate">{activeVideo.materialTitle}</span>
            </div>
            <VideoFrame
              title={activeVideo.materialTitle}
              src={activeVideo.tencentVideoUrl}
              poster={activeVideo.coverImageUrl}
              locked={activeVideo.isVideoLocked}
              lockReason={activeVideo.videoLockReason}
              onLockedAction={onLockedAction}
            />
            <div className="px-1 pb-1 pt-4">
              <h1 className="line-clamp-2 text-2xl font-black leading-tight tracking-tight text-slate-950">{activeVideo.materialTitle}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm font-semibold text-slate-500">
                <span>{activeVideo.speakerName} · {activeVideo.speakerRole}</span>
                {activeVideo.speakerEmail ? (
                  <a href={`mailto:${activeVideo.speakerEmail}`} className="inline-flex items-center gap-1 text-[#6251f5] hover:no-underline">
                    <Mail className="h-4 w-4" />
                    Email
                  </a>
                ) : null}
                {activeVideo.speakerLinkedin ? (
                  <a href={normalizeExternalUrl(activeVideo.speakerLinkedin)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#6251f5] hover:no-underline">
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </a>
                ) : null}
                {activeVideo.sourceVideoUrl ? (
                  <a href={normalizeExternalUrl(activeVideo.sourceVideoUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#6251f5] hover:text-[#4f46e5]">
                    视频来源
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
              {activeVideo.videoSummary ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{activeVideo.videoSummary}</p> : null}
            </div>
          </section>

          <ClipPracticeSection clips={clipsWithFavoriteState} onPlay={trackClipPlay} onLocked={onLockedAction} onToggleFavorite={handleToggleFavorite} />
        </main>
        <CompanyInfoTabs detail={detail} companyPath={companyPath} favoriteCount={favoritesCount} />
      </div>
    </>
  )
}

function ModuleWatchContent({
  video,
  onLockedAction,
  onBack
}: {
  video: CorporateEnglishPublicModuleVideo
  onLockedAction: () => void
  onBack: () => void
}) {
  const section = video.moduleKey || 'english_interview'
  const metaLabel = getModuleVideoMetaLabel(video)
  const detailViewTracker = (
    <TrackDetailView
      section={section}
      entityId={video.videoId}
      category={section === 'remote_preparation' ? video.difficultyLevel || '' : video.category}
      accessTier={video.accessTier}
      locked={video.isLocked}
    />
  )
  if (video.isLocked) {
    return (
      <>
        {detailViewTracker}
        <LockedDetailGate
          title={video.title}
          eyebrow={metaLabel}
          message={video.loginRequired ? '登录后可播放外企英语内容。未登录状态下，视频简介、推荐和学习素材均不可见。' : '该视频为 Club 内容，开通后可查看完整视频和学习材料。'}
          actionLabel={video.loginRequired ? '登录后播放' : '开通 Club'}
          onAction={onLockedAction}
          onBack={onBack}
        />
      </>
    )
  }
  return (
    <>
      {detailViewTracker}
      {!video.isLocked && video.tencentIframeUrl ? (
        <TrackVideoView section={section} entityId={video.videoId} category={section === 'remote_preparation' ? video.difficultyLevel || '' : video.category} />
      ) : null}
      <div className="grid h-full min-h-0 gap-6 overflow-hidden xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
        <main className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto pr-1">
          <VideoFrame
            title={video.title}
            src={video.tencentIframeUrl}
            poster={video.coverImageUrl}
            locked={video.isLocked}
            lockReason={video.lockReason}
            onLockedAction={onLockedAction}
            overlay={<VideoBackButton onClick={onBack} />}
            className="max-h-[calc(100vh-15rem)] shrink-0"
          />
          <section className={`${SOFT_PANEL_CLASS} mt-5 shrink-0 p-5`}>
            <h1 className={`${getDetailTitleClass(video.title)} line-clamp-3 font-black tracking-tight text-slate-950`}>{video.title}</h1>
          </section>
        </main>
        <ModuleInfoPanel video={video} />
      </div>
    </>
  )
}

export default function CorporateEnglishWatchPage() {
  const navigate = useNavigate()
  const { source = '', id = '' } = useParams<{ source: 'ceo' | 'module'; id: string }>()
  const { isAuthenticated } = useAuth()
  const { showError, showWarning } = useNotificationHelpers()
  const showErrorRef = useRef(showError)
  const [loading, setLoading] = useState(true)
  const [ceoDetail, setCeoDetail] = useState<CorporateEnglishCompanyDetail | null>(null)
  const [moduleVideo, setModuleVideo] = useState<CorporateEnglishPublicModuleVideo | null>(null)

  const handleLockedAction = useCallback(() => {
    if (!isAuthenticated) {
      showWarning('请先登录', '登录后可播放免费内容。')
      navigate('/login')
      return
    }
    navigate('/profile?tab=membership#club-service-plans')
  }, [isAuthenticated, navigate, showWarning])

  useEffect(() => {
    showErrorRef.current = showError
  }, [showError])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!id) return
      try {
        setLoading(true)
        setCeoDetail(null)
        setModuleVideo(null)
        if (source === 'ceo') {
          const detail = await corporateEnglishPublicService.getCeoVideo(id)
          if (!cancelled) setCeoDetail(detail)
        } else {
          const data = await corporateEnglishPublicService.getModuleVideo(id)
          if (!cancelled) setModuleVideo(data.video)
        }
      } catch (error) {
        console.error('Failed to load corporate English watch page:', error)
        if (!cancelled) showErrorRef.current('视频加载失败', error instanceof Error ? error.message : '请稍后重试')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, source])

  return (
    <div className="h-screen overflow-hidden bg-[#fbfaf6] font-haigoo-rounded text-slate-950">
      <div className="mx-auto flex h-full max-w-[1780px] flex-col px-4 pb-5 pt-24 sm:px-8">
        {loading ? (
          <div className={`${SOFT_PANEL_CLASS} flex flex-1 items-center justify-center`}>
            <Loader2 className="h-7 w-7 animate-spin text-[#6251f5]" />
          </div>
        ) : source === 'ceo' && ceoDetail ? (
          <CeoWatchContent detail={ceoDetail} materialId={id} onLockedAction={handleLockedAction} onBack={() => navigate('/corporate-english')} />
        ) : source === 'module' && moduleVideo ? (
          <ModuleWatchContent video={moduleVideo} onLockedAction={handleLockedAction} onBack={() => navigate('/corporate-english')} />
        ) : (
          <div className={`${SOFT_PANEL_CLASS} p-12 text-center text-slate-500`}>视频不存在或已下线。</div>
        )}
      </div>
    </div>
  )
}
