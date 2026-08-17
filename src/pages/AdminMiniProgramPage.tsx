import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, ArrowLeft, Edit3, ExternalLink, Eye, Loader2, Plus, RefreshCw, Search, Upload } from 'lucide-react'
import { VideoNotesArticle } from '../components/VideoNotesArticle'
import { VideoNotesEditor } from './AdminCorporateEnglishPage'
import {
  CareerGrowthNote,
  CareerGrowthNoteOrigin,
  CorporateEnglishAccessTier,
  CorporateEnglishStatus,
  SaveCareerGrowthNotePayload,
  corporateEnglishService
} from '../services/corporate-english-service'

const PAGE_SIZE = 20
const MAX_COVER_BYTES = 8 * 1024 * 1024

const ORIGIN_LABELS: Record<CareerGrowthNoteOrigin, string> = {
  video: '视频笔记',
  original: 'Haigoo 原创',
  external: '外部整理'
}

function localDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function emptyPayload(): SaveCareerGrowthNotePayload {
  return {
    originType: 'original',
    title: '',
    originalTitle: '',
    summary: '',
    authorName: 'Haigoo 职业研究',
    sourceName: 'Haigoo Remote',
    sourceUrl: '',
    rightsBasis: 'owned',
    rightsConfirmed: true,
    contentBlocks: [],
    category: '远程职业准备',
    difficultyLevel: '',
    tags: [],
    accessTier: 'vip',
    status: 'draft',
    isFeatured: false,
    sortOrder: 0,
    publishedAt: localDateTime()
  }
}

function notePayload(note: CareerGrowthNote): SaveCareerGrowthNotePayload {
  return {
    originType: note.originType,
    version: note.version,
    title: note.title,
    originalTitle: note.originalTitle,
    summary: note.summary,
    authorName: note.authorName,
    sourceName: note.sourceName,
    sourceUrl: note.sourceUrl,
    rightsBasis: note.rightsBasis,
    rightsConfirmed: note.rightsConfirmed,
    contentBlocks: note.contentBlocks,
    category: note.category,
    difficultyLevel: note.difficultyLevel,
    tags: note.tags,
    accessTier: note.accessTier,
    status: note.status,
    isFeatured: note.isFeatured,
    sortOrder: note.sortOrder,
    publishedAt: localDateTime(note.publishedAt)
  }
}

export default function AdminMiniProgramPage() {
  const [notes, setNotes] = useState<CareerGrowthNote[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [originType, setOriginType] = useState<CareerGrowthNoteOrigin | 'all'>('all')
  const [status, setStatus] = useState<CorporateEnglishStatus | 'all'>('all')
  const [accessTier, setAccessTier] = useState<CorporateEnglishAccessTier | 'all'>('all')
  const [categoryDraft, setCategoryDraft] = useState('')
  const [category, setCategory] = useState('')
  const [editing, setEditing] = useState<CareerGrowthNote | null>(null)
  const [form, setForm] = useState<SaveCareerGrowthNotePayload>(emptyPayload)
  const [tagInput, setTagInput] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true)
      const result = await corporateEnglishService.listMiniNotes({ page, pageSize: PAGE_SIZE, search, originType, status, accessTier, category })
      setNotes(result.notes)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (error) {
      setNotes([])
      alert(error instanceof Error ? error.message : '加载笔记失败')
    } finally {
      setLoading(false)
    }
  }, [accessTier, category, originType, page, search, status])

  useEffect(() => { void loadNotes() }, [loadNotes])
  useEffect(() => () => { if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview) }, [coverPreview])

  const replaceCover = (file: File | null, existing = '') => {
    setCoverPreview((current) => {
      if (current.startsWith('blob:')) URL.revokeObjectURL(current)
      return file ? URL.createObjectURL(file) : existing
    })
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyPayload())
    setTagInput('')
    setCoverFile(null)
    replaceCover(null)
    setShowPreview(false)
    setShowForm(true)
  }

  const openEdit = async (note: CareerGrowthNote) => {
    try {
      setLoading(true)
      const fresh = await corporateEnglishService.getMiniNote(note.noteId)
      setEditing(fresh)
      setForm(notePayload(fresh))
      setTagInput(fresh.tags.join('、'))
      setCoverFile(null)
      replaceCover(null, fresh.coverThumbnailUrl || fresh.coverImageUrl)
      setShowPreview(false)
      setShowForm(true)
    } catch (error) {
      alert(error instanceof Error ? error.message : '加载笔记失败')
    } finally {
      setLoading(false)
    }
  }

  const selectOrigin = (next: CareerGrowthNoteOrigin) => {
    if (editing) return
    setForm((current) => ({
      ...current,
      originType: next,
      authorName: next === 'original' ? 'Haigoo 职业研究' : '',
      sourceName: next === 'original' ? 'Haigoo Remote' : '',
      sourceUrl: '',
      rightsBasis: next === 'original' ? 'owned' : '',
      rightsConfirmed: next === 'original'
    }))
  }

  const handleCover = (file: File) => {
    if (!file.type.startsWith('image/')) return alert('请上传图片文件')
    if (file.size > MAX_COVER_BYTES) return alert('封面不能超过 8MB')
    setCoverFile(file)
    replaceCover(file)
  }

  const normalizedPayload = (statusOverride?: CorporateEnglishStatus, versionOverride?: number): SaveCareerGrowthNotePayload => ({
    ...form,
    status: statusOverride || form.status,
    version: versionOverride ?? form.version,
    tags: [...new Set(tagInput.split(/[，,、;；\n]+/).map((item) => item.trim()).filter(Boolean))].slice(0, 8),
    sortOrder: Number(form.sortOrder || 0),
    publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : new Date().toISOString()
  })

  const saveNote = async () => {
    if (!form.title.trim()) return alert('请填写中文标题')
    try {
      setSaving(true)
      const desiredStatus = form.status
      const needsCoverBeforePublish = desiredStatus === 'published' && !editing?.coverImageHash
      let saved = await corporateEnglishService.saveMiniNote(
        normalizedPayload(needsCoverBeforePublish ? 'draft' : desiredStatus),
        editing?.noteId
      )
      if (coverFile) {
        const linkedVideoId = saved.sourceVideoId || editing?.sourceVideoId
        await corporateEnglishService.uploadCoverImage({
          ownerType: linkedVideoId ? 'module_video' : 'growth_note',
          ownerId: linkedVideoId || saved.noteId,
          file: coverFile
        })
        saved = await corporateEnglishService.getMiniNote(saved.noteId)
      }
      if (needsCoverBeforePublish) {
        if (!coverFile) throw new Error('发布前请上传封面')
        saved = await corporateEnglishService.saveMiniNote(normalizedPayload('published', saved.version), saved.noteId)
      }
      setShowForm(false)
      setEditing(null)
      setCoverFile(null)
      replaceCover(null)
      await loadNotes()
      alert(saved.status === 'published' ? '笔记已发布' : '笔记已保存')
    } catch (error) {
      const conflict = error instanceof Error && (error as Error & { status?: number }).status === 409
      alert(conflict ? '这篇笔记已在另一个入口更新，请重新载入后再编辑。' : error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const archiveNote = async (note: CareerGrowthNote) => {
    if (!confirm(`确定归档「${note.title}」吗？归档后小程序和网站笔记入口将不再展示。`)) return
    try {
      await corporateEnglishService.saveMiniNote({ ...notePayload(note), status: 'archived' }, note.noteId)
      await loadNotes()
    } catch (error) {
      alert(error instanceof Error ? error.message : '归档失败')
    }
  }

  const resultLabel = useMemo(() => `共 ${total} 篇笔记`, [total])

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 py-3 backdrop-blur">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-orange-700">小程序 · 笔记合集</p>
            <h2 className="text-2xl font-black text-slate-950">{editing ? '编辑笔记' : '新增笔记'}</h2>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" type="button" onClick={() => setShowPreview((value) => !value)}><Eye className="h-4 w-4" />{showPreview ? '返回编辑' : '小程序预览'}</button>
            <button className="btn-secondary" type="button" onClick={() => setShowForm(false)}><ArrowLeft className="h-4 w-4" />返回列表</button>
            <button className="btn-primary" type="button" disabled={saving} onClick={saveNote}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}{saving ? '保存中' : '保存笔记'}</button>
          </div>
        </div>

        {showPreview ? (
          <div className="mx-auto max-w-[430px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {coverPreview ? <img src={coverPreview} alt="封面预览" className="aspect-video w-full object-cover" /> : null}
            <div className="space-y-4 p-6">
              <p className="text-xs font-bold text-orange-700">{form.category || '职业成长'}</p>
              <h1 className="text-3xl font-black leading-tight text-slate-950">{form.title || '笔记标题'}</h1>
              {form.originalTitle ? <p className="text-sm text-slate-500">{form.originalTitle}</p> : null}
              <p className="leading-7 text-slate-600">{form.summary || '笔记简介将在这里显示。'}</p>
              <p className="border-b border-slate-200 pb-5 text-sm text-slate-500">{form.authorName || '作者'} · {form.sourceName || '来源'}</p>
              <VideoNotesArticle notes={form.contentBlocks} emptyMessage="正文尚未填写" />
            </div>
          </div>
        ) : (
          <div className="card"><div className="card-content space-y-6">
            <section className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-1"><span className="text-sm font-bold text-slate-700">来源类型</span><select className="input" value={form.originType} disabled={Boolean(editing)} onChange={(event) => selectOrigin(event.target.value as CareerGrowthNoteOrigin)}>{!editing ? <><option value="original">Haigoo 原创</option><option value="external">外部整理</option></> : <option value={form.originType}>{ORIGIN_LABELS[form.originType]}</option>}</select></label>
              {editing?.sourceVideoId ? <div className="flex items-end"><a className="btn-secondary" href="/admin_team?tab=corporate-english" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />打开关联视频</a></div> : null}
              <label className="space-y-1 lg:col-span-2"><span className="text-sm font-bold text-slate-700">中文标题</span><input className="input" value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} /></label>
              <label className="space-y-1 lg:col-span-2"><span className="text-sm font-bold text-slate-700">原题（可选）</span><input className="input" value={form.originalTitle || ''} onChange={(event) => setForm((value) => ({ ...value, originalTitle: event.target.value }))} /></label>
              <label className="space-y-1 lg:col-span-2"><span className="text-sm font-bold text-slate-700">简介</span><textarea className="input min-h-[110px]" value={form.summary} onChange={(event) => setForm((value) => ({ ...value, summary: event.target.value }))} /></label>
              <label className="space-y-1"><span className="text-sm font-bold text-slate-700">作者</span><input className="input" value={form.authorName} onChange={(event) => setForm((value) => ({ ...value, authorName: event.target.value }))} /></label>
              <label className="space-y-1"><span className="text-sm font-bold text-slate-700">来源名称</span><input className="input" value={form.sourceName} onChange={(event) => setForm((value) => ({ ...value, sourceName: event.target.value }))} /></label>
              <label className="space-y-1 lg:col-span-2"><span className="text-sm font-bold text-slate-700">HTTPS 来源链接{form.originType === 'external' ? '（必填）' : '（可选）'}</span><input className="input" type="url" value={form.sourceUrl || ''} onChange={(event) => setForm((value) => ({ ...value, sourceUrl: event.target.value }))} placeholder="https://" /></label>
              <label className="space-y-1"><span className="text-sm font-bold text-slate-700">主题</span><input className="input" value={form.category || ''} onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))} /></label>
              <label className="space-y-1"><span className="text-sm font-bold text-slate-700">难度</span><select className="input" value={form.difficultyLevel || ''} onChange={(event) => setForm((value) => ({ ...value, difficultyLevel: event.target.value }))}><option value="">不标注</option><option value="entry">入门</option><option value="junior">初级</option><option value="intermediate">中级</option><option value="advanced">高级</option></select></label>
              <label className="space-y-1 lg:col-span-2"><span className="text-sm font-bold text-slate-700">标签（顿号或逗号分隔，最多 8 个）</span><input className="input" value={tagInput} onChange={(event) => setTagInput(event.target.value)} /></label>
            </section>

            <section className="space-y-3 border-t border-slate-200 pt-6">
              <h3 className="text-lg font-black text-slate-900">封面与发布</h3>
              <div className="flex flex-wrap items-center gap-4">
                <button type="button" className="relative aspect-video w-full max-w-[320px] overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50" onClick={() => coverInputRef.current?.click()}>{coverPreview ? <img src={coverPreview} alt="笔记封面" className="h-full w-full object-cover" /> : <span className="flex h-full flex-col items-center justify-center gap-2 text-sm font-bold text-slate-500"><Upload className="h-6 w-6" />上传 16:9 封面</span>}</button>
                <p className="max-w-sm text-sm leading-6 text-slate-500">复用现有 WebP 封面管线，自动生成小程序列表缩略图和文章大图。发布必须有封面。</p>
              </div>
              <input ref={coverInputRef} type="file" className="hidden" accept="image/*" onChange={(event) => event.target.files?.[0] && handleCover(event.target.files[0])} />
              <div className="grid gap-4 lg:grid-cols-3">
                <label className="space-y-1"><span className="text-sm font-bold text-slate-700">阅读权益</span><select className="input" value={form.accessTier} onChange={(event) => setForm((value) => ({ ...value, accessTier: event.target.value as CorporateEnglishAccessTier }))}><option value="free">免费</option><option value="vip">会员</option></select></label>
                <label className="space-y-1"><span className="text-sm font-bold text-slate-700">状态</span><select className="input" value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value as CorporateEnglishStatus }))}><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option></select></label>
                <label className="space-y-1"><span className="text-sm font-bold text-slate-700">发布时间</span><input className="input" type="datetime-local" value={form.publishedAt || ''} onChange={(event) => setForm((value) => ({ ...value, publishedAt: event.target.value }))} /></label>
                <label className="space-y-1"><span className="text-sm font-bold text-slate-700">排序</span><input className="input" type="number" value={form.sortOrder || 0} onChange={(event) => setForm((value) => ({ ...value, sortOrder: Number(event.target.value || 0) }))} /></label>
                <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-4"><input type="checkbox" checked={form.isFeatured === true} onChange={(event) => setForm((value) => ({ ...value, isFeatured: event.target.checked }))} /><span className="text-sm font-bold text-slate-700">精选笔记</span></label>
              </div>
              {form.originType === 'external' ? <div className="space-y-3 rounded-lg border border-orange-200 bg-orange-50 p-4"><label className="block space-y-1"><span className="text-sm font-bold text-slate-900">发布依据</span><select className="input bg-white" value={form.rightsBasis || ''} onChange={(event) => setForm((value) => ({ ...value, rightsBasis: event.target.value }))}><option value="">请选择</option><option value="licensed">已获授权</option><option value="permission">已获权利方许可</option><option value="source_terms">来源条款允许</option><option value="fair_use">合理引用并已复核</option></select></label><label className="flex items-start gap-3"><input className="mt-1" type="checkbox" checked={form.rightsConfirmed === true} onChange={(event) => setForm((value) => ({ ...value, rightsConfirmed: event.target.checked }))} /><span><span className="block text-sm font-bold text-slate-900">确认具备整理与发布依据</span><span className="mt-1 block text-xs leading-5 text-slate-600">请在发布前确认引用范围、授权或其他合法依据；后台会记录确认人和时间。</span></span></label></div> : null}
            </section>

            <VideoNotesEditor contentLabel="笔记正文" value={form.contentBlocks} onChange={(contentBlocks) => setForm((value) => ({ ...value, contentBlocks }))} />
          </div></div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-orange-700">小程序 1.0</p><h2 className="text-2xl font-black text-slate-950">笔记合集</h2><p className="mt-1 text-sm text-slate-500">统一管理视频笔记、Haigoo 原创和外部整理内容。</p></div>
        <div className="flex gap-2"><button className="btn-secondary" type="button" onClick={loadNotes}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />刷新</button><button className="btn-primary" type="button" onClick={openCreate}><Plus className="h-4 w-4" />新增笔记</button></div>
      </div>
      <div className="card"><div className="card-content space-y-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_150px_150px_150px_180px]">
          <div className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input aria-label="搜索笔记" className="h-12 w-full rounded-lg border border-slate-200 pl-11 pr-4" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage(1); setSearch(searchDraft.trim()); setCategory(categoryDraft.trim()) } }} placeholder="搜索标题、作者、来源或标签" /></div>
          <select aria-label="按来源筛选" className="input" value={originType} onChange={(event) => { setOriginType(event.target.value as CareerGrowthNoteOrigin | 'all'); setPage(1) }}><option value="all">全部来源</option><option value="video">视频笔记</option><option value="original">Haigoo 原创</option><option value="external">外部整理</option></select>
          <select aria-label="按状态筛选" className="input" value={status} onChange={(event) => { setStatus(event.target.value as CorporateEnglishStatus | 'all'); setPage(1) }}><option value="all">全部状态</option><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option></select>
          <select aria-label="按权益筛选" className="input" value={accessTier} onChange={(event) => { setAccessTier(event.target.value as CorporateEnglishAccessTier | 'all'); setPage(1) }}><option value="all">全部权益</option><option value="free">免费</option><option value="vip">会员</option></select>
          <input aria-label="按主题筛选" className="input" value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { setPage(1); setSearch(searchDraft.trim()); setCategory(categoryDraft.trim()) } }} placeholder="主题精确筛选" />
        </div>
        <div className="flex items-center justify-between text-sm text-slate-500"><span>{resultLabel}</span><button type="button" className="font-bold text-slate-700" onClick={() => { setPage(1); setSearch(searchDraft.trim()); setCategory(categoryDraft.trim()) }}>搜索</button></div>
        <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr>{['笔记','来源','作者 / 主题','权益','状态','更新时间 / 更新人','操作'].map((label) => <th key={label} className="px-4 py-3 text-left text-xs font-bold text-slate-500">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 bg-white">
          {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />正在加载</td></tr> : notes.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">暂无符合条件的笔记</td></tr> : notes.map((note) => <tr key={note.noteId} className="align-top">
            <td className="px-4 py-4"><div className="flex min-w-[300px] gap-3">{note.coverThumbnailUrl ? <img src={note.coverThumbnailUrl} alt="" className="h-16 w-24 rounded-lg object-cover" /> : <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">无封面</div>}<div><p className="line-clamp-2 font-bold text-slate-900">{note.title}</p>{note.originalTitle ? <p className="mt-1 line-clamp-1 text-xs text-slate-500">{note.originalTitle}</p> : null}{note.isFeatured ? <span className="mt-2 inline-flex rounded bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700">精选</span> : null}</div></div></td>
            <td className="px-4 py-4 text-sm"><span className="rounded bg-slate-100 px-2 py-1 font-bold text-slate-700">{ORIGIN_LABELS[note.originType]}</span>{note.sourceVideoId ? <a href="/admin_team?tab=corporate-english" className="mt-2 flex items-center gap-1 text-xs text-blue-700">关联视频 <ExternalLink className="h-3 w-3" /></a> : null}</td>
            <td className="px-4 py-4 text-sm text-slate-600"><p className="font-semibold text-slate-800">{note.authorName || '-'}</p><p className="mt-1">{note.category || '-'}</p></td>
            <td className="px-4 py-4 text-sm font-bold">{note.accessTier === 'free' ? '免费' : '会员'}</td>
            <td className="px-4 py-4"><span className={`rounded px-2 py-1 text-xs font-bold ${note.status === 'published' ? 'bg-emerald-50 text-emerald-700' : note.status === 'archived' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700'}`}>{note.status === 'published' ? '已发布' : note.status === 'archived' ? '已归档' : '草稿'}</span></td>
            <td className="px-4 py-4 text-xs leading-5 text-slate-500"><p>{formatDate(note.updatedAt)}</p><p>{note.updatedBy || '-'}</p></td>
            <td className="px-4 py-4"><div className="flex gap-1"><button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="编辑笔记" onClick={() => void openEdit(note)}><Edit3 className="h-4 w-4" /></button>{note.status !== 'archived' ? <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="归档笔记" onClick={() => void archiveNote(note)}><Archive className="h-4 w-4" /></button> : null}</div></td>
          </tr>)}
        </tbody></table></div>
        <div className="flex items-center justify-between"><button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><span className="text-sm text-slate-500">{page} / {totalPages}</span><button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页</button></div>
      </div></div>
    </div>
  )
}
