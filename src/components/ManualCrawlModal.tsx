import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ExternalLink, Loader2, Pause, Play, RefreshCw, X } from 'lucide-react'
import { CrawlFields, CrawlItem, CrawlMode, CrawlSession, manualCrawlRequest } from '../services/manual-crawl-service'

export type CrawlCompanySnapshot = { id: string; name: string; careersPage?: string }
type Props = {
  mode: CrawlMode | 'history'; companies: CrawlCompanySnapshot[]; page: number; forcePreflight?: boolean
  onClose: () => void; onChanged: () => void; onManageJobs?: () => void
}
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#466f9d] disabled:cursor-not-allowed disabled:opacity-40'
const primary = `${button} !border-[#466f9d] !bg-[#466f9d] !text-white hover:!bg-[#345d88]`
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#466f9d] disabled:bg-slate-50'
const kinds: Record<string, string> = { create: '新增', update: '内容变更', close: '疑似失效', unchanged: '未变化', unknown: '无法确定', restore: '恢复建议' }
const states: Record<string, string> = { pending: '待处理', queued: '等待检查', running: '检查中', awaiting_review: '等待人工审核', approved: '可爬虫', rejected: '不可爬虫', skipped: '已跳过', failed: '检查失败', error: '检查失败', complete: '已完成', cancelled: '已停止', paused: '已暂停', draft: '已保存待审核', published: '已发布', deleted: '已删除', saved: '已保存待审核', pending_review: '待审核', needs_url: '需要招聘链接', ready: '等待人工判定', checking: '检查中' }
const stages: Record<string, string> = { queued: '等待检查', source: '读取招聘来源', listing: '获取岗位列表', details: '获取岗位详情', mapping: '识别岗位字段', review: '等待人工判定', verification: '检查现有岗位链接', complete: '检查完成', failed: '本次检查失败' }
const fields = [['title', '岗位标题'], ['url', '申请链接'], ['description', '职位描述'], ['location', '地点'], ['salary', '薪资'], ['job_type', '工作类型'], ['experience_level', '经验要求'], ['region', '远程范围'], ['timezone', '时区'], ['requirements', '任职要求'], ['benefits', '福利'], ['category', '岗位分类'], ['tags', '标签']] as const
const display = (value: unknown): string => value == null || value === '' ? '' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
const errorMessage = (message: string) => ({ JOB_CONFLICT: '岗位已被其他管理员修改。当前编辑已保留，请重新发起更新检查并对比最新内容后提交。', REVIEW_CONFLICT: '本条结果已被处理，请重新读取状态并核对最新结果。', SOURCE_CONFLICT: '招聘来源已改变，请重新预检后发起更新检查。', EVIDENCE_STALE: '检查证据已过期，请重新发起更新检查。', SESSION_CANCELLED: '本次检查已停止，请点击继续检查后处理结果。' } as Record<string, string>)[message] || message
const actionable = (item: CrawlItem) => ['pending', 'proposed', 'draft', 'saved', 'pending_review', 'awaiting_review', 'open'].includes(item.status)
const safeUrl = (value: unknown) => { try { const u = new URL(String(value)); return ['http:', 'https:'].includes(u.protocol) ? u.href : undefined } catch { return undefined } }

export default function ManualCrawlModal({ mode, companies, page, forcePreflight, onClose, onChanged, onManageJobs }: Props) {
  const [session, setSession] = useState<CrawlSession | null>(null)
  const [previous, setPrevious] = useState<CrawlSession[]>([])
  const [history, setHistory] = useState<CrawlItem[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [selectedId, setSelectedId] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [edits, setEdits] = useState<Record<string, CrawlFields>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [warning, setWarning] = useState('')
  const [openJobsAfterClose, setOpenJobsAfterClose] = useState(false)
  const [busy, setBusy] = useState(false)
  const [driving, setDriving] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [url, setUrl] = useState('')
  const [confirm, setConfirm] = useState<'close' | 'delete' | null>(null)
  const [eligible, setEligible] = useState(false)
  const [fullItem, setFullItem] = useState<CrawlItem | null>(null)
  const [companyEvidence, setCompanyEvidence] = useState<CrawlFields | undefined>()
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [filter, setFilter] = useState('actionable')
  const dialogRef = useRef<HTMLDivElement>(null)
  const requestId = useRef(crypto.randomUUID())
  const alive = useRef(true)
  const executing = useRef(false)
  const stop = useRef(false)
  const changed = useRef(onChanged)
  changed.current = onChanged
  const isHistory = mode === 'history'
  const effectiveMode = session?.mode || mode
  const current = session?.companies.find(c => c.companyId === (selectedCompanyId || session.currentCompanyId)) || session?.companies.find(c => ['awaiting_review', 'ready', 'failed', 'running'].includes(c.status)) || session?.companies[0]
  const allItems = (isHistory ? history : (session?.items?.length ? session.items : session?.companies.flatMap(c => c.items || []) || [])).filter(i => i.status !== 'superseded')
  const companyItems = isHistory ? allItems : allItems.filter(i => i.companyId === current?.companyId)
  const visibleItems = companyItems.filter(i => filter === 'all' || (filter === 'actionable' ? actionable(i) || i.status === 'deleted' : i.kind === filter))
  const selectedItem = companyItems.find(i => i.id === selectedId) || visibleItems.find(i => i.status === 'proposed') || visibleItems[0]
  const item = fullItem?.id === selectedItem?.id && fullItem?.version === selectedItem?.version ? fullItem : selectedItem
  const draft = item ? edits[item.id] || item.draft || {} : {}
  const evidence = item ? item.raw : current?.raw || companyEvidence
  const sourcePosting = item?.raw?.source_payload as CrawlFields | undefined
  const fieldEvidence = sourcePosting?.field_evidence as Record<string, string[]> | undefined
  const savedJob = !!item && (item.status === 'pending' || (item.status === 'draft' && item.kind === 'create'))
  const stoppedProposal = session?.status === 'cancelled' && item?.status === 'proposed'
  const protectedField = (key: string) => item?.kind === 'update' && ['category', 'tags'].includes(key)
  const canEdit = effectiveMode !== 'preflight' && !detailsLoading && !stoppedProposal && !!item?.raw && actionable(item) && !['close', 'unknown', 'unchanged'].includes(item.kind)
  const dirty = Object.keys(edits).length > 0

  const accept = useCallback((next?: CrawlSession) => {
    if (!alive.current || !next) return
    setSession(next)
  }, [])
  const refreshHistory = useCallback(async (offset = 0) => {
    const result = await manualCrawlRequest(undefined, { companyIds: companies.map(c => c.id).join(','), ...(isHistory ? { companyId: companies[0].id, offset:String(offset) } : {}) })
    if (alive.current) { setHistory(result.reviewItems || []); setHistoryTotal(result.reviewTotal || result.reviewItems?.length || 0); setHistoryOffset(offset); setPrevious((result.sessions || []).filter(s => s.status !== 'complete')) }
    return result
  }, [companies, isHistory])
  const start = useCallback(async () => {
    setBusy(true); setError(''); stop.current = false
    try {
      const result = await manualCrawlRequest({ action: 'start', mode, companyIds: companies.map(c => c.id), requestId: requestId.current, forcePreflight: !!forcePreflight })
      accept(result.session); setDriving(true); setPrevious([])
    } catch (e) { setError((e as Error).message) } finally { if (alive.current) setBusy(false) }
  }, [mode, companies, forcePreflight, accept])

  useEffect(() => {
    alive.current = true
    void refreshHistory().then(result => {
      if (!alive.current) return
      setInitialized(true)
      const resumable = (result.sessions || []).filter(s => s.mode === mode && s.status !== 'complete')
      setPrevious(resumable)
      if (!isHistory && !resumable.length) void start()
    }).catch(e => { if (alive.current) { setError(e.message); setInitialized(true) } })
    return () => { alive.current = false; stop.current = true }
  }, [refreshHistory, start, isHistory, mode])

  // One bounded server step at a time. Only a manual start/continue enables this loop.
  useEffect(() => {
    if (!driving || !session || session.status !== 'running' || busy || executing.current || stop.current) return
    executing.current = true; setBusy(true)
    void manualCrawlRequest({ action: 'step', sessionId: session.id }).then(result => {
      if (!stop.current) accept(result.session)
    }).catch(e => { if (alive.current) { setError(e.message); setDriving(false) } }).finally(() => {
      executing.current = false
      if (alive.current) setBusy(false)
    })
  }, [session, driving, busy, accept])

  useEffect(() => { setUrl(current?.url || companies.find(c => c.id === current?.companyId)?.careersPage || ''); setRejecting(false); setReason(''); setSelectedId('') }, [current?.companyId, current?.url, companies])
  useEffect(() => { setEligible(false) }, [item?.id])
  // Lists contain only titles. Load one full record/evidence set on demand.
  useEffect(() => {
    let active = true
    setCompanyEvidence(undefined)
    if (selectedItem?.raw) { setDetailsLoading(false); return }
    if (!selectedItem && !session) return
    setDetailsLoading(true)
    const query: Record<string,string> = selectedItem ? { itemId: selectedItem.id } : { sessionId: session!.id, evidenceCompanyId: current?.companyId || '' }
    void manualCrawlRequest(undefined, query).then(result => {
      if (!active) return
      if (result.item) setFullItem(result.item)
      setCompanyEvidence(result.evidence)
    }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setDetailsLoading(false) })
    return () => { active = false }
  }, [selectedItem?.id, selectedItem?.version, selectedItem?.raw, session?.id, current?.companyId, current?.status])

  const loadItems = async (companyId: string, offset = 0) => {
    if (!session) return
    setBusy(true); setError('')
    try {
      const result = await manualCrawlRequest(undefined, {sessionId:session.id,focusCompanyId:companyId,offset:String(offset)})
      accept(result.session); setSelectedCompanyId(companyId); setSelectedId('')
    } catch(e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; dialogRef.current?.focus()
    return () => { document.body.style.overflow = overflow; old?.focus() }
  }, [])

  const act = async (action: string, data: Record<string, unknown> = {}) => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await manualCrawlRequest({ action, sessionId: session?.id, ...(['decide','restore','retry-publication'].includes(action) ? {focusCompanyId:current?.companyId,offset:session?.itemsOffset || 0} : {}), ...(action === 'retry' ? { requestId: crypto.randomUUID(), expectedAttempt: current?.attempt } : {}), ...data })
      accept(result.session)
      setWarning(result.warning || result.publicationError || '')
      if (['retry', 'continue', 'qualify', 'skip'].includes(action)) { stop.current = false; setDriving(true); setSelectedCompanyId('') }
      changed.current()
      return true
    } catch (e) { setError(errorMessage((e as Error).message)); setDriving(false); return false } finally { if (alive.current) setBusy(false) }
  }
  const decide = async (decision: string) => {
    if (!item || effectiveMode === 'preflight' || stoppedProposal) return
    if (['draft', 'publish'].includes(decision)) {
      if (!display(draft.title).trim() || display(draft.description).trim().length < 50 || !safeUrl(draft.url)) { setError('请填写岗位标题、至少 50 字符的职位描述和有效的申请链接。'); return }
      if (decision === 'publish' && !eligible) { setError('发布前请确认招聘范围和岗位归属。'); return }
    }
    const okay = await act(decision === 'restore' && item.status === 'deleted' ? 'restore' : 'decide', { sessionId: item.sessionId || session?.id, itemId: item.id, version: item.version, decision, ...(canEdit ? { patch: Object.fromEntries(Object.entries(draft).filter(([key]) => !protectedField(key)).map(([key, value]) => [key, ['requirements', 'benefits', 'tags'].includes(key) && typeof value === 'string' ? value.split(key === 'tags' ? /[,，、\n]/ : /\n/).map(v => v.trim()).filter(Boolean) : value])) } : {}), eligibilityConfirmed: eligible })
    if (okay) {
      setEdits(old => { const next = { ...old }; delete next[item.id]; return next }); setConfirm(null); setSelectedId('')
      setNotice(({ draft: '已保存为待审核。已有岗位的线上内容保持原样。', publish: '岗位已发布线上。', pending: '岗位已转为待审核，并从线上隐藏。', delete: '岗位已删除，可在本企业的处理记录中恢复。', cancel: '已取消本条建议，岗位内容未改变。', restore: '岗位已恢复为待审核，可核对后发布。' } as Record<string, string>)[decision] || '操作已保存。')
      if (isHistory) await refreshHistory().catch(e => setError(e.message))
    }
  }
  const close = async () => {
    // Fence the active step before asking the server to stop; ignore late responses.
    stop.current = true; setDriving(false); setBusy(true)
    try {
      if (!isHistory && session && !['complete', 'cancelled'].includes(session.status)) await manualCrawlRequest({ action: 'cancel', sessionId: session.id })
      if (openJobsAfterClose) onManageJobs?.(); else onClose()
    } catch (e) { setError((e as Error).message); setConfirm(null); setBusy(false) }
  }
  const requestClose = () => { if (dirty || (!isHistory && session && !['complete', 'cancelled'].includes(session.status))) setConfirm('close'); else onClose() }
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); requestClose() }
    if (event.key !== 'Tab') return
    const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]') || []).filter(n => n.offsetParent !== null)
    if (!nodes.length) { event.preventDefault(); return }
    if (event.shiftKey && (document.activeElement === nodes[0] || document.activeElement === dialogRef.current)) { event.preventDefault(); nodes[nodes.length - 1].focus() }
    else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus() }
  }
  const updateField = (key: string, value: unknown) => item && setEdits(old => ({ ...old, [item.id]: { ...draft, [key]: value } }))

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-2 sm:p-5">
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="manual-crawl-title" tabIndex={-1} onKeyDown={onKeyDown} className="flex h-[94dvh] w-full max-w-[1480px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-3 py-3 sm:px-5 sm:py-4">
        <div><h2 id="manual-crawl-title" className="text-xl font-semibold text-slate-900">{isHistory ? `${companies[0].name} · 岗位处理记录` : effectiveMode === 'preflight' ? '爬虫预检' : '更新检查'}</h2>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">{isHistory ? '继续审核已保存的修改，或恢复手动删除的岗位。' : `当前第 ${page} 页 · 本次 ${companies.length} 家企业。范围已锁定，翻页和筛选不会影响本次操作。`}</p>
          {!isHistory && <p className="mt-1 text-xs text-slate-500">{effectiveMode === 'preflight' ? '逐家验证能否提取岗位；通过只标记爬虫资格，不保存岗位。' : '只检查可爬虫企业。新增、修改和失效结果都由你逐项决定。'}</p>}
        </div><button className={button} onClick={requestClose} aria-label="关闭爬虫工作流"><X size={18} /></button>
      </header>
      {error && <div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800"><span>{error}{dirty && ' 当前编辑内容仍保留。'}</span><button className={button} disabled={busy || detailsLoading} onClick={() => { stop.current = true; setDriving(false); setError(''); if (session) void manualCrawlRequest(undefined, { sessionId: session.id }).then(r => accept(r.session)).catch(e => setError(e.message)); else void refreshHistory().catch(e => setError(e.message)) }}>重新读取状态</button></div>}
      {session?.publicationErrors?.map(failure => <div key={failure.companyId} role="alert" className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900"><span>{session.companies.find(c => c.companyId === failure.companyId)?.name}：岗位已保存，前台同步{failure.status === 'pending' ? '尚未完成' : '失败'}。{failure.error}</span><button className={button} disabled={busy || detailsLoading} onClick={() => void act('retry-publication', { companyId: failure.companyId })}>重试前台同步</button></div>)}
      {warning && !session?.publicationErrors?.length && <p role="alert" className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">{warning}</p>}
      {notice && <p role="status" className="shrink-0 bg-emerald-50 px-5 py-2 text-sm text-emerald-800">{notice}</p>}
      {confirm && <div role="alertdialog" aria-labelledby="manual-confirm-title" className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-4">
        <h3 id="manual-confirm-title" className="font-semibold text-slate-900">{confirm === 'close' ? '结束本次操作？' : `删除「${display(draft.title) || '此岗位'}」？`}</h3>
        <p className="mt-1 text-sm text-slate-700">{confirm === 'close' ? `后续抓取将停止，已提交的结果会保留。${dirty ? '未保存的编辑将丢弃。' : ''}下次可手动继续。` : `所属企业：${item?.companyName || current?.name}。岗位将从线上隐藏；可在企业处理记录中恢复。`}</p>
        <div className="mt-3 flex gap-2"><button className={button} onClick={() => { setConfirm(null); setOpenJobsAfterClose(false) }}>继续处理</button><button className={`${button} !text-red-700`} disabled={confirm === 'delete' && busy} onClick={() => confirm === 'close' ? void close() : void decide('delete')}>{confirm === 'close' ? openJobsAfterClose ? '丢弃编辑并查看岗位' : '结束并关闭' : '确认删除'}</button></div>
      </div>}
      {!session && !isHistory ? <div className="min-h-0 flex-1 overflow-auto p-6">
        {!initialized || busy ? <p role="status" className="flex items-center gap-2 text-slate-600"><Loader2 size={18} className="animate-spin" />正在读取本次范围…</p> : <>
          {previous.length > 0 && <><h3 className="font-semibold">发现未完成的操作</h3><p className="mt-1 text-sm text-slate-600">读取记录不会抓取。点击继续后，才会恢复检查。</p><div className="my-4 space-y-2">{previous.map(s => <div key={s.id} className="flex items-center justify-between rounded-lg border p-3"><span>{s.companies?.map(c => c.name).join('、') || `${s.companyIds.length} 家企业`} · {states[s.status]}</span><button className={button} onClick={() => { accept(s); setDriving(false); setPrevious([]) }}>查看记录</button></div>)}</div></>}
          <button className={primary} onClick={() => void start()}>{previous.length ? '开始本页新检查' : '开始检查'}</button>
        </>}
      </div> : <>
        {!isHistory && <div className="shrink-0 border-b bg-slate-50 px-5 py-3">
          <div className="flex max-h-24 flex-wrap items-center gap-2 overflow-y-auto" aria-label="本次企业队列">{session?.companies.map(c => <button key={c.companyId} className={`${button} !py-1.5 ${current?.companyId === c.companyId ? '!border-[#466f9d] !bg-blue-50' : ''}`} disabled={busy || detailsLoading} onClick={() => void loadItems(c.companyId)}>{c.name}<span className="text-xs text-slate-500">{c.partial && c.status === 'complete' ? '部分完成' : states[c.status] || '待检查'}</span></button>)}</div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600"><span aria-live="polite">{busy && <Loader2 size={14} className="mr-1 inline animate-spin" />}{current?.name} · {stages[current?.stage || ''] || current?.stage || states[current?.status || ''] || '等待开始'}{current?.progress && ` · 已检查 ${current.progress.checked} / ${current.progress.total ?? '待确定'} 个岗位 · ${current.progress.pages} 页`}</span><span>第 {current?.attempt || 1} 次尝试 · 已重试 {current?.retries || 0} / 5</span></div>
          {current?.error && <p className="mt-2 text-sm text-amber-800">{current.error}</p>}
          {session && (session.status === 'complete' || (effectiveMode === 'update' && session.companies.every(c => ['complete', 'skipped'].includes(c.status)))) && <div className="mt-2 text-sm text-emerald-800" role="status">
            {effectiveMode === 'preflight' ? <>预检已结束，未保存或发布任何岗位。<p>通过 {session.companies.filter(c => c.status === 'approved').length} · 不通过 {session.companies.filter(c => c.status === 'rejected').length} · 跳过 {session.companies.filter(c => c.status === 'skipped').length}</p></> : <>本次抓取检查已结束，以下结果等待你核对。<p>完整检查 {session.companies.filter(c => c.status === 'complete' && !c.partial).length} · 部分完成 {session.companies.filter(c => !!c.partial).length} · 跳过企业 {session.companies.filter(c => c.status === 'skipped').length} · 新增待审核 {session.summary?.item_draft_create ?? allItems.filter(i => i.status === 'draft' && i.kind === 'create').length} · 修改待审核 {session.summary?.item_draft !== undefined ? session.summary.item_draft - (session.summary.item_draft_create || 0) : allItems.filter(i => i.status === 'draft' && i.kind !== 'create').length} · 已转待审核 {session.summary?.item_pending ?? allItems.filter(i => i.status === 'pending').length} · 已发布 {session.summary?.item_published ?? allItems.filter(i => i.status === 'published').length} · 已删除 {session.summary?.item_deleted ?? allItems.filter(i => i.status === 'deleted').length} · 未处理 {session.summary?.item_proposed !== undefined ? session.summary.item_proposed - (session.summary.item_proposed_unchanged || 0) : allItems.filter(i => i.status === 'proposed' && i.kind !== 'unchanged').length}</p></>}
          </div>}
          {current?.reason && <p className="mt-1 text-xs text-slate-600">{current.reason}</p>}
        </div>}
        {isHistory && <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-slate-50 px-5 py-3"><p className="text-sm text-slate-600">已保存的待审核与删除记录共 {historyTotal} 条；当前显示 {history.length} 条。</p><button className={button} onClick={() => { if (dirty) { setOpenJobsAfterClose(true); setConfirm('close') } else onManageJobs?.() }}>查看企业岗位（含待发布）</button></div>}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
          <aside className="max-h-40 shrink-0 overflow-auto border-b bg-slate-50 p-3 md:max-h-none md:w-56 md:border-b-0 md:border-r">
            <label className="block text-xs font-medium text-slate-600">岗位结果<select aria-label="筛选岗位结果" className={`${input} mt-2`} value={filter} onChange={e => { setFilter(e.target.value); setSelectedId('') }}><option value="actionable">需要处理</option><option value="all">全部结果</option>{Object.entries(kinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <div className="mt-3 space-y-2">{visibleItems.map(i => <button key={i.id} onClick={() => setSelectedId(i.id)} className={`w-full rounded-lg border p-3 text-left text-sm ${item?.id === i.id ? 'border-[#466f9d] bg-white shadow-sm' : 'border-transparent hover:bg-white'}`}><span className="block truncate font-medium">{display(i.draft?.title) || display(i.before?.title) || '未识别标题'}</span><span className="mt-1 block text-xs text-slate-500">{kinds[i.kind]} · {states[i.status] || '待处理'}</span></button>)}</div>
            {!isHistory && session && (session.itemsTotal || 0) > 25 && <div className="mt-3 space-y-2 text-xs text-slate-600"><p>本企业共 {session.itemsTotal} 条结果，当前 {Math.floor((session.itemsOffset || 0) / 25) + 1} / {Math.ceil((session.itemsTotal || 0) / 25)} 页；筛选应用于当前结果页。</p><div className="flex gap-2"><button className={button} disabled={busy || !(session.itemsOffset || 0)} onClick={() => void loadItems(current!.companyId, Math.max(0,(session.itemsOffset || 0)-25))}>上一页</button><button className={button} disabled={busy || (session.itemsOffset || 0)+25 >= (session.itemsTotal || 0)} onClick={() => void loadItems(current!.companyId,(session.itemsOffset || 0)+25)}>下一页</button></div></div>}
            {isHistory && historyTotal > 25 && <div className="mt-3 flex gap-2"><button className={button} disabled={busy || !historyOffset} onClick={() => void refreshHistory(Math.max(0,historyOffset-25)).catch(e=>setError(e.message))}>上一页</button><button className={button} disabled={busy || historyOffset+25>=historyTotal} onClick={() => void refreshHistory(historyOffset+25).catch(e=>setError(e.message))}>下一页</button></div>}
            {detailsLoading && <p role="status" className="mt-3 text-sm text-slate-500">正在读取岗位原文与完整字段…</p>}
            {!visibleItems.length && <p className="mt-4 text-sm text-slate-500">{busy ? '正在检查，结果会逐步显示。' : '当前分类没有岗位结果。可切换到全部结果。'}</p>}
          </aside>
          <section aria-labelledby="crawl-evidence-title" className="min-h-[220px] min-w-0 shrink-0 md:flex-1 md:overflow-auto border-b p-5 md:border-b-0 md:border-r">
            <h3 id="crawl-evidence-title" className="font-semibold text-slate-900">抓取原文</h3>
            <p className="mt-1 text-xs text-slate-500">展示实际请求结果与检查证据，原始内容不会执行。</p>
            {(current || item) && <div className="my-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-medium">{item?.companyName || current?.name}</p>{item && <p className="mt-1">{display(sourcePosting?.title || item.draft.title)}</p>}{safeUrl(sourcePosting?.url || item?.draft?.url || current?.url) && <a className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-[#466f9d] underline" href={safeUrl(sourcePosting?.url || item?.draft?.url || current?.url)} target="_blank" rel="noopener noreferrer">{item ? '打开本岗位原页面' : '打开原招聘页'}<ExternalLink size={13} className="shrink-0" /></a>}</div>}
            {item?.reason && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{item.reason}</p>}
            {evidence ? <div className="space-y-3">
              {sourcePosting?.description ? <article className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><p className="mb-3 text-xs text-slate-500">当前选中岗位的原文，与右侧字段对应。完整列表响应可在下方技术详情查看。</p><p className="whitespace-pre-wrap break-words leading-6">{display(sourcePosting.description)}</p></article> : null}
              {!sourcePosting?.description && Array.isArray(evidence.requests) && (evidence.requests as Array<Record<string,unknown>>).map((request,index) => <article key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">请求 {index+1} · HTTP {display(request.status)}</span>{safeUrl(request.url) && <a href={safeUrl(request.url)} target="_blank" rel="noopener noreferrer" className="text-[#466f9d] underline">打开来源</a>}</div>
                <p className="mt-1 break-all text-xs text-slate-500">{display(request.url)}</p>
                <p className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words leading-6">{display(request.text) || '页面未返回可读的岗位正文。可能需要浏览器动态加载或登录，请核对招聘入口。'}</p>
                {request.truncated === true && <p className="mt-2 text-xs text-amber-800">原始响应较长，保留的响应为截取片段。</p>}
              </article>)}
              {!sourcePosting?.description && !Array.isArray(evidence.requests) && <pre className="whitespace-pre-wrap break-words rounded-lg border bg-slate-50 p-4 text-xs leading-6">{JSON.stringify(evidence,null,2)}</pre>}
              <details className="rounded-lg border p-3 text-xs text-slate-600"><summary className="cursor-pointer font-medium">查看原始响应与提取记录（技术详情）</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(evidence,null,2)}</pre></details>
            </div> : <p className="mt-8 text-sm leading-6 text-slate-500">{current?.error || (busy ? '正在请求招聘页。收到真实响应后，原文和字段识别结果会显示在这里。' : '选择左侧岗位查看原文。没有有效样本时，不能确认预检通过。')}</p>}

          </section>
          <section aria-labelledby="crawl-fields-title" className="min-h-[220px] min-w-0 shrink-0 md:flex-1 md:overflow-auto p-5">
            <h3 id="crawl-fields-title" className="font-semibold text-slate-900">{effectiveMode === 'preflight' ? '字段识别结果' : '核对与编辑'}</h3><p className="mt-1 text-xs text-slate-500">{effectiveMode === 'preflight' ? '空白字段表示未识别。预检结果不会保存为岗位。' : item?.kind === 'update' ? '对比当前线上内容。保存修改待审核后，线上继续显示旧版本。' : '核对所属企业、岗位内容与申请范围后，再保存或发布。'}</p>
            {item && <div className="mt-4 space-y-4">
              {fields.map(([key, label]) => <div key={key} className="block text-sm font-medium text-slate-700"><label htmlFor={`crawl-field-${key}`}>{label}</label>{protectedField(key) && <span className="ml-2 text-xs font-normal text-slate-500">保留人工分类</span>}{['title', 'url', 'description'].includes(key) && canEdit && <span aria-hidden="true" className="ml-1 text-red-600">*</span>}
                {item.kind === 'update' && item.before && display(item.before[key]) !== display(item.draft[key]) && <div className="my-1 rounded bg-amber-50 p-2 text-xs font-normal"><p className="max-h-24 overflow-auto whitespace-pre-wrap">当前线上：{display(item.before[key]) || '未填写'}</p><div className="mt-1 flex gap-3"><button type="button" disabled={!canEdit || busy || protectedField(key)} aria-label={`保留${label}线上值`} className="text-[#466f9d] underline" onClick={() => updateField(key, item.before?.[key] ?? '')}>保留线上值</button><button type="button" disabled={!canEdit || busy || protectedField(key)} aria-label={`采用${label}抓取值`} className="text-[#466f9d] underline" onClick={() => updateField(key, item.draft[key] ?? '')}>采用抓取值</button></div></div>}
                {['description', 'requirements', 'benefits'].includes(key) ? <textarea id={`crawl-field-${key}`} aria-label={label} className={`${input} mt-1 font-normal`} rows={key === 'description' ? 7 : 3} value={Array.isArray(draft[key]) ? (draft[key] as unknown[]).join('\n') : display(draft[key])} disabled={!canEdit || busy || protectedField(key)} placeholder="未识别" onChange={e => updateField(key, e.target.value)} /> : <input id={`crawl-field-${key}`} aria-label={label} className={`${input} mt-1 font-normal`} value={Array.isArray(draft[key]) ? (draft[key] as unknown[]).join('、') : display(draft[key])} disabled={!canEdit || busy || protectedField(key)} placeholder="未识别" onChange={e => updateField(key, e.target.value)} />}
                {fieldEvidence?.[key]?.length ? <p className="mt-1 text-xs font-normal text-slate-500">本岗位原文：{fieldEvidence[key].join('；')}</p> : null}
                {key === 'job_type' && fieldEvidence?.schedule?.length ? <p className="mt-1 text-xs font-normal text-slate-500">工作安排：{fieldEvidence.schedule.join('；')}</p> : null}
              </div>)}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_remote === true} disabled={!canEdit || busy} onChange={e => updateField('is_remote', e.target.checked)} />支持远程工作</label>
              {canEdit && <label className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"><input className="mt-1" type="checkbox" checked={eligible} onChange={e => setEligible(e.target.checked)} />我已核对岗位属于本企业，且招聘地域与申请条件适合在本站发布。</label>}
            </div>}
            {!item && <p className="mt-8 text-sm text-slate-500">{effectiveMode === 'preflight' ? '等待可核对的岗位样本。' : '选择一条结果开始核对。检查失败或结果为空不会自动下线岗位。'}</p>}
          </section>
        </div>
        <footer className="shrink-0 border-t bg-white px-5 py-3">
          {effectiveMode === 'preflight' && (session?.status !== 'cancelled' || current?.status === 'failed') && current && !['approved', 'rejected', 'skipped'].includes(current.status) && <div className="mb-3 flex flex-wrap items-end gap-3"><label className="min-w-0 basis-60 flex-1 text-xs text-slate-600">本企业招聘页<input className={`${input} mt-1`} type="url" value={url} placeholder="https://…" disabled={busy || detailsLoading} onChange={e => setUrl(e.target.value)} /></label>{!current.url && <button className={button} disabled={busy || !safeUrl(url)} onClick={() => void act('retry', { companyId: current.companyId, url })}>使用此链接开始预检</button>}{rejecting && <label className="min-w-0 basis-52 flex-1 text-xs text-slate-600">不通过原因（可选）<input className={`${input} mt-1`} value={reason} onChange={e => setReason(e.target.value)} placeholder="例如：详情缺失或岗位不属于本企业" /></label>}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">{!isHistory && session && <><span className="mr-2 text-xs text-slate-500">{session.companies.filter(c => ['approved', 'rejected', 'skipped', 'complete'].includes(c.status)).length} / {session.companyIds.length} 家已处理</span>{driving && session.status === 'running' ? <button className={button} onClick={() => { stop.current = true; setDriving(false); void manualCrawlRequest({ action: 'cancel', sessionId: session.id }).then(r => accept(r.session)).catch(e => setError(e.message)) }}><Pause size={14} />停止检查</button> : ['paused', 'cancelled', 'running'].includes(session.status) && !session.companies.some(c => c.status === 'failed') && <button className={button} disabled={busy || detailsLoading} onClick={() => void act('continue')}><Play size={14} />继续检查</button>}</>}{isHistory && <button className={button} disabled={busy || detailsLoading} onClick={() => void refreshHistory().catch(e => setError(e.message))}><RefreshCw size={14} />刷新记录</button>}</div>
            <div className="flex flex-wrap justify-end gap-2">
              {effectiveMode === 'update' && current?.status === 'failed' && <button className={button} disabled={busy} onClick={() => void act('skip', {companyId:current.companyId})}>跳过并检查下一家</button>}
              {current?.status === 'failed' && <button className={button} disabled={busy || (current.retries || 0) >= 5} onClick={() => void act('retry', { companyId: current.companyId, ...(effectiveMode === 'preflight' ? {url} : {}) })}><RefreshCw size={14} />重试本家（{current.retries || 0}/5）</button>}
              {effectiveMode === 'preflight' && (session?.status !== 'cancelled' || current?.status === 'failed') && current && !['approved', 'rejected', 'skipped'].includes(current.status) ? <>
                <button className={button} disabled={busy || detailsLoading} onClick={() => void act('skip', { companyId: current.companyId })}>跳过并检查下一家</button>
                {rejecting ? <><button className={button} disabled={busy || (current.retries || 0) >= 5 || !safeUrl(url)} onClick={() => { setRejecting(false); void act('retry', { companyId: current.companyId, url }) }}><RefreshCw size={14} />继续重试（{current.retries || 0}/5）</button><button className={`${button} !text-red-700`} disabled={busy || detailsLoading} onClick={() => void act('qualify', { companyId: current.companyId, decision: 'rejected', reason })}>确认不通过</button></> : <button className={button} disabled={busy || detailsLoading} onClick={() => setRejecting(true)}>不通过</button>}
                <button className={primary} disabled={busy || detailsLoading || !current.canApprove} onClick={() => void act('qualify', { companyId: current.companyId, decision: 'approved' })}><Check size={15} />通过</button>
              </> : effectiveMode !== 'preflight' && !stoppedProposal && !detailsLoading && item?.raw && (actionable(item) || item.status === 'deleted') ? <>
                {item.status === 'deleted' || (item.kind === 'restore' && item.status === 'proposed') ? <button className={primary} disabled={busy || detailsLoading} onClick={() => void decide('restore')}>恢复为待审核</button> : item.kind === 'close' && item.status === 'proposed' ? <><p className="self-center text-xs text-amber-800">转为待审核或删除后将从线上隐藏。</p><button className={button} disabled={busy || detailsLoading} onClick={() => void decide('cancel')}>暂不处理</button><button className={`${button} !text-red-700`} disabled={busy || detailsLoading} onClick={() => setConfirm('delete')}>删除</button><button className={primary} disabled={busy || detailsLoading} onClick={() => void decide('pending')}>改为待审核</button></> : ['unknown', 'unchanged'].includes(item.kind) ? <button className={button} disabled={busy || detailsLoading} onClick={() => void decide('cancel')}>保留现状</button> : <>{savedJob ? <button className={`${button} !text-red-700`} disabled={busy || detailsLoading} onClick={() => setConfirm('delete')}>删除岗位</button> : <button className={button} disabled={busy || detailsLoading} onClick={() => void decide('cancel')}>{item.status === 'draft' ? '丢弃修改草稿' : '取消'}</button>}<button className={button} disabled={busy || detailsLoading} onClick={() => void decide('draft')}>{item.status === 'draft' || item.status === 'pending' ? '保存修改（仍待审核）' : '保存为待审核'}</button><button className={primary} disabled={busy || detailsLoading} onClick={() => void decide('publish')}>发布线上</button></>}
              </> : <button className={button} onClick={requestClose}>关闭</button>}
            </div>
          </div>
        </footer>
      </>}
    </div>
  </div>
}
