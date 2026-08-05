import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Check, Clipboard, Download, KeyRound, Loader2, Pencil, Plus, RefreshCw,
  Search, ShieldAlert, Ticket, X
} from 'lucide-react'
import {
  membershipRedemptionCodeService,
  type MembershipCodeBatch,
  type MembershipCodeRow,
  type MembershipCodesResponse,
  type RedemptionMemberType
} from '../services/membership-redemption-code-service'

const PLAN_LABELS: Record<RedemptionMemberType, string> = {
  starter: '月度会员',
  half_year: '半年会员',
  annual: '年度会员'
}

const STATUS_LABELS = {
  unused: '未使用',
  used: '已使用',
  expired: '已过期',
  voided: '已作废'
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

function statusClass(status: MembershipCodeRow['status']) {
  if (status === 'unused') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (status === 'used') return 'border-slate-200 bg-slate-100 text-slate-500'
  if (status === 'expired') return 'border-amber-100 bg-amber-50 text-amber-700'
  return 'border-rose-100 bg-rose-50 text-rose-700'
}

export default function AdminMembershipCodesPage() {
  const [data, setData] = useState<MembershipCodesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [memberType, setMemberType] = useState('all')
  const [channel, setChannel] = useState('all')
  const [batchId, setBatchId] = useState('all')
  const [page, setPage] = useState(1)
  const [showGenerate, setShowGenerate] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])
  const [generatedBatch, setGeneratedBatch] = useState<any>(null)
  const [copied, setCopied] = useState('')
  const [modalError, setModalError] = useState('')
  const [voidTarget, setVoidTarget] = useState<MembershipCodeRow | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [editTarget, setEditTarget] = useState<MembershipCodeBatch | null>(null)
  const [editForm, setEditForm] = useState({ name: '', channel: '' })
  const [actionLoading, setActionLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', channel: '外部平台（待分配）', memberType: 'starter' as RedemptionMemberType, quantity: 50
  })

  const load = useCallback(async (nextPage = page) => {
    setLoading(true)
    setError('')
    try {
      const next = await membershipRedemptionCodeService.list({
        page: nextPage, pageSize: 25, search, status, memberType, channel, batchId
      })
      setData(next)
      setPage(next.pagination.page)
    } catch (err) {
      const errorData = (err as Error & { data?: { isSuperAdmin?: boolean } })?.data
      if (typeof errorData?.isSuperAdmin === 'boolean') {
        setData({
          success: false,
          isSuperAdmin: errorData.isSuperAdmin,
          decryptionErrorCount: 0,
          codes: [],
          summary: { total: 0, unused: 0, used: 0, expired: 0, voided: 0, starter: 0, half_year: 0, annual: 0 },
          pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
          batches: [],
          channels: []
        })
      }
      setError(err instanceof Error ? err.message : '兑换码数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [batchId, channel, memberType, page, search, status])

  useEffect(() => { void load(1) }, [status, memberType, channel, batchId]) // eslint-disable-line react-hooks/exhaustive-deps

  const summaryCards = useMemo(() => {
    const summary = data?.summary
    return [
      ['全部兑换码', Number(summary?.total || 0), 'text-slate-950'],
      ['未使用', Number(summary?.unused || 0), 'text-emerald-700'],
      ['已使用', Number(summary?.used || 0), 'text-slate-600'],
      ['已过期', Number(summary?.expired || 0), 'text-amber-700'],
      ['已作废', Number(summary?.voided || 0), 'text-rose-700']
    ]
  }, [data])

  const selectedBatch = useMemo(
    () => (data?.batches || []).find(batch => batch.batch_id === batchId) || null,
    [batchId, data?.batches]
  )

  useEffect(() => {
    const modalOpen = showGenerate || Boolean(voidTarget) || Boolean(editTarget)
    if (!modalOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || generating || actionLoading) return
      if (showGenerate) closeGenerate()
      else if (voidTarget) setVoidTarget(null)
      else if (editTarget) setEditTarget(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [actionLoading, editTarget, generating, showGenerate, voidTarget]) // eslint-disable-line react-hooks/exhaustive-deps

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied(''), 1600)
    } catch {
      const message = '复制失败，请检查浏览器剪贴板权限'
      if (showGenerate) setModalError(message)
      else setError(message)
    }
  }

  const openGenerate = () => {
    setModalError('')
    setShowGenerate(true)
  }

  const submitGenerate = async (event: FormEvent) => {
    event.preventDefault()
    setGenerating(true)
    setModalError('')
    try {
      const result = await membershipRedemptionCodeService.createBatch(form)
      setGeneratedCodes(result.codes)
      setGeneratedBatch(result.batch)
      await load(1)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : '生成兑换码失败')
    } finally {
      setGenerating(false)
    }
  }

  const closeGenerate = () => {
    setShowGenerate(false)
    setGeneratedCodes([])
    setGeneratedBatch(null)
    setModalError('')
  }

  const openVoid = (row: MembershipCodeRow) => {
    setVoidTarget(row)
    setVoidReason('')
    setModalError('')
  }

  const confirmVoid = async () => {
    if (!voidTarget) return
    setActionLoading(true)
    setModalError('')
    try {
      await membershipRedemptionCodeService.voidCode(voidTarget.id, voidReason.trim())
      setVoidTarget(null)
      await load(page)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : '作废失败')
    } finally {
      setActionLoading(false)
    }
  }

  const exportBatch = async (batch: MembershipCodeBatch | { batchId: string; name: string }) => {
    try {
      const id = 'batch_id' in batch ? batch.batch_id : batch.batchId
      await membershipRedemptionCodeService.exportBatch(id, batch.name)
    } catch (err) {
      const message = err instanceof Error ? err.message : '批次导出失败'
      if (showGenerate) setModalError(message)
      else setError(message)
    }
  }

  const openEditBatch = (batch: MembershipCodeBatch) => {
    setEditTarget(batch)
    setEditForm({ name: batch.name, channel: batch.channel })
    setModalError('')
  }

  const confirmEditBatch = async (event: FormEvent) => {
    event.preventDefault()
    if (!editTarget || !editForm.name.trim() || !editForm.channel.trim()) return
    setActionLoading(true)
    setModalError('')
    try {
      await membershipRedemptionCodeService.updateBatch(editTarget.batch_id, editForm.name.trim(), editForm.channel.trim())
      setEditTarget(null)
      await load(page)
    } catch (err) {
      setModalError(err instanceof Error ? err.message : '批次更新失败')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[linear-gradient(120deg,#f5f3ff_0%,#ffffff_54%,#eff6ff_100%)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-black text-slate-950"><Ticket className="h-6 w-6 text-indigo-600" />会员兑换码管理</h1>
                <p className="mt-1 text-sm text-slate-500">生成、导出并追踪三档会员兑换码。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void load(page)} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />刷新
                </button>
                {data?.isSuperAdmin ? (
                  <button type="button" onClick={openGenerate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                    <Plus className="h-4 w-4" />生成兑换码
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {summaryCards.map(([label, value, tone], index) => (
                <div key={String(label)} className={`rounded-xl border border-white/80 bg-white/85 p-4 shadow-sm ${index === 0 ? 'col-span-2 xl:col-span-1' : ''}`}>
                  <div className="text-xs font-bold text-slate-500">{label}</div>
                  <div className={`mt-2 text-2xl font-black ${tone}`}>{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
              <span className="rounded-full bg-white px-3 py-1.5">月度 {Number(data?.summary?.starter || 0)}</span>
              <span className="rounded-full bg-white px-3 py-1.5">半年 {Number(data?.summary?.half_year || 0)}</span>
              <span className="rounded-full bg-white px-3 py-1.5">年度 {Number(data?.summary?.annual || 0)}</span>
            </div>
          </div>
        </section>

        {!data?.isSuperAdmin && !loading ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            当前为脱敏视图。生成、完整码查看、导出及作废仅限超级管理员。
          </div>
        ) : null}
        {data?.isSuperAdmin && Number(data.decryptionErrorCount || 0) > 0 ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            有 {data.decryptionErrorCount} 个兑换码无法解密，请检查 MEMBERSHIP_REDEMPTION_CODE_KEY 是否与生成时一致，暂勿导出或分发。
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form onSubmit={event => { event.preventDefault(); void load(1) }} className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-[minmax(190px,1fr)_132px_132px_150px_170px_auto]">
            <label className="relative col-span-2 md:col-span-3 xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input aria-label="搜索兑换码、批次或渠道" value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索兑换码、批次或渠道" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" />
            </label>
            <select aria-label="兑换码状态" value={status} onChange={event => setStatus(event.target.value)} className="h-11 min-w-0 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">
              <option value="all">全部状态</option><option value="unused">未使用</option><option value="used">已使用</option><option value="expired">已过期</option><option value="voided">已作废</option>
            </select>
            <select aria-label="会员类型" value={memberType} onChange={event => setMemberType(event.target.value)} className="h-11 min-w-0 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">
              <option value="all">全部类型</option><option value="starter">月度会员</option><option value="half_year">半年会员</option><option value="annual">年度会员</option>
            </select>
            <select aria-label="销售渠道" value={channel} onChange={event => setChannel(event.target.value)} className="h-11 min-w-0 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">
              <option value="all">全部渠道</option>{(data?.channels || []).map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select aria-label="兑换码批次" value={batchId} onChange={event => setBatchId(event.target.value)} className="h-11 min-w-0 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700">
              <option value="all">全部批次</option>{(data?.batches || []).map(item => <option key={item.batch_id} value={item.batch_id}>{item.name}</option>)}
            </select>
            <button type="submit" className="col-span-2 h-11 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white hover:bg-slate-800 md:col-span-1">搜索</button>
          </form>
          {data?.isSuperAdmin && selectedBatch ? (
            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => void exportBatch(selectedBatch)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"><Download className="h-4 w-4" />导出所选批次</button>
              <button type="button" onClick={() => openEditBatch(selectedBatch)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"><Pencil className="h-4 w-4" />编辑批次</button>
            </div>
          ) : null}
          {error ? <div role="alert" className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full divide-y divide-slate-100">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>{['兑换码', '会员权益', '批次 / 渠道', '兑换有效期', '状态', '兑换用户', '操作'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />加载中</td></tr>
                ) : !data?.codes.length ? (
                  <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-500">{Number(data?.summary.total || 0) === 0 ? '还没有兑换码，请先生成批次' : '暂无符合条件的兑换码'}</td></tr>
                ) : data.codes.map(row => {
                  const muted = row.status !== 'unused'
                  return (
                    <tr key={row.id} className={`${muted ? 'bg-slate-50/80 text-slate-400' : 'hover:bg-indigo-50/30'}`}>
                      <td className="px-4 py-4">
                        <div className={`font-mono text-sm font-black tracking-wide ${row.status === 'used' ? 'line-through' : ''}`}>{row.code}</div>
                        <div className="mt-1 text-[11px] text-slate-400">每码限用 {row.usageLimit} 次</div>
                      </td>
                      <td className="px-4 py-4 text-sm"><div className="font-bold text-slate-800">{PLAN_LABELS[row.memberType]}</div><div className="mt-1 text-xs">{row.durationMonths} 个自然月</div></td>
                      <td className="px-4 py-4 text-sm"><div className="font-bold text-slate-800">{row.batchName}</div><div className="mt-1 text-xs">{row.channel}</div></td>
                      <td className="px-4 py-4 text-xs leading-5"><div>生成：{formatDate(row.generatedAt)}</div><div>截止：{formatDate(row.expiresAt)}</div></td>
                      <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(row.status)}`}>{STATUS_LABELS[row.status]}</span></td>
                      <td className="px-4 py-4 text-xs leading-5"><div className="font-semibold text-slate-700">{row.redeemedByEmail || row.redeemedByName || '-'}</div><div>{row.redeemedAt ? formatDate(row.redeemedAt) : '-'}</div></td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          {data.isSuperAdmin && !row.isMasked ? <button type="button" aria-label={`复制兑换码 ${row.code}`} onClick={() => void copyText(row.code, row.id)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200" title="复制兑换码">{copied === row.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Clipboard className="h-4 w-4" />}</button> : null}
                          {data.isSuperAdmin && row.status === 'unused' ? <button type="button" onClick={() => openVoid(row)} className="rounded-lg border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-100">作废</button> : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-500">共 {data?.pagination.total || 0} 个，第 {data?.pagination.page || 1}/{data?.pagination.totalPages || 1} 页</span>
            <div className="flex gap-2">
              <button type="button" disabled={(data?.pagination.page || 1) <= 1 || loading} onClick={() => void load(page - 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40">上一页</button>
              <button type="button" disabled={(data?.pagination.page || 1) >= (data?.pagination.totalPages || 1) || loading} onClick={() => void load(page + 1)} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold disabled:opacity-40">下一页</button>
            </div>
          </div>
        </section>
      </div>

      {showGenerate ? (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="membership-code-generate-title" className="relative w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
            <button type="button" aria-label="关闭生成兑换码弹窗" disabled={generating} onClick={closeGenerate} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><KeyRound className="h-6 w-6" /></div>
            <h2 id="membership-code-generate-title" className="mt-4 text-2xl font-black text-slate-950">{generatedCodes.length ? '批次生成成功' : '生成会员兑换码'}</h2>
            {generatedCodes.length ? (
              <div className="mt-5">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">已生成 {generatedCodes.length} 个{PLAN_LABELS[generatedBatch.memberType as RedemptionMemberType]}兑换码。完整码可随时在后台查看和按批次导出。</div>
                <textarea readOnly value={generatedCodes.join('\n')} className="mt-4 h-64 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 outline-none" />
                {modalError ? <div role="alert" className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{modalError}</div> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copyText(generatedCodes.join('\n'), 'generated')} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white">{copied === 'generated' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}复制全部</button>
                  <button type="button" onClick={() => void exportBatch({ batchId: generatedBatch.batchId, name: generatedBatch.name })} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold"><Download className="h-4 w-4" />导出 CSV</button>
                  <button type="button" onClick={closeGenerate} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">完成</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitGenerate} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="text-sm font-bold text-slate-700">批次名称</span><input autoFocus required value={form.name} onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))} placeholder="例如：2026 Q3 淘宝月度会员" className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" /></label>
                <label><span className="text-sm font-bold text-slate-700">会员类型</span><select value={form.memberType} onChange={event => setForm(prev => ({ ...prev, memberType: event.target.value as RedemptionMemberType }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="starter">月度会员</option><option value="half_year">半年会员</option><option value="annual">年度会员</option></select></label>
                <label><span className="text-sm font-bold text-slate-700">生成数量</span><input type="number" min={1} max={500} required value={form.quantity} onChange={event => setForm(prev => ({ ...prev, quantity: Number(event.target.value) }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
                <label className="sm:col-span-2"><span className="text-sm font-bold text-slate-700">销售渠道</span><input required value={form.channel} onChange={event => setForm(prev => ({ ...prev, channel: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" /></label>
                <div className="sm:col-span-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">兑换截止时间固定为生成日起 1 年；每个兑换码仅可使用 1 次。</div>
                {modalError ? <div role="alert" className="sm:col-span-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{modalError}</div> : null}
                <div className="sm:col-span-2 flex justify-end gap-2"><button type="button" disabled={generating} onClick={closeGenerate} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold disabled:opacity-50">取消</button><button type="submit" disabled={generating} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}确认生成</button></div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {voidTarget ? (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="membership-code-void-title" className="relative w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
            <button type="button" aria-label="关闭作废弹窗" disabled={actionLoading} onClick={() => setVoidTarget(null)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
            <h2 id="membership-code-void-title" className="pr-10 text-xl font-black text-slate-950">作废兑换码</h2>
            <p className="mt-2 break-all font-mono text-sm font-bold text-slate-600">{voidTarget.code}</p>
            <p className="mt-3 text-sm text-slate-600">作废后无法兑换，也不能恢复。</p>
            <label className="mt-4 block"><span className="text-sm font-bold text-slate-700">原因（选填）</span><textarea autoFocus value={voidReason} onChange={event => setVoidReason(event.target.value)} maxLength={500} className="mt-2 h-24 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100" /></label>
            {modalError ? <div role="alert" className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{modalError}</div> : null}
            <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={actionLoading} onClick={() => setVoidTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold disabled:opacity-50">取消</button><button type="button" disabled={actionLoading} onClick={() => void confirmVoid()} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}确认作废</button></div>
          </div>
        </div>
      ) : null}

      {editTarget ? (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="membership-code-edit-title" className="relative w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
            <button type="button" aria-label="关闭编辑批次弹窗" disabled={actionLoading} onClick={() => setEditTarget(null)} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
            <h2 id="membership-code-edit-title" className="pr-10 text-xl font-black text-slate-950">编辑批次</h2>
            <form onSubmit={confirmEditBatch} className="mt-5 space-y-4">
              <label className="block"><span className="text-sm font-bold text-slate-700">批次名称</span><input autoFocus required value={editForm.name} onChange={event => setEditForm(prev => ({ ...prev, name: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" /></label>
              <label className="block"><span className="text-sm font-bold text-slate-700">销售渠道</span><input required value={editForm.channel} onChange={event => setEditForm(prev => ({ ...prev, channel: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" /></label>
              {modalError ? <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{modalError}</div> : null}
              <div className="flex justify-end gap-2"><button type="button" disabled={actionLoading} onClick={() => setEditTarget(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold disabled:opacity-50">取消</button><button type="submit" disabled={actionLoading} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}保存</button></div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
