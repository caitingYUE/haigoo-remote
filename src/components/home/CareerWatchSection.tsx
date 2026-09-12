import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Bell, Briefcase, Check, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { trackingService } from '../../services/tracking-service'
import {
  getCareerWatch,
  importCareerWatch,
  markCareerWatchUpdatesRead,
  saveCareerWatch,
  sendCareerWatchFeedback,
  setCareerWatchFollow
} from '../../services/career-watch-service'
import type { CareerWatchFilterOptions, CareerWatchProfile, CareerWatchResponse, WatchPreferenceKey, WatchRoleFamily } from '../../services/career-watch-service'

type Draft = Omit<CareerWatchProfile, 'profileId' | 'updatedAt' | 'sourcePlatform'>
type Mode = 'feed' | 'source' | 'roles' | 'preferences'

const PREFERENCES: Array<{ value: WatchPreferenceKey; zh: string; en: string }> = [
  { value: 'teamSize', zh: '团队规模', en: 'Team size' }, { value: 'rating', zh: '公开评分', en: 'Public rating' },
  { value: 'companyAge', zh: '成立时间', en: 'Company age' }, { value: 'industry', zh: '行业类型', en: 'Industry' }
]

function hasFilterOptions(options: CareerWatchFilterOptions | undefined, key: WatchPreferenceKey) {
  if (!options) return false
  if (key === 'teamSize') return options.teamSizes.length > 0
  if (key === 'rating') return options.ratings.length > 0
  if (key === 'companyAge') return options.companyAges.length > 0
  return options.industries.length > 0
}

function blankDraft(): Draft {
  return { sourceMode: 'manual', roleFamilies: [], customRoleTerms: [], companyPreferences: {}, activePreferenceKeys: [], toleranceMode: 'balanced', status: 'active', resumeId: null, careerProfileId: null, version: 0 }
}

function profileDraft(profile: CareerWatchProfile): Draft {
  const { profileId: _profileId, updatedAt: _updatedAt, sourcePlatform: _sourcePlatform, ...draft } = profile
  return draft
}

export default function CareerWatchSection({ onOpenJob }: { onOpenJob: (job: any) => void }) {
  const navigate = useNavigate()
  const { token, isAuthenticated, isLoading: authLoading } = useAuth()
  const { isEnglish, text } = useLanguage()
  const [state, setState] = useState<CareerWatchResponse | null>(null)
  const [draft, setDraft] = useState<Draft>(blankDraft())
  const [mode, setMode] = useState<Mode>('feed')
  const [showMore, setShowMore] = useState(false)
  const [expandedPreference, setExpandedPreference] = useState<WatchPreferenceKey | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const startedAt = performance.now()
    setLoading(true); setError('')
    try {
      const result = await getCareerWatch(isAuthenticated ? token : null)
      setState(result)
      trackingService.track('career_watch_feed_loaded', {
        module: 'career_watch',
        outcome: 'succeeded',
        duration_ms: Math.round(performance.now() - startedAt),
        result_count: result.recommendations.length,
        zero_results: result.recommendations.length === 0,
        feed_source: result.source || (result.authenticated ? 'personalized' : 'public')
      })
      if (result.profile) { setDraft(profileDraft(result.profile)); setMode('feed') }
      else setMode(isAuthenticated ? 'source' : 'feed')
    } catch (loadError) {
      trackingService.trackClientError('CAREER_WATCH_LOAD_FAILED', loadError, { module: 'career_watch', duration_ms: Math.round(performance.now() - startedAt) })
      setError(loadError instanceof Error ? loadError.message : isEnglish ? 'Updates could not be loaded. Try again.' : '更新没有加载出来，请重试。')
    } finally { setLoading(false) }
  }, [isAuthenticated, isEnglish, token])

  useEffect(() => { if (!authLoading) void load() }, [authLoading, load])

  const chooseSource = async (source: 'manual' | 'subscription' | 'resume' | 'match_profile') => {
    if (!token) { navigate('/login?redirect=%2F'); return }
    setError('')
    if (source === 'manual') { setDraft(blankDraft()); setMode('roles'); return }
    setSaving(true)
    try {
      const result = await importCareerWatch(token, source)
      trackingService.track('career_watch_imported', { module: 'career_watch', source_key: source, outcome: 'succeeded' })
      setDraft({ ...blankDraft(), ...result.draft, version: state?.profile?.version || 0 })
      setMode('roles')
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : text('没有找到可同步的资料。', 'No data was available to sync.'))
    } finally { setSaving(false) }
  }

  const toggleRole = (role: WatchRoleFamily) => {
    setError('')
    setDraft((current) => {
      const selected = current.roleFamilies.includes(role)
      if (!selected && current.roleFamilies.length >= 5) { setError(text('最多选择 5 个岗位方向。', 'Choose up to 5 role directions.')); return current }
      return { ...current, roleFamilies: selected ? current.roleFamilies.filter((item) => item !== role) : [...current.roleFamilies, role] }
    })
  }

  const togglePreference = (key: WatchPreferenceKey) => {
    setError('')
    const selected = draft.activePreferenceKeys.includes(key)
    if (!selected) {
      setExpandedPreference((value) => value === key ? null : key)
      return
    }
    setDraft((current) => {
      const companyPreferences = { ...current.companyPreferences }
      if (key === 'teamSize') delete companyPreferences.teamSize
      if (key === 'rating') delete companyPreferences.minRating
      if (key === 'companyAge') delete companyPreferences.minFoundedYears
      if (key === 'industry') delete companyPreferences.industries
      return {
        ...current,
        activePreferenceKeys: current.activePreferenceKeys.filter((item) => item !== key),
        companyPreferences
      }
    })
    setExpandedPreference(null)
  }

  const selectPreference = (preferenceKey: WatchPreferenceKey, field: keyof Draft['companyPreferences'], value: unknown) => setDraft((current) => ({
    ...current,
    activePreferenceKeys: current.activePreferenceKeys.includes(preferenceKey) ? current.activePreferenceKeys : [...current.activePreferenceKeys, preferenceKey],
    companyPreferences: { ...current.companyPreferences, [field]: value }
  }))
  const toggleIndustry = (industry: string) => {
    const selected = draft.companyPreferences.industries || []
    if (!selected.includes(industry) && selected.length >= 3) { setError(text('行业最多选择 3 个。', 'Choose up to 3 industries.')); return }
    const next = selected.includes(industry) ? selected.filter((item) => item !== industry) : [...selected, industry]
    setDraft((current) => ({
      ...current,
      activePreferenceKeys: next.length
        ? current.activePreferenceKeys.includes('industry') ? current.activePreferenceKeys : [...current.activePreferenceKeys, 'industry']
        : current.activePreferenceKeys.filter((item) => item !== 'industry'),
      companyPreferences: { ...current.companyPreferences, industries: next }
    }))
  }

  const submit = async () => {
    if (!token || !draft.roleFamilies.length) { setError(text('请至少选择一个岗位方向。', 'Choose at least one role direction.')); return }
    setSaving(true); setError('')
    try {
      const result = await saveCareerWatch(token, draft)
      setState(result); setDraft(profileDraft(result.profile!)); setMode('feed')
      trackingService.track('career_watch_profile_saved', { module: 'career_watch', outcome: 'succeeded', role_count: draft.roleFamilies.length, preference_count: draft.activePreferenceKeys.length, tolerance_mode: draft.toleranceMode, zero_results: result.recommendations.length === 0 })
    } catch (saveError: any) {
      const currentProfile = saveError?.currentProfile as CareerWatchProfile | undefined
      if (saveError?.code === 'WATCH_VERSION_CONFLICT' && currentProfile) {
        setState((current) => current ? { ...current, profile: currentProfile } : current)
        setDraft((current) => ({ ...current, version: currentProfile.version }))
        setError(text('另一端已更新关注条件。你的本次选择已保留，请确认后再次保存。', 'Your watch changed on another device. Your edits are preserved; review and save again.'))
      } else setError(saveError instanceof Error ? saveError.message : text('保存失败，请重试。', 'Could not save. Try again.'))
    } finally { setSaving(false) }
  }

  const toggleFollow = async (companyId: string, followed: boolean) => {
    if (!token) { navigate('/login?redirect=%2F'); return }
    try {
      await setCareerWatchFollow(token, companyId, !followed)
      setState((current) => current ? { ...current, recommendations: current.recommendations.map((item) => item.companyId === companyId ? { ...item, isFollowed: !followed } : item) } : current)
    } catch (followError) { setError(followError instanceof Error ? followError.message : text('操作没有完成。', 'Action could not be completed.')) }
  }

  const dismissCompany = async (companyId: string) => {
    if (!token) return
    try {
      await sendCareerWatchFeedback(token, companyId, 'dismissed')
      setState((current) => current ? { ...current, recommendations: current.recommendations.filter((item) => item.companyId !== companyId) } : current)
    } catch (feedbackError) {
      setError(feedbackError instanceof Error ? feedbackError.message : text('操作没有完成。', 'Action could not be completed.'))
    }
  }

  const roleSummary = useMemo(() => draft.roleFamilies.map((role) => {
    const option = state?.filterOptions?.roles.find((item) => item.value === role)
    return option?.label || role
  }).join(isEnglish ? ', ' : '、'), [draft.roleFamilies, isEnglish, state?.filterOptions?.roles])
  const realRoleOptions = state?.filterOptions?.roles || []
  const roleOptions = showMore ? realRoleOptions : realRoleOptions.slice(0, 4)
  const availablePreferences = PREFERENCES.filter((item) => hasFilterOptions(state?.filterOptions, item.value))

  const openFollowedUpdate = async (item: CareerWatchResponse['followedUpdates'][number]) => {
    if (token) {
      try {
        await markCareerWatchUpdatesRead(token, [item.inboxId])
        setState((current) => current ? { ...current, followedUpdates: current.followedUpdates.filter((update) => update.inboxId !== item.inboxId) } : current)
      } catch {
        // The company page remains available if the read state cannot sync.
      }
    }
    navigate(`/company/${encodeURIComponent(item.companyId)}`)
  }

  return <section className="haigoo-shell haigoo-home__section career-watch" aria-labelledby="career-watch-title">
    <header className="haigoo-home__section-header career-watch__header">
      <div><h2 id="career-watch-title">{text('你的关注更新', 'Your watch updates')}</h2><p>{text('关注企业和岗位变化，及时查看与你相关的更新。', 'See company and role updates relevant to you.')}</p></div>
      {isAuthenticated && state?.profile && mode === 'feed' ? <button type="button" className="haigoo-home__section-link" onClick={() => setMode('roles')}><SlidersHorizontal size={16} />{text('调整关注方向', 'Edit watch')}</button> : null}
    </header>

    {loading && !state ? <div className="career-watch__loading" aria-live="polite"><RefreshCw aria-hidden="true" /><span>{text('正在更新关注动态', 'Updating your watch')}</span></div> : null}
    {loading && state ? <div className="career-watch__refreshing" aria-live="polite"><RefreshCw aria-hidden="true" /><span>{text('正在更新匹配企业', 'Updating matched companies')}</span></div> : null}
    {!loading && error ? <div className="career-watch__notice" role="alert"><span>{error}</span>{mode === 'feed' ? <button type="button" onClick={() => void load()}>{text('重试', 'Try again')}</button> : null}</div> : null}

    {(!loading || state) && mode === 'source' ? <div className="career-watch__setup">
      <div className="career-watch__step"><span>1/3</span><strong>{text('用什么方式开始？', 'How would you like to start?')}</strong></div>
      <div className="career-watch__source-grid">
        <button type="button" onClick={() => void chooseSource('manual')}><Briefcase /><strong>{text('自己选择', 'Choose manually')}</strong><span>{text('设置岗位方向和企业条件', 'Set role and company preferences')}</span></button>
        {state?.importSources?.resume ? <button type="button" onClick={() => void chooseSource('resume')} disabled={saving}><RefreshCw /><strong>{text('使用最近一份简历', 'Use latest resume')}</strong><span>{text('提取岗位方向后再确认', 'Review extracted role directions')}</span></button> : <button type="button" onClick={() => navigate('/profile?tab=resume')}><RefreshCw /><strong>{text('从简历快速生成', 'Start from a resume')}</strong><span>{text('先到个人中心上传简历', 'Upload a resume in your profile')}</span></button>}
      </div>
      {state?.importSources?.subscription ? <button type="button" className="career-watch__import" onClick={() => void chooseSource('subscription')} disabled={saving}>{text('同步已有会员订阅', 'Sync existing member subscription')}<ArrowRight size={16} /></button> : null}
      {state?.importSources?.matchProfile ? <button type="button" className="career-watch__import" onClick={() => void chooseSource('match_profile')} disabled={saving}>{text('同步小程序 Match 资料', 'Sync mini-program Match profile')}<ArrowRight size={16} /></button> : null}
    </div> : null}

    {(!loading || state) && mode === 'roles' ? <div className="career-watch__setup">
      <div className="career-watch__step"><span>2/3</span><strong>{text('想关注哪些岗位方向？', 'Which role directions interest you?')}</strong></div>
      <div className="career-watch__choices">{roleOptions.map((item) => <button key={item.value} type="button" aria-pressed={draft.roleFamilies.includes(item.value)} onClick={() => toggleRole(item.value)}>{draft.roleFamilies.includes(item.value) ? <Check size={16} /> : null}{item.label}</button>)}</div>
      {realRoleOptions.length > 4 ? <button type="button" className="career-watch__text-action" onClick={() => setShowMore((value) => !value)}>{showMore ? text('收起更多方向', 'Show fewer') : text('更多方向', 'More directions')}</button> : null}
      <div className="career-watch__actions"><button type="button" className="career-watch__primary" onClick={() => draft.roleFamilies.length ? setMode('preferences') : setError(text('请至少选择一个岗位方向。', 'Choose at least one role direction.'))}>{text('继续设置企业条件', 'Continue')}</button><button type="button" onClick={() => setMode(state?.profile ? 'feed' : 'source')}>{text('返回', 'Back')}</button></div>
    </div> : null}

    {(!loading || state) && mode === 'preferences' ? <div className="career-watch__setup">
      <div className="career-watch__step"><span>3/3</span><strong>{text('更看重哪些企业条件？', 'Which company criteria matter most?')}</strong></div>
      <p className="career-watch__helper">{text('企业条件均为选填。', 'Company criteria are optional.')}</p>
      <div className="career-watch__criteria">{availablePreferences.map((item) => <button key={item.value} type="button" aria-pressed={draft.activePreferenceKeys.includes(item.value)} onClick={() => togglePreference(item.value)}>{draft.activePreferenceKeys.includes(item.value) ? <Check size={16} /> : null}{isEnglish ? item.en : item.zh}</button>)}</div>
      {(expandedPreference === 'teamSize' || draft.activePreferenceKeys.includes('teamSize')) ? <div className="career-watch__subfield"><strong>{text('选择团队规模', 'Choose team size')}</strong><div>{(state?.filterOptions.teamSizes || []).map((item) => <button key={item.value} type="button" aria-pressed={draft.companyPreferences.teamSize === item.value} onClick={() => selectPreference('teamSize', 'teamSize', item.value)}>{item.label}</button>)}</div></div> : null}
      {(expandedPreference === 'rating' || draft.activePreferenceKeys.includes('rating')) ? <div className="career-watch__subfield"><strong>{text('选择最低公开评分', 'Choose minimum public rating')}</strong><div>{(state?.filterOptions.ratings || []).map((item) => <button key={item.value} type="button" aria-pressed={draft.companyPreferences.minRating === item.value} onClick={() => selectPreference('rating', 'minRating', item.value)}>{item.label}</button>)}</div></div> : null}
      {(expandedPreference === 'companyAge' || draft.activePreferenceKeys.includes('companyAge')) ? <div className="career-watch__subfield"><strong>{text('选择成立时间', 'Choose company age')}</strong><div>{(state?.filterOptions.companyAges || []).map((item) => <button key={item.value} type="button" aria-pressed={draft.companyPreferences.minFoundedYears === item.value} onClick={() => selectPreference('companyAge', 'minFoundedYears', item.value)}>{item.label}</button>)}</div></div> : null}
      {(expandedPreference === 'industry' || draft.activePreferenceKeys.includes('industry')) ? <div className="career-watch__subfield"><strong>{text('选择行业类型（最多 3 个）', 'Choose up to 3 industries')}</strong><div>{(state?.filterOptions.industries || []).map((item) => <button key={item.value} type="button" aria-pressed={(draft.companyPreferences.industries || []).includes(item.value)} onClick={() => toggleIndustry(item.value)}>{item.label}</button>)}</div></div> : null}
      <div className="career-watch__tolerance"><strong>{text('匹配方式', 'Matching mode')}</strong><button type="button" aria-pressed={draft.toleranceMode === 'balanced'} onClick={() => setDraft((current) => ({ ...current, toleranceMode: 'balanced' }))}><span>{text('优先满足，可接受接近', 'Prioritise matches, allow close fits')}</span><small>{text('条件用于排序，结果更丰富', 'Criteria rank results')}</small></button><button type="button" aria-pressed={draft.toleranceMode === 'strict'} onClick={() => setDraft((current) => ({ ...current, toleranceMode: 'strict' }))}><span>{text('只看全部符合', 'Only exact matches')}</span><small>{text('缺少条件数据的企业也会排除', 'Missing data is excluded')}</small></button></div>
      <div className="career-watch__actions"><button type="button" className="career-watch__primary" onClick={() => void submit()} disabled={saving}>{saving ? text('正在更新匹配企业', 'Updating matches') : text('开始关注', 'Start watching')}</button><button type="button" onClick={() => setMode('roles')}>{text('返回岗位方向', 'Back to roles')}</button></div>
    </div> : null}

    {(!loading || state) && mode === 'feed' ? <div className="career-watch__feed">
      {!isAuthenticated ? <div className="career-watch__guest"><div><Bell aria-hidden="true" /><h3>{text('看看企业最近有什么变化', 'See what companies have updated')}</h3><p>{text('登录后选择岗位方向，这里会显示与你相关的企业和岗位更新。', 'Choose role directions after logging in to see relevant company and role updates.')}</p></div><button type="button" className="career-watch__primary" onClick={() => navigate('/login?redirect=%2F')}>{text('登录并设置关注', 'Log in and set your watch')}</button></div> : state?.profile ? <div className="career-watch__summary"><span>{text('正在关注', 'Watching')}</span><strong>{roleSummary}</strong><small>{draft.activePreferenceKeys.length} {text('类企业条件', 'company criteria')} · {draft.toleranceMode === 'balanced' ? text('可接受接近条件', 'close fits allowed') : text('只看全部符合', 'exact matches only')}</small></div> : null}
      {state?.stale ? <div className="career-watch__notice" role="status"><span>{text('网络暂时不可用，当前展示上次结果。', 'You are seeing the last available results while the network is unavailable.')}</span><button type="button" onClick={() => void load()}>{text('重试', 'Try again')}</button></div> : null}
      {state?.followedUpdates?.length ? <div className="career-watch__updates"><h3>{text('有新变化', 'New changes')}</h3>{state.followedUpdates.slice(0, 3).map((item) => <button key={item.inboxId} type="button" onClick={() => void openFollowedUpdate(item)}><span><strong>{item.companyName}</strong><small>{item.hasPublicOpportunity ? text('有新的公开岗位', 'New public role') : text('企业资料有更新', 'Company profile updated')}</small></span><ArrowRight size={16} /></button>)}</div> : null}
      <div className="career-watch__jobs">{state?.recommendations?.map((item) => <article className={isAuthenticated ? 'has-actions' : undefined} key={`${item.companyId}-${item.jobId}`}><button type="button" className="career-watch__job-main" onClick={() => { if (token) void sendCareerWatchFeedback(token, item.companyId, 'opened'); onOpenJob({ id: item.jobId, jobId: item.jobId, title: item.jobTitle, company: item.companyName, companyId: item.companyId, url: item.applyUrl }) }}><span><small>{item.companyName} · {item.industry}</small><strong>{item.jobTitle}</strong><span>{item.reasons.join(' · ')}</span></span><ArrowRight size={17} /></button>{isAuthenticated ? <div className="career-watch__job-actions"><button type="button" className="career-watch__follow" onClick={() => void toggleFollow(item.companyId, item.isFollowed)}>{item.isFollowed ? text('取消关注', 'Unfollow') : text('关注企业', 'Follow company')}</button><button type="button" className="career-watch__dismiss" onClick={() => void dismissCompany(item.companyId)}>{text('不感兴趣', 'Not interested')}</button></div> : null}</article>)}</div>
      {isAuthenticated && state?.profile && !state.recommendations.length ? <div className="career-watch__empty"><strong>{state.emptyReason === 'strict_filters' ? text('当前条件下结果较少', 'Few results match these criteria') : text('目前没有符合方向的公开岗位', 'No public roles match your directions right now')}</strong><p>{state.emptyReason === 'strict_filters' ? text('可以尝试允许接近条件。', 'Try allowing close matches.') : text('调整岗位方向或企业条件，可以看到更多结果。', 'Edit role directions or company criteria to broaden results.')}</p><button type="button" onClick={() => setMode('preferences')}>{text('调整关注条件', 'Edit criteria')}</button></div> : null}
    </div> : null}
  </section>
}
