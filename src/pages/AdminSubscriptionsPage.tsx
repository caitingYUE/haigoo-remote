import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { RefreshCw, Search, Mail, PauseCircle, PlayCircle } from 'lucide-react'
import { subscriptionsService, type Subscription } from '../services/subscriptions-service'
import { normalizeSubscriptionTopicValue, SUBSCRIPTION_TOPICS } from '../constants/subscription-topics'

const topicLabelMap: Map<string, string> = new Map(SUBSCRIPTION_TOPICS.map(item => [item.value, item.label]))

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatTopic(subscription: Subscription) {
  const preferences = subscription.preferences && typeof subscription.preferences === 'object'
    ? subscription.preferences
    : {}
  const topics: string[] = Array.isArray(preferences.topics)
    ? preferences.topics
    : String(subscription.topic || '').split(',')
  const customTopics = [
    ...(Array.isArray(preferences.customTopics) ? preferences.customTopics : []),
    ...String(preferences.customTopic || '').split(',')
  ]
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex(next => next.toLowerCase() === item.toLowerCase()) === index)
  const labels = topics
    .map(item => String(item || '').trim())
    .map(item => normalizeSubscriptionTopicValue(item))
    .filter(Boolean)
    .filter(item => item !== 'other')
    .map(item => topicLabelMap.get(item as any) || item)
  labels.push(...customTopics)
  return labels.length ? labels.join('、') : '-'
}

function statusBadgeClass(status: string) {
  if (status === 'active') return 'border-emerald-100 bg-emerald-50 text-emerald-700'
  if (status === 'bounced') return 'border-rose-100 bg-rose-50 text-rose-700'
  return 'border-slate-200 bg-slate-50 text-slate-500'
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const stats = useMemo(() => {
    return subscriptions.reduce(
      (acc, item) => {
        acc.total += 1
        if (item.status === 'active') acc.active += 1
        if (item.status === 'inactive') acc.inactive += 1
        if (item.status === 'bounced') acc.bounced += 1
        return acc
      },
      { total: 0, active: 0, inactive: 0, bounced: 0 }
    )
  }, [subscriptions])

  const loadSubscriptions = async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await subscriptionsService.getAll({ search, status, channel: 'email' })
      setSubscriptions(rows || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '订阅数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSubscriptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault()
    loadSubscriptions()
  }

  const updateStatus = async (subscription: Subscription, nextStatus: 'active' | 'inactive') => {
    setUpdatingId(subscription.subscription_id)
    setError('')
    try {
      const updated = await subscriptionsService.updateStatus(subscription.subscription_id, nextStatus)
      setSubscriptions(prev => prev.map(item => (
        item.subscription_id === subscription.subscription_id ? { ...item, ...updated } : item
      )))
    } catch (err) {
      setError(err instanceof Error ? err.message : '状态更新失败')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                <Mail className="h-3.5 w-3.5" />
                Member Email Digest
              </div>
              <h1 className="mt-3 text-2xl font-black text-slate-950">邮件订阅管理</h1>
              <p className="mt-1 text-sm text-slate-500">查看会员订阅的岗位方向、邮件状态和发送记录。</p>
            </div>
            <button
              type="button"
              onClick={loadSubscriptions}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[
              ['总订阅', stats.total, 'text-slate-900'],
              ['生效中', stats.active, 'text-emerald-700'],
              ['已暂停', stats.inactive, 'text-slate-500'],
              ['退信', stats.bounced, 'text-rose-700']
            ].map(([label, value, tone]) => (
              <div key={label as string} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">{label}</div>
                <div className={`mt-2 text-2xl font-black ${tone}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="搜索邮箱、用户名或岗位方向"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            <select
              value={status}
              onChange={event => setStatus(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">全部状态</option>
              <option value="active">生效中</option>
              <option value="inactive">已暂停</option>
              <option value="bounced">退信</option>
            </select>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700"
            >
              搜索
            </button>
          </form>
          {error ? <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['用户', '岗位方向', '会员状态', '订阅状态', '创建/更新', '最近发送', '失败', '操作'].map(item => (
                    <th key={item} className="whitespace-nowrap px-5 py-3 text-left text-xs font-black text-slate-500">{item}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">加载中...</td>
                  </tr>
                ) : subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">暂无订阅数据</td>
                  </tr>
                ) : subscriptions.map(subscription => {
                  const isActive = subscription.status === 'active'
                  return (
                    <tr key={subscription.subscription_id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4 align-top">
                        <div className="font-bold text-slate-900">{subscription.user_name || subscription.nickname || '-'}</div>
                        <div className="mt-1 text-xs text-slate-500">{subscription.user_email || subscription.identifier}</div>
                      </td>
                      <td className="max-w-xs px-5 py-4 align-top text-sm font-semibold leading-6 text-slate-700">
                        {formatTopic(subscription)}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="text-sm font-bold text-slate-800">{subscription.member_type || subscription.membership_level || '-'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {subscription.member_status || '-'} · {formatDate(subscription.member_expire_at)}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusBadgeClass(subscription.status)}`}>
                          {subscription.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top text-xs text-slate-500">
                        <div>{formatDate(subscription.created_at)}</div>
                        <div className="mt-1">{formatDate(subscription.updated_at)}</div>
                      </td>
                      <td className="px-5 py-4 align-top text-xs text-slate-500">{formatDate(subscription.last_sent_at)}</td>
                      <td className="px-5 py-4 align-top text-sm font-bold text-slate-700">{subscription.fail_count || 0}</td>
                      <td className="px-5 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => updateStatus(subscription, isActive ? 'inactive' : 'active')}
                          disabled={updatingId === subscription.subscription_id}
                          className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold ${
                            isActive
                              ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          } disabled:opacity-60`}
                        >
                          {isActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                          {isActive ? '暂停' : '恢复'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
