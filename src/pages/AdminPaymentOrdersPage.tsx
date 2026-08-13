import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, RotateCcw, Search, X } from 'lucide-react'
import { paymentOrdersAdminService, type AdminPaymentOrder } from '../services/payment-orders-admin-service'

const STATUS_LABELS: Record<string, string> = {
  pending: '待支付', capture_pending: '确认中', completed: '已生效', partially_refunded: '部分退款',
  refunded: '已退款', failed: '失败', review_required: '争议处理中', requested: '待审核',
  processing: '退款处理中', rejected: '已拒绝'
}

function formatMoney(cents: number, currency = 'CNY') {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(Number(cents || 0) / 100)
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
}

function statusClass(status: string) {
  if (status === 'completed') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (status === 'requested' || status === 'capture_pending' || status === 'processing') return 'border-amber-100 bg-amber-50 text-amber-700'
  if (status === 'failed' || status === 'review_required') return 'border-rose-100 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

export default function AdminPaymentOrdersPage() {
  const [orders, setOrders] = useState<AdminPaymentOrder[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewTarget, setReviewTarget] = useState<AdminPaymentOrder | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await paymentOrdersAdminService.list({ page, pageSize: 25, status, search: submittedSearch })
      setOrders(data.orders)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '支付订单加载失败')
    } finally {
      setLoading(false)
    }
  }, [page, status, submittedSearch])

  useEffect(() => { void load() }, [load])

  const summary = useMemo(() => ({
    completed: orders.filter(item => item.status === 'completed').length,
    pendingRefund: orders.filter(item => item.refundRequestStatus === 'requested').length,
    review: orders.filter(item => item.status === 'review_required').length
  }), [orders])

  const review = async (decision: 'approve' | 'reject') => {
    if (!reviewTarget?.refundId) return
    setReviewing(true)
    setError('')
    try {
      await paymentOrdersAdminService.reviewRefund(reviewTarget.refundId, decision, reviewNote.trim())
      setReviewTarget(null)
      setReviewNote('')
      await load()
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : '退款审核失败')
    } finally {
      setReviewing(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.16em] text-[#466f9d]">PayPal Operations</div>
              <h1 className="mt-2 text-2xl font-black text-slate-950">支付订单与退款</h1>
              <p className="mt-1 text-sm text-slate-500">订单、权益排期与退款状态以服务端验证结果为准。</p>
            </div>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />刷新
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[['总订单', total], ['本页已生效', summary.completed], ['待审退款', summary.pendingRefund], ['争议订单', summary.review]].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div></div>
            ))}
          </div>
        </section>

        <form onSubmit={event => { event.preventDefault(); setPage(1); setSubmittedSearch(search.trim()) }} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
          <label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索订单号、邮箱或用户名" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-[#9fbbd2]" /></label>
          <select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700">
            <option value="all">全部状态</option><option value="completed">已生效</option><option value="requested">待审退款</option><option value="capture_pending">确认中</option><option value="refunded">已退款</option><option value="review_required">争议处理中</option><option value="failed">失败</option>
          </select>
          <button type="submit" className="h-11 rounded-xl bg-[#466f9d] px-5 text-sm font-black text-white">搜索</button>
        </form>

        {error ? <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50"><tr>{['订单 / 用户', '方案', '金额', '支付状态', '权益时间', '退款', '操作'].map(item => <th key={item} className="whitespace-nowrap px-5 py-3 text-left text-xs font-black text-slate-500">{item}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={7} className="px-5 py-12 text-center text-sm font-bold text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />加载中...</td></tr> : orders.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-sm font-bold text-slate-500">暂无 PayPal 订单</td></tr> : orders.map(order => (
                  <tr key={order.paymentId} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4 align-top"><div className="font-mono text-xs font-black text-slate-800">{order.paymentId}</div><div className="mt-1 text-sm font-bold text-slate-700">{order.userName || '-'}</div><div className="text-xs text-slate-500">{order.userEmail}</div><div className="mt-1 text-[11px] text-slate-400">{formatDate(order.createdAt)}</div></td>
                    <td className="px-5 py-4 align-top"><div className="text-sm font-black text-slate-900">{order.planName}</div><div className="mt-1 text-xs text-slate-500">{order.memberType}</div></td>
                    <td className="px-5 py-4 align-top"><div className="text-sm font-black text-slate-900">{formatMoney(order.amountCents, order.currency)}</div>{order.refundedAmountCents > 0 ? <div className="mt-1 text-xs font-bold text-rose-600">已退 {formatMoney(order.refundedAmountCents, order.currency)}</div> : null}</td>
                    <td className="px-5 py-4 align-top"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(order.status)}`}>{STATUS_LABELS[order.status] || order.status}</span><div className="mt-2 text-[11px] text-slate-400">{order.providerStatus || '-'}</div></td>
                    <td className="whitespace-nowrap px-5 py-4 align-top text-xs text-slate-500"><div>{formatDate(order.startsAt)}</div><div className="my-1 text-slate-300">↓</div><div>{formatDate(order.expiresAt)}</div></td>
                    <td className="max-w-[260px] px-5 py-4 align-top">{order.refundRequestStatus ? <><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClass(order.refundRequestStatus)}`}>{STATUS_LABELS[order.refundRequestStatus] || order.refundRequestStatus}</span><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{order.refundReason || '-'}</p>{order.refundRequestedAmountCents ? <div className="mt-1 text-xs font-black text-slate-700">预计 {formatMoney(order.refundRequestedAmountCents, order.currency)}</div> : null}</> : <span className="text-xs text-slate-400">无</span>}</td>
                    <td className="px-5 py-4 align-top">{order.refundRequestStatus === 'requested' && order.refundId ? <button type="button" onClick={() => { setReviewTarget(order); setReviewNote('') }} className="inline-flex items-center gap-2 rounded-lg bg-[#466f9d] px-3 py-2 text-xs font-black text-white"><RotateCcw className="h-4 w-4" />审核退款</button> : <span className="text-xs text-slate-400">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm text-slate-500"><span>第 {page} / {totalPages} 页</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button type="button" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
        </div>
      </div>

      {reviewTarget ? <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/55 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black text-slate-950">审核剩余权益退款</h2><p className="mt-1 text-sm text-slate-500">批准时会重新计算金额，并通过 PayPal 原路退回。</p></div><button type="button" onClick={() => setReviewTarget(null)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><div className="text-sm leading-6 text-amber-900"><div className="font-black">{reviewTarget.planName} · {reviewTarget.userEmail}</div><div>用户申请时预计退款 {formatMoney(reviewTarget.refundRequestedAmountCents || 0, reviewTarget.currency)}</div><div className="mt-1 text-xs">{reviewTarget.refundReason || '未填写原因'}</div></div></div></div><label className="mt-5 block"><span className="text-sm font-black text-slate-700">审核备注</span><textarea value={reviewNote} onChange={event => setReviewNote(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#9fbbd2]" placeholder="可填写与用户沟通结果" /></label><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" disabled={reviewing} onClick={() => void review('reject')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50"><X className="h-4 w-4" />拒绝</button><button type="button" disabled={reviewing} onClick={() => void review('approve')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#466f9d] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}批准并退款</button></div></div></div> : null}
    </div>
  )
}
