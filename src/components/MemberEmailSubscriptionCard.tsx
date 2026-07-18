import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight, CheckCircle2, ChevronDown, Crown, Loader2, Mail, PauseCircle, PlayCircle, Plus, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useNotificationHelpers } from './NotificationSystem'
import { buildRoleOptionGroups, type RoleOption } from '../constants/job-role-groups'
import {
  getSubscriptionTopicSearchText,
  MAX_SUBSCRIPTION_TOPICS,
  normalizeSubscriptionTopicValue,
  RECOMMENDED_SUBSCRIPTION_TOPICS,
  SUBSCRIPTION_TOPICS
} from '../constants/subscription-topics'

interface SubscriptionPreferences {
  topics?: string[]
  customTopic?: string | null
  customTopics?: string[]
}

interface UserSubscription {
  subscription_id: number | string
  topic?: string
  preferences?: string | SubscriptionPreferences
  status: 'active' | 'inactive' | 'bounced'
}

interface SubscriptionTopicOption extends RoleOption {
  aliases?: readonly string[]
}

const STATIC_SUBSCRIPTION_TOPIC_OPTIONS: SubscriptionTopicOption[] = SUBSCRIPTION_TOPICS
  .filter(item => item.value !== '其他')
  .map(item => ({
    value: item.value,
    label: item.label,
    aliases: item.aliases || []
  }))

function normalizeSearchText(value: string) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '')
}

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

function buildNormalizedTopicMap(options: SubscriptionTopicOption[]) {
  return new Map(
    options.flatMap(item => {
      const aliases = Array.isArray(item.aliases) ? item.aliases : []
      return [item.value, item.label, ...aliases].map(value => [normalizeSearchText(value), item.value] as const)
    })
  )
}

function normalizeTopicOption(value: string, count?: number): SubscriptionTopicOption | null {
  const topicValue = normalizeSubscriptionTopicValue(String(value || '').trim())
  if (!topicValue || topicValue === '其他' || topicValue === 'other' || topicValue === 'Unspecified') return null
  return {
    value: topicValue,
    label: topicValue,
    count,
    aliases: []
  }
}

function parseSubscriptionPreferences(value: UserSubscription['preferences']): SubscriptionPreferences {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string' || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function parseTopicState(subscription: UserSubscription | null) {
  if (!subscription) return { topics: [] as string[], customTopics: [] as string[] }
  const preferences = parseSubscriptionPreferences(subscription.preferences)
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
    .filter(item => item !== 'other')
    .slice(0, MAX_SUBSCRIPTION_TOPICS)
  const topicKeys = new Set(topics.map(item => normalizeSearchText(item)))
  return {
    topics,
    customTopics: customTopics
      .filter(item => !topicKeys.has(normalizeSearchText(item)))
      .slice(0, Math.max(0, MAX_SUBSCRIPTION_TOPICS - topics.length))
  }
}

export default function MemberEmailSubscriptionCard() {
  const { isAuthenticated, isMember, token, user } = useAuth()
  const { text } = useLanguage()
  const { showSuccess, showError, showWarning } = useNotificationHelpers()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [customTopics, setCustomTopics] = useState<string[]>([])
  const [categoryTopicOptions, setCategoryTopicOptions] = useState<SubscriptionTopicOption[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [activeTopicGroup, setActiveTopicGroup] = useState(0)
  const comboRef = useRef<HTMLDivElement | null>(null)
  const previousDropdownOpenRef = useRef(false)
  const operationInFlightRef = useRef(false)

  const isActive = subscription?.status === 'active'
  const normalizedSearchTerm = normalizeSearchText(searchTerm)
  const topicOptions = useMemo(() => {
    const optionMap = new Map<string, SubscriptionTopicOption>()
    const addOption = (option: SubscriptionTopicOption) => {
      const value = normalizeSubscriptionTopicValue(option.value)
      if (!value || value === '其他' || value === 'other') return
      const existing = optionMap.get(value)
      optionMap.set(value, {
        value,
        label: option.label || existing?.label || value,
        aliases: option.aliases?.length ? option.aliases : existing?.aliases || [],
        count: typeof option.count === 'number' ? option.count : existing?.count
      })
    }

    STATIC_SUBSCRIPTION_TOPIC_OPTIONS.forEach(addOption)
    categoryTopicOptions.forEach(addOption)
    selectedTopics.forEach(value => addOption({ value, label: value }))
    return Array.from(optionMap.values())
  }, [categoryTopicOptions, selectedTopics])
  const topicLabels = useMemo(() => new Map(topicOptions.map(item => [item.value, item.label])), [topicOptions])
  const normalizedTopicLabels = useMemo(() => buildNormalizedTopicMap(topicOptions), [topicOptions])
  const selectedLabels = useMemo(() => (
    [
      ...selectedTopics.map(item => topicLabels.get(item) || item),
      ...customTopics
    ]
      .join('、')
  ), [customTopics, selectedTopics, topicLabels])
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
  ), [customTopics, selectedTopics, topicLabels])
  const exactMatchedTopic = useMemo(() => (
    normalizedSearchTerm ? normalizedTopicLabels.get(normalizedSearchTerm) || null : null
  ), [normalizedSearchTerm, normalizedTopicLabels])
  const visibleTopicOptions = useMemo(() => {
    const selectedSet = new Set(selectedTopics)
    const scored = topicOptions
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
    const selectedOptions = topicOptions
      .filter(topic => selectedSet.has(topic.value))
      .filter(topic => !matches.some(item => item.value === topic.value))
    return [...selectedOptions, ...matches]
  }, [normalizedSearchTerm, selectedTopics, topicOptions])
  const canCreateCustomTopic = Boolean(searchTerm.trim()) && !exactMatchedTopic
  const groupedTopicOptions = useMemo(() => buildRoleOptionGroups(topicOptions), [topicOptions])
  const currentTopicGroupOptions = useMemo(() => {
    const groupOptions = groupedTopicOptions[activeTopicGroup]?.options || []
    const selectedSet = new Set(selectedTopics)
    return [...groupOptions].sort((a, b) => {
      const aSelected = selectedSet.has(a.value) ? 0 : 1
      const bSelected = selectedSet.has(b.value) ? 0 : 1
      if (aSelected !== bSelected) return aSelected - bSelected
      return a.label.localeCompare(b.label, 'zh-Hans-CN')
    })
  }, [activeTopicGroup, groupedTopicOptions, selectedTopics])
  const dropdownTopicOptions = normalizedSearchTerm ? visibleTopicOptions : currentTopicGroupOptions
  const dropdownTitle = normalizedSearchTerm ? text('匹配结果', 'Matching roles') : (groupedTopicOptions[activeTopicGroup]?.title || text('岗位方向', 'Role categories'))
  const customTopicHint = useMemo(() => {
    const hasFuzzyTopicMatch = (value: string) => {
      const normalizedValue = normalizeSearchText(value)
      if (!normalizedValue) return false
      return topicOptions.some(topic => {
        const labelText = normalizeSearchText(`${topic.label}${topic.value}`)
        const searchText = normalizeSearchText(getSubscriptionTopicSearchText(topic))
        return labelText.includes(normalizedValue) || searchText.includes(normalizedValue)
      })
    }
    const nextTerm = searchTerm.trim()
    if (nextTerm && !exactMatchedTopic && visibleTopicOptions.length === 0) {
      return text(`暂无「${nextTerm}」这类岗位，如后续新增该类型，会继续发送匹配岗位。`, `No “${nextTerm}” roles are available yet. We’ll include matching roles when they are added.`)
    }
    const latestCustomTopic = customTopics[customTopics.length - 1]
    if (latestCustomTopic && !normalizedTopicLabels.has(normalizeSearchText(latestCustomTopic)) && !hasFuzzyTopicMatch(latestCustomTopic)) {
      return text(`暂无「${latestCustomTopic}」这类岗位，如后续新增该类型，会继续发送匹配岗位。`, `No “${latestCustomTopic}” roles are available yet. We’ll include matching roles when they are added.`)
    }
    return ''
  }, [customTopics, exactMatchedTopic, normalizedTopicLabels, searchTerm, text, topicOptions, visibleTopicOptions.length])

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
        if (!response.ok || !data?.success) throw new Error(data?.error || 'subscription_load_failed')
        const emailSub = (data.subscriptions || []).find((item: UserSubscription) => item.status !== 'bounced') || data.subscriptions?.[0] || null
        setSubscription(emailSub)
        const next = parseTopicState(emailSub)
        setSelectedTopics(next.topics)
        setCustomTopics(next.customTopics)
      } catch {
        if (mounted) showError(text('订阅信息加载失败', 'Could not load your subscription'), text('请稍后刷新页面重试', 'Refresh the page and try again.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadSubscription()
    return () => { mounted = false }
  }, [isAuthenticated, token, showError, text])

  useEffect(() => {
    let mounted = true
    const loadTopicOptions = async () => {
      if (!isAuthenticated || !isMember) return
      try {
        const metadataParams = new URLSearchParams({
          metadataOnly: 'true',
          page: '1',
          pageSize: '1',
          limit: '1',
          sortBy: 'recent',
          isApproved: 'true'
        })
        const jobsParams = new URLSearchParams({
          page: '1',
          pageSize: '500',
          limit: '500',
          sortBy: 'recent',
          isApproved: 'true',
          skipAggregations: 'true',
          listMode: 'compact'
        })
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
        const [metadataResponse, jobsResponse] = await Promise.all([
          fetch(`/api/data/processed-jobs?${metadataParams.toString()}`, { headers }),
          fetch(`/api/data/processed-jobs?${jobsParams.toString()}`, { headers })
        ])
        const metadataData = await metadataResponse.json().catch(() => ({}))
        const jobsData = await jobsResponse.json().catch(() => ({}))
        if (!mounted) return

        const optionMap = new Map<string, SubscriptionTopicOption>()
        const addOption = (option: SubscriptionTopicOption | null) => {
          if (!option) return
          const existing = optionMap.get(option.value)
          optionMap.set(option.value, {
            ...option,
            count: typeof option.count === 'number' ? option.count : existing?.count,
            aliases: option.aliases?.length ? option.aliases : existing?.aliases || []
          })
        }

        if (Array.isArray(metadataData?.aggregations?.category)) {
          metadataData.aggregations.category.forEach((item: { value?: string; count?: number }) => {
            addOption(normalizeTopicOption(item?.value || '', typeof item.count === 'number' ? item.count : Number(item.count) || undefined))
          })
        }

        if (Array.isArray(jobsData?.jobs)) {
          jobsData.jobs.forEach((job: { category?: string }) => {
            addOption(normalizeTopicOption(job?.category || ''))
          })
        }

        setCategoryTopicOptions(Array.from(optionMap.values()))
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('[MemberEmailSubscriptionCard] Failed to load category facets:', error)
        }
      }
    }
    loadTopicOptions()
    return () => { mounted = false }
  }, [isAuthenticated, isMember, token])

  useEffect(() => {
    if (activeTopicGroup >= groupedTopicOptions.length) {
      setActiveTopicGroup(0)
    }
  }, [activeTopicGroup, groupedTopicOptions.length])

  useEffect(() => {
    const wasOpen = previousDropdownOpenRef.current
    previousDropdownOpenRef.current = dropdownOpen
    if (!dropdownOpen || wasOpen || normalizedSearchTerm || selectedTopics.length === 0) return
    const targetIndex = groupedTopicOptions.findIndex(group =>
      group.options.some(option => selectedTopics.includes(option.value))
    )
    if (targetIndex >= 0 && targetIndex !== activeTopicGroup) {
      setActiveTopicGroup(targetIndex)
    }
  }, [activeTopicGroup, dropdownOpen, groupedTopicOptions, normalizedSearchTerm, selectedTopics])

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
    if (selectedTopics.includes(value)) {
      setSelectedTopics(prev => prev.filter(item => item !== value))
      return
    }
    if (selectedTopics.length + customTopics.length >= MAX_SUBSCRIPTION_TOPICS) {
      showWarning(text('已触达订阅上限，无法继续添加', 'Subscription limit reached. You can’t add more categories.'))
      return
    }
    setSelectedTopics(prev => prev.includes(value) ? prev : [...prev, value])
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
      showWarning(text('已触达订阅上限，无法继续添加', 'Subscription limit reached. You can’t add more categories.'))
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
    if (!token || operationInFlightRef.current) return
    const pendingSearchTerm = searchTerm.trim()
    const pendingMatchedTopic = pendingSearchTerm ? normalizedTopicLabels.get(normalizeSearchText(pendingSearchTerm)) : null
    const nextSelectedTopics = pendingMatchedTopic && !selectedTopics.includes(pendingMatchedTopic)
      ? [...selectedTopics, pendingMatchedTopic]
      : selectedTopics
    const nextCustomTopics = uniqueCustomTopics([
      ...customTopics,
      ...(pendingSearchTerm && !pendingMatchedTopic ? [pendingSearchTerm] : [])
    ])
    const nextSelectedCount = nextSelectedTopics.length + nextCustomTopics.length

    if (selectedTopics.length === 0 && customTopics.length === 0 && !pendingMatchedTopic && nextCustomTopics.length === 0) {
      showWarning(text('请选择岗位方向', 'Choose a role category'), text('至少选择一个方向后再保存。', 'Select at least one category before saving.'))
      return
    }
    if (nextSelectedCount > MAX_SUBSCRIPTION_TOPICS) {
      showWarning(text('已触达订阅上限，无法继续添加', 'Subscription limit reached. You can’t add more categories.'))
      return
    }
    const topicsToSave = nextCustomTopics.length
      ? [...nextSelectedTopics, 'other']
      : nextSelectedTopics.slice(0, MAX_SUBSCRIPTION_TOPICS)

    operationInFlightRef.current = true
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
        showError(text('订阅保存失败', 'Could not save subscription'), data?.error || text('请稍后重试', 'Please try again later.'))
        return
      }
      setSubscription(data.subscription)
      setSearchTerm('')
      const next = parseTopicState(data.subscription)
      setSelectedTopics(next.topics)
      setCustomTopics(next.customTopics)
      showSuccess(text('邮件订阅已保存', 'Email subscription saved'), text('之后会按你的方向匹配每日精选岗位。', 'We’ll match daily curated roles to your selected categories.'))
    } catch {
      showError(text('订阅保存失败', 'Could not save subscription'), text('网络错误，请稍后重试', 'Network error. Please try again later.'))
    } finally {
      operationInFlightRef.current = false
      setSaving(false)
    }
  }

  const updateSubscriptionStatus = async (status: 'active' | 'inactive') => {
    if (!token || !subscription || operationInFlightRef.current) return
    operationInFlightRef.current = true
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
        showError(text('订阅状态更新失败', 'Could not update subscription'), data?.error || text('请稍后重试', 'Please try again later.'))
        return
      }
      setSubscription(prev => prev ? { ...prev, status } : prev)
      showSuccess(status === 'active' ? text('订阅已恢复', 'Subscription resumed') : text('订阅已暂停', 'Subscription paused'))
    } catch {
      showError(text('订阅状态更新失败', 'Could not update subscription'), text('网络错误，请稍后重试', 'Network error. Please try again later.'))
    } finally {
      operationInFlightRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="relative z-10 mt-6 isolate overflow-visible rounded-[26px] border border-[#dbe9f2] bg-[linear-gradient(135deg,#f7fcff_0%,#ffffff_48%,#fffaf1_100%)] px-5 py-5 shadow-[0_18px_48px_-40px_rgba(62,91,120,0.28)] sm:px-6">
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,rgba(111,99,246,0),rgba(111,99,246,0.35),rgba(240,161,31,0))]" />
      <div className="relative">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[22px] font-black leading-tight tracking-normal text-slate-950 sm:text-[26px]">
                {text('订阅你感兴趣的方向，及时接收最新岗位通知', 'Subscribe to the roles you care about')}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e4dfff] bg-[#f4f1ff] px-3 py-1 text-xs font-black text-[#6f63f6] shadow-sm">
                <Crown className="h-3.5 w-3.5" />
                {text('Club 权益', 'Club benefit')}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              {text(`选择 1-${RECOMMENDED_SUBSCRIPTION_TOPICS} 个岗位方向，当有岗位上新时，我们会发到你的注册邮箱。`, `Choose 1–${RECOMMENDED_SUBSCRIPTION_TOPICS} role categories and receive new matching opportunities at your registered email.`)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600 xl:justify-end">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white bg-white/80 px-3 shadow-sm">
              <Mail className="h-3.5 w-3.5 text-[#6f63f6]" />
              {user?.email || text('登录后使用注册邮箱', 'Log in to use your registered email')}
            </span>
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="mt-5 flex flex-col gap-3 rounded-[20px] border border-[#e3edf4] bg-white/78 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black text-slate-950">{text('登录后开启会员订阅', 'Log in to start a Club subscription')}</div>
              <p className="mt-1 text-sm leading-6 text-slate-500">{text('登录并开通会员后，可保存岗位方向并接收每日邮件推荐。', 'Club members can save role categories and receive daily recommendations by email.')}</p>
            </div>
            <Link
              to="/login"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-black text-white no-underline hover:bg-[#6f63f6] hover:no-underline"
            >
              {text('去登录', 'Log in')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : !isMember ? (
          <div className="mt-5 flex flex-col gap-3 rounded-[20px] border border-[#f2dfb7] bg-[#fffaf0]/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black text-slate-950">{text('会员专属邮件订阅', 'Member email updates')}</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">{text('升级会员后可及时接收你关注的岗位更新，避免错过好机会。', 'Upgrade to receive timely updates for the roles you follow.')}</p>
            </div>
            <Link
              to="/profile?tab=membership#club-service-plans"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#f0a11f] px-5 text-sm font-black text-white no-underline hover:bg-[#d9951f] hover:no-underline"
            >
              {text('升级会员', 'Upgrade membership')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-5">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="text-sm font-black text-slate-950">{text('订阅方向', 'Subscribed categories')}</div>
                  <div className="text-xs font-semibold text-slate-500">
                    {loading ? text('正在读取订阅...', 'Loading subscription...') : subscription ? (isActive ? text('当前订阅生效中', 'Subscription active') : text('当前订阅已暂停', 'Subscription paused')) : text('尚未保存订阅', 'No subscription saved')}
                  </div>
                </div>

                <div ref={comboRef} className="relative">
                  <div
                    className={`flex min-h-[48px] items-center gap-2 rounded-2xl border bg-white/96 px-3 py-2 shadow-[0_12px_28px_-26px_rgba(51,65,85,0.45)] transition-colors ${
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
                            aria-label={text(`移除${item.label}`, `Remove ${item.label}`)}
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
                        placeholder={selectedDisplayItems.length ? text('继续输入或搜索', 'Type or search for more') : text('搜索或输入岗位方向，例如 产品经理、市场营销', 'Search or enter a role, e.g. Product Manager or Marketing')}
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
                      aria-label={text('展开岗位方向列表', 'Open role category list')}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  <div className="mt-2 min-h-[20px] text-xs font-semibold leading-5 text-slate-500">
                    {customTopicHint || (selectedLabels ? text(`已选：${selectedLabels}`, `Selected: ${selectedLabels}`) : '')}
                  </div>

                  {dropdownOpen ? (
                    <div
                      className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-[#dbe9f2] bg-white shadow-[0_24px_70px_-42px_rgba(45,64,92,0.42)]"
                      onMouseDown={event => event.stopPropagation()}
                      onClick={event => event.stopPropagation()}
                      onWheel={event => event.stopPropagation()}
                    >
                      <div className="grid h-[420px] max-h-[calc(100vh-220px)] min-h-[280px] grid-cols-[132px_minmax(0,1fr)] overflow-hidden">
                        <div className="min-h-0 overflow-y-auto overscroll-contain border-r border-[#edf2f7] bg-slate-50/80 p-2 custom-scrollbar">
                          {groupedTopicOptions.map((group, index) => (
                            <button
                              key={group.title}
                              type="button"
                              onClick={event => {
                                event.preventDefault()
                                event.stopPropagation()
                                setActiveTopicGroup(index)
                                setSearchTerm('')
                              }}
                              className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-xs font-black transition-colors ${
                                !normalizedSearchTerm && activeTopicGroup === index
                                  ? 'bg-white text-[#5b50e6] shadow-sm'
                                  : 'text-slate-500 hover:bg-white/80 hover:text-slate-900'
                              }`}
                            >
                              {group.title.replace('类', '')}
                            </button>
                          ))}
                        </div>

                        <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain p-3 custom-scrollbar">
                          <div className="mb-2 px-1 text-sm font-black text-slate-900">{dropdownTitle}</div>
                          {canCreateCustomTopic ? (
                            <button
                              type="button"
                              onClick={() => addCustomTopic(searchTerm)}
                              className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 hover:bg-[#f7f9fc]"
                            >
                              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f4f1ff] text-[#6f63f6]">
                                <Plus className="h-3.5 w-3.5" />
                              </span>
                              <span className="min-w-0 flex-1 truncate">{text(`保留“${searchTerm.trim()}”`, `Keep “${searchTerm.trim()}”`)}</span>
                              <span className="text-xs font-semibold text-slate-400">{text('自定义', 'Custom')}</span>
                            </button>
                          ) : null}

                          <div className="grid gap-1.5">
                            {dropdownTopicOptions.length ? dropdownTopicOptions.map(topic => {
                              const checked = selectedTopics.includes(topic.value)
                              return (
                                <button
                                  key={topic.value}
                                  type="button"
                                  onClick={() => toggleTopic(topic.value)}
                                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                                    checked
                                      ? 'bg-[#f4f1ff] font-black text-[#5b50e6]'
                                      : 'font-bold text-slate-700 hover:bg-[#f7f9fc]'
                                  }`}
                                >
                                  <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                    checked ? 'border-[#6f63f6] bg-[#6f63f6] text-white' : 'border-[#cfdbe6] bg-white'
                                  }`}>
                                    {checked ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">{topic.label}</span>
                                  {checked ? <span className="text-xs font-black text-[#7c70f4]">{text('已选', 'Selected')}</span> : null}
                                </button>
                              )
                            }) : (
                              <div className="px-3 py-6 text-center text-sm font-semibold text-slate-400">
                                {text('没有匹配的内置方向', 'No matching role category')}
                              </div>
                            )}
                          </div>
                        </div>
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
                  {text('保存订阅', 'Save subscription')}
                </button>
                {subscription ? (
                  <button
                    type="button"
                    onClick={() => updateSubscriptionStatus(isActive ? 'inactive' : 'active')}
                    disabled={saving || loading}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#e3edf4] bg-white px-5 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                    {isActive ? text('暂停', 'Pause') : text('恢复', 'Resume')}
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
