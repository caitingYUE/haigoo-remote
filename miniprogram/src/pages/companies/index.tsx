import { Text, View } from '@tarojs/components'
import Taro, { navigateTo, stopPullDownRefresh, switchTab, useDidHide, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CompanyFollowAction from '../../components/company-follow-action'
import CompanyLogo from '../../components/company-logo'
import ContentSkeleton from '../../components/content-skeleton'
import EditorialTopBar from '../../components/editorial-top-bar'
import EditorialRow from '../../components/editorial-row'
import EditorialSearch from '../../components/editorial-search'
import EditorialState from '../../components/editorial-state'
import MiniIcon from '../../components/mini-icon'
import TopicScroller from '../../components/topic-scroller'
import { fetchCompanies } from '../../services/content-service'
import type { CompaniesResponse, CompanyDirectorySort } from '../../services/content-service'
import { fetchCareerWatch, fetchCompanyFollows } from '../../services/career-match-service'
import { refreshWechatSessionIfStale } from '../../services/mini-auth-service'
import type { CareerWatchResponse } from '../../services/career-match-service'
import { onCompanyFollowChange } from '../../services/company-follow-state'
import { getMiniUser, hasAuthenticatedSession } from '../../services/session'
import useMiniShare from '../../hooks/use-mini-share'
import { buildCompanyRoleSummary } from '../../utils/company-role-summary'
import useRetainedResource, { miniContentScope } from '../../hooks/use-retained-resource'
import { companyUpdateDeadline } from '../../utils/company-update-badge'
import './index.scss'

const sortOptions: Array<{ value: CompanyDirectorySort; label: string }> = [
  { value: 'latest', label: '按最新' },
  { value: 'relevance', label: '按相关度' }
]
const COMPANY_CHECK_INTERVAL_MS = 2 * 60 * 1000
const companyResourceKey = (search: string, industry: string, sortBy: CompanyDirectorySort) => `companies:${JSON.stringify([search.trim(), industry, sortBy])}`

export default function CompaniesPage() {
  const { data, setData, loading, refreshing, error, load: loadResource } = useRetainedResource<CompaniesResponse>(companyResourceKey('', '', 'latest'))
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [unread, setUnread] = useState(0)
  const [watchState, setWatchState] = useState<CareerWatchResponse | null>(null)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [sortBy, setSortBy] = useState<CompanyDirectorySort>('latest')
  const [sortOpen, setSortOpen] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [badgeTime, setBadgeTime] = useState(0)
  const requestSequence = useRef(0)
  const followRevision = useRef(0)
  const lastScope = useRef('')
  const [visible, setVisible] = useState(false)
  const paginationPending = useRef(false)
  useMiniShare('Haigoo 远程企业名单', '/pages/companies/index')

  const load = useCallback(async (force = false, query = appliedSearch, category = industry, nextSort = sortBy, automatic = false) => {
    if (automatic && paginationPending.current) return
    const scope = miniContentScope()
    const scopeChanged = lastScope.current !== scope
    if (scopeChanged) {
      lastScope.current = scope
      setFollowed(new Set())
      setWatchState(null)
      setUnread(0)
    }
    if (query.trim() !== appliedSearch || category !== industry || nextSort !== sortBy) requestSequence.current++
    // Keep the submitted query even if it fails, so retry never reloads an old search.
    setAppliedSearch(query.trim())
    setSortBy(nextSort)
    await loadResource(companyResourceKey(query, category, nextSort), async () => {
      const sequence = ++requestSequence.current
      const revision = followRevision.current
      const authenticated = hasAuthenticatedSession()
      // Refresh the pages already loaded so returning from a detail keeps list depth.
      const pageCount = !scopeChanged && query.trim() === appliedSearch && category === industry && nextSort === sortBy ? data?.page || 1 : 1
      const first = await fetchCompanies({ search: query, industry: category, sortBy: nextSort, page: 1, pageSize: 20, force })
      const pages = [first]
      const lastPage = first.access.scope === 'member_all' ? Math.min(pageCount, Math.max(1, Math.ceil(first.total / first.pageSize))) : 1
      // Bound fan-out when a long list is refreshed.
      for (let page = 2; page <= lastPage; page += 4) {
        const fetchedPages = await Promise.all(Array.from({ length: Math.min(4, lastPage - page + 1) }, (_, index) =>
          fetchCompanies({ search: query, industry: category, sortBy: nextSort, page: page + index, pageSize: 20, force })
        ))
        fetchedPages.forEach((item) => pages.push(item))
      }
      const result = pages[pages.length - 1]
      const seen = new Set<string>()
      const companies = pages.flatMap((page) => page.companies).filter((company) => {
        if (seen.has(company.id)) return false
        seen.add(company.id)
        return true
      })
      if (scope === miniContentScope() && sequence === requestSequence.current) {
        // Secondary badges must never hold up the directory itself.
        void Promise.allSettled([
          authenticated ? fetchCompanyFollows() : Promise.resolve({ follows: [] }),
          authenticated ? fetchCareerWatch() : Promise.resolve(null)
        ]).then(([follows, watch]) => {
          if (scope !== miniContentScope() || sequence !== requestSequence.current) return
          if (follows.status === 'fulfilled' && revision === followRevision.current) setFollowed(new Set(follows.value.follows.map((item) => String(item.company_id))))
          if (watch.status === 'fulfilled') {
            setUnread((watch.value?.unreadFollowedUpdateCount ?? watch.value?.followedUpdates.filter((item) => item.status === 'unread').length) || 0)
            setWatchState(watch.value)
          }
        })
      }
      const next = { ...result, companies }
      // serverTime changes on every check; unchanged content keeps its object and cards.
      const { serverTime: _oldTime, ...previousContent } = data || {} as CompaniesResponse
      const { serverTime: _newTime, ...nextContent } = next
      return !scopeChanged && JSON.stringify(previousContent) === JSON.stringify(nextContent) ? data! : next
    }, force, { maxAgeMs: COMPANY_CHECK_INTERVAL_MS, silent: automatic })
  }, [appliedSearch, data, industry, loadResource, sortBy])

  useDidShow(() => {
    setVisible(true)
    Taro.eventCenter.trigger('haigoo:tab-change', '/pages/companies/index')
    const previousScope = miniContentScope()
    if (!hasAuthenticatedSession()) { void load(false, appliedSearch, industry, sortBy, true); return }
    void refreshWechatSessionIfStale().catch(() => null).then(() => {
      if (previousScope !== miniContentScope()) void load(true)
      else void load(false, appliedSearch, industry, sortBy, true)
    })
  })
  useDidHide(() => setVisible(false))
  const latestCheck = useRef(() => Promise.resolve())
  latestCheck.current = () => load(false, appliedSearch, industry, sortBy, true)
  useEffect(() => {
    if (!visible) return
    const timer = setInterval(() => { void latestCheck.current() }, COMPANY_CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [visible])
  useEffect(() => onCompanyFollowChange(({ companyId, followed: nextFollowed }) => {
    followRevision.current++
    setFollowed((current) => {
      const next = new Set(current)
      if (nextFollowed) next.add(companyId)
      else next.delete(companyId)
      return next
    })
  }), [])
  useEffect(() => () => { requestSequence.current++ }, [])
  useEffect(() => {
    const syncUnread = (count?: number) => setUnread(Math.max(0, Number(count || 0)))
    Taro.eventCenter.on('haigoo:unread-change', syncUnread)
    return () => { Taro.eventCenter.off('haigoo:unread-change', syncUnread) }
  }, [])
  usePullDownRefresh(async () => { await load(true); stopPullDownRefresh() })

  useEffect(() => {
    const parsedServerTime = Date.parse(data?.serverTime || '')
    const serverTime = Number.isFinite(parsedServerTime) ? parsedServerTime : Date.now()
    const receivedAt = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    const refreshBadges = () => {
      const now = serverTime + Math.max(0, Date.now() - receivedAt)
      setBadgeTime(now)
      const expiries = (data?.companies || []).map((company) => companyUpdateDeadline(company, now)).filter((expiry) => expiry > now)
      if (expiries.length) timer = setTimeout(refreshBadges, expiries.reduce((earliest, value) => Math.min(earliest, value)) - now + 1)
    }
    refreshBadges()
    return () => { if (timer) clearTimeout(timer) }
  }, [data])

  const selectIndustry = async (key: string) => {
    setIndustry(key)
    await load(false, appliedSearch, key, sortBy)
  }

  const selectSort = async (nextSort: CompanyDirectorySort) => {
    setSortOpen(false)
    if (nextSort === sortBy) return
    await load(false, appliedSearch, industry, nextSort)
  }

  const loadMore = async () => {
    if (!data?.hasMore || paginationPending.current || refreshing) return
    paginationPending.current = true
    const requestId = requestSequence.current
    const scope = miniContentScope()
    setLoadingMore(true)
    try {
      const next = await fetchCompanies({ search: appliedSearch, industry, sortBy, page: data.page + 1, pageSize: data.pageSize, force: true })
      if (requestId !== requestSequence.current || scope !== miniContentScope()) return
      setData((current) => current ? {
        ...next,
        companies: current.companies.concat(next.companies.filter((item) => !current.companies.some((existing) => existing.id === item.id)))
      } : current)
    } catch (loadError) { Taro.showToast({ title: loadError instanceof Error ? loadError.message : '更多企业加载失败', icon: 'none' }) } finally { paginationPending.current = false; setLoadingMore(false) }
  }

  const clearFilters = async () => {
    setSearch(''); setIndustry('')
    await load(false, '', '')
  }

  const industries = useMemo(() => data?.industries.map((item) => ({ key: item.name, label: item.name })) || [], [data?.industries])
  const matchRequired = data?.access.scope === 'match_required'
  const isMemberDirectory = data?.access.scope === 'member_all'
  const isFreeExactSearch = data?.access.searchMode === 'exact' && Boolean(appliedSearch)
  const visibleFreeCount = data?.companies.length ?? 0
  const countLabel = isFreeExactSearch ? `找到${visibleFreeCount}家` : isMemberDirectory ? `会员版${data?.total || 0}家` : `免费版${visibleFreeCount}家`
  const searchTooBroad = data?.searchOutcome === 'too_broad'
  const companyDetailUrl = (companyId: string) => `/pages/company-detail/index?id=${encodeURIComponent(companyId)}${isFreeExactSearch ? `&search=${encodeURIComponent(appliedSearch)}` : ''}`

  const user = getMiniUser()
  return <View className='companies-root'>
    <EditorialTopBar authenticated={hasAuthenticatedSession()} avatar={user?.avatar} unread={unread} />
    <View className='page-shell companies-page'>
    <View className='companies-heading'><View><Text className='page-heading'>远程企业</Text><Text className='page-subtitle'>{isFreeExactSearch ? '搜索企业或岗位' : '仅展示有开放申请的企业'}</Text></View>{data && !loading && !matchRequired ? <Text>{countLabel}</Text> : null}</View>
    <View className='companies-tools'><View className='companies-tools__search-row'><EditorialSearch value={search} placeholder='搜索企业或岗位名称' iconSize='30rpx' onInput={setSearch} onSubmit={() => void load(true, search, industry, sortBy)} />{data && !matchRequired ? <View className='companies-sort-control'>
      <View className='companies-sort-toggle' aria-role='button' aria-haspopup='listbox' aria-expanded={sortOpen} aria-label={`当前${sortBy === 'latest' ? '按最新' : '按相关度'}排序`} hoverClass='mini-action--pressed' onClick={(event) => { event.stopPropagation(); setSortOpen((current) => !current) }}><Text>{sortBy === 'latest' ? '按最新' : '按相关度'}</Text><MiniIcon name='chevronRight' className={`companies-sort-toggle__icon ${sortOpen ? 'is-open' : ''}`} size='20rpx' /></View>
      {sortOpen ? <><View className='companies-sort-dismiss' aria-role='button' aria-label='关闭排序菜单' onClick={() => setSortOpen(false)} /><View className='companies-sort-menu' aria-role='listbox' aria-label='企业排序方式' onClick={(event) => event.stopPropagation()}>
        {sortOptions.map((option) => <View className={option.value === sortBy ? 'is-selected' : ''} data-sort={option.value} aria-role='option' aria-selected={option.value === sortBy} hoverClass='mini-action--pressed' key={option.value} onClick={() => void selectSort(option.value)}><Text>{option.label}</Text>{option.value === sortBy ? <MiniIcon name='check' size='20rpx' /> : null}</View>)}
      </View></> : null}
    </View> : null}</View>{industries.length && !isFreeExactSearch ? <TopicScroller activeKey={industry} onSelect={(key) => void selectIndustry(key)} items={[{ key: '', label: '全部' }].concat(industries)} /> : null}</View>
    {error ? <EditorialState title='企业名单暂时无法加载' copy={error} actionLabel='重新加载' onAction={() => void load(true)} /> : null}
    {data && refreshing ? <View className='companies-refreshing'><Text>正在更新企业…</Text></View> : null}
    {loading && !data ? <ContentSkeleton rows={5} /> : null}
    {!loading && !error && matchRequired ? <View className='companies-match-required'><Text>先完成匹配</Text><Text>设置求职方向后查看企业。</Text><View className='primary-button' aria-role='button' aria-label='去设置匹配方向' hoverClass='mini-action--pressed' onClick={() => switchTab({ url: '/pages/index/index' })}>去匹配</View></View> : null}
    {!loading && !error && !matchRequired && data?.companies.length === 0 ? <EditorialState title={searchTooBroad ? '请输入完整企业或岗位名称' : search ? '未找到已审核的公开岗位' : '暂无开放申请的企业'} copy={searchTooBroad ? '免费版支持精准搜索完整企业或岗位名称；更多结果请升级会员' : '请检查企业或岗位名称，或清除筛选条件。'} actionLabel={searchTooBroad ? '查看会员' : industry || search ? '清除筛选' : undefined} onAction={() => searchTooBroad ? void navigateTo({ url: '/pages/membership/index' }) : void clearFilters()} /> : null}
    {!loading && !error && data?.companies.length ? <View className='company-list'>
      {data.companies.map((company) => {
        const meta = [company.industry, company.address, company.employeeCount].filter(Boolean).join(' · ')
        const ratingVisible = Boolean(company.ratingSource?.trim()) && company.rating !== null && Number.isFinite(Number(company.rating)) && Number(company.rating) > 0 && Number(company.rating) <= 5
        const roleSummary = buildCompanyRoleSummary(
          company.openRoleCategories || [],
          watchState?.profile || null,
          watchState?.filterOptions || { roles: [], roleGroups: [], teamSizes: [], ratings: [], companyAges: [], industries: [] }
        )
        return <EditorialRow className='company-card' key={company.id} label={`查看 ${company.name} 企业资料`}>
          <View className='company-card__main' aria-role='button' aria-label={`查看 ${company.name} 企业资料`} hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: companyDetailUrl(company.id) })}>
            <View className='company-card__logo'><CompanyLogo name={company.name} logoUrl={company.logoUrl} logoFileId={company.logoFileId} lazyLoad /></View>
            <View className='company-card__identity'>
              <View className='company-card__title-row'>
                <Text className='company-card__name'>{company.name}</Text>
                {ratingVisible ? <View className='company-card__rating' aria-label={`企业评分 ${company.rating?.toFixed(1)}`}><MiniIcon name='starFilled' size='20rpx' /><Text>{company.rating?.toFixed(1)}</Text></View> : null}
                {badgeTime > 0 && companyUpdateDeadline(company, badgeTime) > badgeTime ? <Text className='company-card__new' aria-label='近三天有新岗位'>NEW</Text> : null}
              </View>
              <Text className='company-card__industry'>{meta || '企业信息待补充'}</Text>
              <View className='company-card__roles' aria-label={roleSummary.ariaLabel}>
                {roleSummary.segments.length ? <>
                  <Text className='company-card__role-types'>{roleSummary.segments.map((segment, index) => <Text className={segment.matched ? 'company-card__role--matched' : ''} key={segment.label}>
                    {segment.label}{index < roleSummary.segments.length - 1 ? '、' : ''}
                  </Text>)}</Text>
                  <Text className='company-card__role-suffix'>{roleSummary.suffix}</Text>
                </> : <Text>{roleSummary.suffix}</Text>}
              </View>
            </View>
            <View className='company-card__footer'>
              <CompanyFollowAction companyId={company.id} companyName={company.name} followed={followed.has(company.id)} compact unfollowedIcon='plus' onChanged={(nextFollowed) => setFollowed((current) => { const next = new Set(current); if (nextFollowed) next.add(company.id); else next.delete(company.id); return next })} />
            </View>
          </View>
        </EditorialRow>
      })}
      {data.hasMore ? <View className='companies-load-more' aria-role='button' aria-label={loadingMore ? '正在加载更多企业' : '加载更多企业'} hoverClass={loadingMore ? undefined : 'mini-action--pressed'} onClick={() => void loadMore()}>{loadingMore ? '正在加载…' : '加载更多企业'}</View> : null}
      {data.access.scope === 'free_fixed' ? <View className='companies-member-boundary' aria-role='button' aria-label='查看会员企业数据权益' hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/membership/index' })}><Text>完整远程企业数据仅对会员开放</Text><MiniIcon name='chevronRight' size={18} /></View> : null}
    </View> : null}
    </View>
  </View>
}
