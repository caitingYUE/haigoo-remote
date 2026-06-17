import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
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
  Wand2
} from 'lucide-react'
import {
  CorporateEnglishClip,
  CorporateEnglishClipTag,
  CorporateEnglishMaterial,
  CorporateEnglishStatus,
  CorporateEnglishSubtitleRow,
  corporateEnglishService
} from '../services/corporate-english-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'

const MAX_SOURCE_AUDIO_BYTES = 500 * 1024 * 1024
const MAX_CSV_BYTES = 2 * 1024 * 1024
const MAX_CLIP_BYTES = 3 * 1024 * 1024
const MAX_CLIPS = 50
const CLIP_AUDIO_BITRATE = 48000
const ACCEPTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm', '.mp4']

type Mode = 'list' | 'create' | 'edit'
type ClipDownloadFormat = 'compressed' | 'wav' | 'm4a'

interface EditableClip extends CorporateEnglishClip {
  localId: string
  startTimecode: string
  endTimecode: string
  clipTagInput?: string
  clipBlob?: Blob
  clipAudioUrl?: string
  clipMimeType?: string
  clipExtension?: string
  downloadFormat?: ClipDownloadFormat
  uploadProgress?: number
}

interface EditorState {
  materialId?: string
  selectedCompany: TrustedCompany | null
  materialTitle: string
  speakerName: string
  speakerRole: string
  speakerEmail: string
  speakerLinkedin: string
  status: CorporateEnglishStatus
  sourceAudioAssetId?: string | null
  subtitleCsvAssetId?: string | null
  durationMs?: number | null
  subtitleRows: CorporateEnglishSubtitleRow[]
  clips: EditableClip[]
}

const emptyEditorState = (): EditorState => ({
  selectedCompany: null,
  materialTitle: '',
  speakerName: '',
  speakerRole: '',
  speakerEmail: '',
  speakerLinkedin: '',
  status: 'draft',
  sourceAudioAssetId: null,
  subtitleCsvAssetId: null,
  durationMs: null,
  subtitleRows: [],
  clips: []
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
    translationText: selected.map((row) => row.translation_text).filter(Boolean).join('\n')
  }
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

function getCompressedAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus'
  ]
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || null
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

async function encodeCompressedClip(audioBuffer: AudioBuffer): Promise<{ blob: Blob; mimeType: string; extension: string }> {
  const mimeType = getCompressedAudioMimeType()
  if (!mimeType) {
    return { blob: encodeWav(audioBuffer), mimeType: 'audio/wav', extension: 'wav' }
  }

  return encodeAudioBufferWithMediaRecorder(audioBuffer, mimeType, mimeType.includes('ogg') ? 'ogg' : 'webm', CLIP_AUDIO_BITRATE)
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

async function encodeCompressedClipFromAudioFile(
  file: File,
  startMs: number,
  endMs: number
): Promise<{ blob: Blob; mimeType: string; extension: string }> {
  const mimeType = getCompressedAudioMimeType()
  if (!mimeType) {
    const decoded = await decodeAudioBlob(file)
    return encodeCompressedClip(clipAudioBuffer(decoded, startMs, endMs))
  }

  const objectUrl = URL.createObjectURL(file)
  const durationSeconds = Math.max(0.1, (endMs - startMs) / 1000)

  return new Promise((resolve, reject) => {
    const audio = new Audio()
    let recorder: MediaRecorder | null = null
    let audioContext: AudioContext | null = null
    let sourceNode: MediaElementAudioSourceNode | null = null
    let destinationNode: MediaStreamAudioDestinationNode | null = null
    let timeoutId: number | null = null
    let started = false
    const chunks: BlobPart[] = []

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      destinationNode?.stream.getTracks().forEach((track) => track.stop())
      sourceNode?.disconnect()
      destinationNode?.disconnect()
      audioContext?.close().catch(() => undefined)
      URL.revokeObjectURL(objectUrl)
    }

    const finish = () => {
      cleanup()
      const blob = new Blob(chunks, { type: mimeType })
      resolve({
        blob,
        mimeType,
        extension: mimeType.includes('ogg') ? 'ogg' : 'webm'
      })
    }

    const fail = (error: unknown) => {
      cleanup()
      reject(error instanceof Error ? error : new Error('压缩剪辑音频失败'))
    }

    const startRecording = () => {
      if (started) return
      started = true
      try {
        audioContext = new AudioContext({ sampleRate: 48000 })
        sourceNode = audioContext.createMediaElementSource(audio)
        destinationNode = audioContext.createMediaStreamDestination()
        sourceNode.connect(destinationNode)
        recorder = new MediaRecorder(destinationNode.stream, {
          mimeType,
          audioBitsPerSecond: CLIP_AUDIO_BITRATE
        })
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data)
        }
        recorder.onerror = () => fail(new Error('压缩剪辑音频失败'))
        recorder.onstop = finish
        recorder.start(1000)
        audioContext.resume()
          .then(() => audio.play())
          .catch(fail)
        timeoutId = window.setTimeout(() => {
          if (recorder?.state === 'recording') recorder.stop()
        }, Math.ceil(durationSeconds * 1000) + 250)
      } catch (error) {
        fail(error)
      }
    }

    audio.preload = 'auto'
    audio.onloadedmetadata = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
        fail(new Error('无法读取音频时长'))
        return
      }
      const startSeconds = Math.min(startMs / 1000, Math.max(0, audio.duration - 0.05))
      if (startSeconds <= 0.05) startRecording()
      else audio.currentTime = startSeconds
    }
    audio.onseeked = startRecording
    audio.ontimeupdate = () => {
      if (audio.currentTime >= endMs / 1000 && recorder?.state === 'recording') {
        recorder.stop()
      }
    }
    audio.onended = () => {
      if (recorder?.state === 'recording') recorder.stop()
    }
    audio.onerror = () => fail(new Error('音频解析失败，请确认文件格式可被当前浏览器播放'))
    audio.src = objectUrl
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

export default function AdminCorporateEnglishPage() {
  const [mode, setMode] = useState<Mode>('list')
  const [editingId, setEditingId] = useState<string>('')
  const [materials, setMaterials] = useState<CorporateEnglishMaterial[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [statusFilter, setStatusFilter] = useState<CorporateEnglishStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [editor, setEditor] = useState<EditorState>(() => emptyEditorState())
  const [companySearch, setCompanySearch] = useState('')
  const [companyResults, setCompanyResults] = useState<TrustedCompany[]>([])
  const [companyLoading, setCompanyLoading] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [decodedAudio, setDecodedAudio] = useState<AudioBuffer | null>(null)
  const [audioObjectUrl, setAudioObjectUrl] = useState('')
  const [audioLoading, setAudioLoading] = useState(false)
  const [generatingClipId, setGeneratingClipId] = useState('')
  const audioInputRef = useRef<HTMLInputElement | null>(null)
  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const audioObjectUrlRef = useRef('')

  const isEditing = mode === 'edit'

  const refreshModeFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    const urlMode = params.get('mode')
    const materialId = params.get('materialId') || ''
    if (urlMode === 'create') {
      setMode('create')
      setEditingId('')
    } else if (urlMode === 'edit' && materialId) {
      setMode('edit')
      setEditingId(materialId)
    } else {
      setMode('list')
      setEditingId('')
    }
  }, [])

  const setUrlMode = useCallback((nextMode: Mode, materialId = '') => {
    const params = new URLSearchParams(window.location.search)
    params.set('tab', 'corporate-english')
    if (nextMode === 'list') {
      params.delete('mode')
      params.delete('materialId')
    } else {
      params.set('mode', nextMode)
      if (materialId) params.set('materialId', materialId)
      else params.delete('materialId')
    }
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`)
    refreshModeFromUrl()
  }, [refreshModeFromUrl])

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

  const loadMaterials = useCallback(async () => {
    if (mode !== 'list') return
    try {
      setLoading(true)
      const data = await corporateEnglishService.listMaterials({
        page,
        limit: 20,
        search,
        status: statusFilter
      })
      setMaterials(data.materials)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Failed to load corporate English materials:', error)
      alert(error instanceof Error ? error.message : '加载外企英语素材失败')
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
    }
  }, [refreshModeFromUrl])

  useEffect(() => {
    loadMaterials()
  }, [loadMaterials])

  useEffect(() => {
    if (mode === 'create') {
      setEditor(emptyEditorState())
      setAudioFile(null)
      setCsvFile(null)
      setDecodedAudio(null)
      replaceAudioObjectUrl(null)
    }
  }, [mode, replaceAudioObjectUrl])

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
        setEditor({
          materialId: detail.material.materialId,
          selectedCompany: company,
          materialTitle: detail.material.materialTitle,
          speakerName: detail.material.speakerName,
          speakerRole: detail.material.speakerRole,
          speakerEmail: detail.material.speakerEmail || '',
          speakerLinkedin: detail.material.speakerLinkedin || '',
          status: detail.material.status,
          sourceAudioAssetId: detail.material.sourceAudioAssetId,
          subtitleCsvAssetId: detail.material.subtitleCsvAssetId,
          durationMs: detail.material.durationMs,
          subtitleRows: detail.material.normalizedSubtitleRows || [],
          clips: detail.clips.map((clip) => ({
            ...clip,
            localId: clip.clipId || crypto.randomUUID(),
            startTimecode: formatTime(clip.startMs),
            endTimecode: formatTime(clip.endMs),
            clipTagInput: formatClipTags(clip.clipTags || []),
            clipTags: normalizeClipTags(clip.clipTags || [])
          }))
        })
        setAudioFile(null)
        setCsvFile(null)
        setDecodedAudio(null)
        replaceAudioObjectUrl(null)
      } catch (error) {
        console.error('Failed to load material:', error)
        alert(error instanceof Error ? error.message : '加载素材失败')
        setUrlMode('list')
      } finally {
        setLoading(false)
      }
    }
    loadDetail()
    return () => {
      cancelled = true
    }
  }, [editingId, mode, replaceAudioObjectUrl, setUrlMode])

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
    throw new Error('V1 不保存原始音频；如需重新剪辑，请重新上传原始音频文件')
  }

  const addClip = () => {
    if (editor.clips.length >= MAX_CLIPS) {
      alert(`单个素材最多支持 ${MAX_CLIPS} 个剪辑段`)
      return
    }
    const startMs = 0
    const endMs = Math.min(editor.durationMs || 5000, 5000)
    const text = extractSubtitle(editor.subtitleRows, startMs, endMs)
    updateEditor({
      clips: [
        ...editor.clips,
        {
          localId: crypto.randomUUID(),
          sequence: editor.clips.length,
          clipTitle: `片段 ${editor.clips.length + 1}`,
          startMs,
          endMs,
          startTimecode: formatTime(startMs),
          endTimecode: formatTime(endMs),
          subtitleText: text.subtitleText,
          translationText: text.translationText,
          clipTagInput: '',
          clipTags: [],
          status: editor.status
        }
      ]
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
          next.clipAudioAssetId = null
          next.clipBlob = undefined
          next.clipAudioUrl = undefined
          next.clipMimeType = undefined
          next.clipExtension = undefined
          const text = extractSubtitle(editor.subtitleRows, next.startMs, next.endMs)
          next.subtitleText = text.subtitleText
          next.translationText = text.translationText
        }
        return next
      })
    })
  }

  const updateClipTagInput = (localId: string, value: string) => {
    updateClip(localId, {
      clipTagInput: value,
      clipTags: parseClipTags(value)
    })
  }

  const generateClip = async (localId: string) => {
    try {
      setGeneratingClipId(localId)
      const clip = editor.clips.find((item) => item.localId === localId)
      if (!clip) return
      if (clip.endMs <= clip.startMs) {
        alert('结束时间必须晚于起始时间')
        return
      }
      if (editor.durationMs && clip.endMs > editor.durationMs + 500) {
        alert('剪辑结束时间超过音频总时长')
        return
      }
      const { blob, mimeType, extension } = audioFile
        ? await encodeCompressedClipFromAudioFile(audioFile, clip.startMs, clip.endMs)
        : await ensureDecodedAudio().then((source) => encodeCompressedClip(clipAudioBuffer(source, clip.startMs, clip.endMs)))
      if (blob.size > MAX_CLIP_BYTES) {
        alert('单个剪辑音频不能超过 3MB，请缩短时间段。当前已按 48kbps 低码率压缩。')
        return
      }
      if (blob.size <= 0) {
        alert('剪辑音频为空，请检查起止时间或原始音频格式')
        return
      }
      if (clip.clipAudioUrl) URL.revokeObjectURL(clip.clipAudioUrl)
      const url = URL.createObjectURL(blob)
      const text = extractSubtitle(editor.subtitleRows, clip.startMs, clip.endMs)
      updateClip(localId, {
        clipBlob: blob,
        clipAudioUrl: url,
        clipMimeType: mimeType,
        clipExtension: extension,
        clipAudioAssetId: null,
        subtitleText: clip.subtitleText || text.subtitleText,
        translationText: clip.translationText || text.translationText
      })
    } catch (error) {
      console.error('Failed to generate clip:', error)
      alert(error instanceof Error ? error.message : '生成剪辑失败')
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

    return [
      `标题：${title}`,
      `分段：${clip.startTimecode}-${clip.endTimecode}`,
      tags ? `标签：\n${tags}` : '',
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
    if (isEditing && !audioFile && editor.clips.some((clip) => !clip.clipAudioAssetId)) return '重新生成剪辑需要重新上传原始音频'
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
        uploadedClips.push({ ...clip, clipAudioAssetId, sequence: index, status: editor.status })
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
        sourceAudioAssetId,
        subtitleCsvAssetId,
        normalizedSubtitleRows: editor.subtitleRows,
        status: editor.status,
        durationMs: editor.durationMs || null,
        clips: uploadedClips
      }, isEditing ? editor.materialId : undefined)

      alert('保存成功')
      setEditor((prev) => ({ ...prev, materialId, sourceAudioAssetId, subtitleCsvAssetId, clips: uploadedClips }))
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
              <h2 className="text-2xl font-black text-slate-900">{isEditing ? '编辑外企英语素材' : '添加外企英语素材'}</h2>
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
              <div className="card-header"><h2>第一步：选择可信企业</h2></div>
              <div className="card-content space-y-4">
                {editor.selectedCompany ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                    <div>
                      <div className="font-bold text-slate-900">{editor.selectedCompany.name}</div>
                      <div className="text-sm text-slate-500">{editor.selectedCompany.website || '暂无官网'}</div>
                    </div>
                    <button type="button" className="btn-secondary" onClick={() => updateEditor({ selectedCompany: null })}>重新选择</button>
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
              <div className="card-header"><h2>第二步：上传和配置素材</h2></div>
              <div className="card-content space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <button type="button" className="rounded-lg border border-dashed border-slate-300 p-5 text-left hover:border-indigo-300" onClick={() => audioInputRef.current?.click()}>
                    <FileAudio className="mb-3 h-6 w-6 text-indigo-600" />
                    <div className="font-bold text-slate-900">{audioFile?.name || '上传原始音频用于本地剪辑'}</div>
                    <div className="text-sm text-slate-500">
                      支持 mp3、wav、m4a、aac；原文件仅在浏览器本地处理，建议不超过 500MB，保存时只上传 48kbps 压缩后的剪辑片段。
                      {audioFile ? ` ${formatBytes(audioFile.size)}` : ''}
                    </div>
                    {editor.durationMs ? <div className="mt-2 text-sm text-slate-500">音频时长 {formatTime(editor.durationMs)}</div> : null}
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

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                <button type="button" className="btn-secondary" onClick={addClip}>
                  <Plus className="h-4 w-4" />
                  新增剪辑段
                </button>
              </div>
              <div className="card-content space-y-4">
                {isEditing && !audioFile && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    V1 不保存原始音频；编辑已有素材时，如需重新生成或调整音频片段，请在第二步重新上传原音频文件。
                  </div>
                )}
                {editor.clips.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">还没有剪辑段，点击“新增剪辑段”开始配置。</div>
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
                          <button type="button" className="btn-secondary" onClick={() => generateClip(clip.localId)} disabled={generatingClipId === clip.localId}>
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
                          <textarea
                            className="mt-1 h-24 w-full rounded-lg border border-slate-200 px-3 py-2"
                            value={clip.clipTagInput || ''}
                            onChange={(event) => updateClipTagInput(clip.localId, event.target.value)}
                            placeholder="B2-C1；企业文化 / 开源理念；技术公司表达 / CEO表达"
                          />
                          <div className="mt-2 text-xs text-slate-500">
                            标签跟随当前剪辑片段保存。可用三段式输入，也可逐行自定义：适用英语水平：B2-C1；适用场景：CEO表达 / 技术公司表达
                          </div>
                          {normalizeClipTags(clip.clipTags).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {normalizeClipTags(clip.clipTags).map((group) => (
                                <span key={group.title} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {group.title}：{group.tags.map((tag) => `#${tag}`).join(' ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </label>
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-700">字幕原文</span>
                          <textarea className="mt-1 h-32 w-full rounded-lg border border-slate-200 px-3 py-2" value={clip.subtitleText} onChange={(event) => updateClip(clip.localId, { subtitleText: event.target.value })} />
                        </label>
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-700">字幕翻译</span>
                          <textarea className="mt-1 h-32 w-full rounded-lg border border-slate-200 px-3 py-2" value={clip.translationText} onChange={(event) => updateClip(clip.localId, { translationText: event.target.value })} />
                        </label>
                      </div>
                      {clip.clipAudioUrl && <audio className="mt-4 w-full" controls src={clip.clipAudioUrl} />}
                      {clip.uploadProgress ? <div className="mt-2 text-sm text-indigo-600">片段上传 {clip.uploadProgress}%</div> : null}
                    </div>
                  ))
                )}
                {editor.clips.length > 0 && (
                  <button type="button" className="btn-secondary" onClick={() => copyText(clipSummaryText)}>
                    <Copy className="h-4 w-4" />
                    批量复制全部剪辑完整信息
                  </button>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900">外企英语</h2>
          <p className="text-sm text-slate-500">管理按可信企业关联的英语音频素材和跟读剪辑。</p>
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
          <div className="mb-4 grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[minmax(260px,1fr)_112px_180px]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch()
                }}
                placeholder="搜索素材标题、企业、人物"
              />
            </div>
            <button type="button" className="btn-secondary h-12 px-4" onClick={runSearch} disabled={loading}>
              <Search className="h-4 w-4" />
              搜索
            </button>
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
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">素材</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">关联企业</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">人物</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">剪辑数</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">更新时间</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
                ) : materials.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">暂无外企英语素材，点击右上角添加。</td></tr>
                ) : materials.map((material) => (
                  <tr key={material.materialId} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{material.materialTitle}</div>
                      <div className="text-sm text-slate-500">{material.durationMs ? `原音频 ${formatTime(material.durationMs)}` : '未记录时长'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{material.companyName}</div>
                      <div className="max-w-[220px] truncate text-sm text-slate-500">{material.companyWebsite}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{material.speakerName}</div>
                      <div className="text-sm text-slate-500">{material.speakerRole}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{material.clipCount}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{statusLabel(material.status)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{material.updatedAt ? new Date(material.updatedAt).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn-secondary" onClick={() => setUrlMode('edit', material.materialId)}>
                          <Edit3 className="h-4 w-4" />
                          编辑
                        </button>
                        <button type="button" className="btn-secondary text-red-600" onClick={() => handleDelete(material)}>
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
