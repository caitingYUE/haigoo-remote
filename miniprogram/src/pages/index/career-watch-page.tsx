import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { navigateTo, showModal, showToast, useDidShow } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import {
  fetchCareerWatch,
  fetchCareerWatchOptions,
  followCompany,
  markCareerWatchUpdatesRead,
  parseCareerResumeFile,
  saveCareerWatch,
  setCareerWatchNotifications,
  setMatchNotifications,
  unfollowCompany
} from '../../services/career-match-service'
import type { CareerWatchResponse, WatchFeedItem, WatchFilterOptions, WatchPreferenceKey, WatchProfile, WatchRoleFamily } from '../../services/career-match-service'
import { trackMiniEvent } from '../../services/analytics-service'
import { loginWithWechat } from '../../services/mini-auth-service'
import { getMiniUser, hasAuthenticatedSession } from '../../services/session'
import useMiniNavigationInset from '../../hooks/use-mini-navigation-inset'
import useMiniShare from '../../hooks/use-mini-share'

type WatchStep = 'loading' | 'start' | 'setup' | 'feed'
type WatchDraft = Omit<WatchProfile, 'profileId' | 'updatedAt' | 'sourcePlatform' | 'version' | 'inAppEnabled' | 'wechatEnabled' | 'wechatTemplateStatus'> & { version?: number }
type RoleOption = { value: string; label: string; families: WatchRoleFamily[] }

const START_FEATURES = [
  '梳理更适合你的职业方向',
  '关注企业，查看最新动态',
  '会员可查看已收录联系人'
]

function emptyDraft(): WatchDraft {
  return {
    sourceMode: 'manual', roleFamilies: [], customRoleTerms: [], companyPreferences: {},
    activePreferenceKeys: [], toleranceMode: 'balanced', status: 'active',
    resumeId: null, careerProfileId: null
  }
}

function updateTimeLabel(value?: string | number | null) {
  const time = new Date(value || '').getTime()
  if (!Number.isFinite(time)) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(time)
}

function nextUpdateTime(value: string, hours: number) {
  const base = new Date(value || '').getTime()
  if (!Number.isFinite(base)) return ''
  const interval = Math.max(1, hours) * 60 * 60 * 1000
  const elapsed = Math.max(0, Date.now() - base)
  return updateTimeLabel(base + (Math.floor(elapsed / interval) + 1) * interval)
}

export default function CareerWatchPage() {
  const authenticated = hasAuthenticatedSession()
  const [step, setStep] = useState<WatchStep>(authenticated ? 'loading' : 'start')
  const [watch, setWatch] = useState<CareerWatchResponse | null>(null)
  const [standaloneOptions, setStandaloneOptions] = useState<WatchFilterOptions | null>(null)
  const [draft, setDraft] = useState<WatchDraft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [activeRoleGroup, setActiveRoleGroup] = useState(0)
  const [showAllUpdates, setShowAllUpdates] = useState(false)
  const navigationInset = useMiniNavigationInset()
  useMiniShare('HaigooRemote｜找到更适合你的远程方向', '/pages/index/index')

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

  const load = useCallback(async () => {
    if (!hasAuthenticatedSession()) { setStep('start'); return }
    setError('')
    try {
      const result = await fetchCareerWatch()
      applyResponse(result)
      void trackMiniEvent('mini_watch_feed_loaded', { result_count: result.recommendations.length, match_state: result.matchState })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '方向结果暂时无法加载')
      setStep('start')
    }
  }, [applyResponse])

  useDidShow(() => {
    Taro.eventCenter.trigger('haigoo:tab-change', '/pages/index/index')
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
    setBusy(true); setError('')
    try {
      const result = watch || await fetchCareerWatch()
      if (!watch) applyResponse(result)
      const selected = await Taro.chooseMessageFile({ count: 1, type: 'file', extension: ['pdf', 'docx', 'txt'] })
      const file = selected.tempFiles[0]
      if (!file) return
      if (Number(file.size || 0) > 2 * 1024 * 1024) throw new Error('简历不能超过 2MB，请压缩后重试')
      const parsed = await parseCareerResumeFile(file.name || 'resume.pdf', file.path)
      const available = new Set(result.filterOptions.roles.map((item) => item.value))
      const roles = Array.isArray(parsed.structured?.roleFamilies)
        ? parsed.structured.roleFamilies.filter((role): role is WatchRoleFamily => available.has(String(role) as WatchRoleFamily)).slice(0, 5)
        : []
      setDraft({ ...emptyDraft(), sourceMode: 'resume', roleFamilies: roles })
      setStep('setup')
      showToast({ title: roles.length ? '已识别方向，请确认' : '请手动选择方向', icon: 'none' })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '简历读取失败，请重试')
    } finally { setBusy(false) }
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
      if (saveError?.payload?.code === 'FREE_MATCH_USED') {
        await load()
        setError('方向结果已生成，可继续查看和关注企业。')
      } else setError(saveError instanceof Error ? saveError.message : '方向结果没有生成，请重试')
    } finally { setBusy(false) }
  }

  const toggleFollow = async (company: WatchFeedItem) => {
    try {
      if (company.isFollowed) await unfollowCompany(company.companyId)
      else await followCompany(company.companyId)
      setWatch((current) => current ? { ...current, recommendations: current.recommendations.map((item) => item.companyId === company.companyId ? { ...item, isFollowed: !item.isFollowed } : item) } : current)
      showToast({ title: company.isFollowed ? '已取消关注' : '已关注企业', icon: 'success' })
    } catch (followError) { showToast({ title: followError instanceof Error ? followError.message : '操作没有完成', icon: 'none' }) }
  }

  const requestWechatNotice = async (templateId: string): Promise<'accepted' | 'rejected' | 'unavailable' | null> => {
    try {
      const requestSubscribeMessage = Taro.requestSubscribeMessage as unknown as (options: { tmplIds: string[] }) => Promise<Record<string, string>>
      const result = await requestSubscribeMessage({ tmplIds: [templateId] })
      const status = String(result[templateId] || '')
      if (status === 'accept') return 'accepted'
      if (status === 'ban') {
        await showModal({ title: '订阅消息未开启', content: '请在小程序设置中开启订阅消息后重试。', showCancel: false, confirmText: '知道了' })
        return 'unavailable'
      }
      showToast({ title: '未开启微信提醒，可稍后再试', icon: 'none' })
      return 'rejected'
    } catch (requestError: any) {
      const message = String(requestError?.errMsg || requestError?.message || '')
      console.warn('[CareerWatch] requestSubscribeMessage failed', { errCode: requestError?.errCode || '', message })
      void trackMiniEvent('mini_wechat_subscribe_failed', { reason: /template|20004|invalid/i.test(message) ? 'configuration' : 'request_failed' })
      showToast({ title: /template|20004|invalid/i.test(message) ? '微信提醒配置暂不可用' : '微信提醒未开启，请稍后重试', icon: 'none' })
      return null
    }
  }

  const enableDirectionNotice = async () => {
    if (!watch?.entitlements.isMember) return navigateTo({ url: '/pages/membership/index' })
    const templateId = watch.entitlements.wechatTemplateId
    if (!watch.entitlements.wechatSubscriptionAvailable || !templateId) return showToast({ title: '微信提醒暂不可用，站内通知已开启', icon: 'none' })
    try {
      const status = await requestWechatNotice(templateId)
      if (!status) return
      const accepted = status === 'accepted'
      await setCareerWatchNotifications(accepted, status)
      setWatch((current) => current?.profile ? { ...current, profile: { ...current.profile, wechatEnabled: accepted, wechatTemplateStatus: status } } : current)
      if (accepted) showToast({ title: '已开启一次微信提醒', icon: 'success' })
    } catch (saveError) { showToast({ title: saveError instanceof Error ? saveError.message : '提醒设置没有保存，请重试', icon: 'none' }) }
  }

  const enableCompanyNotice = async (company: WatchFeedItem) => {
    const templateId = watch?.entitlements.wechatTemplateId || ''
    if (!company.isFollowed) return showToast({ title: '请先关注企业', icon: 'none' })
    if (!watch?.entitlements.wechatSubscriptionAvailable || !templateId) return showToast({ title: '微信提醒暂不可用，站内通知已开启', icon: 'none' })
    try {
      const status = await requestWechatNotice(templateId)
      if (!status) return
      const accepted = status === 'accepted'
      await setMatchNotifications(company.companyId, accepted, status)
      if (accepted) showToast({ title: '已开启一次微信提醒', icon: 'success' })
    } catch (saveError) { showToast({ title: saveError instanceof Error ? saveError.message : '提醒设置没有保存，请重试', icon: 'none' }) }
  }

  const openUpdate = async (update: CareerWatchResponse['followedUpdates'][number]) => {
    try { await markCareerWatchUpdatesRead([update.inboxId]) } catch { /* detail remains available */ }
    setWatch((current) => {
      if (!current) return current
      const next = { ...current, followedUpdates: current.followedUpdates.filter((item) => item.inboxId !== update.inboxId) }
      const activeUser = getMiniUser()
      if (activeUser?.userId) Taro.setStorageSync(`haigoo-career-watch:${activeUser.userId}`, next)
      Taro.eventCenter.trigger('haigoo:unread-change', next.followedUpdates.length)
      return next
    })
    navigateTo({ url: `/pages/company-detail/index?id=${encodeURIComponent(update.companyId)}` })
  }

  const roleSummary = useMemo(() => {
    return [...draft.customRoleTerms, ...unrepresentedRoleFamilies.map((role) => filterOptions?.roles.find((item) => item.value === role)?.label || role)].join('、')
  }, [draft.customRoleTerms, filterOptions?.roles, unrepresentedRoleFamilies])
  const selectedDirectionCount = draft.customRoleTerms.length + unrepresentedRoleFamilies.length
  const updateHours = watch?.entitlements.refreshHours || 24
  const lastUpdateLabel = updateTimeLabel(watch?.generatedAt)
  const nextUpdateLabel = watch ? nextUpdateTime(watch.generatedAt, updateHours) : ''

  return <View className='page-shell watch-page' style={{ paddingTop: `${navigationInset}px` }}>
    {step === 'loading' ? <View className='watch-loading'><View><MiniIcon name='target' size={30} /></View><Text className='watch-loading__label'>正在加载方向结果</Text></View> : null}

    {step === 'start' ? <View className='watch-start'>
      <View className='watch-start__hero'>
        <Image src='/assets/home-hero-bg.jpg' mode='aspectFill' />
        <Text className='watch-start__brand'>HaigooRemote</Text>
        <View className='watch-start__promise'><Text>用你喜欢的方式</Text><Text>工作和生活</Text></View>
      </View>
      <View className='watch-brand'>
        <Text className='watch-brand__title'>找到更适合你的</Text>
        <Text className='watch-brand__title watch-brand__title--accent'>远程方向</Text>
        <Text className='watch-brand__copy'>从职业方向开始，探索值得关注的远程企业。</Text>
      </View>
      <View className='watch-start__features'>{START_FEATURES.map((feature) => <View key={feature}><View><MiniIcon name='check' size={15} /></View><Text>{feature}</Text></View>)}</View>
      <View className={`primary-button watch-primary ${busy ? 'primary-button--disabled' : ''}`} onClick={busy ? undefined : () => void startSetup()}>{busy ? '正在准备…' : '手动设置方向'}</View>
      <View className='watch-secondary' aria-role='button' onClick={busy ? undefined : () => void uploadResume()}><MiniIcon name='application' size={20} />上传简历识别方向</View>
      {error ? <View className='watch-start__error'><Text>{error}</Text><Text onClick={busy ? undefined : () => void startSetup()}>重试</Text></View> : null}
    </View> : null}

    {step === 'setup' && filterOptions ? <View className='watch-setup'>
      <View className='watch-heading'><Text>选择职业方向</Text><Text>可选择 1–5 个方向。</Text></View>
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
      <View className='watch-submit-bar'><View><Text>{roleSummary || '请选择方向'}</Text><Text>{draft.activePreferenceKeys.length ? `已设置 ${draft.activePreferenceKeys.length} 项企业条件` : '企业条件不限'}</Text></View><View className={`primary-button ${busy ? 'primary-button--disabled' : ''}`} onClick={busy ? undefined : () => void save()}>{busy ? '正在生成…' : watch?.entitlements.isMember ? '保存并更新方向' : '查看方向与企业'}</View></View>
    </View> : null}

    {step === 'feed' && watch ? <View className='watch-feed'>
      <Text className='watch-feed__brand'>HaigooRemote</Text>
      <View className='watch-feed__heading'><View><Text>方向与企业</Text><Text>{watch.matchState === 'fixed_free' ? '关注企业后查看最新动态' : roleSummary || '按已保存方向更新'}</Text></View>{watch.matchState === 'member_dynamic' ? <Text onClick={() => setStep('setup')}>编辑方向</Text> : null}</View>
      <View className='watch-notice-bar' onClick={watch.entitlements.isMember ? () => void enableDirectionNotice() : undefined}><View><MiniIcon name='subscription' size={21} /><View><Text>企业更新提醒</Text><Text>{watch.entitlements.isMember ? watch.entitlements.wechatSubscriptionAvailable ? '站内提醒已开启，可授权一次微信提醒' : '站内提醒已开启' : '关注企业后查看最新动态'}</Text></View></View>{watch.entitlements.isMember && watch.entitlements.wechatSubscriptionAvailable ? <MiniIcon name='chevronRight' size={18} /> : null}</View>
      <View className='watch-refresh'><View><Text>更新记录</Text><Text>{watch.followedUpdates.length ? `${watch.followedUpdates.length} 条未读动态` : '暂无新动态'}</Text></View><View><Text>{lastUpdateLabel ? `最近检查 ${lastUpdateLabel}` : '每日检查企业动态'}</Text><Text>{nextUpdateLabel ? `下次检查 ${nextUpdateLabel}` : `每 ${updateHours} 小时检查`}</Text></View></View>
      {!watch.entitlements.isMember ? <View className='watch-plan'><View><Text>免费方案</Text><Text>当前保留 {watch.fixedCompanyCount || watch.recommendations.length} 家方向企业</Text></View><Text aria-role='button' onClick={() => navigateTo({ url: '/pages/membership/index' })}>开通会员</Text><Text>会员可浏览全部在招企业、更新方向并查看已收录联系人。</Text></View> : null}
      {watch.followedUpdates.length ? <View className='watch-updates'><View className='watch-section-title'><Text>最新动态</Text><Text>{watch.followedUpdates.length} 条</Text></View>{watch.followedUpdates.slice(0, showAllUpdates ? watch.followedUpdates.length : 4).map((update) => <View className='watch-update' key={update.inboxId} onClick={() => void openUpdate(update)}><View><Text>{update.companyName}</Text><Text>{update.hasPublicOpportunity ? '有新的公开岗位' : '企业资料有更新'}</Text></View><MiniIcon name='chevronRight' size={18} /></View>)}{watch.followedUpdates.length > 4 ? <Text className='watch-updates__toggle' onClick={() => setShowAllUpdates((value) => !value)}>{showAllUpdates ? '收起' : '查看全部'}</Text> : null}</View> : null}
      <View className='watch-results'>
        {watch.recommendations.map((company) => <View className='watch-company' key={company.companyId}>
          <View className='watch-company__head' onClick={() => navigateTo({ url: `/pages/company-detail/index?id=${encodeURIComponent(company.companyId)}` })}><View><Text>{company.companyName}</Text><Text>{company.industry || '行业信息暂缺'}</Text></View>{company.score > 0 ? <View className='watch-company__score'><Text>{company.score}</Text><Text>方向契合度</Text></View> : <MiniIcon name='chevronRight' size={20} />}</View>
          <View className='watch-company__reasons'>{company.reasons.filter(Boolean).slice(0, 3).map((reason) => <Text key={reason}>{reason}</Text>)}</View>
          <View className='watch-company__actions'><Text aria-role='button' onClick={() => void toggleFollow(company)}>{company.isFollowed ? '取消关注' : '关注企业'}</Text><Text aria-role='button' onClick={() => navigateTo({ url: `/pages/company-detail/index?id=${encodeURIComponent(company.companyId)}` })}>查看企业</Text></View>
          {!watch.entitlements.isMember && company.isFollowed ? <Text aria-role='button' className='watch-company__notice-action' onClick={() => void enableCompanyNotice(company)}><MiniIcon name='subscription' size={17} />开启微信提醒</Text> : null}
        </View>)}
        {!watch.recommendations.length ? <View className='empty-state'><Text className='empty-state__title'>暂无符合当前方向的企业</Text>{watch.matchState === 'member_dynamic' ? <View className='empty-state__action' onClick={() => setStep('setup')}>调整方向</View> : null}</View> : null}
      </View>
      {error ? <Text className='watch-error'>{error}</Text> : null}
    </View> : null}
  </View>
}
