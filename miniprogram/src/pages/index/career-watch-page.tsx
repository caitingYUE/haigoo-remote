import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { navigateTo, showModal, showToast, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EditorialTopBar from '../../components/editorial-top-bar'
import MatchCompanyCard from '../../components/match-company-card'
import MatchCompanyDeck from '../../components/match-company-deck'
import MiniIcon from '../../components/mini-icon'
import {
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
import { loginWithWechat } from '../../services/mini-auth-service'
import { getMiniUser, hasAuthenticatedSession } from '../../services/session'
import useMiniNavigationInset from '../../hooks/use-mini-navigation-inset'
import useMiniShare from '../../hooks/use-mini-share'
import { matchDeckStorageKey, wrapDeckIndex } from '../../utils/match-deck'
import heroImage from '../../../assets/home-hero-bg.webp'

type WatchStep = 'loading' | 'start' | 'setup' | 'feed' | 'error'
type WatchDraft = Omit<WatchProfile, 'profileId' | 'updatedAt' | 'sourcePlatform' | 'version' | 'inAppEnabled' | 'wechatEnabled' | 'wechatTemplateStatus'> & { version?: number }
type RoleOption = { value: string; label: string; families: WatchRoleFamily[] }

const START_FEATURES = [
  '基于职业方向匹配远程企业',
  '关注企业，持续接收信息更新',
  '掌上笔记，随时提升远程技能。'
]

function emptyDraft(): WatchDraft {
  return {
    sourceMode: 'manual', roleFamilies: [], customRoleTerms: [], companyPreferences: {},
    activePreferenceKeys: [], toleranceMode: 'balanced', status: 'active',
    resumeId: null, careerProfileId: null
  }
}

export default function CareerWatchPage() {
  const authenticated = hasAuthenticatedSession()
  const [step, setStep] = useState<WatchStep>(authenticated ? 'loading' : 'start')
  const [watch, setWatch] = useState<CareerWatchResponse | null>(null)
  const [standaloneOptions, setStandaloneOptions] = useState<WatchFilterOptions | null>(null)
  const [draft, setDraft] = useState<WatchDraft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeCompanyIndex, setActiveCompanyIndex] = useState(0)
  const [activeRoleGroup, setActiveRoleGroup] = useState(0)
  const resumeFlowActive = useRef(false)
  const navigationInset = useMiniNavigationInset(0)
  useMiniShare('HaigooRemote｜找到更适合你的远程方向', '/pages/index/index')

  useEffect(() => {
    Taro.eventCenter.trigger('haigoo:match-step', step)
    return () => { Taro.eventCenter.trigger('haigoo:match-step', 'leaving') }
  }, [step])

  const applyResponse = useCallback((result: CareerWatchResponse) => {
    setWatch(result)
    const activeUser = getMiniUser()
    if (activeUser?.userId) Taro.setStorageSync(`haigoo-career-watch:${activeUser.userId}`, result)
    Taro.eventCenter.trigger('haigoo:unread-change', result.followedUpdates.length)
    if (result.profile) {
      setDraft({
        sourceMode: result.profile.sourceMode,
        roleFamilies: result.profile.roleFamilies,
        customRoleTerms: result.profile.customRoleTerms,
        companyPreferences: result.profile.companyPreferences,
        activePreferenceKeys: result.profile.activePreferenceKeys,
        toleranceMode: result.profile.toleranceMode,
        status: result.profile.status,
        resumeId: result.profile.resumeId,
        careerProfileId: result.profile.careerProfileId,
        version: result.profile.version
      })
    }
    setStep(result.matchState === 'unused' ? 'start' : 'feed')
  }, [])

  useEffect(() => {
    if (!watch?.snapshotId || !watch.recommendations.length) return
    const userId = getMiniUser()?.userId || 'guest'
    const stored = Number(Taro.getStorageSync(matchDeckStorageKey(userId, watch.snapshotId)) || 0)
    const nextIndex = wrapDeckIndex(Number.isFinite(stored) ? stored : 0, watch.recommendations.length)
    setActiveCompanyIndex(nextIndex)
    void trackMiniEvent('mini_match_deck_view', { snapshot_id: watch.snapshotId, result_count: watch.recommendations.length, presentation_version: 'immersive_v2_1' })
    void trackMiniEvent('mini_match_card_view', { snapshot_id: watch.snapshotId, entity_id: watch.recommendations[nextIndex]?.companyId, card_index: nextIndex, presentation_version: 'immersive_v2_1' })
  }, [watch?.snapshotId])

  const load = useCallback(async () => {
    if (!hasAuthenticatedSession()) { setStep('start'); return }
    setError('')
    const activeUser = getMiniUser()
    const cached = activeUser?.userId
      ? normalizeCareerWatchResponse(Taro.getStorageSync(`haigoo-career-watch:${activeUser.userId}`))
      : null
    const validCached = cached && isCareerWatchCacheValid(cached) ? cached : null
    if (validCached && !resumeFlowActive.current) applyResponse(validCached)
    try {
      const result = await fetchCareerWatch()
      if (resumeFlowActive.current) return
      applyResponse(result)
      void trackMiniEvent('mini_watch_feed_loaded', { result_count: result.recommendations.length, match_state: result.matchState })
    } catch (loadError) {
      if (validCached) {
        setError('暂时无法更新，仍在展示有效期内的上次结果。')
      } else {
        setError(loadError instanceof Error ? loadError.message : '方向结果暂时无法加载')
        setStep('error')
      }
    }
  }, [applyResponse])

  useDidShow(() => {
    Taro.eventCenter.trigger('haigoo:tab-change', '/pages/index/index')
    if (resumeFlowActive.current) return
    const pendingIntent = String(Taro.getStorageSync('haigoo:match-intent') || '')
    if (hasAuthenticatedSession() && pendingIntent) {
      Taro.removeStorageSync('haigoo:match-intent')
      if (pendingIntent === 'resume') void uploadResume()
      else if (pendingIntent === 'save') void save(true)
      else void load()
      return
    }
    void load()
  })

  const ensureAccount = async (intent = '') => {
    if (hasAuthenticatedSession()) return true
    try {
      const session = await loginWithWechat()
      if (!session.bound) {
        if (intent) Taro.setStorageSync('haigoo:match-intent', intent)
        navigateTo({ url: '/pages/account-bind/index' })
        return false
      }
      return true
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '微信登录失败，请重试')
      return false
    }
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

  const save = async (confirmed = false) => {
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
    setBusy(true); setError('')
    try {
      const result = await saveCareerWatch(draft)
      applyResponse(result)
      showToast({ title: result.matchState === 'fixed_free' ? '方向结果已生成' : '职业方向已更新', icon: 'success' })
      void trackMiniEvent('mini_watch_saved', { role_count: draft.roleFamilies.length, match_state: result.matchState })
    } catch (saveError: any) {
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
      if (reconciled) {
        applyResponse(reconciled)
        showToast({ title: reconciled.matchState === 'fixed_free' ? '方向结果已生成' : '职业方向已更新', icon: 'success' })
      } else if (saveError?.payload?.code === 'FREE_MATCH_USED') {
        await load()
        setError('方向结果已生成，可继续查看和订阅企业。')
      } else setError(saveError instanceof Error ? saveError.message : '方向结果没有生成，请重试')
    } finally { setBusy(false) }
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
  const openMatchSettings = () => {
    if (watch?.matchState === 'member_dynamic') { setStep('setup'); return }
    void showModal({
      title: '当前个性化设置',
      content: `当前方向：${feedSummary || '暂未设置'}。免费匹配结果生成后会固定保留，会员可随时修改方向和企业偏好。`,
      showCancel: false,
      confirmText: '知道了'
    })
  }

  return <View className='watch-root'>
    <EditorialTopBar authenticated={authenticated} avatar={activeUser?.avatar} unread={watch?.followedUpdates.length || 0} showAccount={step !== 'start' && step !== 'setup'} />
    <View className={`page-shell watch-page ${step === 'feed' ? 'watch-page--feed' : ''} ${step === 'start' || step === 'setup' ? 'watch-page--flow' : ''}`} style={{ '--watch-navigation-height': `${navigationInset}px` } as React.CSSProperties}>
    {step === 'loading' ? <View className='watch-loading'><Text className='watch-loading__label'>正在整理匹配企业</Text><View className='match-deck-skeleton'><View /></View></View> : null}

    {step === 'start' ? <View className='watch-start'>
      <View className='watch-start__hero'>
        <Image src={heroImage} mode='aspectFill' />
        <Text className='watch-start__brand-mark'>HaigooRemote</Text>
      </View>
      <View className='watch-start__content'>
        <View className='watch-brand'>
          <Text className='watch-brand__title'>找到适合你的</Text>
          <Text className='watch-brand__title watch-brand__title--accent'>远程方向</Text>
          <Text className='watch-brand__copy'>根据你的经历和兴趣，梳理职业方向并推荐值得关注的远程企业。</Text>
        </View>
        <View className='watch-start__features'>{START_FEATURES.map((feature) => <View key={feature}><View><MiniIcon name='check' size={15} /></View><Text>{feature}</Text></View>)}</View>
        <View className='watch-start__actions'>
          <View className={`primary-button watch-primary ${busy ? 'primary-button--disabled' : ''}`} aria-role='button' aria-label={busy ? '正在准备匹配' : '开始设置偏好'} hoverClass={busy ? undefined : 'mini-action--pressed'} onClick={busy ? undefined : () => void startSetup()}><Text>{busy ? '正在准备…' : '开始设置偏好'}</Text><MiniIcon name='chevronRight' size={18} /></View>
          <View className='watch-secondary' aria-role='button' aria-label='上传简历，快速识别方向' hoverClass='mini-action--pressed' onClick={busy ? undefined : () => void uploadResume()}><MiniIcon name='application' size={20} />上传简历，快速识别方向</View>
          {error ? <View className='watch-start__error' aria-live='polite'><Text>{error}</Text><Text aria-role='button' aria-label='重试匹配设置' onClick={busy ? undefined : () => void startSetup()}>重试</Text></View> : null}
        </View>
      </View>
    </View> : null}

    {step === 'setup' && filterOptions ? <View className='watch-setup'>
      <View className='watch-setup__progress'><View aria-role='button' aria-label='返回启动页' hoverClass='mini-action--pressed' onClick={() => setStep('start')}><MiniIcon name='chevronLeft' size={20} /></View><View className='watch-setup__progress-bars'><View className='is-complete' /><View className='is-active' /><View /></View><Text aria-role='button' aria-label='跳过个性化设置' onClick={() => setStep(watch ? 'feed' : 'start')}>跳过</Text></View>
      <View className='watch-heading'><Text>设置求职偏好</Text><Text>可选择 1–5 个方向，逐步缩小更适合你的企业范围。</Text></View>
      <View className='watch-field watch-role-field'>
        <View className='watch-field__head'><Text className='watch-field__label'>职业方向</Text><Text>{selectedDirectionCount}/5</Text></View>
        <ScrollView className='watch-role-tabs' scrollX enhanced showScrollbar={false}><View className='watch-role-tabs__inner'>{roleGroups.map((group, index) => <Text aria-role='tab' aria-selected={activeRoleGroup === index} className={activeRoleGroup === index ? 'is-active' : ''} key={group.key} onClick={() => setActiveRoleGroup(index)}>{group.label}</Text>)}</View></ScrollView>
        <View className='watch-choice-grid'>{(roleGroups[activeRoleGroup]?.options || []).map((item) => <View aria-role='checkbox' aria-checked={draft.customRoleTerms.includes(item.value)} className={draft.customRoleTerms.includes(item.value) ? 'is-active' : ''} hoverClass='mini-action--pressed' key={item.value} onClick={() => toggleRole(item)}><Text>{item.label}</Text>{draft.customRoleTerms.includes(item.value) ? <MiniIcon name='check' size={17} /> : null}</View>)}</View>
        {unrepresentedRoleFamilies.length ? <View className='watch-resume-directions'>{unrepresentedRoleFamilies.map((role) => <Text key={role} onClick={() => removeBroadRole(role)}>{filterOptions.roles.find((item) => item.value === role)?.label || role} ×</Text>)}</View> : null}
        {roleSummary ? <Text className='watch-field__selection'>已选：{roleSummary}</Text> : null}
      </View>
      {filterOptions.industries.length ? <View className='watch-field'><Text className='watch-field__label'>目标行业</Text><View className='watch-chip-row'><Text className={(draft.companyPreferences.industries || []).length ? '' : 'is-active'} onClick={() => clearPreference('industry', 'industries')}>不限</Text>{filterOptions.industries.map((item) => <Text className={(draft.companyPreferences.industries || []).includes(item.value) ? 'is-active' : ''} key={item.value} onClick={() => toggleIndustry(item.value)}>{item.label}</Text>)}</View></View> : null}
      {filterOptions.teamSizes.length ? <View className='watch-field'><Text className='watch-field__label'>企业规模</Text><View className='watch-chip-row'><Text className={draft.companyPreferences.teamSize ? '' : 'is-active'} onClick={() => clearPreference('teamSize', 'teamSize')}>不限</Text>{filterOptions.teamSizes.map((item) => <Text className={draft.companyPreferences.teamSize === item.value ? 'is-active' : ''} key={item.value} onClick={() => setPreference('teamSize', 'teamSize', item.value)}>{item.label}</Text>)}</View></View> : null}
      {filterOptions.ratings.length ? <View className='watch-field'><Text className='watch-field__label'>Glassdoor 最低评分</Text><View className='watch-chip-row'><Text className={draft.companyPreferences.minRating ? '' : 'is-active'} onClick={() => clearPreference('rating', 'minRating')}>不限</Text>{filterOptions.ratings.map((item) => <Text className={draft.companyPreferences.minRating === item.value ? 'is-active' : ''} key={item.value} onClick={() => setPreference('rating', 'minRating', item.value)}>{item.label}</Text>)}</View></View> : null}
      {filterOptions.companyAges.length ? <View className='watch-field'><Text className='watch-field__label'>成立年限</Text><View className='watch-chip-row'><Text className={draft.companyPreferences.minFoundedYears ? '' : 'is-active'} onClick={() => clearPreference('companyAge', 'minFoundedYears')}>不限</Text>{filterOptions.companyAges.map((item) => <Text className={draft.companyPreferences.minFoundedYears === item.value ? 'is-active' : ''} key={item.value} onClick={() => setPreference('companyAge', 'minFoundedYears', item.value)}>{item.label}</Text>)}</View></View> : null}
      {error ? <Text className='watch-error'>{error}</Text> : null}
      <View className='watch-submit-bar'><View><Text>已选择 {selectedDirectionCount}/5</Text><Text>{draft.activePreferenceKeys.length ? `已设置 ${draft.activePreferenceKeys.length} 项企业条件` : '企业条件不限'}</Text></View><View className={`primary-button ${busy || selectedDirectionCount === 0 ? 'primary-button--disabled' : ''}`} aria-disabled={busy || selectedDirectionCount === 0} onClick={busy || selectedDirectionCount === 0 ? undefined : () => void save()}>{busy ? '正在生成…' : watch?.entitlements.isMember ? '保存并更新方向' : '查看方向与企业'}</View></View>
    </View> : null}

    {step === 'error' ? <View className='watch-fatal-error'><MiniIcon name='target' size={30} /><Text>匹配结果暂时无法加载</Text><Text>{error || '请检查网络后重新加载。'}</Text><View className='primary-button' onClick={() => { setStep('loading'); void load() }}>重新加载</View></View> : null}

    {step === 'feed' && watch ? <View className='watch-feed'>
      <View className='watch-feed__heading'>
        <View className='watch-feed__heading-copy'><Text className='watch-feed__eyebrow'>HaigooRemote</Text><Text className='watch-feed__title'>为你匹配</Text></View>
        <View className='watch-feed__heading-actions'>
          {!watch.entitlements.isMember ? <View className='watch-feed__membership' aria-role='button' onClick={() => navigateTo({ url: '/pages/membership/index' })}>升级会员</View> : null}
          <View className='watch-feed__settings' aria-role='button' aria-label='修改个性化设置' onClick={openMatchSettings}><MiniIcon name='settings' size={18} /></View>
        </View>
        <View className='watch-feed__summary'>
          <Text className='watch-feed__summary-copy'>{feedSummary}</Text>
          <Text className='watch-feed__summary-action' aria-role='button' aria-label='编辑个性化设置' onClick={openMatchSettings}>编辑</Text>
        </View>
      </View>
      {watch.recommendations.length ? <>
        <MatchCompanyDeck items={watch.recommendations} snapshotId={watch.snapshotId} activeIndex={activeCompanyIndex} onActiveIndexChange={changeActiveCompany} renderCard={(company, active) => <MatchCompanyCard
          company={company}
          active={active}
          onFollowChanged={(companyId, followed) => updateCompanyState(companyId, followed
            ? { isFollowed: true }
            : { isFollowed: false, isSubscribed: false })}
          onOpenCompany={openCompany}
          onOpenJob={openJob}
          onScoreOpened={openScore}
        />} />
        <View className='watch-deck-meta'><View className='watch-deck-dots'>{watch.recommendations.map((item, index) => <View className={index === activeCompanyIndex ? 'is-active' : ''} key={item.companyId} />)}</View><Text>{activeCompanyIndex + 1} / {watch.recommendations.length} · 左右滑动，反复比较</Text></View>
      </> : <View className='watch-empty'><MiniIcon name='target' size={30} /><Text>{watch.emptyReason === 'strict_filters' ? '当前条件下暂无合适企业' : '当前方向暂无合适企业'}</Text><Text>{watch.emptyReason === 'strict_filters' ? '可以放宽一项企业条件后再试。' : '调整职业方向后，我们会重新整理。'}</Text>{watch.matchState === 'member_dynamic' ? <View className='primary-button' onClick={() => setStep('setup')}>{watch.emptyReason === 'strict_filters' ? '放宽企业条件' : '调整求职方向'}</View> : <View className='primary-button' onClick={() => void load()}>重新加载</View>}</View>}
      {error ? <View className='watch-cache-warning'><Text>{error}</Text><Text onClick={() => void load()}>重试</Text></View> : null}
    </View> : null}
    </View>
  </View>
}
