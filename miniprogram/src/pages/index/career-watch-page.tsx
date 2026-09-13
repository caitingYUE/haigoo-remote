import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { navigateTo, showModal, showToast, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EditorialTopBar from '../../components/editorial-top-bar'
import MatchCompanyCard from '../../components/match-company-card'
import MatchCompanyDeck from '../../components/match-company-deck'
import MiniIcon from '../../components/mini-icon'
import {
  careerWatchDailyRefreshKey,
  fetchCareerWatch,
  fetchCareerWatchOptions,
  isCareerWatchCacheValid,
  mapResumeCareerDirections,
  normalizeCareerWatchResponse,
  parseCareerResumeFile,
  saveCareerWatch
} from '../../services/career-match-service'
import type { CareerWatchResponse, WatchFeedItem, WatchFilterOptions, WatchPreferenceKey, WatchProfile, WatchRoleFamily } from '../../services/career-match-service'
import { trackMiniEvent } from '../../services/analytics-service'
import { refreshWechatSessionIfStale } from '../../services/mini-auth-service'
import { careerWatchStorageKey, getMiniUser, hasAuthenticatedSession } from '../../services/session'
import { invalidateMiniResource } from '../../services/retained-resource-cache'
import { miniContentScope } from '../../hooks/use-retained-resource'
import useMiniShare from '../../hooks/use-mini-share'
import { matchDeckStorageKey, wrapDeckIndex } from '../../utils/match-deck'
import { formatCalendarDate } from '../../utils/runtime-compat'
// JPEG is derived from home-hero-bg.webp for native image decoding across devices.
import heroImage from '../../../assets/home-hero-bg.jpg'

type WatchStep = 'loading' | 'start' | 'setup' | 'feed' | 'error'
type WatchDraft = Omit<WatchProfile, 'profileId' | 'updatedAt' | 'sourcePlatform' | 'version' | 'inAppEnabled' | 'wechatEnabled' | 'wechatTemplateStatus'> & { version?: number }
type RoleOption = { value: string; label: string; families: WatchRoleFamily[] }

const START_FEATURES = [
  '经过审核的真实企业与远程岗位信息',
  '关注企业查看更新，可授权一次微信提醒',
  '掌上笔记，随时随地提升远程技能'
]

function emptyDraft(): WatchDraft {
  return {
    sourceMode: 'manual', roleFamilies: [], customRoleTerms: [], companyPreferences: {},
    activePreferenceKeys: [], toleranceMode: 'balanced', status: 'active',
    resumeId: null, careerProfileId: null
  }
}

function draftFromWatch(watch: CareerWatchResponse | null): WatchDraft {
  const profile = watch?.profile
  return profile ? {
    sourceMode: profile.sourceMode,
    roleFamilies: profile.roleFamilies,
    customRoleTerms: profile.customRoleTerms,
    companyPreferences: profile.companyPreferences,
    activePreferenceKeys: profile.activePreferenceKeys,
    toleranceMode: profile.toleranceMode,
    status: profile.status,
    resumeId: profile.resumeId,
    careerProfileId: profile.careerProfileId,
    version: profile.version
  } : emptyDraft()
}

function readValidCachedWatch(): CareerWatchResponse | null {
  const user = getMiniUser()
  if (!user?.userId || !hasAuthenticatedSession()) return null
  const cached = normalizeCareerWatchResponse(Taro.getStorageSync(careerWatchStorageKey(user.userId)))
  const activeMember = Boolean(user.isMember && (!user.memberExpireAt || Date.parse(user.memberExpireAt) > Date.now()))
  return cached && isCareerWatchCacheValid(cached) && cached.entitlements.isMember === activeMember ? cached : null
}

function savedDeckIndex(watch: CareerWatchResponse | null) {
  if (!watch?.snapshotId) return 0
  const stored = Number(Taro.getStorageSync(matchDeckStorageKey(getMiniUser()?.userId || 'guest', watch.snapshotId)) || 0)
  return wrapDeckIndex(Number.isFinite(stored) ? stored : 0, watch.recommendations.length)
}

export default function CareerWatchPage() {
  const authenticated = hasAuthenticatedSession()
  const initialWatch = useMemo(() => readValidCachedWatch(), [authenticated])
  const [step, setStep] = useState<WatchStep>(initialWatch ? initialWatch.matchState === 'unused' ? 'start' : 'feed' : authenticated ? 'loading' : 'start')
  const stepRef = useRef(step)
  stepRef.current = step
  const [watch, setWatch] = useState<CareerWatchResponse | null>(initialWatch)
  const [standaloneOptions, setStandaloneOptions] = useState<WatchFilterOptions | null>(null)
  const [draft, setDraft] = useState<WatchDraft>(() => draftFromWatch(initialWatch))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeCompanyIndex, setActiveCompanyIndex] = useState(() => savedDeckIndex(initialWatch))
  const [activeRoleGroup, setActiveRoleGroup] = useState(0)
  const [expandedRoleGroups, setExpandedRoleGroups] = useState<Record<string, boolean>>({})
  const [industriesExpanded, setIndustriesExpanded] = useState(false)
  const resumeFlowActive = useRef(false)
  const loadSequence = useRef(0)
  const pendingLoad = useRef('')
  const lastScope = useRef(miniContentScope())
  const watchRef = useRef(initialWatch)
  const [pendingWatch, setPendingWatch] = useState<CareerWatchResponse | null>(null)
  const pendingWatchRef = useRef<CareerWatchResponse | null>(null)
  useEffect(() => () => { loadSequence.current++ }, [])
  useMiniShare('HaigooRemote｜找到更适合你的远程方向', '/pages/index/index')

  useEffect(() => {
    Taro.eventCenter.trigger('haigoo:match-step', step)
    return () => { Taro.eventCenter.trigger('haigoo:match-step', 'leaving') }
  }, [step])

  const applyResponse = useCallback((result: CareerWatchResponse) => {
    if (watchRef.current?.snapshotId !== result.snapshotId) invalidateMiniResource('profile-dashboard')
    if (watchRef.current?.profile?.version !== result.profile?.version) invalidateMiniResource('companies:')
    // Restore the position with the snapshot, before the native swiper mounts.
    if (watchRef.current?.snapshotId !== result.snapshotId) setActiveCompanyIndex(savedDeckIndex(result))
    pendingWatchRef.current = null
    setPendingWatch(null)
    watchRef.current = result
    setWatch(result)
    const activeUser = getMiniUser()
    if (activeUser?.userId) Taro.setStorageSync(careerWatchStorageKey(activeUser.userId), result)
    Taro.eventCenter.trigger('haigoo:unread-change', result.followedUpdates.length)
    if (result.profile) setDraft(draftFromWatch(result))
    setStep(result.matchState === 'unused' ? 'start' : 'feed')
  }, [])

  useEffect(() => {
    if (!watch?.snapshotId || !watch.recommendations.length) return
    const nextIndex = savedDeckIndex(watch)
    void trackMiniEvent('mini_match_deck_view', { snapshot_id: watch.snapshotId, result_count: watch.recommendations.length, presentation_version: 'immersive_v2_1' })
    void trackMiniEvent('mini_match_card_view', { snapshot_id: watch.snapshotId, entity_id: watch.recommendations[nextIndex]?.companyId, card_index: nextIndex, presentation_version: 'immersive_v2_1' })
  }, [watch?.snapshotId])

  const load = useCallback(async (force = false) => {
    const scope = miniContentScope()
    if (lastScope.current !== scope) {
      lastScope.current = scope
      pendingLoad.current = ''
      pendingWatchRef.current = null
      setPendingWatch(null)
      watchRef.current = null
      setWatch(null)
      setDraft(emptyDraft)
      setActiveCompanyIndex(0)
      setStep(hasAuthenticatedSession() ? 'loading' : 'start')
    }
    if (!hasAuthenticatedSession()) { setStep('start'); return }
    if (pendingLoad.current === scope) return
    if (!force && pendingWatchRef.current && isCareerWatchCacheValid(pendingWatchRef.current)) return
    pendingLoad.current = scope
    const sequence = ++loadSequence.current
    setError('')
    const validCached = readValidCachedWatch()
    if (validCached && !resumeFlowActive.current) {
      applyResponse(validCached)
      if (!force) { pendingLoad.current = ''; return }
    }
    try {
      let result = await fetchCareerWatch()
      if (scope !== miniContentScope() || sequence !== loadSequence.current) return
      if (result.entitlements.isMember && result.matchState !== 'unused' && !isCareerWatchCacheValid(result)) {
        result = await fetchCareerWatch(careerWatchDailyRefreshKey())
      }
      if (scope !== miniContentScope() || sequence !== loadSequence.current || resumeFlowActive.current || stepRef.current === 'setup') return
      if (watchRef.current && watchRef.current.snapshotId !== result.snapshotId && !force) {
        pendingWatchRef.current = result
        setPendingWatch(result)
      } else applyResponse(result)
      if (result.stale) setError('暂时无法更新，仍在展示上次结果。')
      void trackMiniEvent('mini_watch_feed_loaded', { result_count: result.recommendations.length, match_state: result.matchState })
    } catch (loadError) {
      if (sequence !== loadSequence.current) return
      if (scope !== miniContentScope()) {
        setWatch(null)
        setDraft(emptyDraft)
        setStep(hasAuthenticatedSession() ? 'error' : 'start')
        setError('账号状态已变化，请重新加载')
        return
      }
      if (validCached || watchRef.current) {
        setError('暂时无法更新，仍在展示上次结果。')
      } else {
        setError(loadError instanceof Error ? loadError.message : '方向结果暂时无法加载')
        setStep('error')
      }
    } finally {
      if (sequence === loadSequence.current) pendingLoad.current = ''
    }
  }, [applyResponse])

  useDidShow(() => {
    Taro.eventCenter.trigger('haigoo:tab-change', '/pages/index/index')
    if (resumeFlowActive.current || (stepRef.current === 'setup' && lastScope.current === miniContentScope())) return
    const previousScope = miniContentScope()
    const authenticatedNow = hasAuthenticatedSession()
    const refresh = authenticatedNow ? refreshWechatSessionIfStale().catch(() => null) : Promise.resolve(null)
    void refresh.then(() => {
      const pendingIntent = String(Taro.getStorageSync('haigoo:match-intent') || '')
      if (hasAuthenticatedSession() && pendingIntent) {
        Taro.removeStorageSync('haigoo:match-intent')
        if (pendingIntent === 'resume') void uploadResume()
        else if (pendingIntent === 'save') void save(true)
        else void load(true)
        return
      }
      const cached = readValidCachedWatch()
      if (lastScope.current === miniContentScope() && previousScope === miniContentScope() && cached) {
        // Returning must preserve the current step, edits and card position.
        watchRef.current = cached
        setWatch(cached)
        return
      }
      void load()
    })
  })

  const ensureAccount = async (intent = '') => {
    if (hasAuthenticatedSession()) return true
    if (intent) Taro.setStorageSync('haigoo:match-intent', intent)
    await navigateTo({ url: '/pages/profile/index' })
    return false
  }

  const startSetup = async () => {
    setBusy(true); setError('')
    try {
      let options: WatchFilterOptions
      if (hasAuthenticatedSession()) {
        const result = await fetchCareerWatch()
        applyResponse(result)
        setStandaloneOptions(result.filterOptions)
        options = result.filterOptions
        if (!result.profile) setDraft(emptyDraft())
      } else {
        const result = await fetchCareerWatchOptions()
        setStandaloneOptions(result.filterOptions)
        options = result.filterOptions
        setDraft(emptyDraft())
      }
      if (!options.roles.length) throw new Error('职业方向暂时无法加载')
      setStep('setup')
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : '设置项暂时无法加载')
    } finally { setBusy(false) }
  }

  const uploadResume = async () => {
    if (!await ensureAccount('resume')) return
    resumeFlowActive.current = true
    setBusy(true); setError('')
    try {
      const result = watch || await fetchCareerWatch()
      setStandaloneOptions(result.filterOptions)
      const selected = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['pdf', 'docx', 'txt'] })
      const file = selected.tempFiles[0]
      if (!file) return
      if (Number(file.size || 0) > 2 * 1024 * 1024) throw new Error('简历不能超过 2MB，请压缩后重试')
      const parsed = await parseCareerResumeFile(file.name || 'resume.pdf', file.path)
      const mapped = mapResumeCareerDirections(parsed.structured, result.filterOptions)
      setDraft({ ...emptyDraft(), sourceMode: 'resume', ...mapped })
      setStep('setup')
      if (mapped.customRoleTerms.length) {
        showToast({ title: '已识别方向，请确认', icon: 'none' })
      } else {
        await showModal({
          title: '暂无匹配类型',
          content: '暂未识别到可用的职业方向，请手动选择你感兴趣的方向。',
          showCancel: false,
          confirmText: '手动选择'
        })
      }
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : String(uploadError || '')
      if (!/cancel/i.test(message)) setError(message || '简历读取失败，请重试')
    } finally {
      resumeFlowActive.current = false
      setBusy(false)
    }
  }

  const filterOptions = watch?.filterOptions || standaloneOptions
  const roleGroups = useMemo(() => filterOptions?.roleGroups?.length
    ? filterOptions.roleGroups
    : [{ key: 'all', label: '职业方向', options: (filterOptions?.roles || []).map((item) => ({ value: item.label, label: item.label, families: [item.value] })) }], [filterOptions])
  const roleOptions = useMemo(() => roleGroups.flatMap((group) => group.options), [roleGroups])
  const activeRoleGroupItem = roleGroups[activeRoleGroup] || roleGroups[0]
  const activeRoleOptions = activeRoleGroupItem?.options || []
  const activeRoleGroupKey = activeRoleGroupItem?.key || 'all'
  const roleOptionsExpanded = Boolean(expandedRoleGroups[activeRoleGroupKey])
  const visibleRoleOptions = roleOptionsExpanded ? activeRoleOptions : activeRoleOptions.slice(0, 6)
  const industryOptions = filterOptions?.industries || []
  const selectedIndustries = draft.companyPreferences.industries || []
  const visibleIndustryOptions = industriesExpanded
    ? industryOptions
    : [...industryOptions.filter((item) => selectedIndustries.includes(item.value)), ...industryOptions.filter((item) => !selectedIndustries.includes(item.value))].slice(0, 8)
  const unrepresentedRoleFamilies = useMemo(() => {
    const explicitFamilies = new Set(draft.customRoleTerms.flatMap((term) => roleOptions.find((item) => item.value === term)?.families || []))
    return draft.roleFamilies.filter((role) => !explicitFamilies.has(role))
  }, [draft.customRoleTerms, draft.roleFamilies, roleOptions])

  const toggleRole = (option: RoleOption) => setDraft((current) => {
    const selected = current.customRoleTerms
    const exists = selected.includes(option.value)
    const explicitFamilies = new Set(selected.flatMap((term) => roleOptions.find((item) => item.value === term)?.families || []))
    const retainedFamilies = current.roleFamilies.filter((role) => !explicitFamilies.has(role))
    if (!exists && selected.length + retainedFamilies.length >= 5) { showToast({ title: '最多选择 5 个方向', icon: 'none' }); return current }
    const customRoleTerms = exists ? selected.filter((item) => item !== option.value) : [...selected, option.value]
    const roleFamilies = [...new Set([...retainedFamilies, ...customRoleTerms.flatMap((term) => roleOptions.find((item) => item.value === term)?.families || [])])].slice(0, 5)
    return { ...current, sourceMode: current.sourceMode === 'resume' ? 'mixed' : 'manual', customRoleTerms, roleFamilies }
  })

  const removeBroadRole = (role: WatchRoleFamily) => setDraft((current) => ({
    ...current,
    sourceMode: current.customRoleTerms.length ? 'manual' : current.sourceMode,
    roleFamilies: current.roleFamilies.filter((item) => item !== role)
  }))

  const setPreference = (key: WatchPreferenceKey, field: keyof WatchProfile['companyPreferences'], value: unknown) => setDraft((current) => {
    return {
      ...current,
      activePreferenceKeys: current.activePreferenceKeys.includes(key) ? current.activePreferenceKeys : [...current.activePreferenceKeys, key],
      companyPreferences: { ...current.companyPreferences, [field]: value }
    }
  })

  const clearPreference = (key: WatchPreferenceKey, field: keyof WatchProfile['companyPreferences']) => setDraft((current) => {
    const companyPreferences = { ...current.companyPreferences }
    delete companyPreferences[field]
    return { ...current, activePreferenceKeys: current.activePreferenceKeys.filter((item) => item !== key), companyPreferences }
  })

  const toggleIndustry = (industry: string) => {
    setDraft((value) => {
      const current = value.companyPreferences.industries || []
      const adding = !current.includes(industry)
      if (adding && current.length >= 3) { showToast({ title: '行业最多选择 3 个', icon: 'none' }); return value }
      const next = adding ? [...current, industry] : current.filter((item) => item !== industry)
      return {
        ...value,
        activePreferenceKeys: next.length
          ? value.activePreferenceKeys.includes('industry') ? value.activePreferenceKeys : [...value.activePreferenceKeys, 'industry']
          : value.activePreferenceKeys.filter((item) => item !== 'industry'),
        companyPreferences: { ...value.companyPreferences, industries: next }
      }
    })
  }

  const save = async (confirmed = false): Promise<void> => {
    if (!draft.roleFamilies.length) return setError('请至少选择一个职业方向')
    if (!confirmed && (!watch || watch.matchState === 'unused')) {
      const result = await showModal({
        title: '确认当前方向？',
        content: '请确认你选择的职业方向。生成后，本次结果将继续保留。',
        confirmText: '确认生成'
      })
      if (!result.confirm) return
    }
    if (!await ensureAccount('save')) return
    const scope = miniContentScope()
    ++loadSequence.current
    pendingLoad.current = ''
    let shouldRetry = false
    setBusy(true); setError('')
    try {
      const result = await saveCareerWatch(draft)
      if (scope !== miniContentScope()) return
      applyResponse(result)
      showToast({ title: result.matchState === 'fixed_free' ? '方向结果已生成' : '职业方向已更新', icon: 'success' })
      void trackMiniEvent('mini_watch_saved', { role_count: draft.roleFamilies.length, match_state: result.matchState })
    } catch (saveError: any) {
      if (scope !== miniContentScope()) return
      let reconciled: CareerWatchResponse | null = null
      for (let attempt = 0; attempt < 3 && !reconciled; attempt += 1) {
        if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt * 500))
        try {
          const latest = await fetchCareerWatch()
          const sameDirections = latest.profile &&
            [...latest.profile.customRoleTerms].sort().join('|') === [...draft.customRoleTerms].sort().join('|') &&
            [...latest.profile.roleFamilies].sort().join('|') === [...draft.roleFamilies].sort().join('|')
          if (latest.matchState !== 'unused' && sameDirections) reconciled = latest
        } catch { /* Retry the authoritative state read. */ }
      }
      if (scope !== miniContentScope()) return
      if (reconciled) {
        applyResponse(reconciled)
        showToast({ title: reconciled.matchState === 'fixed_free' ? '方向结果已生成' : '职业方向已更新', icon: 'success' })
      } else if (saveError?.payload?.code === 'FREE_MATCH_USED') {
        await load()
      } else {
        const retry = await showModal({
          title: '方向生成失败',
          content: saveError instanceof Error ? saveError.message : '方向结果没有生成，请稍后重试。',
          cancelText: '稍后再试',
          confirmText: '重试'
        })
        shouldRetry = retry.confirm
      }
    } finally { setBusy(false) }
    if (shouldRetry) void save(true)
  }

  const roleSummary = useMemo(() => {
    return [...draft.customRoleTerms, ...unrepresentedRoleFamilies.map((role) => filterOptions?.roles.find((item) => item.value === role)?.label || role)].join('、')
  }, [draft.customRoleTerms, filterOptions?.roles, unrepresentedRoleFamilies])
  const selectedDirectionCount = draft.customRoleTerms.length + unrepresentedRoleFamilies.length
  const feedSummary = [
    roleSummary || '职业方向待完善',
    (draft.companyPreferences.industries || []).slice(0, 2).join('/'),
    draft.companyPreferences.teamSize ? filterOptions?.teamSizes.find((item) => item.value === draft.companyPreferences.teamSize)?.label : ''
  ].filter(Boolean).join(' · ')
  const recentMatchDate = formatCalendarDate(watch?.generatedAt)
  const activeUser = getMiniUser()
  const updateCompanyState = (companyId: string, state: Partial<Pick<WatchFeedItem, 'isFollowed' | 'isSubscribed'>>) => setWatch((current) => current ? {
    ...current,
    recommendations: current.recommendations.map((item) => item.companyId === companyId ? { ...item, ...state } : item)
  } : current)
  const changeActiveCompany = (index: number, direction: 'left' | 'right') => {
    setActiveCompanyIndex(index)
    if (watch?.snapshotId) Taro.setStorageSync(matchDeckStorageKey(activeUser?.userId || 'guest', watch.snapshotId), index)
    const company = watch?.recommendations[index]
    void trackMiniEvent('mini_match_card_swipe', { snapshot_id: watch?.snapshotId, entity_id: company?.companyId, card_index: index, direction, presentation_version: 'immersive_v2_1' })
    if (company) void trackMiniEvent('mini_match_card_view', { snapshot_id: watch?.snapshotId, entity_id: company.companyId, card_index: index, presentation_version: 'immersive_v2_1' })
  }
  const openCompany = (company: WatchFeedItem) => {
    void trackMiniEvent('mini_company_open', { entity_id: company.companyId, source_page: 'match' })
    navigateTo({ url: `/pages/company-detail/index?id=${encodeURIComponent(company.companyId)}` })
  }
  const openJob = (company: WatchFeedItem) => {
    if (!company.jobId) return
    void trackMiniEvent('mini_match_job_open', { entity_id: company.jobId, company_id: company.companyId })
    navigateTo({ url: `/pages/job-detail/index?companyId=${encodeURIComponent(company.companyId)}&jobId=${encodeURIComponent(company.jobId)}` })
  }
  const openScore = (company: WatchFeedItem) => {
    void trackMiniEvent('mini_match_score_open', {
      snapshot_id: watch?.snapshotId,
      entity_id: company.companyId,
      card_index: activeCompanyIndex,
      score_band: company.fitBand,
      score_confidence_band: company.scoreConfidence >= 0.75 ? 'high' : 'limited',
      presentation_version: 'immersive_v2_1'
    })
  }
  const focusFirstSelectedRoleGroup = () => {
    const selectedTerm = draft.customRoleTerms.find((term) => roleGroups.some((group) => group.options.some((option) => option.value === term)))
    let groupIndex = selectedTerm
      ? roleGroups.findIndex((group) => group.options.some((option) => option.value === selectedTerm))
      : roleGroups.findIndex((group) => group.options.some((option) => option.families.some((family) => draft.roleFamilies.includes(family))))
    if (groupIndex < 0) groupIndex = 0
    setActiveRoleGroup(groupIndex)
    const group = roleGroups[groupIndex]
    const optionIndex = selectedTerm ? group?.options.findIndex((option) => option.value === selectedTerm) ?? -1 : -1
    if (group && optionIndex >= 6) setExpandedRoleGroups((current) => ({ ...current, [group.key]: true }))
  }
  const openMatchSettings = () => {
    if (watch?.matchState === 'member_dynamic') { focusFirstSelectedRoleGroup(); setStep('setup'); return }
    void showModal({
      title: '当前个性化设置',
      content: `当前方向：${feedSummary || '暂未设置'}。免费匹配结果生成后会固定保留，会员可随时修改方向和企业偏好。`,
      showCancel: false,
      confirmText: '知道了'
    })
  }

  return <View className={`watch-root ${step === 'loading' ? 'watch-root--loading' : ''} ${step === 'start' ? 'watch-root--start' : ''} ${step === 'feed' ? 'watch-root--feed' : ''}`}>
    <EditorialTopBar authenticated={authenticated} avatar={activeUser?.avatar} unread={watch?.followedUpdates.length || 0} showAccount={step !== 'setup'} />
    <View className={`page-shell watch-page ${step === 'feed' ? 'watch-page--feed' : ''} ${step === 'start' || step === 'setup' ? 'watch-page--flow' : ''}`}>
    {step === 'loading' ? <View className='watch-loading' aria-live='polite' aria-busy aria-label='正在匹配中'>
      <View className='watch-loading__visual'><MiniIcon name='search' size={30} /></View>
      <Text className='watch-loading__label'>正在匹配中</Text>
      <Text className='watch-loading__status'>正在根据你的方向整理企业信息</Text>
    </View> : null}

    {step === 'start' ? <View className='watch-start'>
      <View className='watch-start__hero'>
        <Image className='watch-start__hero-image' src={heroImage} mode='aspectFill' lazyLoad={false} />
        <Text className='watch-start__brand-mark'>HaigooRemote</Text>
      </View>
      <View className='watch-start__content'>
        <View className='watch-brand'>
          <Text className='watch-brand__title'>你的掌上</Text>
          <Text className='watch-brand__title watch-brand__title--accent'>远程工作助手</Text>
        </View>
        <View className='watch-start__features'>{START_FEATURES.map((feature) => <View key={feature}><View><MiniIcon name='check' size={15} /></View><Text>{feature}</Text></View>)}</View>
        <View className='watch-start__actions'>
          <View className={`primary-button watch-primary ${busy ? 'primary-button--disabled' : ''}`} aria-role='button' aria-label={busy ? '正在准备匹配' : '开始设置偏好'} hoverClass={busy ? undefined : 'mini-action--pressed'} onClick={busy ? undefined : () => void startSetup()}><Text>{busy ? '正在准备…' : '开始设置偏好'}</Text><MiniIcon name='chevronRight' size={18} /></View>
          <View className='watch-secondary' aria-role='button' aria-label='上传简历，快速识别方向' hoverClass='mini-action--pressed' onClick={busy ? undefined : () => void uploadResume()}><MiniIcon name='application' size={20} />上传简历，快速识别方向</View>
          {!authenticated ? <View className='watch-start__login' aria-role='button' aria-label='已有账号，前往登录' hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/account-bind/index' })}>已有账号，前往登录</View> : null}
          {error ? <View className='watch-start__error' aria-live='polite'><Text>{error}</Text><Text aria-role='button' aria-label='重试匹配设置' onClick={busy ? undefined : () => void startSetup()}>重试</Text></View> : null}
        </View>
      </View>
    </View> : null}

    {step === 'setup' && filterOptions ? <View className='watch-setup'>
      <View className='watch-setup__progress'><View aria-role='button' aria-label='返回启动页' hoverClass='mini-action--pressed' onClick={() => setStep('start')}><MiniIcon name='chevronLeft' size={20} /></View><View className='watch-setup__progress-bars'><View className='is-complete' /><View className='is-active' /><View /></View><Text aria-role='button' aria-label='跳过个性化设置' onClick={() => setStep(watch ? 'feed' : 'start')}>跳过</Text></View>
      <View className='watch-heading'><Text>设置远程工作预期</Text><Text>可选择 1–5 个方向，逐步缩小更适合你的企业范围。</Text></View>
      <View className='watch-field watch-role-field'>
        <View className='watch-field__head'><Text className='watch-field__label'>职业方向</Text><Text>{selectedDirectionCount}/5</Text></View>
        <ScrollView className='watch-role-tabs' scrollX enhanced showScrollbar={false}><View className='watch-role-tabs__inner'>{roleGroups.map((group, index) => <Text aria-role='tab' aria-selected={activeRoleGroup === index} className={activeRoleGroup === index ? 'is-active' : ''} key={group.key} onClick={() => setActiveRoleGroup(index)}>{group.label}</Text>)}</View></ScrollView>
        <View className='watch-choice-grid'>{visibleRoleOptions.map((item) => <View aria-role='checkbox' aria-checked={draft.customRoleTerms.includes(item.value)} className={draft.customRoleTerms.includes(item.value) ? 'is-active' : ''} hoverClass='mini-action--pressed' key={item.value} onClick={() => toggleRole(item)}><Text>{item.label}</Text>{draft.customRoleTerms.includes(item.value) ? <MiniIcon name='check' size={17} /> : null}</View>)}</View>
        {activeRoleOptions.length > 6 ? <View className='watch-expand-toggle' aria-role='button' aria-expanded={roleOptionsExpanded} hoverClass='mini-action--pressed' onClick={() => setExpandedRoleGroups((current) => ({ ...current, [activeRoleGroupKey]: !current[activeRoleGroupKey] }))}><Text>{roleOptionsExpanded ? '收起' : `展开其余 ${activeRoleOptions.length - 6} 项`}</Text></View> : null}
        {unrepresentedRoleFamilies.length ? <View className='watch-resume-directions'>{unrepresentedRoleFamilies.map((role) => <Text key={role} onClick={() => removeBroadRole(role)}>{filterOptions.roles.find((item) => item.value === role)?.label || role} ×</Text>)}</View> : null}
        {roleSummary ? <Text className='watch-field__selection'>已选：{roleSummary}</Text> : null}
      </View>
      {industryOptions.length ? <View className='watch-field'><Text className='watch-field__label'>目标行业</Text><View className='watch-chip-row watch-industry-grid'><Text className={selectedIndustries.length ? '' : 'is-active'} onClick={() => clearPreference('industry', 'industries')}>不限</Text>{visibleIndustryOptions.map((item) => <Text className={selectedIndustries.includes(item.value) ? 'is-active' : ''} key={item.value} onClick={() => toggleIndustry(item.value)}>{item.label}</Text>)}</View>{industryOptions.length > 8 ? <View className='watch-expand-toggle' aria-role='button' aria-expanded={industriesExpanded} hoverClass='mini-action--pressed' onClick={() => setIndustriesExpanded((current) => !current)}><Text>{industriesExpanded ? '收起' : `展开其余 ${industryOptions.length - 8} 项`}</Text></View> : null}</View> : null}
      {filterOptions.teamSizes.length ? <View className='watch-field'><Text className='watch-field__label'>企业规模</Text><View className='watch-chip-row'><Text className={draft.companyPreferences.teamSize ? '' : 'is-active'} onClick={() => clearPreference('teamSize', 'teamSize')}>不限</Text>{filterOptions.teamSizes.map((item) => <Text className={draft.companyPreferences.teamSize === item.value ? 'is-active' : ''} key={item.value} onClick={() => setPreference('teamSize', 'teamSize', item.value)}>{item.label}</Text>)}</View></View> : null}
      {filterOptions.ratings.length ? <View className='watch-field'><Text className='watch-field__label'>Glassdoor 最低评分</Text><View className='watch-chip-row'><Text className={draft.companyPreferences.minRating ? '' : 'is-active'} onClick={() => clearPreference('rating', 'minRating')}>不限</Text>{filterOptions.ratings.map((item) => <Text className={draft.companyPreferences.minRating === item.value ? 'is-active' : ''} key={item.value} onClick={() => setPreference('rating', 'minRating', item.value)}>{item.label}</Text>)}</View></View> : null}
      {filterOptions.companyAges.length ? <View className='watch-field'><Text className='watch-field__label'>成立年限</Text><View className='watch-chip-row'><Text className={draft.companyPreferences.minFoundedYears ? '' : 'is-active'} onClick={() => clearPreference('companyAge', 'minFoundedYears')}>不限</Text>{filterOptions.companyAges.map((item) => <Text className={draft.companyPreferences.minFoundedYears === item.value ? 'is-active' : ''} key={item.value} onClick={() => setPreference('companyAge', 'minFoundedYears', item.value)}>{item.label}</Text>)}</View></View> : null}
      {error ? <Text className='watch-error'>{error}</Text> : null}
      <View className='watch-submit-bar'><View><Text>已选择 {selectedDirectionCount}/5</Text><Text>{draft.activePreferenceKeys.length ? `已设置 ${draft.activePreferenceKeys.length} 项企业条件` : '企业条件不限'}</Text></View><View className={`primary-button ${busy || selectedDirectionCount === 0 ? 'primary-button--disabled' : ''}`} aria-disabled={busy || selectedDirectionCount === 0} onClick={busy || selectedDirectionCount === 0 ? undefined : () => void save()}>{busy ? '正在生成…' : watch?.entitlements.isMember ? '保存并更新方向' : '查看方向与企业'}</View></View>
    </View> : null}

    {step === 'error' ? <View className='watch-fatal-error'><MiniIcon name='target' size={30} /><Text>匹配结果暂时无法加载</Text><Text>{error || '请检查网络后重新加载。'}</Text><View className='primary-button' onClick={() => { setStep('loading'); void load() }}>重新加载</View></View> : null}

    {step === 'feed' && watch ? <View className='watch-feed'>
      <View className='watch-feed__heading'>
        <View className='watch-feed__heading-copy'><Text className='watch-feed__title'>为你匹配</Text><Text className='watch-feed__count'>{activeCompanyIndex + 1}/{watch.recommendations.length}</Text></View>
        <View className='watch-feed__summary'>
          <Text className='watch-feed__summary-copy'>{feedSummary}</Text>
          <View className='watch-feed__summary-action' aria-role='button' aria-label='编辑个性化设置' onClick={openMatchSettings}><MiniIcon name='settings' size={16} /></View>
        </View>
        <View className='watch-feed__meta'>
          <Text className='watch-feed__freshness'>
            {recentMatchDate ? `更新于 ${recentMatchDate}` : '本次 Match 结果'}
            {!watch.entitlements.isMember ? ' · 非会员仅匹配一次' : ''}
          </Text>
          {!watch.entitlements.isMember ? <View className='watch-feed__membership' aria-role='button' onClick={() => navigateTo({ url: '/pages/membership/index' })}>升级会员</View> : null}
          {watch.entitlements.isMember ? pendingWatch
            ? <Text className='watch-feed__update' aria-role='button' onClick={() => applyResponse(pendingWatch)}>今日已更新 · 点击查看</Text>
            : <Text className='watch-feed__daily'>会员日更</Text> : null}
        </View>
      </View>
      {watch.recommendations.length ? <>
        <MatchCompanyDeck key={watch.snapshotId} items={watch.recommendations} snapshotId={watch.snapshotId} activeIndex={activeCompanyIndex} onActiveIndexChange={changeActiveCompany} renderCard={(company, active) => <MatchCompanyCard
          company={company}
          active={active}
          reminderAvailable={watch.entitlements.wechatSubscriptionAvailable}
          reminderTemplateId={watch.entitlements.wechatTemplateId}
          onFollowChanged={(companyId, followed) => updateCompanyState(companyId, followed
            ? { isFollowed: true }
            : { isFollowed: false, isSubscribed: false })}
          onReminderChanged={(companyId, enabled) => updateCompanyState(companyId, { isSubscribed: enabled })}
          onOpenCompany={openCompany}
          onOpenJob={openJob}
          onScoreOpened={openScore}
        />} />
        <View className='watch-deck-meta'>
          <View className='watch-deck-dots'>{watch.recommendations.map((item, index) => <View className={index === activeCompanyIndex ? 'is-active' : ''} key={item.companyId} />)}</View>
        </View>
      </> : <View className='watch-empty'><MiniIcon name='target' size={30} /><Text>{watch.emptyReason === 'strict_filters' ? '当前条件下暂无合适企业' : '当前方向暂无合适企业'}</Text><Text>{watch.emptyReason === 'strict_filters' ? '可以放宽一项企业条件后再试。' : '调整职业方向后，我们会重新整理。'}</Text>{watch.matchState === 'member_dynamic' ? <View className='primary-button' onClick={() => setStep('setup')}>{watch.emptyReason === 'strict_filters' ? '放宽企业条件' : '调整求职方向'}</View> : <View className='primary-button' onClick={() => void load()}>重新加载</View>}</View>}
    </View> : null}
    </View>
  </View>
}
