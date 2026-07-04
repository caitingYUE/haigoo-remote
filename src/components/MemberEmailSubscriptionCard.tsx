import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight, Bell, CheckCircle2, ChevronDown, Loader2, Mail, PauseCircle, PlayCircle, Plus, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from './NotificationSystem'
import {
  getSubscriptionTopicSearchText,
  MAX_SUBSCRIPTION_TOPICS,
  normalizeSubscriptionTopicValue,
  SUBSCRIPTION_TOPICS
} from '../constants/subscription-topics'

interface UserSubscription {
  subscription_id: number | string
  topic?: string
  preferences?: {
    topics?: string[]
    customTopic?: string | null
    customTopics?: string[]
  }
  status: 'active' | 'inactive' | 'bounced'
}

const topicLabels: Map<string, string> = new Map(SUBSCRIPTION_TOPICS.map(item => [item.value, item.label]))
function normalizeSearchText(value: string) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '')
}

const normalizedTopicLabels: Map<string, string> = new Map(
  SUBSCRIPTION_TOPICS.flatMap(item => {
    const aliases = 'aliases' in item && Array.isArray(item.aliases) ? item.aliases : []
    return [item.value, item.label, ...aliases].map(value => [normalizeSearchText(value), item.value] as const)
  })
)

const CUSTOM_TOPIC_VALUE = '__custom__'

function uniqueCustomTopics(values: string[]) {
  const seen = new Set<string>()
  return values
    .map(item => String(item || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .filter(item => {
      const key = normalizeSearchText(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function parseTopicState(subscription: UserSubscription | null) {
  if (!subscription) return { topics: [] as string[], customTopics: [] as string[] }
  const preferences = subscription.preferences && typeof subscription.preferences === 'object'
    ? subscription.preferences
    : {}
  const rawTopics = Array.isArray(preferences.topics)
    ? preferences.topics
    : String(subscription.topic || '').split(',')
  const customTopics = uniqueCustomTopics([
    ...(Array.isArray(preferences.customTopics) ? preferences.customTopics : []),
    ...String(preferences.customTopic || '').split(',')
  ])
  const topics = rawTopics
    .map(item => String(item || '').trim())
    .map(item => normalizeSubscriptionTopicValue(item))
    .filter(Boolean)
    .filter(item => topicLabels.has(item))
    .filter(item => item !== 'other')
    .slice(0, MAX_SUBSCRIPTION_TOPICS)
  return { topics, customTopics }
}

export default function MemberEmailSubscriptionCard() {
  const { isAuthenticated, isMember, token, user } = useAuth()
  const { showSuccess, showError, showWarning } = useNotificationHelpers()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [customTopics, setCustomTopics] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const comboRef = useRef<HTMLDivElement | null>(null)

  const isActive = subscription?.status === 'active'
  const normalizedSearchTerm = normalizeSearchText(searchTerm)
  const selectedCount = selectedTopics.length + customTopics.length
  const selectedLabels = useMemo(() => (
    [
      ...selectedTopics.map(item => topicLabels.get(item) || item),
      ...customTopics
    ]
      .join('、')
  ), [customTopics, selectedTopics])
  const selectedDisplayItems = useMemo(() => (
    [
      ...selectedTopics.map(item => ({
      value: item,
      label: topicLabels.get(item) || item
      })),
      ...customTopics.map(item => ({
        value: `${CUSTOM_TOPIC_VALUE}:${item}`,
        label: item
      }))
    ]
  ), [customTopics, selectedTopics])
  const exactMatchedTopic = useMemo(() => (
    normalizedSearchTerm ? normalizedTopicLabels.get(normalizedSearchTerm) || null : null
  ), [normalizedSearchTerm])
  const visibleTopicOptions = useMemo(() => {
    const selectedSet = new Set(selectedTopics)
    const scored = SUBSCRIPTION_TOPICS
      .filter(topic => topic.value !== '其他')
      .map((topic, index) => {
        if (!normalizedSearchTerm) return { topic, score: 0, index }
        const labelText = normalizeSearchText(`${topic.label}${topic.value}`)
        const searchText = normalizeSearchText(getSubscriptionTopicSearchText(topic))
        const isSelected = selectedSet.has(topic.value)
        let score = 0
        if (labelText === normalizedSearchTerm) score = 100
        else if (labelText.includes(normalizedSearchTerm)) score = 86
        else if (normalizedSearchTerm.includes(labelText)) score = 82
        else if (searchText.includes(normalizedSearchTerm)) score = 76
        else if (normalizedSearchTerm.includes(topic.label.slice(0, 2))) score = 42
        return { topic, score: isSelected ? Math.max(score, 1) : score, index }
      })
      .filter(item => !normalizedSearchTerm || item.score > 0)
      .sort((a, b) => {
        const aSelected = selectedSet.has(a.topic.value) ? 0 : 1
        const bSelected = selectedSet.has(b.topic.value) ? 0 : 1
        if (aSelected !== bSelected) return aSelected - bSelected
        if (b.score !== a.score) return b.score - a.score
        return a.index - b.index
      })
    const matches = scored.map(item => item.topic)
    const selectedOptions = SUBSCRIPTION_TOPICS
      .filter(topic => topic.value !== '其他' && selectedSet.has(topic.value))
      .filter(topic => !matches.some(item => item.value === topic.value))
    return [...selectedOptions, ...matches]
  }, [normalizedSearchTerm, selectedTopics])
  const canCreateCustomTopic = Boolean(searchTerm.trim()) && !exactMatchedTopic
  const customTopicHint = useMemo(() => {
    const nextTerm = searchTerm.trim()
    if (nextTerm && !exactMatchedTopic) {
      return `暂无「${nextTerm}」这类岗位，如后续新增该类型，会继续发送匹配岗位。`
    }
    const latestCustomTopic = customTopics[customTopics.length - 1]
    if (latestCustomTopic && !normalizedTopicLabels.has(normalizeSearchText(latestCustomTopic))) {
      return `暂无「${latestCustomTopic}」这类岗位，如后续新增该类型，会继续发送匹配岗位。`
    }
    return ''
  }, [customTopics, exactMatchedTopic, searchTerm])

  useEffect(() => {
    let mounted = true
    const loadSubscription = async () => {
      if (!isAuthenticated || !token) return
      setLoading(true)
      try {
        const response = await fetch('/api/auth?action=my-subscriptions', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await response.json().catch(() => ({}))
        if (!mounted) return
        if (response.ok && data?.success) {
          const emailSub = (data.subscriptions || []).find((item: UserSubscription) => item.status !== 'bounced') || data.subscriptions?.[0] || null
          setSubscription(emailSub)
          const next = parseTopicState(emailSub)
          setSelectedTopics(next.topics)
          setCustomTopics(next.customTopics)
        }
      } catch {
        if (mounted) showError('订阅信息加载失败', '请稍后刷新页面重试')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadSubscription()
    return () => { mounted = false }
  }, [isAuthenticated, token, showError])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!comboRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const toggleTopic = (value: string) => {
    setSelectedTopics(prev => {
      if (prev.includes(value)) return prev.filter(item => item !== value)
      if (prev.length + customTopics.length >= MAX_SUBSCRIPTION_TOPICS) {
        showWarning(`最多选择 ${MAX_SUBSCRIPTION_TOPICS} 个方向`)
        return prev
      }
      return [...prev, value]
    })
  }

  const removeSelectedItem = (value: string) => {
    if (value.startsWith(`${CUSTOM_TOPIC_VALUE}:`)) {
      const customValue = value.slice(CUSTOM_TOPIC_VALUE.length + 1)
      setCustomTopics(prev => prev.filter(item => normalizeSearchText(item) !== normalizeSearchText(customValue)))
      return
    }
    setSelectedTopics(prev => prev.filter(item => item !== value))
  }

  const addCustomTopic = (rawValue: string) => {
    const nextValue = rawValue.trim().replace(/\s+/g, ' ')
    if (!nextValue) return
    const matchedTopic = normalizedTopicLabels.get(normalizeSearchText(nextValue))
    if (matchedTopic) {
      if (!selectedTopics.includes(matchedTopic)) toggleTopic(matchedTopic)
      setSearchTerm('')
      return
    }
    const alreadyExists = customTopics.some(item => normalizeSearchText(item) === normalizeSearchText(nextValue))
    if (!alreadyExists && selectedTopics.length + customTopics.length >= MAX_SUBSCRIPTION_TOPICS) {
      showWarning(`最多选择 ${MAX_SUBSCRIPTION_TOPICS} 个方向`)
      return
    }
    if (!alreadyExists) setCustomTopics(prev => uniqueCustomTopics([...prev, nextValue]))
    setSearchTerm('')
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      const nextValue = searchTerm.trim()
      if (!nextValue) {
        saveSubscription()
        return
      }
      addCustomTopic(nextValue)
      setDropdownOpen(true)
      return
    }
    if (event.key === 'Backspace' && !searchTerm && selectedDisplayItems.length > 0) {
      removeSelectedItem(selectedDisplayItems[selectedDisplayItems.length - 1].value)
    }
    if (event.key === 'Escape') {
      setDropdownOpen(false)
    }
  }

  const saveSubscription = async () => {
    if (!token) return
    const pendingSearchTerm = searchTerm.trim()
    const pendingMatchedTopic = pendingSearchTerm ? normalizedTopicLabels.get(normalizeSearchText(pendingSearchTerm)) : null
    const nextSelectedTopics = pendingMatchedTopic && !selectedTopics.includes(pendingMatchedTopic)
      ? [...selectedTopics, pendingMatchedTopic].slice(0, MAX_SUBSCRIPTION_TOPICS)
      : selectedTopics
    const nextCustomTopics = uniqueCustomTopics([
      ...customTopics,
      ...(pendingSearchTerm && !pendingMatchedTopic ? [pendingSearchTerm] : [])
    ])
    const nextSelectedCount = nextSelectedTopics.length + nextCustomTopics.length

    if (selectedTopics.length === 0 && customTopics.length === 0 && !pendingMatchedTopic && nextCustomTopics.length === 0) {
      showWarning('请选择岗位方向', '至少选择一个方向后再保存。')
      return
    }
    if (nextSelectedCount > MAX_SUBSCRIPTION_TOPICS) {
      showWarning(`最多选择 ${MAX_SUBSCRIPTION_TOPICS} 个方向`)
      return
    }
    const topicsToSave = nextCustomTopics.length
      ? [...nextSelectedTopics, 'other']
      : nextSelectedTopics.slice(0, MAX_SUBSCRIPTION_TOPICS)

    setSaving(true)
    try {
      const response = await fetch('/api/auth?action=subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          topics: topicsToSave,
          customTopic: nextCustomTopics[0] || '',
          customTopics: nextCustomTopics
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.success) {
        showError('订阅保存失败', data?.error || '请稍后重试')
        return
      }
      setSubscription(data.subscription)
      setSearchTerm('')
      const next = parseTopicState(data.subscription)
      setSelectedTopics(next.topics)
      setCustomTopics(next.customTopics)
      showSuccess('邮件订阅已保存', '之后会按你的方向匹配每日精选岗位。')
    } catch {
      showError('订阅保存失败', '网络错误，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const updateSubscriptionStatus = async (status: 'active' | 'inactive') => {
    if (!token || !subscription) return
    setSaving(true)
    try {
      const response = await fetch('/api/auth?action=update-subscription', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id: subscription.subscription_id,
          status
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.success) {
        showError('订阅状态更新失败', data?.error || '请稍后重试')
        return
      }
      setSubscription(prev => prev ? { ...prev, status } : prev)
      showSuccess(status === 'active' ? '订阅已恢复' : '订阅已暂停')
    } catch {
      showError('订阅状态更新失败', '网络错误，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative z-10 mt-6 overflow-visible rounded-[26px] border border-[#e3edf4] bg-white px-5 py-5 shadow-[0_18px_48px_-40px_rgba(62,91,120,0.28)] sm:px-6">
      <div className="relative">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dbe9f2] bg-white/82 px-3 py-1 text-xs font-black text-[#6f63f6] shadow-sm">
              <Bell className="h-3.5 w-3.5" />
              会员邮件订阅
            </div>
            <h2 className="mt-3 text-[22px] font-black leading-tight tracking-normal text-slate-950 sm:text-[26px]">
              订阅你感兴趣的方向，及时接收最新岗位通知
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              选择 1-{MAX_SUBSCRIPTION_TOPICS} 个岗位方向，当有岗位上新时，我们会发到你的注册邮箱。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600 xl:justify-end">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white bg-white/80 px-3 shadow-sm">
              <Mail className="h-3.5 w-3.5 text-[#6f63f6]" />
              {user?.email || '登录后使用注册邮箱'}
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white bg-white/80 px-3 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              最多 {MAX_SUBSCRIPTION_TOPICS} 个方向
            </span>
            {subscription ? (
              <span className={`inline-flex h-9 items-center rounded-full border px-3 text-xs font-black shadow-sm ${
                isActive ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}>
                {isActive ? 'Active' : 'Paused'}
              </span>
            ) : null}
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="mt-5 flex flex-col gap-3 rounded-[20px] border border-[#e3edf4] bg-white/78 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black text-slate-950">登录后开启会员订阅</div>
              <p className="mt-1 text-sm leading-6 text-slate-500">登录并开通会员后，可保存岗位方向并接收每日邮件推荐。</p>
            </div>
            <Link
              to="/login"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-black text-white no-underline hover:bg-[#6f63f6] hover:no-underline"
            >
              去登录
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : !isMember ? (
          <div className="mt-5 flex flex-col gap-3 rounded-[20px] border border-[#f2dfb7] bg-[#fffaf0]/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black text-slate-950">会员专属邮件订阅</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">升级会员后可按岗位方向订阅每日精选机会，减少反复刷新和手动筛选。</p>
            </div>
            <Link
              to="/profile?tab=membership#club-service-plans"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#f0a11f] px-5 text-sm font-black text-white no-underline hover:bg-[#d9951f] hover:no-underline"
            >
              升级会员
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-5">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="text-sm font-black text-slate-950">订阅方向</div>
                  <div className="text-xs font-semibold text-slate-500">
                    {loading ? '正在读取订阅...' : subscription ? (isActive ? '当前订阅生效中' : '当前订阅已暂停') : '尚未保存订阅'}
                  </div>
                </div>

                <div ref={comboRef} className="relative">
                  <div
                    className={`flex min-h-[48px] items-center gap-2 rounded-2xl border bg-white/92 px-3 py-2 transition-colors ${
                      dropdownOpen ? 'border-[#bdb5ff] ring-2 ring-[#eeeaff]' : 'border-[#e3edf4]'
                    }`}
                    onClick={() => setDropdownOpen(true)}
                  >
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {selectedDisplayItems.map(item => (
                        <span
                          key={item.value}
                          className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-[#cfc8ff] bg-[#f4f1ff] px-2.5 text-xs font-black text-[#5b50e6]"
                        >
                          <span className="truncate">{item.label}</span>
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation()
                              removeSelectedItem(item.value)
                            }}
                            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[#7c70f4] hover:bg-white"
                            aria-label={`移除${item.label}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        value={searchTerm}
                        onChange={event => {
                          setSearchTerm(event.target.value)
                          setDropdownOpen(true)
                        }}
                        onFocus={() => setDropdownOpen(true)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder={selectedDisplayItems.length ? '继续输入或搜索' : '搜索或输入岗位方向，例如 产品经理、市场营销'}
                        className="h-7 min-w-[180px] flex-1 border-0 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        setDropdownOpen(prev => !prev)
                      }}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-50"
                      aria-label="展开岗位方向列表"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  <div className="mt-2 min-h-[20px] text-xs font-semibold leading-5 text-slate-500">
                    {customTopicHint || (selectedLabels ? `已选：${selectedLabels}` : '')}
                  </div>

                  {dropdownOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-[#dbe9f2] bg-white shadow-[0_24px_70px_-42px_rgba(45,64,92,0.42)]">
                      <div className="max-h-[270px] overflow-y-auto p-2">
                        {canCreateCustomTopic ? (
                          <button
                            type="button"
                            onClick={() => addCustomTopic(searchTerm)}
                            disabled={!customTopics.some(item => normalizeSearchText(item) === normalizeSearchText(searchTerm)) && selectedCount >= MAX_SUBSCRIPTION_TOPICS}
                            className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-[#f7f9fc] disabled:cursor-not-allowed disabled:text-slate-300"
                          >
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f4f1ff] text-[#6f63f6]">
                              <Plus className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate">保留“{searchTerm.trim()}”</span>
                            <span className="text-xs font-semibold text-slate-400">自定义</span>
                          </button>
                        ) : null}

                        {visibleTopicOptions.length ? visibleTopicOptions.map(topic => {
                          const checked = selectedTopics.includes(topic.value)
                          const disabled = !checked && selectedCount >= MAX_SUBSCRIPTION_TOPICS
                          return (
                            <button
                              key={topic.value}
                              type="button"
                              onClick={() => toggleTopic(topic.value)}
                              disabled={disabled}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                                checked
                                  ? 'bg-[#f4f1ff] font-black text-[#5b50e6]'
                                  : disabled
                                    ? 'cursor-not-allowed text-slate-300'
                                    : 'font-bold text-slate-700 hover:bg-[#f7f9fc]'
                              }`}
                            >
                              <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                checked ? 'border-[#6f63f6] bg-[#6f63f6] text-white' : 'border-[#cfdbe6] bg-white'
                              }`}>
                                {checked ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{topic.label}</span>
                              {checked ? <span className="text-xs font-black text-[#7c70f4]">已选</span> : null}
                            </button>
                          )
                        }) : (
                          <div className="px-3 py-6 text-center text-sm font-semibold text-slate-400">
                            没有匹配的内置方向
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(160px,1fr)_auto] xl:min-w-[340px] xl:pt-[30px]">
                <button
                  type="button"
                  onClick={saveSubscription}
                  disabled={saving || loading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-black text-white transition-colors hover:bg-[#6f63f6] disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  保存订阅
                </button>
                {subscription ? (
                  <button
                    type="button"
                    onClick={() => updateSubscriptionStatus(isActive ? 'inactive' : 'active')}
                    disabled={saving || loading}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#e3edf4] bg-white px-5 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                    {isActive ? '暂停' : '恢复'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
