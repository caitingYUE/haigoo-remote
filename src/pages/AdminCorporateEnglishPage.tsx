import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  FileAudio,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Wand2,
  X
} from 'lucide-react'
import {
  CorporateEnglishClip,
  CorporateEnglishClipTag,
  CorporateEnglishCompanyProfile,
  CorporateEnglishContentSection,
  CorporateEnglishModuleKey,
  CorporateEnglishModuleVideo,
  CorporateEnglishVideoNoteBlock,
  CorporateEnglishVideoNoteBlockType,
  CorporateEnglishResourceLink,
  CorporateEnglishMaterial,
  CorporateEnglishPronunciationMark,
  CorporateEnglishPronunciationMarkType,
  SaveCorporateEnglishModuleVideoPayload,
  CorporateEnglishStatus,
  CorporateEnglishSubtitleCue,
  CorporateEnglishSubtitleRow,
  corporateEnglishService
} from '../services/corporate-english-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'

const MAX_SOURCE_AUDIO_BYTES = 500 * 1024 * 1024
const MAX_CSV_BYTES = 2 * 1024 * 1024
const MAX_CLIP_BYTES = 3 * 1024 * 1024
const MAX_COVER_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_CLIPS = 50
const CLIP_AUDIO_BITRATE = 48000
const ACCEPTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm', '.mp4']
const COVER_ASPECT_RATIO = 16 / 9
const COVER_OUTPUT_WIDTH = 1280
const COVER_OUTPUT_HEIGHT = 720

type Mode = 'list' | 'create' | 'edit' | 'profile'
type AdminSubModule = 'ceo' | CorporateEnglishModuleKey
type ModuleCategoryType = 'jobCategories' | 'companyIndustries'

const REMOTE_PREPARATION_LEVEL_OPTIONS = [
  { value: 'entry', label: '入门' },
  { value: 'junior', label: '初级' },
  { value: 'intermediate', label: '中级' },
  { value: 'advanced', label: '高级' }
]

const ADMIN_SUB_MODULES: Array<{
  key: AdminSubModule
  label: string
  description: string
  moduleKey?: CorporateEnglishModuleKey
  categoryType?: ModuleCategoryType
}> = [
  { key: 'ceo', label: 'CEO访谈', description: '按企业管理 CEO 访谈视频、跟读剪辑和企业文化配置。' },
  { key: 'english_interview', label: '英语面试', moduleKey: 'english_interview', categoryType: 'jobCategories', description: '管理岗位方向相关的英文面试视频内容。' },
  { key: 'remote_preparation', label: '远程准备', moduleKey: 'remote_preparation', description: '管理远程求职、远程协作和入职准备相关视频内容。' },
  { key: 'foreign_meeting', label: '外企会议', moduleKey: 'foreign_meeting', categoryType: 'companyIndustries', description: '管理行业场景相关的外企会议视频内容。' }
]
type ClipDownloadFormat = 'compressed' | 'wav' | 'm4a'
type ProfileSectionKey = 'cultureSections' | 'ceoThinkingSections'
type BulkApplyMode = 'append' | 'replace'

interface EditableClip extends CorporateEnglishClip {
  localId: string
  startTimecode: string
  endTimecode: string
  clipTagInput?: string
  pronunciationMarkInput?: string
  clipBlob?: Blob
  clipAudioUrl?: string
  clipMimeType?: string
  clipExtension?: string
  downloadFormat?: ClipDownloadFormat
  uploadProgress?: number
}

interface CompanyGroup {
  companyId: string
  companyName: string
  companyWebsite?: string
  status: CorporateEnglishStatus
  videoCount: number
  clipCount: number
  latestUpdatedAt?: string
  profile?: CorporateEnglishCompanyProfile | null
  materials: CorporateEnglishMaterial[]
}

interface CoverCropDraft {
  file: File
  previewUrl: string
}

function loadImageForCrop(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('封面图片加载失败，请重新选择图片'))
    image.src = src
  })
}

async function createCroppedCoverFile(file: File, previewUrl: string, pixelCrop: Area): Promise<File> {
  const image = await loadImageForCrop(previewUrl)
  const canvas = document.createElement('canvas')
  canvas.width = COVER_OUTPUT_WIDTH
  canvas.height = COVER_OUTPUT_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持图片裁剪')
  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    COVER_OUTPUT_WIDTH,
    COVER_OUTPUT_HEIGHT
  )
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) resolve(nextBlob)
      else reject(new Error('封面裁剪失败，请重新选择图片'))
    }, 'image/webp', 0.9)
  })
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'cover'
  return new File([blob], `${baseName}-16x9.webp`, { type: 'image/webp' })
}

function CoverCropModal({
  draft,
  onCancel,
  onApply
}: {
  draft: CoverCropDraft
  onCancel: () => void
  onApply: (file: File) => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedPixels, setCroppedPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const applyCrop = async () => {
    if (!croppedPixels) {
      alert('请先调整封面裁剪范围')
      return
    }
    try {
      setSaving(true)
      const croppedFile = await createCroppedCoverFile(draft.file, draft.previewUrl, croppedPixels)
      onApply(croppedFile)
    } catch (error) {
      alert(error instanceof Error ? error.message : '封面裁剪失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/56 px-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">裁剪视频封面</h3>
            <p className="text-sm text-slate-500">固定 16:9 比例，可拖动图片并缩放，避免黑边和主体偏移。</p>
          </div>
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4" />
            取消
          </button>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-950">
            <Cropper
              image={draft.previewUrl}
              crop={crop}
              zoom={zoom}
              aspect={COVER_ASPECT_RATIO}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, nextPixels) => setCroppedPixels(nextPixels)}
              showGrid
              objectFit="contain"
            />
          </div>
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-sm font-bold text-slate-700">缩放</div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-full"
              />
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              上传后会以当前裁剪范围生成 16:9 WebP 封面。前台列表、Hero 和详情页会使用同一套比例，建议主体尽量放在中间偏上位置。
            </div>
            <button type="button" className="btn-primary h-12 w-full" onClick={applyCrop} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {saving ? '裁剪中...' : '确认裁剪'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface EditorState {
  materialId?: string
  selectedCompany: TrustedCompany | null
  materialTitle: string
  speakerName: string
  speakerRole: string
  speakerEmail: string
  speakerLinkedin: string
  tencentVideoInput: string
  sourceVideoUrl: string
  videoSummary: string
  coverImageUrl?: string
  coverThumbnailUrl?: string
  sequence: number
  status: CorporateEnglishStatus
  isFeatured: boolean
  sourceAudioAssetId?: string | null
  subtitleCsvAssetId?: string | null
  durationMs?: number | null
  subtitleRows: CorporateEnglishSubtitleRow[]
  clips: EditableClip[]
}

interface ParsedBulkClipConfig {
  startMs: number
  endMs: number
  title: string
  clipTagInput: string
  pronunciationMarkInput: string
  subtitleText?: string
  translationText?: string
  subtitleCues?: CorporateEnglishSubtitleCue[]
}

const emptyEditorState = (): EditorState => ({
  selectedCompany: null,
  materialTitle: '',
  speakerName: '',
  speakerRole: '',
  speakerEmail: '',
  speakerLinkedin: '',
  tencentVideoInput: '',
  sourceVideoUrl: '',
  videoSummary: '',
  coverImageUrl: '',
  coverThumbnailUrl: '',
  sequence: 0,
  status: 'draft',
  isFeatured: false,
  sourceAudioAssetId: null,
  subtitleCsvAssetId: null,
  durationMs: null,
  subtitleRows: [],
  clips: []
})

const emptyProfile = (companyId = ''): CorporateEnglishCompanyProfile => ({
  companyId,
  cultureSections: [],
  ceoThinkingSections: [],
  otherResources: [],
  accessTier: 'vip',
  status: 'published',
  sortOrder: 0
})

function formatBytes(bytes?: number) {
  const value = Number(bytes || 0)
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${value} B`
}

function formatTime(ms?: number | null) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const base = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${base}` : base
}

function parseTimecode(value: string) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parts = raw.split(':').map((part) => Number.parseFloat(part))
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null
  if (parts.length === 1) return Math.round(parts[0] * 1000)
  if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000)
  if (parts.length === 3) return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000)
  return null
}

function formatSecondsInput(ms?: number | null) {
  return (Math.max(0, Number(ms || 0)) / 1000).toFixed(2)
}

function secondsInputToMs(value: string) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds < 0) return 0
  return Math.round(seconds * 1000)
}

function splitTagValues(value: string) {
  return value
    .split(/[\/,，、；;]+/g)
    .map((tag) => tag.replace(/^#+/, '').trim())
    .filter(Boolean)
}

function parseClipTags(input: string): CorporateEnglishClipTag[] {
  const raw = String(input || '').trim()
  if (!raw) return []

  const defaultTitles = ['适用英语水平', '素材关键词', '适用场景']
  const lines = raw
    .split(/\n+/g)
    .map((line) => line.trim())
    .filter(Boolean)

  const hasExplicitTitles = lines.some((line) => /[:：]/.test(line))
  if (hasExplicitTitles) {
    return lines
      .map((line, index) => {
        const [titlePart, ...valueParts] = line.split(/[:：]/)
        const title = (titlePart || defaultTitles[index] || `标签组 ${index + 1}`).trim()
        const tags = splitTagValues(valueParts.join('：') || '')
        return { title, tags }
      })
      .filter((group) => group.title && group.tags.length > 0)
  }

  return raw
    .split(/[；;]+/g)
    .map((group, index) => ({
      title: defaultTitles[index] || `标签组 ${index + 1}`,
      tags: splitTagValues(group)
    }))
    .filter((group) => group.tags.length > 0)
}

function formatClipTags(tags: CorporateEnglishClipTag[]) {
  return (tags || [])
    .filter((group) => group.title && Array.isArray(group.tags) && group.tags.length > 0)
    .map((group) => `${group.title}：${group.tags.join(' / ')}`)
    .join('\n')
}

function normalizeClipTags(tags?: CorporateEnglishClipTag[]) {
  if (!Array.isArray(tags)) return []
  return tags
    .map((group, index) => ({
      title: String(group?.title || `标签组 ${index + 1}`).trim(),
      tags: Array.isArray(group?.tags) ? group.tags.map((tag) => String(tag).trim()).filter(Boolean) : []
    }))
    .filter((group) => group.title && group.tags.length > 0)
}

const pronunciationTypeLabels: Record<CorporateEnglishPronunciationMarkType, string> = {
  stress: '重读',
  weak: '弱读',
  linking: '连读',
  keyword: '关键词',
  pause: '停顿'
}

const pronunciationLabelToType: Record<string, CorporateEnglishPronunciationMarkType> = {
  重读: 'stress',
  stress: 'stress',
  accent: 'stress',
  emphasize: 'stress',
  弱读: 'weak',
  weak: 'weak',
  reduction: 'weak',
  连读: 'linking',
  linking: 'linking',
  link: 'linking',
  关键词: 'keyword',
  keyword: 'keyword',
  key: 'keyword',
  停顿: 'pause',
  pause: 'pause',
  break: 'pause'
}

function splitPronunciationValues(value: string) {
  return value
    .split(/[\/,，、；;]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizePronunciationMarks(marks?: CorporateEnglishPronunciationMark[]) {
  if (!Array.isArray(marks)) return []
  return marks
    .map((mark) => ({
      type: ['stress', 'weak', 'linking', 'keyword', 'pause'].includes(String(mark?.type))
        ? mark.type
        : 'keyword',
      text: String(mark?.text || '').trim(),
      note: String(mark?.note || '').trim()
    }))
    .filter((mark) => mark.text)
}

function parsePronunciationMarks(input: string): CorporateEnglishPronunciationMark[] {
  const raw = String(input || '').trim()
  if (!raw) return []
  return raw
    .split(/\n+/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [titlePart, ...valueParts] = line.split(/[:：]/)
      const type = pronunciationLabelToType[String(titlePart || '').trim().toLowerCase()]
        || pronunciationLabelToType[String(titlePart || '').trim()]
        || 'keyword'
      return splitPronunciationValues(valueParts.join('：') || line).map((value) => ({
        type,
        text: value.replace(/^#+/, '').trim()
      }))
    })
    .filter((mark) => mark.text)
}

function formatPronunciationMarks(marks?: CorporateEnglishPronunciationMark[]) {
  const groups = normalizePronunciationMarks(marks).reduce<Record<string, string[]>>((acc, mark) => {
    const label = pronunciationTypeLabels[mark.type] || '关键词'
    acc[label] = acc[label] || []
    acc[label].push(mark.text)
    return acc
  }, {})

  return Object.entries(groups)
    .map(([label, values]) => `${label}：${[...new Set(values)].join(' / ')}`)
    .join('\n')
}

function inferPronunciationMarks(
  subtitleText: string,
  subtitleRows: CorporateEnglishSubtitleRow[] = [],
  startMs = 0,
  endMs = Number.POSITIVE_INFINITY
): CorporateEnglishPronunciationMark[] {
  const text = String(subtitleText || '')
  const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []
  const lowerWords = words.map((word) => word.toLowerCase())
  const stopWords = new Set([
    'a', 'an', 'the', 'to', 'of', 'for', 'and', 'or', 'but', 'if', 'in', 'on', 'at', 'with', 'from',
    'you', 'your', 'we', 'our', 'i', 'me', 'my', 'it', 'its', 'is', 'are', 'was', 'were', 'be', 'been',
    'that', 'this', 'these', 'those', 'as', 'so', 'do', 'does', 'did', 'can', 'could', 'would', 'should',
    'will', 'would', 'shall', 'may', 'might', 'must', 'have', 'has', 'had', 'not', 'no', 'yes', 'uh', 'um'
  ])
  const functionWords = new Set([
    'a', 'an', 'the', 'to', 'of', 'for', 'and', 'or', 'but', 'you', 'your', 'we', 'our', 'it', 'is', 'are',
    'was', 'were', 'be', 'been', 'that', 'this', 'as', 'do', 'does', 'did', 'can', 'could', 'would', 'should',
    'will', 'would', 'shall', 'may', 'might', 'must', 'have', 'has', 'had', 'am', 'him', 'her', 'them', 'us'
  ])
  const vowelStart = /^[aeiou]/i
  const vowelEnd = /[aeiouy]$/i
  const consonantEnd = /[bcdfghjklmnpqrstvwxyz]$/i
  const contentWordCounts = new Map<string, number>()
  const marks: CorporateEnglishPronunciationMark[] = []

  lowerWords.forEach((word) => {
    if (!stopWords.has(word) && word.length >= 4) {
      contentWordCounts.set(word, (contentWordCounts.get(word) || 0) + 1)
    }
  })

  lowerWords.forEach((word, index) => {
    const original = words[index]
    const previous = lowerWords[index - 1] || ''
    const next = words[index + 1]
    if (functionWords.has(word) || /^(?:'[a-z]+)$/.test(word)) {
      marks.push({ type: 'weak', text: original, note: '功能词，跟读时通常轻读' })
    }
    if (!stopWords.has(word) && (word.length >= 6 || contentWordCounts.get(word)! >= 2 || /^[A-Z]{2,}$/.test(original))) {
      marks.push({ type: 'keyword', text: original, note: contentWordCounts.get(word)! >= 2 ? '高频内容词' : '内容理解关键词' })
    }
    if (!stopWords.has(word) && (word.length >= 8 || /^[A-Z]/.test(original || '') || /ly$|tion$|ment$|ness$|ity$/.test(word))) {
      marks.push({ type: 'stress', text: original, note: '句子里需要强调的词' })
    }
    if (!stopWords.has(word) && previous && (previous === 'very' || previous === 'really' || previous === 'so')) {
      marks.push({ type: 'stress', text: original, note: '程度副词后的语义重心' })
    }
    const nextLower = lowerWords[index + 1] || ''
    if (next && (
      (consonantEnd.test(original) && vowelStart.test(next))
      || (vowelEnd.test(original) && vowelStart.test(next))
      || (word === 'way' && nextLower === 'to')
      || (word === 'going' && nextLower === 'to')
      || (word === 'want' && nextLower === 'to')
      || (word === 'have' && nextLower === 'to')
      || (word === 'used' && nextLower === 'to')
    )) {
      marks.push({ type: 'linking', text: `${original} ${next}`, note: '两个词要连在一起读' })
    }
  })

  const reductions: Array<{ phrase: string; note: string }> = [
    { phrase: 'going to', note: '常见口语弱化，可读作 gonna' },
    { phrase: 'want to', note: '常见口语弱化，可读作 wanna' },
    { phrase: 'have to', note: 'have 中 /v/ 常弱化' },
    { phrase: 'kind of', note: '常见口语弱化' },
    { phrase: 'sort of', note: '常见口语弱化' },
    { phrase: 'you know', note: '填充表达，通常轻读' },
    { phrase: 'a lot of', note: '功能词组合，通常连贯轻读' },
    { phrase: 'as a', note: '功能词组合，通常连贯轻读' },
    { phrase: 'as an', note: '功能词组合，通常连贯轻读' }
  ]
  const normalizedText = text.toLowerCase()
  reductions.forEach(({ phrase, note }) => {
    if (new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalizedText)) {
      marks.push({ type: 'weak', text: phrase, note })
      marks.push({ type: 'linking', text: phrase, note: '词组内连贯读' })
    }
  })

  const rowsInRange = subtitleRows
    .filter((row) => row.subtitle_start_ms >= startMs && row.subtitle_start_ms <= endMs)
    .sort((a, b) => a.subtitle_start_ms - b.subtitle_start_ms)
  rowsInRange.forEach((row, index) => {
    const next = rowsInRange[index + 1]
    const rowWords = row.subtitle_text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []
    const anchor = rowWords[rowWords.length - 1]
    if (!anchor || !next) return
    const gapMs = next.subtitle_start_ms - row.subtitle_start_ms
    if (gapMs >= 2500) {
      marks.push({ type: 'pause', text: anchor, note: '长停顿' })
    } else if (gapMs >= 1200) {
      marks.push({ type: 'pause', text: anchor, note: '短停顿' })
    }
  })

  text.split(/\n+/g).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    if (/[,.!?;:]$/.test(trimmed)) {
      const lastWords = trimmed.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || []
      const anchor = lastWords[lastWords.length - 1]
      if (anchor) marks.push({ type: 'pause', text: anchor, note: /[.!?]$/.test(trimmed) ? '长停顿' : '短停顿' })
    }
  })

  const seen = new Set<string>()
  return marks.filter((mark) => {
    const key = `${mark.type}:${mark.text.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 40)
}

function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function splitCsvLine(line: string) {
  const values: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

function parseSubtitleCsv(csvText: string): CorporateEnglishSubtitleRow[] {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim())

  if (lines.length < 2) throw new Error('CSV 至少需要表头和一行字幕数据')

  const findHeaderMeta = () => {
    for (let lineIndex = 0; lineIndex < Math.min(lines.length, 10); lineIndex += 1) {
      const headers = splitCsvLine(lines[lineIndex]).map(normalizeHeader)
      const findIndex = (aliases: string[]) => headers.findIndex((header) => aliases.includes(header))
      const timeIndex = findIndex(['time', 'timestamp', '时间', '时间戳'])
      const subtitleIndex = findIndex(['subtitle', '字幕', 'subtitle text'])
      const translationIndex = findIndex(['translation', 'translation4', '翻译', 'translation text'])
      if (timeIndex >= 0 && subtitleIndex >= 0 && translationIndex >= 0) {
        return { headers, lineIndex, timeIndex, subtitleIndex, translationIndex }
      }
    }
    return null
  }

  const headerMeta = findHeaderMeta()
  if (!headerMeta) {
    throw new Error('CSV 需要包含 Time、Subtitle、Translation/Translation4 字段')
  }

  const { headers, lineIndex: headerLineIndex, timeIndex, subtitleIndex, translationIndex } = headerMeta
  const findIndex = (aliases: string[]) => headers.findIndex((header) => aliases.includes(header))
  const titleIndex = findIndex(['文件标题', 'file title', 'title', 'source title'])
  const titleRows = lines.slice(0, headerLineIndex)
  const titleFromLeadingRows = titleRows
    .map((line) => splitCsvLine(line).join(' ').trim())
    .filter(Boolean)
    .join(' ')

  return lines.slice(headerLineIndex + 1).map((line, index) => {
    const cells = splitCsvLine(line)
    const timecode = String(cells[timeIndex] || '').trim()
    const startMs = parseTimecode(timecode)
    if (startMs === null) throw new Error(`第 ${headerLineIndex + index + 2} 行 Time 格式无效`)
    return {
      source_title: titleIndex >= 0 ? String(cells[titleIndex] || '').trim() : titleFromLeadingRows,
      subtitle_timecode: timecode,
      subtitle_start_ms: startMs,
      subtitle_text: String(cells[subtitleIndex] || '').trim(),
      translation_text: String(cells[translationIndex] || '').trim()
    }
  })
}

function extractSubtitle(rows: CorporateEnglishSubtitleRow[], startMs: number, endMs: number) {
  const selected = rows.filter((row) => row.subtitle_start_ms >= startMs && row.subtitle_start_ms <= endMs)
  return {
    subtitleText: selected.map((row) => row.subtitle_text).filter(Boolean).join('\n'),
    translationText: selected.map((row) => row.translation_text).filter(Boolean).join('\n'),
    subtitleCues: selected.map((row, index) => {
      const nextStartMs = selected[index + 1]?.subtitle_start_ms ?? endMs
      const cueStartMs = Math.max(0, row.subtitle_start_ms - startMs)
      const cueEndMs = Math.max(cueStartMs + 1, Math.min(endMs - startMs, nextStartMs - startMs))
      return {
        startMs: cueStartMs,
        endMs: cueEndMs,
        subtitleText: row.subtitle_text,
        translationText: row.translation_text
      }
    }).filter((cue) => cue.subtitleText || cue.translationText)
  }
}

function parseBulkClipHeader(line: string) {
  const parts = line.split(/[|｜]/g).map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const timeMatch = parts[0].match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:-|–|—|~|至|到)\s*(\d{1,2}:\d{2}(?::\d{2})?)$/)
  if (!timeMatch) return null
  const startMs = parseTimecode(timeMatch[1])
  const endMs = parseTimecode(timeMatch[2])
  if (startMs === null || endMs === null || endMs <= startMs) {
    throw new Error(`时间戳无效：${parts[0]}`)
  }
  return {
    startMs,
    endMs,
    title: parts[1],
    clipTagInput: parts.slice(2).join('；')
  }
}

function isBulkClipHeaderLine(line: string) {
  return Boolean(parseBulkClipHeader(line))
}

function parseBulkClipConfig(input: string, subtitleRows: CorporateEnglishSubtitleRow[]) {
  const lines = String(input || '').split(/\r?\n/g)
  const blocks: Array<{ header: string; lines: string[] }> = []
  let currentBlock: { header: string; lines: string[] } | null = null

  lines.forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) return
    if (isBulkClipHeaderLine(line)) {
      currentBlock = { header: line, lines: [] }
      blocks.push(currentBlock)
      return
    }
    if (currentBlock) currentBlock.lines.push(rawLine)
  })

  return blocks.map((block, index): ParsedBulkClipConfig => {
    const header = parseBulkClipHeader(block.header)
    if (!header) throw new Error(`第 ${index + 1} 段缺少有效标题行`)

    const pronunciationLines: string[] = []
    const textFields: Record<'subtitleText' | 'translationText', string[]> = {
      subtitleText: [],
      translationText: []
    }
    let activeTextField: 'subtitleText' | 'translationText' | '' = ''

    block.lines.forEach((rawLine) => {
      const line = rawLine.trim()
      if (!line) return
      const labelMatch = line.match(/^([^:：]{1,12})[:：]\s*(.*)$/)
      const label = String(labelMatch?.[1] || '').trim()
      const value = String(labelMatch?.[2] || '').trim()

      if (['跟读原文', '原文', '英文原文', '字幕原文'].includes(label)) {
        activeTextField = 'subtitleText'
        if (value) textFields.subtitleText.push(value)
        return
      }
      if (['参考译文', '译文', '翻译', '字幕翻译'].includes(label)) {
        activeTextField = 'translationText'
        if (value) textFields.translationText.push(value)
        return
      }
      if (label && (pronunciationLabelToType[label] || pronunciationLabelToType[label.toLowerCase()])) {
        pronunciationLines.push(`${label}：${value}`)
        activeTextField = ''
        return
      }
      if (activeTextField) {
        textFields[activeTextField].push(line)
      }
    })

    const extracted = extractSubtitle(subtitleRows, header.startMs, header.endMs)
    return {
      ...header,
      pronunciationMarkInput: pronunciationLines.join('\n'),
      subtitleText: textFields.subtitleText.join('\n') || extracted.subtitleText,
      translationText: textFields.translationText.join('\n') || extracted.translationText,
      subtitleCues: extracted.subtitleCues
    }
  })
}

function parseProfileBulkSections(input: string) {
  return String(input || '')
    .split(/\r?\n/g)
    .map((rawLine, index) => {
      const line = rawLine.trim()
      if (!line) return null
      const separatorIndex = line.search(/[|｜]/)
      if (separatorIndex < 0) throw new Error(`第 ${index + 1} 行缺少「｜」分隔符`)
      const title = line.slice(0, separatorIndex).trim()
      const body = line.slice(separatorIndex + 1).trim()
      if (!title || !body) throw new Error(`第 ${index + 1} 行标题或内容为空`)
      return { title, body }
    })
    .filter((section): section is CorporateEnglishContentSection => Boolean(section))
}

function encodeWav(audioBuffer: AudioBuffer) {
  const channelCount = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const bytesPerSample = 2
  const blockAlign = channelCount * bytesPerSample
  const dataLength = audioBuffer.length * blockAlign
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)
  let offset = 0

  const writeString = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index))
      offset += 1
    }
  }

  writeString('RIFF')
  view.setUint32(offset, 36 + dataLength, true)
  offset += 4
  writeString('WAVE')
  writeString('fmt ')
  view.setUint32(offset, 16, true)
  offset += 4
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint16(offset, channelCount, true)
  offset += 2
  view.setUint32(offset, sampleRate, true)
  offset += 4
  view.setUint32(offset, sampleRate * blockAlign, true)
  offset += 4
  view.setUint16(offset, blockAlign, true)
  offset += 2
  view.setUint16(offset, 16, true)
  offset += 2
  writeString('data')
  view.setUint32(offset, dataLength, true)
  offset += 4

  for (let sample = 0; sample < audioBuffer.length; sample += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const source = audioBuffer.getChannelData(channel)[sample]
      const clamped = Math.max(-1, Math.min(1, source))
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

function resampleToMonoAudioBuffer(audioBuffer: AudioBuffer, targetSampleRate = 24000) {
  const outputLength = Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate))
  const output = new AudioBuffer({
    length: outputLength,
    numberOfChannels: 1,
    sampleRate: targetSampleRate
  })
  const outputData = output.getChannelData(0)
  const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) => audioBuffer.getChannelData(channel))
  const ratio = audioBuffer.sampleRate / targetSampleRate

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio
    const before = Math.floor(sourceIndex)
    const after = Math.min(before + 1, audioBuffer.length - 1)
    const weight = sourceIndex - before
    let mixed = 0
    for (const data of channelData) {
      mixed += (data[before] || 0) * (1 - weight) + (data[after] || 0) * weight
    }
    outputData[index] = mixed / Math.max(1, channelData.length)
  }

  return output
}

function encodeSpeechWavClip(audioBuffer: AudioBuffer) {
  const speechBuffer = resampleToMonoAudioBuffer(audioBuffer, 24000)
  return { blob: encodeWav(speechBuffer), mimeType: 'audio/wav', extension: 'wav' }
}

function getM4aAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4'
  ]
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || null
}

async function decodeAudioBlob(blob: Blob) {
  const audioContext = new AudioContext()
  const arrayBuffer = await blob.arrayBuffer()
  return audioContext.decodeAudioData(arrayBuffer.slice(0))
}

function isAcceptedAudioFile(file: File) {
  const name = file.name.toLowerCase()
  return file.type.startsWith('audio/') || ACCEPTED_AUDIO_EXTENSIONS.some((extension) => name.endsWith(extension))
}

function readAudioDurationMs(objectUrl: string) {
  return new Promise<number>((resolve, reject) => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        resolve(Math.round(audio.duration * 1000))
      } else {
        reject(new Error('无法读取音频时长'))
      }
    }
    audio.onerror = () => reject(new Error('音频解析失败，请确认文件格式可被当前浏览器播放'))
    audio.src = objectUrl
  })
}

function clipAudioBuffer(source: AudioBuffer, startMs: number, endMs: number) {
  const startSample = Math.max(0, Math.floor((startMs / 1000) * source.sampleRate))
  const endSample = Math.min(source.length, Math.ceil((endMs / 1000) * source.sampleRate))
  const frameCount = Math.max(1, endSample - startSample)
  const clipped = new AudioBuffer({
    length: frameCount,
    numberOfChannels: source.numberOfChannels,
    sampleRate: source.sampleRate
  })
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    clipped.copyToChannel(source.getChannelData(channel).slice(startSample, endSample), channel)
  }
  return clipped
}

async function encodeAudioBufferWithMediaRecorder(
  audioBuffer: AudioBuffer,
  mimeType: string,
  extension: string,
  audioBitsPerSecond = CLIP_AUDIO_BITRATE
): Promise<{ blob: Blob; mimeType: string; extension: string }> {
  return new Promise((resolve, reject) => {
    const audioContext = new AudioContext({ sampleRate: Math.min(audioBuffer.sampleRate, 48000) })
    const source = audioContext.createBufferSource()
    const destination = audioContext.createMediaStreamDestination()
    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(destination.stream, {
      mimeType,
      audioBitsPerSecond
    })

    source.buffer = audioBuffer
    source.connect(destination)
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onerror = () => {
      audioContext.close().catch(() => undefined)
      reject(new Error('压缩剪辑音频失败'))
    }
    recorder.onstop = () => {
      audioContext.close().catch(() => undefined)
      const blob = new Blob(chunks, { type: mimeType })
      resolve({
        blob,
        mimeType,
        extension
      })
    }
    source.onended = () => {
      if (recorder.state !== 'inactive') recorder.stop()
    }

    recorder.start()
    audioContext.resume()
      .then(() => source.start())
      .catch((error) => {
        audioContext.close().catch(() => undefined)
        reject(error)
      })
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function statusLabel(status: CorporateEnglishStatus) {
  if (status === 'published') return '已发布'
  if (status === 'archived') return '已归档'
  return '草稿'
}

function shouldSilenceLocalDatabaseError(error: unknown) {
  if (!import.meta.env.DEV) return false
  const message = error instanceof Error ? error.message : String(error || '')
  return /Error connecting to database|fetch failed|Database not configured|Connect Timeout|UND_ERR_CONNECT_TIMEOUT/i.test(message)
}

function formatDateTimeInput(value?: string) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function formatSimpleTags(tags: string[]) {
  return (tags || []).join('、')
}

function emptyModuleVideoForm(moduleKey: CorporateEnglishModuleKey): SaveCorporateEnglishModuleVideoPayload {
  return {
    moduleKey,
    title: '',
    description: '',
    tencentIframeUrl: '',
    videoSource: '',
    category: '',
    difficultyLevel: '',
    videoNotes: [],
    tags: [],
    accessTier: 'vip',
    status: 'draft',
    sortOrder: 0,
    publishedAt: formatDateTimeInput(new Date().toISOString()),
    isFeatured: false
  }
}

const VIDEO_NOTE_BLOCK_OPTIONS: Array<{ value: CorporateEnglishVideoNoteBlockType; label: string }> = [
  { value: 'heading_1', label: '一级标题' },
  { value: 'heading_2', label: '二级标题' },
  { value: 'paragraph', label: '正文段落' },
  { value: 'bullet_list', label: '项目列表' },
  { value: 'numbered_list', label: '编号列表' },
  { value: 'quote', label: '重点引用' }
]

function createVideoNoteBlock(type: CorporateEnglishVideoNoteBlockType): CorporateEnglishVideoNoteBlock {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return type === 'bullet_list' || type === 'numbered_list'
    ? { id, type, items: [''] }
    : { id, type, text: '' }
}

function parseVideoNotesText(input: string): CorporateEnglishVideoNoteBlock[] {
  const lines = String(input || '').replace(/\r\n?/g, '\n').split('\n')
  const blocks: CorporateEnglishVideoNoteBlock[] = []
  let paragraphLines: string[] = []

  const addTextBlock = (type: Exclude<CorporateEnglishVideoNoteBlockType, 'bullet_list' | 'numbered_list'>, text: string) => {
    const normalized = text.trim()
    if (normalized) blocks.push({ ...createVideoNoteBlock(type), text: normalized })
  }
  const flushParagraph = () => {
    if (!paragraphLines.length) return
    addTextBlock('paragraph', paragraphLines.join('\n'))
    paragraphLines = []
  }

  for (let index = 0; index < lines.length;) {
    const raw = lines[index]
    const line = raw.trim()
    if (!line) {
      flushParagraph()
      index += 1
      continue
    }
    if (/^-{3,}$/.test(line)) {
      flushParagraph()
      addTextBlock('paragraph', '---')
      index += 1
      continue
    }

    const markdownHeading = line.match(/^(#{1,3})\s+(.+)$/)
    if (markdownHeading) {
      flushParagraph()
      addTextBlock(markdownHeading[1].length === 1 ? 'heading_1' : 'heading_2', markdownHeading[2])
      index += 1
      continue
    }
    if (/^[一二三四五六七八九十百]+[、.．]\s*\S+/.test(line)) {
      flushParagraph()
      addTextBlock('heading_1', line)
      index += 1
      continue
    }
    if (/^>\s*/.test(line)) {
      flushParagraph()
      const quoteLines: string[] = []
      while (index < lines.length && /^>\s*/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s*/, ''))
        index += 1
      }
      addTextBlock('quote', quoteLines.join('\n'))
      continue
    }
    if (/^[-*•·●○]\s+/.test(line)) {
      flushParagraph()
      const items: string[] = []
      while (index < lines.length && /^[-*•·●○]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*•·●○]\s+/, '').trim())
        index += 1
      }
      blocks.push({ ...createVideoNoteBlock('bullet_list'), items: items.filter(Boolean) })
      continue
    }
    if (/^\d+[.)、．]\s*/.test(line)) {
      flushParagraph()
      const items: string[] = []
      let cursor = index
      while (cursor < lines.length && /^\d+[.)、．]\s*/.test(lines[cursor].trim())) {
        items.push(lines[cursor].trim().replace(/^\d+[.)、．]\s*/, '').trim())
        cursor += 1
      }
      const nextLineIsBlank = cursor >= lines.length || !lines[cursor].trim()
      if (items.length === 1 && nextLineIsBlank && line.length <= 80) {
        addTextBlock('heading_2', line)
      } else {
        blocks.push({ ...createVideoNoteBlock('numbered_list'), items: items.filter(Boolean) })
      }
      index = cursor
      continue
    }
    const nextLine = lines[index + 1]?.trim() || ''
    if (line.length <= 80 && (/^第[一二三四五六七八九十百]+[层部分章节]/.test(line) || /[：:]$/.test(line))) {
      flushParagraph()
      addTextBlock('heading_2', line)
      index += 1
      continue
    }
    if (line.length <= 60 && !/[。！？!?；;：:]$/.test(line) && (!nextLine || index === 0)) {
      flushParagraph()
      addTextBlock(index === 0 ? 'heading_1' : 'heading_2', line)
      index += 1
      continue
    }

    paragraphLines.push(line)
    index += 1
  }
  flushParagraph()
  return blocks.filter((block) => block.text || block.items?.length)
}

function VideoNotesEditor({
  value,
  onChange
}: {
  value: CorporateEnglishVideoNoteBlock[]
  onChange: (blocks: CorporateEnglishVideoNoteBlock[]) => void
}) {
  const blocks = useMemo(() => Array.isArray(value) ? value : [], [value])
  const [importText, setImportText] = useState('')
  const noteCharacterCount = useMemo(() => blocks.reduce((sum, block) => sum + (block.text?.length || 0) + (block.items || []).reduce((itemSum, item) => itemSum + item.length, 0), 0), [blocks])
  const blockGroups = useMemo(() => {
    const groups: Array<{ id: string; title: string; items: Array<{ block: CorporateEnglishVideoNoteBlock; index: number }> }> = []
    blocks.forEach((block, index) => {
      if (block.type === 'heading_1' || groups.length === 0) {
        groups.push({ id: block.id, title: block.type === 'heading_1' ? (block.text || '未命名章节') : '开篇内容', items: [] })
      }
      groups[groups.length - 1].items.push({ block, index })
    })
    return groups
  }, [blocks])
  const applyImportedText = (mode: 'replace' | 'append', text = importText) => {
    const parsed = parseVideoNotesText(text)
    if (!parsed.length) return
    onChange(mode === 'replace' ? parsed : [...blocks, ...parsed])
  }
  const updateBlock = (index: number, patch: Partial<CorporateEnglishVideoNoteBlock>) => {
    onChange(blocks.map((block, blockIndex) => blockIndex === index ? { ...block, ...patch } : block))
  }
  const changeBlockType = (index: number, type: CorporateEnglishVideoNoteBlockType) => {
    const block = blocks[index]
    const isList = type === 'bullet_list' || type === 'numbered_list'
    updateBlock(index, isList
      ? { type, text: undefined, items: block.items?.length ? block.items : block.text ? [block.text] : [''] }
      : { type, items: undefined, text: block.text || block.items?.join('\n') || '' })
  }
  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    const next = [...blocks]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-2">
      <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 font-black text-slate-900"><Wand2 className="h-4 w-4 text-indigo-600" />智能导入整篇笔记</h4>
            <p className="mt-1 text-sm leading-6 text-slate-500">直接粘贴 Notion、Word 或 Markdown 文本，自动识别标题、段落、列表和引用。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary h-9 px-3 text-xs" disabled={!importText.trim()} onClick={() => applyImportedText('append')}>追加识别</button>
            <button type="button" className="btn-primary h-9 px-3 text-xs" disabled={!importText.trim()} onClick={() => applyImportedText('replace')}><Wand2 className="h-3.5 w-3.5" />重新识别并替换</button>
          </div>
        </div>
        <textarea
          className="input mt-3 min-h-[240px] w-full font-sans leading-7"
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text/plain')
            if (!pasted.trim()) return
            event.preventDefault()
            setImportText(pasted)
            applyImportedText(blocks.length ? 'append' : 'replace', pasted)
          }}
          placeholder={'粘贴整篇视频笔记，例如：\n\n# 国际远程技术求职完整方法\n\n## 真正的问题不是去哪里投\n\n正文内容……\n\n- 第一项\n- 第二项\n\n> 需要重点记住的结论'}
        />
        <p className="mt-2 text-xs font-semibold text-slate-400">粘贴后会立即识别；已有内容时默认追加，可使用“重新识别并替换”覆盖。</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-black text-slate-900">视频笔记</h4>
          <p className="mt-1 text-sm leading-6 text-slate-500">已识别 {blocks.length} 个内容块、{noteCharacterCount.toLocaleString('zh-CN')} 字。建议笔记正文 3,000-30,000 字，最多 60,000 字。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {VIDEO_NOTE_BLOCK_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="btn-secondary h-9 px-3 text-xs"
              onClick={() => onChange([...blocks, createVideoNoteBlock(option.value)])}
            >
              <Plus className="h-3.5 w-3.5" />
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {blocks.length ? (
        <div className="space-y-3">
          {blockGroups.map((group) => {
            const groupCharacters = group.items.reduce((sum, item) => sum + (item.block.text?.length || 0) + (item.block.items || []).reduce((itemSum, text) => itemSum + text.length, 0), 0)
            return (
              <details key={group.id} className="group rounded-xl border border-slate-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 marker:hidden">
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
                  <span className="min-w-0 flex-1 truncate font-black text-slate-900">{group.title}</span>
                  <span className="shrink-0 text-xs font-semibold text-slate-400">{group.items.length} 块 · {groupCharacters.toLocaleString('zh-CN')} 字</span>
                </summary>
                <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-3">
                  {group.items.map(({ block, index }) => {
                    const isList = block.type === 'bullet_list' || block.type === 'numbered_list'
                    return (
                      <div key={block.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="w-6 text-center text-xs font-black text-slate-400">{index + 1}</span>
                  <select
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
                    value={block.type}
                    onChange={(event) => changeBlockType(index, event.target.value as CorporateEnglishVideoNoteBlockType)}
                  >
                    {VIDEO_NOTE_BLOCK_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <div className="ml-auto flex items-center gap-1">
                    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={() => moveBlock(index, -1)} disabled={index === 0} aria-label="上移内容块">
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} aria-label="下移内容块">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" onClick={() => onChange(blocks.filter((_, blockIndex) => blockIndex !== index))} aria-label="删除内容块">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <textarea
                  className={`input w-full ${block.type === 'heading_1' || block.type === 'heading_2' ? 'min-h-[72px] font-bold' : 'min-h-[110px]'}`}
                  value={isList ? (block.items || []).join('\n') : (block.text || '')}
                  onChange={(event) => updateBlock(index, isList
                    ? { items: event.target.value.split('\n') }
                    : { text: event.target.value })}
                  placeholder={isList ? '每行填写一个列表项' : '填写内容'}
                />
                      </div>
                    )
                  })}
                </div>
              </details>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">暂无视频笔记，使用上方按钮添加内容块。</div>
      )}
    </section>
  )
}

function AdminModuleVideoManager({
  moduleKey,
  title,
  description,
  categoryType
}: {
  moduleKey: CorporateEnglishModuleKey
  title: string
  description: string
  categoryType?: ModuleCategoryType
}) {
  const [videos, setVideos] = useState<CorporateEnglishModuleVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingVideo, setEditingVideo] = useState<CorporateEnglishModuleVideo | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SaveCorporateEnglishModuleVideoPayload>(() => emptyModuleVideoForm(moduleKey))
  const [tagInput, setTagInput] = useState('')
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [statusFilter, setStatusFilter] = useState<CorporateEnglishStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('')
  const [coverCropDraft, setCoverCropDraft] = useState<CoverCropDraft | null>(null)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  const replaceCoverPreview = useCallback((file: File | null, existingUrl = '') => {
    setCoverPreviewUrl((current) => {
      if (current && current.startsWith('blob:')) URL.revokeObjectURL(current)
      return file ? URL.createObjectURL(file) : existingUrl
    })
  }, [])

  const isRemotePreparation = moduleKey === 'remote_preparation'
  const getDifficultyLevelLabel = useCallback((value?: string) => {
    return REMOTE_PREPARATION_LEVEL_OPTIONS.find((option) => option.value === value)?.label || ''
  }, [])

  const closeCoverCropDraft = useCallback(() => {
    setCoverCropDraft((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
  }, [])

  const loadVideos = useCallback(async () => {
    try {
      setLoading(true)
      const data = await corporateEnglishService.listModuleVideos({
        module: moduleKey,
        page,
        limit: 20,
        search,
        status: statusFilter
      })
      setVideos(data.videos)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Failed to load module videos:', error)
      setVideos([])
      setTotal(0)
      setTotalPages(1)
      if (!shouldSilenceLocalDatabaseError(error)) {
        alert(error instanceof Error ? error.message : '加载视频失败')
      }
    } finally {
      setLoading(false)
    }
  }, [moduleKey, page, search, statusFilter])

  useEffect(() => {
    let cancelled = false
    const loadTagConfig = async () => {
      if (!categoryType) {
        setCategoryOptions([])
        return
      }
      try {
        const response = await fetch('/api/data/trusted-companies?target=tags')
        const data = await response.json().catch(() => ({}))
        if (!cancelled && data?.success) {
          const options = data.config?.[categoryType]
          setCategoryOptions(Array.isArray(options) ? options : [])
        }
      } catch (error) {
        console.warn('Failed to load module video categories:', error)
      }
    }
    loadTagConfig()
    return () => {
      cancelled = true
    }
  }, [categoryType])

  useEffect(() => {
    setForm(emptyModuleVideoForm(moduleKey))
    setEditingVideo(null)
    setShowForm(false)
    setPage(1)
    setSearch('')
    setSearchDraft('')
  }, [moduleKey])

  useEffect(() => {
    loadVideos()
  }, [loadVideos])

  useEffect(() => {
    if (!showForm) return
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [showForm, editingVideo?.videoId])

  const openCreate = () => {
    closeCoverCropDraft()
    setEditingVideo(null)
    setForm(emptyModuleVideoForm(moduleKey))
    setTagInput('')
    setCoverFile(null)
    replaceCoverPreview(null, '')
    setShowForm(true)
  }

  const openEdit = (video: CorporateEnglishModuleVideo) => {
    closeCoverCropDraft()
    setEditingVideo(video)
    setForm({
      moduleKey,
      title: video.title,
      description: video.description,
      tencentIframeUrl: video.tencentIframeUrl,
      videoSource: video.videoSource,
      category: video.category,
      difficultyLevel: video.difficultyLevel || '',
      videoNotes: video.videoNotes || [],
      tags: video.tags,
      accessTier: video.accessTier,
      status: video.status,
      sortOrder: video.sortOrder,
      publishedAt: formatDateTimeInput(video.publishedAt),
      isFeatured: video.isFeatured === true
    })
    setTagInput(formatSimpleTags(video.tags))
    setCoverFile(null)
    replaceCoverPreview(null, video.coverThumbnailUrl || video.coverImageUrl || '')
    setShowForm(true)
  }

  const handleCoverFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传 jpg、png 或 webp 图片')
      return
    }
    if (file.size > MAX_COVER_IMAGE_BYTES) {
      alert('封面图片不能超过 8MB')
      return
    }
    const previewUrl = URL.createObjectURL(file)
    setCoverCropDraft({ file, previewUrl })
  }

  const applyCroppedCover = (file: File) => {
    setCoverFile(file)
    replaceCoverPreview(file)
    closeCoverCropDraft()
  }

  const saveVideo = async () => {
    if (!form.title.trim()) {
      alert('请填写视频标题')
      return
    }
    if (!form.tencentIframeUrl.trim()) {
      alert('请填写腾讯视频或 Bilibili iframe 地址')
      return
    }
    if (isRemotePreparation && !form.difficultyLevel) {
      alert('请选择远程准备级别')
      return
    }
    try {
      setSaving(true)
      const payload: SaveCorporateEnglishModuleVideoPayload = {
        ...form,
        moduleKey,
        tags: splitTagValues(tagInput),
        sortOrder: Number(form.sortOrder || 0),
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : new Date().toISOString()
      }
      const savedVideo = await corporateEnglishService.saveModuleVideo(payload, editingVideo?.videoId)
      if (coverFile) {
        await corporateEnglishService.uploadCoverImage({
          ownerType: 'module_video',
          ownerId: savedVideo.videoId,
          file: coverFile
        })
      }
      setShowForm(false)
      setEditingVideo(null)
      setCoverFile(null)
      replaceCoverPreview(null, '')
      await loadVideos()
      alert('保存成功')
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const deleteVideo = async (video: CorporateEnglishModuleVideo) => {
    if (!confirm(`确定删除「${video.title}」吗？`)) return
    try {
      await corporateEnglishService.deleteModuleVideo(video.videoId)
      await loadVideos()
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除失败')
    }
  }

  const runSearch = () => {
    setSearch(searchDraft.trim())
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className={showForm ? 'hidden' : 'flex flex-wrap items-center justify-between gap-3'}>
        <div>
          <h2 className="text-2xl font-black text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary h-12 px-4" onClick={loadVideos} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button type="button" className="btn-primary h-12 px-5" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            添加视频
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="card">
          {coverCropDraft ? (
            <CoverCropModal
              draft={coverCropDraft}
              onCancel={closeCoverCropDraft}
              onApply={applyCroppedCover}
            />
          ) : null}
          <div className="card-content space-y-4">
            <div className="sticky top-0 z-20 -mx-1 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-1 py-3 backdrop-blur">
              <h3 className="text-lg font-black text-slate-900">{editingVideo ? '编辑视频' : '新增视频'}</h3>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}><ArrowLeft className="h-4 w-4" />返回列表</button>
                <button type="button" className="btn-primary" onClick={saveVideo} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
                  {saving ? '保存中...' : '保存视频'}
                </button>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 lg:col-span-2">
                <span className="text-sm font-bold text-slate-700">视频封面</span>
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    className="relative aspect-video w-full max-w-[320px] overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-left transition hover:border-indigo-300"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {coverPreviewUrl ? (
                      <img src={coverPreviewUrl} alt="视频封面预览" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full flex-col items-center justify-center gap-2 text-sm font-bold text-slate-500">
                        <Upload className="h-6 w-6 text-indigo-600" />
                        上传 16:9 封面
                      </span>
                    )}
                  </button>
                  <div className="max-w-sm text-sm leading-6 text-slate-500">
                    上传后先手动确认 16:9 裁剪范围，再压缩为 WebP，生成列表缩略图和播放页大图。
                  </div>
                </div>
                <input ref={coverInputRef} type="file" className="hidden" accept="image/*" onChange={(event) => event.target.files?.[0] && handleCoverFile(event.target.files[0])} />
              </div>
              <label className="space-y-1">
                <span className="text-sm font-bold text-slate-700">视频标题</span>
                <input className="input" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-bold text-slate-700">视频 iframe 地址 / 腾讯 vid</span>
                <input className="input" value={form.tencentIframeUrl} onChange={(event) => setForm((prev) => ({ ...prev, tencentIframeUrl: event.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-bold text-slate-700">视频来源</span>
                <input className="input" value={form.videoSource || ''} onChange={(event) => setForm((prev) => ({ ...prev, videoSource: event.target.value }))} placeholder="可填写来源名称或链接" />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-bold text-slate-700">{isRemotePreparation ? '级别' : '类别'}</span>
                {isRemotePreparation ? (
                  <select className="input" value={form.difficultyLevel || ''} onChange={(event) => setForm((prev) => ({ ...prev, difficultyLevel: event.target.value, category: '' }))}>
                    <option value="">请选择级别</option>
                    {REMOTE_PREPARATION_LEVEL_OPTIONS.map((level) => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                ) : (
                  <select className="input" value={form.category || ''} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}>
                    <option value="">请选择类别</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                )}
              </label>
              <label className="space-y-1">
                <span className="text-sm font-bold text-slate-700">自定义标签</span>
                <input className="input" value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="用顿号、逗号或分号分隔" />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-bold text-slate-700">视频权限</span>
                <select className="input" value={form.accessTier} onChange={(event) => setForm((prev) => ({ ...prev, accessTier: event.target.value as 'free' | 'vip' }))}>
                  <option value="free">免费</option>
                  <option value="vip">会员</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-bold text-slate-700">状态</span>
                <select className="input" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as CorporateEnglishStatus }))}>
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                  <option value="archived">已归档</option>
                </select>
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={form.isFeatured === true} onChange={(event) => setForm((prev) => ({ ...prev, isFeatured: event.target.checked }))} />
                <span>
                  <span className="block text-sm font-bold text-slate-700">精选</span>
                  <span className="block text-xs text-slate-500">展示在首页职业成长模块</span>
                </span>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-bold text-slate-700">发布时间</span>
                <input type="datetime-local" className="input" value={form.publishedAt || ''} onChange={(event) => setForm((prev) => ({ ...prev, publishedAt: event.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-bold text-slate-700">排序</span>
                <input type="number" className="input" value={form.sortOrder || 0} onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value || 0) }))} />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-bold text-slate-700">简介</span>
              <textarea className="input min-h-[110px]" value={form.description || ''} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
            </label>
            {isRemotePreparation ? (
              <VideoNotesEditor
                value={form.videoNotes || []}
                onChange={(videoNotes) => setForm((prev) => ({ ...prev, videoNotes }))}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={showForm ? 'hidden' : 'card'}>
        <div className="card-content">
          <div className="mb-4 grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[minmax(260px,1fr)_180px]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                onBlur={runSearch}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch()
                }}
                placeholder="搜索视频标题、简介、来源、标签"
              />
            </div>
            <select className="h-12 rounded-lg border border-slate-200 px-3 py-2 text-slate-900" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as CorporateEnglishStatus | 'all'); setPage(1) }}>
              <option value="all">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">视频</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{isRemotePreparation ? '级别/标签' : '类别/标签'}</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">权限</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">发布时间</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                ) : videos.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">暂无视频，点击右上角添加。</td></tr>
                ) : videos.map((video) => (
                  <tr key={video.videoId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{video.title}</span>
                        {!video.coverImageHash ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">缺封面</span>
                        ) : null}
                      </div>
                      <div className="mt-1 max-w-[420px] truncate text-sm text-slate-500">{video.description || video.tencentIframeUrl}</div>
                      {video.videoSource ? (
                        <div className="mt-1 max-w-[420px] truncate text-xs font-semibold text-slate-400">来源：{video.videoSource}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div className="font-semibold text-slate-700">{isRemotePreparation ? (getDifficultyLevelLabel(video.difficultyLevel) || '-') : (video.category || '-')}</div>
                      <div className="mt-1 max-w-[300px] truncate text-xs text-slate-400">{formatSimpleTags(video.tags) || '无标签'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${video.accessTier === 'free' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {video.accessTier === 'free' ? '免费' : '会员'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{statusLabel(video.status)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{video.publishedAt ? new Date(video.publishedAt).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn-secondary" onClick={() => openEdit(video)}>
                          <Edit3 className="h-4 w-4" />
                          编辑
                        </button>
                        <button type="button" className="btn-secondary text-red-600" onClick={() => deleteVideo(video)}>
                          <Trash2 className="h-4 w-4" />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <span>共 {total} 条</span>
            <div className="flex items-center gap-2">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronRight className="h-4 w-4 rotate-180" />
                上一页
              </button>
              <span>{page} / {totalPages}</span>
              <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                下一页
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminCorporateEnglishPage() {
  const [activeSubModule, setActiveSubModule] = useState<AdminSubModule>('ceo')
  const [mode, setMode] = useState<Mode>('list')
  const [editingId, setEditingId] = useState<string>('')
  const [contextCompanyId, setContextCompanyId] = useState<string>('')
  const [companyGroups, setCompanyGroups] = useState<CompanyGroup[]>([])
  const [contextCompanyFallback, setContextCompanyFallback] = useState<TrustedCompany | null>(null)
  const [expandedCompanyId, setExpandedCompanyId] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [statusFilter, setStatusFilter] = useState<CorporateEnglishStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [editor, setEditor] = useState<EditorState>(() => emptyEditorState())
  const [profileDraft, setProfileDraft] = useState<CorporateEnglishCompanyProfile>(() => emptyProfile())
  const [bulkClipInput, setBulkClipInput] = useState('')
  const [profileBulkInputs, setProfileBulkInputs] = useState<Record<ProfileSectionKey, string>>({
    cultureSections: '',
    ceoThinkingSections: ''
  })
  const [companySearch, setCompanySearch] = useState('')
  const [companyResults, setCompanyResults] = useState<TrustedCompany[]>([])
  const [companyLoading, setCompanyLoading] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [materialCoverFile, setMaterialCoverFile] = useState<File | null>(null)
  const [materialCoverPreviewUrl, setMaterialCoverPreviewUrl] = useState('')
  const [materialCoverCropDraft, setMaterialCoverCropDraft] = useState<CoverCropDraft | null>(null)
  const [decodedAudio, setDecodedAudio] = useState<AudioBuffer | null>(null)
  const [audioObjectUrl, setAudioObjectUrl] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [generatingClipId, setGeneratingClipId] = useState('')
  const [expandedSubtitleCueClipIds, setExpandedSubtitleCueClipIds] = useState<Set<string>>(() => new Set())
  const audioInputRef = useRef<HTMLInputElement | null>(null)
  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const materialCoverInputRef = useRef<HTMLInputElement | null>(null)
  const audioObjectUrlRef = useRef('')
  const materialCoverObjectUrlRef = useRef('')
  const clipAudioObjectUrlsRef = useRef<string[]>([])

  const isEditing = mode === 'edit'
  const isProfileMode = mode === 'profile'
  const activeSubModuleMeta = ADMIN_SUB_MODULES.find((module) => module.key === activeSubModule) || ADMIN_SUB_MODULES[0]

  const contextCompany = useMemo(() => {
    if (!contextCompanyId) return null
    const group = companyGroups.find((company) => company.companyId === contextCompanyId)
    if (!group) return contextCompanyFallback?.id === contextCompanyId ? contextCompanyFallback : null
    return {
      id: group.companyId,
      name: group.companyName,
      website: group.companyWebsite || '',
      careersPage: '',
      isTrusted: true,
      canRefer: false,
      memberOnly: false,
      createdAt: '',
      updatedAt: group.latestUpdatedAt || ''
    } as TrustedCompany
  }, [companyGroups, contextCompanyFallback, contextCompanyId])

  const refreshModeFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    const urlMode = params.get('mode')
    const materialId = params.get('materialId') || ''
    const companyId = params.get('companyId') || ''
    if (urlMode === 'create') {
      setMode('create')
      setEditingId('')
      setContextCompanyId(companyId)
    } else if (urlMode === 'edit' && materialId) {
      setMode('edit')
      setEditingId(materialId)
      setContextCompanyId('')
    } else if (urlMode === 'profile' && companyId) {
      setMode('profile')
      setEditingId('')
      setContextCompanyId(companyId)
    } else {
      setMode('list')
      setEditingId('')
      setContextCompanyId('')
    }
  }, [])

  const setUrlMode = useCallback((nextMode: Mode, materialId = '', companyId = '') => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', 'corporate-english')
    if (nextMode === 'list') {
      params.delete('mode')
      params.delete('materialId')
      params.delete('companyId')
    } else {
      params.set('mode', nextMode)
      if (materialId) params.set('materialId', materialId)
      else params.delete('materialId')
      if (companyId) params.set('companyId', companyId)
      else params.delete('companyId')
    }
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`)
    refreshModeFromUrl()
  }, [refreshModeFromUrl])

  const renderSubModuleTabs = () => (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {ADMIN_SUB_MODULES.map((module) => {
        const active = activeSubModule === module.key
        return (
          <button
            key={module.key}
            type="button"
            onClick={() => {
              setActiveSubModule(module.key)
              if (module.key !== 'ceo') setUrlMode('list')
            }}
            className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-black transition ${
              active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            {module.label}
          </button>
        )
      })}
    </div>
  )

  const replaceAudioObjectUrl = useCallback((file: File | null) => {
    if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current)
    if (!file) {
      audioObjectUrlRef.current = ''
      setAudioObjectUrl('')
      return ''
    }
    const nextUrl = URL.createObjectURL(file)
    audioObjectUrlRef.current = nextUrl
    setAudioObjectUrl(nextUrl)
    return nextUrl
  }, [])

  const replaceMaterialCoverPreview = useCallback((file: File | null, existingUrl = '') => {
    if (materialCoverObjectUrlRef.current) {
      URL.revokeObjectURL(materialCoverObjectUrlRef.current)
      materialCoverObjectUrlRef.current = ''
    }
    if (!file) {
      setMaterialCoverPreviewUrl(existingUrl)
      return existingUrl
    }
    const nextUrl = URL.createObjectURL(file)
    materialCoverObjectUrlRef.current = nextUrl
    setMaterialCoverPreviewUrl(nextUrl)
    return nextUrl
  }, [])

  const closeMaterialCoverCropDraft = useCallback(() => {
    setMaterialCoverCropDraft((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl)
      return null
    })
  }, [])

  const revokeClipAudioObjectUrls = useCallback(() => {
    clipAudioObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    clipAudioObjectUrlsRef.current = []
  }, [])

  const registerClipAudioObjectUrl = useCallback((url: string) => {
    clipAudioObjectUrlsRef.current.push(url)
    return url
  }, [])

  const loadMaterials = useCallback(async () => {
    if (mode !== 'list') return
    try {
      setLoading(true)
      const data = await corporateEnglishService.listCompanyGroups({
        page,
        limit: 20,
        search,
        status: statusFilter
      })
      setCompanyGroups(data.companies)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Failed to load corporate English materials:', error)
      setCompanyGroups([])
      setTotal(0)
      setTotalPages(1)
      if (!shouldSilenceLocalDatabaseError(error)) {
        alert(error instanceof Error ? error.message : '加载外企英语素材失败')
      }
    } finally {
      setLoading(false)
    }
  }, [mode, page, search, statusFilter])

  useEffect(() => {
    refreshModeFromUrl()
    const onPopState = () => refreshModeFromUrl()
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      if (audioObjectUrlRef.current) URL.revokeObjectURL(audioObjectUrlRef.current)
      revokeClipAudioObjectUrls()
    }
  }, [refreshModeFromUrl, revokeClipAudioObjectUrls])

  useEffect(() => {
    loadMaterials()
  }, [loadMaterials])

  useEffect(() => {
    if (!contextCompanyId || contextCompany || mode === 'list') return
    let cancelled = false
    const loadContextCompany = async () => {
      const company = await trustedCompaniesService.getCompanyById(contextCompanyId)
      if (!cancelled && company) setContextCompanyFallback(company)
    }
    loadContextCompany()
    return () => {
      cancelled = true
    }
  }, [contextCompany, contextCompanyId, mode])

  useEffect(() => {
    if (mode === 'create') {
      const nextEditor = emptyEditorState()
      if (contextCompany) nextEditor.selectedCompany = contextCompany
      setEditor(nextEditor)
      setProfileDraft(emptyProfile())
      setBulkClipInput('')
      setProfileBulkInputs({ cultureSections: '', ceoThinkingSections: '' })
      setAudioFile(null)
      setCsvFile(null)
      setMaterialCoverFile(null)
      closeMaterialCoverCropDraft()
      replaceMaterialCoverPreview(null)
      setDecodedAudio(null)
      replaceAudioObjectUrl(null)
      revokeClipAudioObjectUrls()
    }
  }, [closeMaterialCoverCropDraft, contextCompany, mode, replaceAudioObjectUrl, replaceMaterialCoverPreview, revokeClipAudioObjectUrls])

  useEffect(() => {
    if (mode !== 'edit' || !editingId) return
    let cancelled = false
    const loadDetail = async () => {
      try {
        setLoading(true)
        const detail = await corporateEnglishService.getMaterial(editingId)
        if (cancelled) return
        const company: TrustedCompany = {
          id: detail.material.companyId,
          name: detail.material.companyName,
          website: detail.material.companyWebsite || '',
          careersPage: '',
          isTrusted: true,
          canRefer: false,
          memberOnly: false,
          createdAt: detail.material.createdAt,
          updatedAt: detail.material.updatedAt
        }
        const clips = await Promise.all(detail.clips.map(async (clip) => {
          let clipAudioUrl = ''
          if (clip.clipAudioAssetId) {
            try {
              const blob = await corporateEnglishService.downloadAsset(clip.clipAudioAssetId)
              clipAudioUrl = URL.createObjectURL(blob)
            } catch (error) {
              console.warn('Failed to load saved clip audio preview:', error)
            }
          }
          return {
            ...clip,
            localId: clip.clipId || crypto.randomUUID(),
            startTimecode: formatTime(clip.startMs),
            endTimecode: formatTime(clip.endMs),
            clipTagInput: formatClipTags(clip.clipTags || []),
            clipTags: normalizeClipTags(clip.clipTags || []),
            pronunciationMarkInput: formatPronunciationMarks(clip.pronunciationMarks || []),
            pronunciationMarks: normalizePronunciationMarks(clip.pronunciationMarks || []),
            clipAudioUrl: clipAudioUrl || undefined
          }
        }))
        if (cancelled) {
          clips.forEach((clip) => {
            if (clip.clipAudioUrl) URL.revokeObjectURL(clip.clipAudioUrl)
          })
          return
        }
        revokeClipAudioObjectUrls()
        clips.forEach((clip) => {
          if (clip.clipAudioUrl) registerClipAudioObjectUrl(clip.clipAudioUrl)
        })
        setEditor({
          materialId: detail.material.materialId,
          selectedCompany: company,
          materialTitle: detail.material.materialTitle,
          speakerName: detail.material.speakerName,
          speakerRole: detail.material.speakerRole,
          speakerEmail: detail.material.speakerEmail || '',
          speakerLinkedin: detail.material.speakerLinkedin || '',
          tencentVideoInput: detail.material.tencentVideoVid || detail.material.tencentVideoUrl || '',
          sourceVideoUrl: detail.material.sourceVideoUrl || '',
          videoSummary: detail.material.videoSummary || '',
          coverImageUrl: detail.material.coverImageUrl || '',
          coverThumbnailUrl: detail.material.coverThumbnailUrl || '',
          sequence: detail.material.sequence || 0,
          status: detail.material.status,
          isFeatured: detail.material.isFeatured === true,
          sourceAudioAssetId: detail.material.sourceAudioAssetId,
          subtitleCsvAssetId: detail.material.subtitleCsvAssetId,
          durationMs: detail.material.durationMs,
          subtitleRows: detail.material.normalizedSubtitleRows || [],
          clips
        })
        setBulkClipInput('')
        setAudioFile(null)
        setCsvFile(null)
        setMaterialCoverFile(null)
        closeMaterialCoverCropDraft()
        replaceMaterialCoverPreview(null, detail.material.coverThumbnailUrl || detail.material.coverImageUrl || '')
        setDecodedAudio(null)
        replaceAudioObjectUrl(null)
      } catch (error) {
        console.error('Failed to load material:', error)
        if (!shouldSilenceLocalDatabaseError(error)) {
          alert(error instanceof Error ? error.message : '加载素材失败')
        }
        setUrlMode('list')
      } finally {
        setLoading(false)
      }
    }
    loadDetail()
    return () => {
      cancelled = true
    }
  }, [closeMaterialCoverCropDraft, editingId, mode, registerClipAudioObjectUrl, replaceAudioObjectUrl, replaceMaterialCoverPreview, revokeClipAudioObjectUrls, setUrlMode])

  useEffect(() => {
    if (!companySearch.trim()) {
      setCompanyResults([])
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        setCompanyLoading(true)
        const data = await trustedCompaniesService.getAllCompanies({
          page: 1,
          limit: 8,
          search: companySearch,
          isTrusted: 'yes'
        })
        setCompanyResults(Array.isArray(data) ? data : data.companies || [])
      } catch (error) {
        console.error('Failed to search trusted companies:', error)
      } finally {
        setCompanyLoading(false)
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [companySearch])

  useEffect(() => {
    const companyId = contextCompanyId
    if (mode !== 'profile' || !companyId) return
    let cancelled = false
    const loadProfile = async () => {
      const profile = await corporateEnglishService.getCompanyProfile(companyId).catch(() => null)
      if (!cancelled) {
        setProfileDraft(profile || emptyProfile(companyId))
        setProfileBulkInputs({ cultureSections: '', ceoThinkingSections: '' })
      }
    }
    loadProfile()
    return () => {
      cancelled = true
    }
  }, [contextCompanyId, mode])

  const clipSummaryText = useMemo(() => {
    return editor.clips
      .map((clip, index) => formatClipCopyText(clip, index))
      .join('\n\n')
  }, [editor.clips])

  const updateEditor = (patch: Partial<EditorState>) => {
    setEditor((prev) => ({ ...prev, ...patch }))
  }

  const runSearch = useCallback(() => {
    setPage(1)
    setSearch(searchDraft.trim())
  }, [searchDraft])

  const handleMaterialCoverFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传 jpg、png 或 webp 图片')
      return
    }
    if (file.size > MAX_COVER_IMAGE_BYTES) {
      alert('封面图片不能超过 8MB')
      return
    }
    const previewUrl = URL.createObjectURL(file)
    setMaterialCoverCropDraft({ file, previewUrl })
  }

  const applyCroppedMaterialCover = (file: File) => {
    setMaterialCoverFile(file)
    replaceMaterialCoverPreview(file)
    closeMaterialCoverCropDraft()
  }

  const handleAudioFile = async (file: File) => {
    if (!isAcceptedAudioFile(file)) {
      alert('请上传 mp3、wav、m4a、aac 等主流音频格式')
      return
    }
    if (file.size > MAX_SOURCE_AUDIO_BYTES) {
      alert('原始音频用于浏览器本地处理，建议不超过 500MB；请先拆分后再上传')
      return
    }
    const objectUrl = replaceAudioObjectUrl(file)
    try {
      setAudioLoading(true)
      const durationMs = await readAudioDurationMs(objectUrl)
      setAudioFile(file)
      setDecodedAudio(null)
      updateEditor({
        sourceAudioAssetId: null,
        durationMs
      })
    } catch (error) {
      console.error('Failed to decode audio:', error)
      replaceAudioObjectUrl(null)
      alert(error instanceof Error ? error.message : '音频解析失败，请确认文件格式为 mp3、wav、m4a、aac 等主流音频格式')
    } finally {
      setAudioLoading(false)
    }
  }

  const loadSavedSourceAudio = async () => {
    const assetId = editor.sourceAudioAssetId
    if (!assetId) return
    try {
      setAudioLoading(true)
      const blob = await corporateEnglishService.downloadAsset(assetId)
      const mimeType = blob.type || 'audio/mpeg'
      const extension = mimeType.includes('wav')
        ? 'wav'
        : mimeType.includes('mp4') || mimeType.includes('aac')
          ? 'm4a'
          : mimeType.includes('ogg')
            ? 'ogg'
            : mimeType.includes('webm')
              ? 'webm'
              : 'mp3'
      const file = new File([blob], `saved-source-audio.${extension}`, { type: mimeType })
      await handleAudioFile(file)
      updateEditor({ sourceAudioAssetId: assetId })
    } catch (error) {
      console.error('Failed to load saved source audio:', error)
      alert(error instanceof Error ? error.message : '加载草稿原音频失败')
    } finally {
      setAudioLoading(false)
    }
  }

  const handleCsvFile = async (file: File) => {
    if (file.size > MAX_CSV_BYTES) {
      alert('CSV 文件不能超过 2MB')
      return
    }
    try {
      const text = await file.text()
      const rows = parseSubtitleCsv(text)
      setCsvFile(file)
      updateEditor({
        subtitleCsvAssetId: null,
        subtitleRows: rows,
        materialTitle: editor.materialTitle || rows.find((row) => row.source_title)?.source_title || file.name.replace(/\.[^.]+$/, '')
      })
    } catch (error) {
      console.error('Failed to parse CSV:', error)
      alert(error instanceof Error ? error.message : 'CSV 解析失败')
    }
  }

  const ensureDecodedAudio = async () => {
    if (decodedAudio) return decodedAudio
    if (audioFile) {
      const buffer = await decodeAudioBlob(audioFile)
      setDecodedAudio(buffer)
      return buffer
    }
    throw new Error('当前没有可用于重新剪辑的原始音频；请重新上传原始音频后再生成剪辑。')
  }

  const addClip = (afterLocalId?: string) => {
    if (editor.clips.length >= MAX_CLIPS) {
      alert(`单个素材最多支持 ${MAX_CLIPS} 个剪辑段`)
      return
    }
    const insertIndex = afterLocalId
      ? Math.max(0, editor.clips.findIndex((clip) => clip.localId === afterLocalId) + 1)
      : editor.clips.length
    const previousClip = insertIndex > 0 ? editor.clips[insertIndex - 1] : null
    const durationMs = Number(editor.durationMs || 0)
    const rawStartMs = previousClip ? previousClip.endMs : 0
    const startMs = durationMs > 0 ? Math.min(rawStartMs, Math.max(0, durationMs - 5000)) : rawStartMs
    const maxEndMs = durationMs > 0 ? durationMs : startMs + 5000
    const desiredEndMs = Math.min(maxEndMs, startMs + 5000)
    const endMs = durationMs > 0 ? Math.max(startMs, desiredEndMs) : Math.max(startMs + 1000, desiredEndMs)
    const text = extractSubtitle(editor.subtitleRows, startMs, endMs)
    const nextClips = [...editor.clips]
    nextClips.splice(insertIndex, 0, {
      localId: crypto.randomUUID(),
      sequence: insertIndex,
      clipTitle: `片段 ${insertIndex + 1}`,
      startMs,
      endMs,
      startTimecode: formatTime(startMs),
      endTimecode: formatTime(endMs),
      subtitleText: text.subtitleText,
      translationText: text.translationText,
      subtitleCues: text.subtitleCues,
      clipTagInput: '',
      clipTags: [],
      pronunciationMarkInput: '',
      pronunciationMarks: [],
      status: editor.status
    })
    updateEditor({
      clips: nextClips.map((clip, index) => ({ ...clip, sequence: index }))
    })
  }

  const updateClip = (localId: string, patch: Partial<EditableClip>) => {
    updateEditor({
      clips: editor.clips.map((clip) => {
        if (clip.localId !== localId) return clip
        const next = { ...clip, ...patch }
        if (patch.startTimecode !== undefined || patch.endTimecode !== undefined) {
          const startMs = parseTimecode(next.startTimecode)
          const endMs = parseTimecode(next.endTimecode)
          if (startMs !== null) next.startMs = startMs
          if (endMs !== null) next.endMs = endMs
          if (next.clipAudioUrl && clipAudioObjectUrlsRef.current.includes(next.clipAudioUrl)) {
            URL.revokeObjectURL(next.clipAudioUrl)
            clipAudioObjectUrlsRef.current = clipAudioObjectUrlsRef.current.filter((url) => url !== next.clipAudioUrl)
          }
          next.clipAudioAssetId = null
          next.clipBlob = undefined
          next.clipAudioUrl = undefined
          next.clipMimeType = undefined
          next.clipExtension = undefined
          const text = extractSubtitle(editor.subtitleRows, next.startMs, next.endMs)
          next.subtitleText = text.subtitleText
          next.translationText = text.translationText
          next.subtitleCues = text.subtitleCues
        }
        return next
      })
    })
  }

  const rebuildClipTextFromCues = (clip: EditableClip, subtitleCues: CorporateEnglishSubtitleCue[]): EditableClip => ({
    ...clip,
    subtitleCues,
    subtitleText: subtitleCues.map((cue) => String(cue.subtitleText || '').trim()).filter(Boolean).join('\n'),
    translationText: subtitleCues.map((cue) => String(cue.translationText || '').trim()).filter(Boolean).join('\n')
  })

  const updateClipSubtitleCue = (localId: string, cueIndex: number, patch: Partial<CorporateEnglishSubtitleCue>) => {
    updateEditor({
      clips: editor.clips.map((clip) => {
        if (clip.localId !== localId) return clip
        const subtitleCues = [...(clip.subtitleCues || [])]
        const current = subtitleCues[cueIndex] || { startMs: 0, endMs: 1000, subtitleText: '', translationText: '' }
        const nextCue = {
          ...current,
          ...patch,
          startMs: Math.max(0, Number(patch.startMs ?? current.startMs ?? 0)),
          endMs: Math.max(0, Number(patch.endMs ?? current.endMs ?? 0)),
          subtitleText: String(patch.subtitleText ?? current.subtitleText ?? ''),
          translationText: String(patch.translationText ?? current.translationText ?? '')
        }
        if (nextCue.endMs <= nextCue.startMs) nextCue.endMs = nextCue.startMs + 500
        subtitleCues[cueIndex] = nextCue
        return rebuildClipTextFromCues(clip, subtitleCues)
      })
    })
  }

  const addClipSubtitleCue = (localId: string) => {
    updateEditor({
      clips: editor.clips.map((clip) => {
        if (clip.localId !== localId) return clip
        const subtitleCues = [...(clip.subtitleCues || [])]
        const previousCue = subtitleCues[subtitleCues.length - 1]
        const startMs = previousCue ? previousCue.endMs : 0
        const endMs = Math.min(clip.endMs - clip.startMs, startMs + 1000)
        subtitleCues.push({
          startMs,
          endMs: Math.max(startMs + 500, endMs),
          subtitleText: '',
          translationText: ''
        })
        return rebuildClipTextFromCues(clip, subtitleCues)
      })
    })
  }

  const removeClipSubtitleCue = (localId: string, cueIndex: number) => {
    updateEditor({
      clips: editor.clips.map((clip) => {
        if (clip.localId !== localId) return clip
        const subtitleCues = (clip.subtitleCues || []).filter((_, index) => index !== cueIndex)
        return rebuildClipTextFromCues(clip, subtitleCues)
      })
    })
  }

  const toggleClipSubtitleCues = (localId: string) => {
    setExpandedSubtitleCueClipIds((prev) => {
      const next = new Set(prev)
      if (next.has(localId)) {
        next.delete(localId)
      } else {
        next.add(localId)
      }
      return next
    })
  }

  const updatePronunciationMarkInput = (localId: string, value: string) => {
    updateClip(localId, {
      pronunciationMarkInput: value,
      pronunciationMarks: parsePronunciationMarks(value)
    })
  }

  const generatePronunciationDraft = (localId: string) => {
    const clip = editor.clips.find((item) => item.localId === localId)
    if (!clip) return
    const marks = inferPronunciationMarks(clip.subtitleText, editor.subtitleRows, clip.startMs, clip.endMs)
    updateClip(localId, {
      pronunciationMarks: marks,
      pronunciationMarkInput: formatPronunciationMarks(marks)
    })
  }

  const updateClipTagInput = (localId: string, value: string) => {
    updateClip(localId, {
      clipTagInput: value,
      clipTags: parseClipTags(value)
    })
  }

  const applyBulkClipConfig = (mode: BulkApplyMode) => {
    try {
      const parsedClips = parseBulkClipConfig(bulkClipInput, editor.subtitleRows)
      if (parsedClips.length === 0) {
        alert('没有解析到剪辑片段，请检查时间戳标题行格式。')
        return
      }
      const baseClips = mode === 'append' ? editor.clips : []
      if (baseClips.length + parsedClips.length > MAX_CLIPS) {
        alert(`单个素材最多支持 ${MAX_CLIPS} 个剪辑段，当前批量结果超出限制。`)
        return
      }
      const nextClips: EditableClip[] = parsedClips.map((clip, index) => {
        const clipTagInput = clip.clipTagInput || ''
        const pronunciationMarkInput = clip.pronunciationMarkInput || ''
        return {
          localId: crypto.randomUUID(),
          sequence: baseClips.length + index,
          clipTitle: clip.title || `片段 ${baseClips.length + index + 1}`,
          startMs: clip.startMs,
          endMs: clip.endMs,
          startTimecode: formatTime(clip.startMs),
          endTimecode: formatTime(clip.endMs),
          subtitleText: clip.subtitleText || '',
          translationText: clip.translationText || '',
          subtitleCues: clip.subtitleCues || [],
          clipTagInput,
          clipTags: parseClipTags(clipTagInput),
          pronunciationMarkInput,
          pronunciationMarks: parsePronunciationMarks(pronunciationMarkInput),
          status: editor.status
        }
      })
      updateEditor({
        clips: [...baseClips, ...nextClips].map((clip, index) => ({ ...clip, sequence: index }))
      })
      alert(`已解析 ${nextClips.length} 个剪辑段，请校验后生成剪辑音频并保存。`)
    } catch (error) {
      alert(error instanceof Error ? error.message : '批量解析失败')
    }
  }

  const buildGeneratedClipPatch = async (clip: EditableClip, source: AudioBuffer): Promise<Partial<EditableClip>> => {
    if (clip.endMs <= clip.startMs) {
      throw new Error(`「${clip.clipTitle || '未命名片段'}」结束时间必须晚于起始时间`)
    }
    if (editor.durationMs && clip.endMs > editor.durationMs + 500) {
      throw new Error(`「${clip.clipTitle || '未命名片段'}」剪辑结束时间超过音频总时长`)
    }
    const { blob, mimeType, extension } = encodeSpeechWavClip(clipAudioBuffer(source, clip.startMs, clip.endMs))
    if (blob.size > MAX_CLIP_BYTES) {
      throw new Error(`「${clip.clipTitle || '未命名片段'}」音频超过 3MB，请缩短时间段。`)
    }
    if (blob.size <= 0) {
      throw new Error(`「${clip.clipTitle || '未命名片段'}」剪辑音频为空，请检查起止时间或原始音频格式。`)
    }
    const url = registerClipAudioObjectUrl(URL.createObjectURL(blob))
    const text = extractSubtitle(editor.subtitleRows, clip.startMs, clip.endMs)
    const subtitleText = clip.subtitleText || text.subtitleText
    const subtitleCues = clip.subtitleCues?.length ? clip.subtitleCues : text.subtitleCues
    const pronunciationMarks = clip.pronunciationMarks?.length
      ? clip.pronunciationMarks
      : inferPronunciationMarks(subtitleText, editor.subtitleRows, clip.startMs, clip.endMs)

    return {
      clipBlob: blob,
      clipAudioUrl: url,
      clipMimeType: mimeType,
      clipExtension: extension,
      clipAudioAssetId: null,
      subtitleText,
      translationText: clip.translationText || text.translationText,
      subtitleCues,
      pronunciationMarks,
      pronunciationMarkInput: clip.pronunciationMarkInput || formatPronunciationMarks(pronunciationMarks)
    }
  }

  const generateClip = async (localId: string) => {
    try {
      setGeneratingClipId(localId)
      const clip = editor.clips.find((item) => item.localId === localId)
      if (!clip) return
      const source = await ensureDecodedAudio()
      const patch = await buildGeneratedClipPatch(clip, source)
      if (clip.clipAudioUrl) {
        URL.revokeObjectURL(clip.clipAudioUrl)
        clipAudioObjectUrlsRef.current = clipAudioObjectUrlsRef.current.filter((url) => url !== clip.clipAudioUrl)
      }
      updateClip(localId, {
        ...patch
      })
    } catch (error) {
      console.error('Failed to generate clip:', error)
      alert(error instanceof Error ? error.message : '生成剪辑失败')
    } finally {
      setGeneratingClipId('')
    }
  }

  const generateAllClips = async () => {
    if (editor.clips.length === 0) {
      alert('请先添加或批量解析剪辑段')
      return
    }
    try {
      setGeneratingClipId('__all__')
      const source = await ensureDecodedAudio()
      const nextClips: EditableClip[] = []
      for (const clip of editor.clips) {
        const patch = await buildGeneratedClipPatch(clip, source)
        if (clip.clipAudioUrl) {
          URL.revokeObjectURL(clip.clipAudioUrl)
          clipAudioObjectUrlsRef.current = clipAudioObjectUrlsRef.current.filter((url) => url !== clip.clipAudioUrl)
        }
        nextClips.push({ ...clip, ...patch })
      }
      updateEditor({ clips: nextClips.map((clip, index) => ({ ...clip, sequence: index })) })
      alert(`已生成 ${nextClips.length} 个剪辑音频，请校验后保存。`)
    } catch (error) {
      console.error('Failed to generate all clips:', error)
      alert(error instanceof Error ? error.message : '批量生成剪辑失败')
    } finally {
      setGeneratingClipId('')
    }
  }

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text)
    alert('已复制')
  }

  function formatClipCopyText(clip: EditableClip, index: number) {
    const title = clip.clipTitle || `片段 ${index + 1}`
    const tags = normalizeClipTags(clip.clipTags)
      .map((group) => `${group.title}：${group.tags.map((tag) => `#${tag}`).join(' ')}`)
      .join('\n')
    const pronunciation = formatPronunciationMarks(clip.pronunciationMarks)

    return [
      `标题：${title}`,
      `分段：${clip.startTimecode}-${clip.endTimecode}`,
      tags ? `标签：\n${tags}` : '',
      pronunciation ? `跟读标注：\n${pronunciation}` : '',
      clip.subtitleText ? `原文：\n${clip.subtitleText}` : '',
      clip.translationText ? `翻译：\n${clip.translationText}` : ''
    ].filter(Boolean).join('\n')
  }

  const getClipSourceBlob = async (clip: EditableClip) => {
    if (clip.clipBlob) return clip.clipBlob
    if (clip.clipAudioAssetId) return corporateEnglishService.downloadAsset(clip.clipAudioAssetId)
    return null
  }

  const convertClipBlobForDownload = async (blob: Blob, format: ClipDownloadFormat) => {
    if (format === 'compressed') {
      const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('wav') ? 'wav' : blob.type.includes('mp4') ? 'm4a' : 'webm'
      return { blob, extension }
    }

    const decoded = await decodeAudioBlob(blob)
    if (format === 'wav') {
      return { blob: encodeWav(decoded), extension: 'wav' }
    }

    const m4aMimeType = getM4aAudioMimeType()
    if (!m4aMimeType) {
      throw new Error('当前浏览器不支持导出 M4A，请选择 WAV 格式')
    }
    const encoded = await encodeAudioBufferWithMediaRecorder(decoded, m4aMimeType, 'm4a', 96000)
    return { blob: encoded.blob, extension: encoded.extension }
  }

  const downloadClip = async (clip: EditableClip, index: number) => {
    try {
      const sourceBlob = await getClipSourceBlob(clip)
      if (!sourceBlob) {
        alert('请先生成剪辑音频')
        return
      }
      const format = clip.downloadFormat || 'wav'
      const { blob, extension } = await convertClipBlobForDownload(sourceBlob, format)
      downloadBlob(blob, `${editor.materialTitle || 'clip'}-${index + 1}.${extension}`)
    } catch (error) {
      console.error('Failed to download clip:', error)
      alert(error instanceof Error ? error.message : '下载剪辑音频失败')
      return
    }
  }

  const validateBeforeSave = () => {
    if (!editor.selectedCompany?.id) return '请选择可信企业'
    if (!editor.materialTitle.trim()) return '请填写音频素材标题'
    if (!editor.speakerName.trim()) return '请填写素材人物名称'
    if (!editor.speakerRole.trim()) return '请填写人物职业'
    if (!audioFile && !isEditing) return '请上传音频素材'
    if (isEditing && !audioFile && !editor.sourceAudioAssetId && editor.clips.some((clip) => !clip.clipAudioAssetId)) return '重新生成剪辑需要重新上传原始音频'
    if (editor.subtitleRows.length === 0) return '字幕 CSV 解析结果为空'
    for (const [index, clip] of editor.clips.entries()) {
      if (clip.endMs <= clip.startMs) return `第 ${index + 1} 段剪辑时间无效`
      if (!clip.clipBlob && !clip.clipAudioAssetId) return `第 ${index + 1} 段剪辑需要先生成音频`
    }
    return ''
  }

  const handleSave = async () => {
    const error = validateBeforeSave()
    if (error) {
      alert(error)
      return
    }
    try {
      setSaving(true)
      const companyId = editor.selectedCompany!.id
      const sourceAudioAssetId = null
      const subtitleCsvAssetId = null

      const uploadedClips: EditableClip[] = []
      for (const [index, clip] of editor.clips.entries()) {
        let clipAudioAssetId = clip.clipAudioAssetId || null
        if (clip.clipBlob) {
          const extension = clip.clipExtension || (clip.clipMimeType?.includes('wav') ? 'wav' : 'webm')
          const asset = await corporateEnglishService.uploadAsset({
            blob: clip.clipBlob,
            filename: `${editor.materialTitle || 'clip'}-${index + 1}.${extension}`,
            mimeType: clip.clipMimeType || clip.clipBlob.type || 'audio/webm',
            assetKind: 'clip_audio',
            companyId,
            materialId: editor.materialId,
            onProgress: (progress) => {
              updateEditor({
                clips: editor.clips.map((item) => item.localId === clip.localId ? { ...item, uploadProgress: progress } : item)
              })
            }
          })
          clipAudioAssetId = asset.assetId
        }
        uploadedClips.push({
          ...clip,
          clipAudioAssetId,
          clipBlob: undefined,
          uploadProgress: undefined,
          sequence: index,
          status: editor.status
        })
      }

      const materialId = await corporateEnglishService.saveMaterial({
        companyId,
        companyName: editor.selectedCompany!.name,
        companyWebsite: editor.selectedCompany!.website,
        materialTitle: editor.materialTitle.trim(),
        speakerName: editor.speakerName.trim(),
        speakerRole: editor.speakerRole.trim(),
        speakerEmail: editor.speakerEmail.trim(),
        speakerLinkedin: editor.speakerLinkedin.trim(),
        tencentVideoVid: editor.tencentVideoInput.trim(),
        tencentVideoUrl: editor.tencentVideoInput.trim(),
        sourceVideoUrl: editor.sourceVideoUrl.trim(),
        videoSummary: editor.videoSummary.trim(),
        sequence: editor.sequence,
        sourceAudioAssetId,
        subtitleCsvAssetId,
        normalizedSubtitleRows: editor.subtitleRows,
        status: editor.status,
        isFeatured: editor.isFeatured,
        durationMs: editor.durationMs || null,
        clips: uploadedClips
      }, isEditing ? editor.materialId : undefined)
      if (materialCoverFile) {
        await corporateEnglishService.uploadCoverImage({
          ownerType: 'material',
          ownerId: materialId,
          file: materialCoverFile
        })
      }

      alert('保存成功')
      setEditor((prev) => ({ ...prev, materialId, sourceAudioAssetId, subtitleCsvAssetId, clips: uploadedClips }))
      setMaterialCoverFile(null)
      setUrlMode('list')
      loadMaterials()
    } catch (saveError) {
      console.error('Failed to save material:', saveError)
      alert(saveError instanceof Error ? saveError.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (material: CorporateEnglishMaterial) => {
    if (!window.confirm(`确认删除「${material.materialTitle}」吗？`)) return
    try {
      await corporateEnglishService.deleteMaterial(material.materialId)
      loadMaterials()
    } catch (error) {
      console.error('Failed to delete material:', error)
      alert(error instanceof Error ? error.message : '删除失败')
    }
  }

  const handleSaveProfile = async () => {
    if (!contextCompanyId) {
      alert('缺少企业 ID')
      return
    }
    try {
      setSaving(true)
      await corporateEnglishService.saveCompanyProfile({
        ...profileDraft,
        companyId: contextCompanyId,
        cultureSections: profileDraft.cultureSections,
        ceoThinkingSections: profileDraft.ceoThinkingSections,
        otherResources: profileDraft.otherResources || [],
        accessTier: profileDraft.accessTier || 'vip',
        status: profileDraft.status,
        sortOrder: profileDraft.sortOrder
      })
      alert('企业配置已保存')
      setUrlMode('list')
      loadMaterials()
    } catch (error) {
      console.error('Failed to save company profile:', error)
      alert(error instanceof Error ? error.message : '保存企业配置失败')
    } finally {
      setSaving(false)
    }
  }

  const updateProfileSection = (
    key: 'cultureSections' | 'ceoThinkingSections',
    index: number,
    patch: Partial<CorporateEnglishContentSection>
  ) => {
    setProfileDraft((prev) => ({
      ...prev,
      [key]: prev[key].map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section)
    }))
  }

  const addProfileSection = (key: 'cultureSections' | 'ceoThinkingSections') => {
    setProfileDraft((prev) => ({
      ...prev,
      [key]: [...prev[key], { title: '', body: '' }]
    }))
  }

  const removeProfileSection = (key: 'cultureSections' | 'ceoThinkingSections', index: number) => {
    setProfileDraft((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, sectionIndex) => sectionIndex !== index)
    }))
  }

  const applyProfileBulkSections = (key: ProfileSectionKey, mode: BulkApplyMode) => {
    try {
      const sections = parseProfileBulkSections(profileBulkInputs[key])
      if (sections.length === 0) {
        alert('没有解析到配置内容，请检查「标题｜内容」格式。')
        return
      }
      setProfileDraft((prev) => ({
        ...prev,
        [key]: mode === 'append' ? [...prev[key], ...sections] : sections
      }))
      alert(`已解析 ${sections.length} 条，可继续校验后保存。`)
    } catch (error) {
      alert(error instanceof Error ? error.message : '批量解析失败')
    }
  }

  const updateResourceLink = (index: number, patch: Partial<CorporateEnglishResourceLink>) => {
    setProfileDraft((prev) => ({
      ...prev,
      otherResources: (prev.otherResources || []).map((resource, resourceIndex) => resourceIndex === index ? { ...resource, ...patch } : resource)
    }))
  }

  const addResourceLink = () => {
    setProfileDraft((prev) => ({
      ...prev,
      otherResources: [...(prev.otherResources || []), { title: '', url: '' }]
    }))
  }

  const removeResourceLink = (index: number) => {
    setProfileDraft((prev) => ({
      ...prev,
      otherResources: (prev.otherResources || []).filter((_, resourceIndex) => resourceIndex !== index)
    }))
  }

  if (mode === 'list' && activeSubModuleMeta.moduleKey) {
    return (
      <div className="space-y-6">
        {renderSubModuleTabs()}
        <AdminModuleVideoManager
          moduleKey={activeSubModuleMeta.moduleKey}
          title={activeSubModuleMeta.label}
          description={activeSubModuleMeta.description}
          categoryType={activeSubModuleMeta.categoryType}
        />
      </div>
    )
  }

  if (isProfileMode) {
    const profileCompany = contextCompany || companyGroups.find((company) => company.companyId === contextCompanyId)
    const profileCompanyName = profileCompany
      ? ('name' in profileCompany ? profileCompany.name : profileCompany.companyName)
      : contextCompanyId
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" className="btn-secondary" onClick={() => setUrlMode('list')}>
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </button>
            <div>
              <h2 className="text-2xl font-black text-slate-900">企业配置</h2>
              <p className="text-sm text-slate-500">
                {profileCompanyName} 的企业文化、CEO商业思维和外部资料。
              </p>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={handleSaveProfile} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {saving ? '保存中...' : '保存企业配置'}
          </button>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>展示设置</h2>
            <div className="flex items-center gap-2">
              <select
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                value={profileDraft.accessTier || 'vip'}
                onChange={(event) => setProfileDraft((prev) => ({ ...prev, accessTier: event.target.value as 'free' | 'vip' }))}
              >
                <option value="free">FREE 免费体验</option>
                <option value="vip">Club 会员内容</option>
              </select>
              <select
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                value={profileDraft.status}
                onChange={(event) => setProfileDraft((prev) => ({ ...prev, status: event.target.value as CorporateEnglishStatus }))}
              >
                <option value="published">公开展示</option>
                <option value="draft">草稿</option>
                <option value="archived">归档</option>
              </select>
              <input
                className="h-10 w-24 rounded-lg border border-slate-200 px-3 text-sm"
                type="number"
                value={profileDraft.sortOrder}
                onChange={(event) => setProfileDraft((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))}
                placeholder="排序"
              />
            </div>
          </div>
          <div className="card-content grid grid-cols-1 gap-5 xl:grid-cols-2">
            {([
              { key: 'cultureSections' as const, title: '企业文化', placeholder: '使命、愿景、价值观、企业故事等' },
              { key: 'ceoThinkingSections' as const, title: 'CEO 商业思维', placeholder: '创业、增长、个人成长、管理理念等' }
            ]).map((group) => (
              <div key={group.key} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{group.title}</h3>
                    <p className="text-xs text-slate-500">{group.placeholder}</p>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => addProfileSection(group.key)}>
                    <Plus className="h-4 w-4" />
                    添加
                  </button>
                </div>
                <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-900">批量配置</div>
                      <div className="text-xs text-slate-500">每行一条：标题｜内容</div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary" onClick={() => applyProfileBulkSections(group.key, 'append')}>
                        追加
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => applyProfileBulkSections(group.key, 'replace')}>
                        替换
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="h-28 w-full rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm"
                    value={profileBulkInputs[group.key]}
                    onChange={(event) => setProfileBulkInputs((prev) => ({ ...prev, [group.key]: event.target.value }))}
                    placeholder="开放是底层原则｜Automattic 和 WordPress 的核心文化不是“拥有一切”，而是尽可能开放..."
                  />
                </div>
                <div className="space-y-3">
                  {profileDraft[group.key].length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">暂无配置，可点击添加。</div>
                  ) : profileDraft[group.key].map((section, index) => (
                    <div key={index} className="rounded-lg bg-slate-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <input
                          className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
                          value={section.title}
                          onChange={(event) => updateProfileSection(group.key, index, { title: event.target.value })}
                          placeholder="标题"
                        />
                        <button type="button" className="btn-secondary text-red-600" onClick={() => removeProfileSection(group.key, index)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        className="h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={section.body}
                        onChange={(event) => updateProfileSection(group.key, index, { body: event.target.value })}
                        placeholder="内容"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-slate-200 p-4 xl:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">其他资料</h3>
                  <p className="text-xs text-slate-500">配置标题 + 链接，例如 CEO访谈合集、播客、公开演讲等。</p>
                </div>
                <button type="button" className="btn-secondary" onClick={addResourceLink}>
                  <Plus className="h-4 w-4" />
                  添加资料
                </button>
              </div>
              <div className="space-y-3">
                {(profileDraft.otherResources || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">暂无其他资料，可点击添加。</div>
                ) : (profileDraft.otherResources || []).map((resource, index) => (
                  <div key={index} className="grid gap-2 rounded-lg bg-slate-50 p-3 lg:grid-cols-[minmax(160px,280px)_minmax(260px,1fr)_auto]">
                    <input
                      className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                      value={resource.title}
                      onChange={(event) => updateResourceLink(index, { title: event.target.value })}
                      placeholder="资料标题，如 CEO访谈合集"
                    />
                    <input
                      className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                      value={resource.url}
                      onChange={(event) => updateResourceLink(index, { url: event.target.value })}
                      placeholder="https://..."
                    />
                    <button type="button" className="btn-secondary text-red-600" onClick={() => removeResourceLink(index)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (mode !== 'list') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" className="btn-secondary" onClick={() => setUrlMode('list')}>
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </button>
            <div>
              <h2 className="text-2xl font-black text-slate-900">{isEditing ? '编辑CEO访谈视频' : '添加CEO访谈视频'}</h2>
              <p className="text-sm text-slate-500">按可信企业关联音频、字幕与跟读片段。</p>
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {saving ? '保存中...' : '保存素材'}
          </button>
        </div>

        {loading ? (
          <div className="card"><div className="card-content loading"><Loader2 className="h-6 w-6 animate-spin" /></div></div>
        ) : (
          <>
            <div className="card">
              <div className="card-header"><h2>第一步：关联可信企业</h2></div>
              <div className="card-content space-y-4">
                {editor.selectedCompany ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                    <div>
                      <div className="font-bold text-slate-900">{editor.selectedCompany.name}</div>
                      <div className="text-sm text-slate-500">{editor.selectedCompany.website || '暂无官网'}</div>
                    </div>
                    {contextCompanyId ? (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700">已从企业列表关联</span>
                    ) : (
                      <button type="button" className="btn-secondary" onClick={() => updateEditor({ selectedCompany: null })}>重新选择</button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        value={companySearch}
                        onChange={(event) => setCompanySearch(event.target.value)}
                        placeholder="搜索可信企业名称"
                      />
                    </div>
                    <div className="grid gap-2">
                      {companyLoading && <div className="text-sm text-slate-500">搜索中...</div>}
                      {companyResults.map((company) => (
                        <button
                          key={company.id}
                          type="button"
                          className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50"
                          onClick={() => updateEditor({ selectedCompany: company })}
                        >
                          <span>
                            <span className="block font-semibold text-slate-900">{company.name}</span>
                            <span className="block text-sm text-slate-500">{company.website || company.careersPage}</span>
                          </span>
                          <Plus className="h-4 w-4 text-indigo-600" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              {materialCoverCropDraft ? (
                <CoverCropModal
                  draft={materialCoverCropDraft}
                  onCancel={closeMaterialCoverCropDraft}
                  onApply={applyCroppedMaterialCover}
                />
              ) : null}
              <div className="card-header"><h2>第二步：上传和配置素材</h2></div>
              <div className="card-content space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <button type="button" className="rounded-lg border border-dashed border-slate-300 p-5 text-left hover:border-indigo-300" onClick={() => materialCoverInputRef.current?.click()}>
                    {materialCoverPreviewUrl ? (
                      <img src={materialCoverPreviewUrl} alt="视频封面预览" className="mb-3 aspect-video w-full rounded-lg object-cover" />
                    ) : (
                      <Upload className="mb-3 h-6 w-6 text-indigo-600" />
                    )}
                    <div className="font-bold text-slate-900">{materialCoverFile?.name || (materialCoverPreviewUrl ? '已配置视频封面' : '上传视频封面')}</div>
                    <div className="text-sm text-slate-500">支持 jpg、png、webp；选择后可手动调整 16:9 裁剪范围，最大 8MB。</div>
                  </button>
                  <button type="button" className="rounded-lg border border-dashed border-slate-300 p-5 text-left hover:border-indigo-300" onClick={() => audioInputRef.current?.click()}>
                    <FileAudio className="mb-3 h-6 w-6 text-indigo-600" />
                    <div className="font-bold text-slate-900">{audioFile?.name || '上传原始音频用于本地剪辑'}</div>
                    <div className="text-sm text-slate-500">
                      支持 mp3、wav、m4a、aac；原始音频仅用于本地生成剪辑，保存时只保留剪辑后的音频，重剪需重新上传原音频。
                      {audioFile ? ` ${formatBytes(audioFile.size)}` : ''}
                    </div>
                    {editor.durationMs ? <div className="mt-2 text-sm text-slate-500">音频时长 {formatTime(editor.durationMs)}</div> : null}
                    {isEditing && editor.sourceAudioAssetId && !audioFile && editor.status !== 'published' ? (
                      <span
                        role="button"
                        tabIndex={0}
                        className="mt-3 inline-flex rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700"
                        onClick={(event) => {
                          event.stopPropagation()
                          loadSavedSourceAudio()
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          event.stopPropagation()
                          loadSavedSourceAudio()
                        }}
                      >
                        加载已保存原音频继续剪辑
                      </span>
                    ) : null}
                    {audioLoading && <div className="mt-2 text-sm text-indigo-600">音频解析中...</div>}
                  </button>
                  <button type="button" className="rounded-lg border border-dashed border-slate-300 p-5 text-left hover:border-indigo-300" onClick={() => csvInputRef.current?.click()}>
                    <FileText className="mb-3 h-6 w-6 text-indigo-600" />
                    <div className="font-bold text-slate-900">{csvFile?.name || (editor.subtitleRows.length > 0 ? '已解析字幕 CSV' : '上传字幕 CSV')}</div>
                    <div className="text-sm text-slate-500">字段支持 File Title/Title、Time、Subtitle、Translation/Translation4，最大 2MB；标题优先从字幕文件提取，V1 不保存 CSV 原文件。</div>
                    <div className="mt-2 text-sm text-slate-500">已解析 {editor.subtitleRows.length} 行字幕</div>
                  </button>
                </div>
                {audioObjectUrl && (
                  <audio className="w-full" controls src={audioObjectUrl}>
                    <track kind="captions" />
                  </audio>
                )}

                <input ref={audioInputRef} type="file" className="hidden" accept="audio/*,.mp3,.wav,.m4a,.aac,.mp4,.ogg,.webm" onChange={(event) => event.target.files?.[0] && handleAudioFile(event.target.files[0])} />
                <input ref={csvInputRef} type="file" className="hidden" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && handleCsvFile(event.target.files[0])} />
                <input ref={materialCoverInputRef} type="file" className="hidden" accept="image/*" onChange={(event) => event.target.files?.[0] && handleMaterialCoverFile(event.target.files[0])} />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">视频 iframe 链接 / 腾讯 vid</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={editor.tencentVideoInput}
                      onChange={(event) => updateEditor({ tencentVideoInput: event.target.value })}
                      placeholder="g32823rixpo、腾讯 iframe，或 Bilibili iframe"
                    />
                    <span className="mt-1 block text-xs text-slate-500">前台只渲染腾讯视频和 Bilibili 白名单播放器地址，不保存任意 iframe HTML。</span>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">视频排序</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      type="number"
                      value={editor.sequence}
                      onChange={(event) => updateEditor({ sequence: Number(event.target.value) || 0 })}
                    />
                  </label>
                  <label className="block lg:col-span-2">
                    <span className="text-sm font-semibold text-slate-700">原始视频地址</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={editor.sourceVideoUrl}
                      onChange={(event) => updateEditor({ sourceVideoUrl: event.target.value })}
                      placeholder="https://..."
                    />
                    <span className="mt-1 block text-xs text-slate-500">前台视频右上角“视频来源”会跳转到该地址，建议填写原视频发布页。</span>
                  </label>
                  <label className="block lg:col-span-2">
                    <span className="text-sm font-semibold text-slate-700">视频简介</span>
                    <textarea
                      className="mt-1 h-24 w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={editor.videoSummary}
                      onChange={(event) => updateEditor({ videoSummary: event.target.value })}
                      placeholder="用于前台视频下方说明，可概括这段 CEO/企业内容的学习价值。"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">素材标题 *</span>
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={editor.materialTitle} onChange={(event) => updateEditor({ materialTitle: event.target.value })} />
                    <span className="mt-1 block text-xs text-slate-500">上传字幕 CSV 后自动从标题字段或 CSV 文件名提取，可手动修改。</span>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">状态</span>
                    <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={editor.status} onChange={(event) => updateEditor({ status: event.target.value as CorporateEnglishStatus })}>
                      <option value="draft">草稿</option>
                      <option value="published">已发布</option>
                      <option value="archived">已归档</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={editor.isFeatured} onChange={(event) => updateEditor({ isFeatured: event.target.checked })} />
                    <span>
                      <span className="block text-sm font-semibold text-slate-700">精选</span>
                      <span className="block text-xs text-slate-500">展示在首页职业成长模块</span>
                    </span>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">素材人物名称 *</span>
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={editor.speakerName} onChange={(event) => updateEditor({ speakerName: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">人物职业 *</span>
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={editor.speakerRole} onChange={(event) => updateEditor({ speakerRole: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">人物联系邮箱</span>
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={editor.speakerEmail} onChange={(event) => updateEditor({ speakerEmail: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">人物 LinkedIn</span>
                    <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={editor.speakerLinkedin} onChange={(event) => updateEditor({ speakerLinkedin: event.target.value })} />
                  </label>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>第三、四步：配置和编辑剪辑</h2>
              </div>
              <div className="card-content space-y-4">
                {isEditing && !audioFile && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    已保存的剪辑音频会直接展示和下载；如需重新剪辑，请重新上传原始音频后点击“生成/更新剪辑”。
                  </div>
                )}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">批量配置剪辑段</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        先上传字幕 CSV，再粘贴批量配置；跟读原文和译文会按时间戳从字幕自动提取。可选填重读、弱读、连读、关键词。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary" onClick={() => applyBulkClipConfig('append')}>
                        追加解析结果
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => applyBulkClipConfig('replace')}>
                        替换当前剪辑
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="h-44 w-full rounded-lg border border-indigo-100 bg-white px-3 py-2 font-mono text-sm leading-6"
                    value={bulkClipInput}
                    onChange={(event) => setBulkClipInput(event.target.value)}
                    placeholder={'02:16–02:46 | Travel Keeps You Humble | B1-B2; #旅行与适应力 / #远程工作方式; #生活方式表达 / #CEO 日常表达\n重读：love / travel / humbling\n弱读：that’s / of / what / I\n连读：part of / what I / love about\n关键词：humbling / in control / productive\n\n06:37–07:08 | Finding the Right CEO Partner | B2-C1; #创始人合作 / #领导力; #创业故事 / #组织搭建'}
                  />
                  <div className="mt-2 text-xs leading-5 text-slate-500">
                    标题行格式：时间戳｜片段标题｜适合英语水平；#素材关键词 / #素材关键词2；#适用场景1 / #适用场景2
                  </div>
                </div>
                {editor.clips.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    <p>还没有剪辑段，添加第一段后即可配置时间、字幕和跟读标注。</p>
                    <button type="button" className="btn-secondary mt-4" onClick={() => addClip()}>
                      <Plus className="h-4 w-4" />
                      新增剪辑段
                    </button>
                  </div>
                ) : (
                  editor.clips.map((clip, index) => (
                    <div key={clip.localId} className="rounded-lg border border-slate-200 p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <input
                          className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold"
                          value={clip.clipTitle || ''}
                          onChange={(event) => updateClip(clip.localId, { clipTitle: event.target.value })}
                          placeholder={`片段 ${index + 1}`}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="btn-secondary" onClick={() => generateClip(clip.localId)} disabled={generatingClipId === clip.localId || generatingClipId === '__all__'}>
                            {generatingClipId === clip.localId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                            {generatingClipId === clip.localId ? '生成中...' : '生成/更新剪辑'}
                          </button>
                          <select
                            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                            value={clip.downloadFormat || 'wav'}
                            onChange={(event) => updateClip(clip.localId, { downloadFormat: event.target.value as ClipDownloadFormat })}
                            aria-label="下载格式"
                          >
                            <option value="wav">WAV</option>
                            <option value="m4a">M4A</option>
                            <option value="compressed">原压缩格式</option>
                          </select>
                          <button type="button" className="btn-secondary" onClick={() => downloadClip(clip, index)}>
                            <Download className="h-4 w-4" />
                            下载音频
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => copyText(formatClipCopyText(clip, index))}>
                            <Copy className="h-4 w-4" />
                            复制完整信息
                          </button>
                          <button type="button" className="btn-secondary text-red-600" onClick={() => updateEditor({ clips: editor.clips.filter((item) => item.localId !== clip.localId) })}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-700">起始时间</span>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={clip.startTimecode} onChange={(event) => updateClip(clip.localId, { startTimecode: event.target.value })} placeholder="00:00" />
                        </label>
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-700">结束时间</span>
                          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={clip.endTimecode} onChange={(event) => updateClip(clip.localId, { endTimecode: event.target.value })} placeholder="00:30" />
                        </label>
                        <label className="block lg:col-span-2">
                          <span className="text-sm font-semibold text-slate-700">片段标签</span>
                          <input
                            className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 py-2"
                            value={clip.clipTagInput || ''}
                            onChange={(event) => updateClipTagInput(clip.localId, event.target.value)}
                            placeholder="B2-C1；企业文化 / 开源理念；技术公司表达 / CEO表达"
                          />
                          {normalizeClipTags(clip.clipTags).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {normalizeClipTags(clip.clipTags).map((group) => (
                                <span key={group.title} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {group.title}：{group.tags.map((tag) => `#${tag}`).join(' ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </label>
                        <label className="block lg:col-span-2">
                          <span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                            <span>跟读标注</span>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                              onClick={() => generatePronunciationDraft(clip.localId)}
                            >
                              <Wand2 className="h-3.5 w-3.5" />
                              从字幕生成草稿
                            </button>
                          </span>
                          <textarea
                            className="mt-1 h-28 w-full rounded-lg border border-slate-200 px-3 py-2"
                            value={clip.pronunciationMarkInput || ''}
                            onChange={(event) => updatePronunciationMarkInput(clip.localId, event.target.value)}
                            placeholder={'重读：modestly / contributors / WordPress\n弱读：to / the / of\n连读：way to / get me\n关键词：open source / salary\n停顿：modestly / salary'}
                          />
                        </label>
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-700">字幕原文</span>
                          <textarea className="mt-1 h-32 w-full rounded-lg border border-slate-200 px-3 py-2" value={clip.subtitleText} onChange={(event) => updateClip(clip.localId, { subtitleText: event.target.value })} />
                        </label>
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-700">字幕翻译</span>
                          <textarea className="mt-1 h-32 w-full rounded-lg border border-slate-200 px-3 py-2" value={clip.translationText} onChange={(event) => updateClip(clip.localId, { translationText: event.target.value })} />
                        </label>
                        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-2 text-left text-sm font-semibold text-slate-700 hover:text-indigo-700"
                              onClick={() => toggleClipSubtitleCues(clip.localId)}
                              aria-expanded={expandedSubtitleCueClipIds.has(clip.localId)}
                            >
                              {expandedSubtitleCueClipIds.has(clip.localId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <div className="text-sm font-semibold text-slate-700">剪辑相对字幕时间戳</div>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500">
                                {(clip.subtitleCues || []).length} 行
                              </span>
                            </button>
                            {expandedSubtitleCueClipIds.has(clip.localId) && (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
                                onClick={() => addClipSubtitleCue(clip.localId)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                新增字幕行
                              </button>
                            )}
                          </div>
                          {expandedSubtitleCueClipIds.has(clip.localId) && (
                            (clip.subtitleCues || []).length > 0 ? (
                              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 text-xs leading-5 text-slate-600">
                                {(clip.subtitleCues || []).map((cue, cueIndex) => (
                                  <div key={`${cue.startMs}-${cue.endMs}-${cueIndex}`} className="grid gap-2 rounded-lg bg-white p-2 md:grid-cols-[88px_88px_minmax(0,1fr)_minmax(0,1fr)_34px]">
                                    <label className="block">
                                      <span className="mb-1 block text-[11px] font-bold text-slate-400">开始(s)</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
                                        value={formatSecondsInput(cue.startMs)}
                                        onChange={(event) => updateClipSubtitleCue(clip.localId, cueIndex, { startMs: secondsInputToMs(event.target.value) })}
                                      />
                                    </label>
                                    <label className="block">
                                      <span className="mb-1 block text-[11px] font-bold text-slate-400">结束(s)</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs"
                                        value={formatSecondsInput(cue.endMs)}
                                        onChange={(event) => updateClipSubtitleCue(clip.localId, cueIndex, { endMs: secondsInputToMs(event.target.value) })}
                                      />
                                    </label>
                                    <label className="block">
                                      <span className="mb-1 block text-[11px] font-bold text-slate-400">字幕原文</span>
                                      <input
                                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                        value={cue.subtitleText || ''}
                                        onChange={(event) => updateClipSubtitleCue(clip.localId, cueIndex, { subtitleText: event.target.value })}
                                      />
                                    </label>
                                    <label className="block">
                                      <span className="mb-1 block text-[11px] font-bold text-slate-400">字幕翻译</span>
                                      <input
                                        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                                        value={cue.translationText || ''}
                                        onChange={(event) => updateClipSubtitleCue(clip.localId, cueIndex, { translationText: event.target.value })}
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      className="mt-5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:text-rose-600"
                                      onClick={() => removeClipSubtitleCue(clip.localId, cueIndex)}
                                      aria-label="删除字幕行"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-400">
                                当前片段没有字幕时间戳，可点击“新增字幕行”手动补充。
                              </div>
                            )
                          )}
                        </div>
                      </div>
                      {clip.clipAudioUrl && <audio className="mt-4 w-full" controls src={clip.clipAudioUrl} />}
                      {clip.uploadProgress ? <div className="mt-2 text-sm text-indigo-600">片段上传 {clip.uploadProgress}%</div> : null}
                      {index === editor.clips.length - 1 ? (
                        <div className="mt-4 flex justify-end">
                          <button type="button" className="btn-secondary" onClick={() => addClip(clip.localId)}>
                            <Plus className="h-4 w-4" />
                            新增剪辑段
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
                {editor.clips.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary" onClick={generateAllClips} disabled={generatingClipId === '__all__'}>
                      {generatingClipId === '__all__' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      {generatingClipId === '__all__' ? '批量生成中...' : '批量生成全部剪辑音频'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => copyText(clipSummaryText)}>
                      <Copy className="h-4 w-4" />
                      批量复制全部剪辑完整信息
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {renderSubModuleTabs()}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900">CEO访谈</h2>
          <p className="text-sm text-slate-500">按企业管理 CEO 访谈视频、跟读剪辑和企业文化配置。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary h-12 px-4" onClick={loadMaterials} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button type="button" className="btn-primary h-12 px-5" onClick={() => setUrlMode('create')}>
            <Plus className="h-4 w-4" />
            添加素材
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-content">
          <div className="mb-4 grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[minmax(260px,1fr)_180px]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                onBlur={runSearch}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch()
                }}
                placeholder="搜索企业、视频标题、人物"
              />
            </div>
            <select className="h-12 rounded-lg border border-slate-200 px-3 py-2 text-slate-900" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as CorporateEnglishStatus | 'all'); setPage(1) }}>
              <option value="all">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">企业</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">视频数</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">剪辑数</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">企业配置</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">更新时间</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                ) : companyGroups.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">暂无CEO访谈企业内容，点击右上角添加。</td></tr>
                ) : companyGroups.map((company) => (
                  <React.Fragment key={company.companyId}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left"
                          onClick={() => setExpandedCompanyId(expandedCompanyId === company.companyId ? '' : company.companyId)}
                        >
                          {expandedCompanyId === company.companyId ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                          <span>
                            <span className="block font-semibold text-slate-900">{company.companyName}</span>
                            <span className="block max-w-[260px] truncate text-sm text-slate-500">{company.companyWebsite || '暂无官网'}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{company.videoCount}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{company.clipCount}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <Building2 className="h-4 w-4 text-indigo-500" />
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${company.profile?.accessTier === 'free' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {company.profile?.accessTier === 'free' ? 'FREE' : 'Club'}
                          </span>
                          {company.profile
                            ? `${company.profile.cultureSections.length + company.profile.ceoThinkingSections.length + (company.profile.otherResources || []).length} 项`
                            : '未配置'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{statusLabel(company.status)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{company.latestUpdatedAt ? new Date(company.latestUpdatedAt).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button type="button" className="btn-secondary" onClick={() => setUrlMode('profile', '', company.companyId)}>
                            <Building2 className="h-4 w-4" />
                            企业配置
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => setUrlMode('create', '', company.companyId)}>
                            <Plus className="h-4 w-4" />
                            新增视频
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedCompanyId === company.companyId && (
                      <tr key={`${company.companyId}-videos`} className="bg-slate-50/70">
                        <td colSpan={7} className="px-8 py-4">
                          <div className="space-y-2">
                            {company.materials.map((material) => (
                              <div key={material.materialId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-slate-900">{material.materialTitle}</span>
                                    {!material.coverImageHash ? (
                                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">缺封面</span>
                                    ) : null}
                                  </div>
                                  <div className="text-sm text-slate-500">
                                    {material.speakerName} · {material.speakerRole} · {material.clipCount} 个片段
                                    {material.tencentVideoVid ? ` · vid ${material.tencentVideoVid}` : ''}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button type="button" className="btn-secondary" onClick={() => setUrlMode('edit', material.materialId)}>
                                    <Edit3 className="h-4 w-4" />
                                    编辑
                                  </button>
                                  <button type="button" className="btn-secondary text-red-600" onClick={() => handleDelete(material)}>
                                    <Trash2 className="h-4 w-4" />
                                    删除
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>共 {total} 条</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>上一页</button>
              <span>{page} / {totalPages}</span>
              <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>下一页</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
