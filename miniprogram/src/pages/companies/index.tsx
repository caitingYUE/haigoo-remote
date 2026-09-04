import { Image, Text, View } from '@tarojs/components'
import Taro, { navigateTo, stopPullDownRefresh, switchTab, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CompanyFollowAction from '../../components/company-follow-action'
import ContentSkeleton from '../../components/content-skeleton'
import EditorialTopBar from '../../components/editorial-top-bar'
import EditorialRow from '../../components/editorial-row'
import EditorialSearch from '../../components/editorial-search'
import EditorialState from '../../components/editorial-state'
import MiniIcon from '../../components/mini-icon'
import TopicScroller from '../../components/topic-scroller'
import { fetchCompanies, fetchCompany } from '../../services/content-service'
import type { CompaniesResponse } from '../../services/content-service'
import type { MiniCompanyJob } from '../../types'
import { fetchCareerWatch, fetchCompanyFollows } from '../../services/career-match-service'
import { onCompanyFollowChange } from '../../services/company-follow-state'
import { getMiniUser, hasAuthenticatedSession } from '../../services/session'
import useMiniShare from '../../hooks/use-mini-share'
import { roleLabelsFromTitles } from '../../utils/match-card-presentation'
import './index.scss'

function companyInitial(name: string) {
  const value = String(name || '').trim()
  if (!value) return '企'
  const latin = value.match(/[A-Za-z0-9]+/g)
  if (latin?.length) return latin.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return value.slice(0, 2)
}

function companyOpenRoleSummary(company: CompaniesResponse['companies'][number], detailJobs?: MiniCompanyJob[]) {
  const titles = [
    ...(company.publicJobTitles || []),
    ...(detailJobs || company.jobs || []).flatMap((job) => [job.titleZh, job.title, job.titleOriginal])
  ].filter((title): title is string => Boolean(String(title || '').trim()))
  const labels = roleLabelsFromTitles(titles)
  if (labels.length === 1) return `${labels[0]}可申请`
  if (labels.length > 1) return `${labels.join('、')}等可申请`
  if (titles.length) return '其他方向可申请'
  return detailJobs === undefined ? '方向加载中…' : '暂无可申请岗位'
}

export default function CompaniesPage() {
  const [data, setData] = useState<CompaniesResponse | null>(null)
  const [failedLogoIds, setFailedLogoIds] = useState<Set<string>>(new Set())
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [unread, setUnread] = useState(0)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [detailJobs, setDetailJobs] = useState<Record<string, MiniCompanyJob[]>>({})
  const directionRequests = useRef<Record<string, MiniCompanyJob[] | null>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  useMiniShare('Haigoo 远程企业名单', '/pages/companies/index')

  const loadCompanyDirections = useCallback((companies: CompaniesResponse['companies'], accessSearch = '') => {
    companies.forEach((company) => {
      if (
        company.publicJobTitles?.length ||
        company.jobs?.length ||
        Object.prototype.hasOwnProperty.call(directionRequests.current, company.id)
      ) return
      directionRequests.current[company.id] = null
      void fetchCompany(company.id, false, accessSearch)
        .then((detail) => {
          const jobs = detail.jobs || []
          directionRequests.current[company.id] = jobs
          setDetailJobs((current) => ({ ...current, [company.id]: jobs }))
        })
        .catch(() => {
          directionRequests.current[company.id] = []
          setDetailJobs((current) => ({ ...current, [company.id]: [] }))
        })
    })
  }, [])

  const load = useCallback(async (force = false) => {
    setLoading(true); setError('')
    try {
      const authenticated = hasAuthenticatedSession()
      const emptyFollows = { success: true as const, follows: [] as Array<{ company_id: string; name: string; industry: string; wechat_enabled?: boolean; wechat_template_status?: string }> }
      const [result, follows, watch] = await Promise.all([
        fetchCompanies({ search, industry, page: 1, pageSize: 20, force }),
        authenticated ? fetchCompanyFollows().catch(() => emptyFollows) : Promise.resolve(emptyFollows),
        authenticated ? fetchCareerWatch().catch(() => null) : Promise.resolve(null)
      ])
      setData(result)
      setAppliedSearch(search.trim())
      setFollowed(new Set(follows.follows.map((item) => String(item.company_id))))
      setUnread(watch?.followedUpdates.length || 0)
      loadCompanyDirections(result.companies, search.trim())
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '企业名单加载失败') } finally { setLoading(false) }
  }, [industry, loadCompanyDirections, search])

  useDidShow(() => {
    Taro.eventCenter.trigger('haigoo:tab-change', '/pages/companies/index')
    void load()
  })
  useEffect(() => onCompanyFollowChange(({ companyId, followed: nextFollowed }) => {
    setFollowed((current) => {
      const next = new Set(current)
      if (nextFollowed) next.add(companyId)
      else next.delete(companyId)
      return next
    })
  }), [])
  usePullDownRefresh(async () => { await load(true); stopPullDownRefresh() })

  const selectIndustry = async (key: string) => {
    setIndustry(key)
    setLoading(true); setError('')
    try {
      const next = await fetchCompanies({ search, industry: key, page: 1, pageSize: 20, force: true })
      setData(next)
      loadCompanyDirections(next.companies, search.trim())
    }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : '企业名单加载失败') }
    finally { setLoading(false) }
  }

  const loadMore = async () => {
    if (!data?.hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await fetchCompanies({ search, industry, page: data.page + 1, pageSize: data.pageSize, force: true })
      setData({ ...next, companies: [...data.companies, ...next.companies] })
      loadCompanyDirections(next.companies, search.trim())
    } catch (loadError) { Taro.showToast({ title: loadError instanceof Error ? loadError.message : '更多企业加载失败', icon: 'none' }) } finally { setLoadingMore(false) }
  }

  const clearFilters = async () => {
    setSearch(''); setIndustry(''); setLoading(true); setError('')
    try {
      const next = await fetchCompanies({ search: '', industry: '', page: 1, pageSize: 20, force: true })
      setData(next)
      setAppliedSearch('')
      loadCompanyDirections(next.companies)
    }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : '企业名单加载失败') }
    finally { setLoading(false) }
  }

  const industries = useMemo(() => data?.industries.map((item) => ({ key: item.name, label: item.name })) || [], [data?.industries])
  const matchRequired = data?.access.scope === 'match_required'
  const isMemberDirectory = data?.access.scope === 'member_all'
  const isFreeExactSearch = data?.access.searchMode === 'exact' && Boolean(appliedSearch)
  const visibleFreeCount = data?.companies.length ?? 0
  const countLabel = isMemberDirectory ? `会员版${data?.total || 0}家` : `免费版${visibleFreeCount}家`
  const companyDetailUrl = (companyId: string) => `/pages/company-detail/index?id=${encodeURIComponent(companyId)}${isFreeExactSearch ? `&search=${encodeURIComponent(appliedSearch)}` : ''}`

  const user = getMiniUser()
  return <View className='companies-root'>
    <EditorialTopBar authenticated={hasAuthenticatedSession()} avatar={user?.avatar} unread={unread} />
    <View className='page-shell companies-page'>
    <View className='companies-heading'><View><Text className='page-heading'>远程企业</Text><Text className='page-subtitle'>仅展示有开放申请的企业</Text></View>{data && !loading && !matchRequired ? <Text>{countLabel}</Text> : null}</View>
    <View className='companies-tools'><EditorialSearch value={search} placeholder='搜索企业或岗位名称' iconSize='30rpx' onInput={setSearch} onSubmit={() => void load(true)} />{industries.length ? <TopicScroller activeKey={industry} onSelect={(key) => void selectIndustry(key)} items={[{ key: '', label: '全部' }, ...industries]} /> : null}</View>
    {error ? <EditorialState title='企业名单暂时无法加载' copy={error} actionLabel='重新加载' onAction={() => void load(true)} /> : null}
    {loading ? <ContentSkeleton rows={5} /> : null}
    {!loading && !error && matchRequired ? <View className='companies-match-required'><Text>先完成匹配</Text><Text>设置求职方向后查看企业。</Text><View className='primary-button' aria-role='button' aria-label='去设置匹配方向' hoverClass='mini-action--pressed' onClick={() => switchTab({ url: '/pages/index/index' })}>去匹配</View></View> : null}
    {!loading && !error && !matchRequired && data?.companies.length === 0 ? <EditorialState title='没有找到相关企业' copy='请检查名称或清除筛选条件。' actionLabel={industry || search ? '清除筛选' : undefined} onAction={() => void clearFilters()} /> : null}
    {!loading && !error && data?.companies.length ? <View className='company-list'>
      {data.companies.map((company) => {
        const meta = [company.industry, company.employeeCount].filter(Boolean).join(' · ')
        const ratingVisible = Boolean(company.ratingSource?.trim()) && company.rating !== null && Number.isFinite(Number(company.rating)) && Number(company.rating) > 0 && Number(company.rating) <= 5
        const directions = companyOpenRoleSummary(company, detailJobs[company.id])
        const hasApplicationDirections = directions !== '方向加载中…' && directions !== '暂无可申请岗位'
        return <EditorialRow className='company-card' key={company.id} label={`查看 ${company.name} 企业资料`}>
          <View className='company-card__main' aria-role='button' aria-label={`查看 ${company.name} 企业资料`} hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: companyDetailUrl(company.id) })}>
            <View className='company-card__logo'>{company.logoUrl && !failedLogoIds.has(company.id) ? <Image src={company.logoUrl} mode='aspectFit' lazyLoad onError={() => setFailedLogoIds((current) => new Set(current).add(company.id))} /> : <Text>{companyInitial(company.name)}</Text>}</View>
            <View className='company-card__identity'>
              <View className='company-card__title-row'>
                <Text className='company-card__name'>{company.name}</Text>
                {ratingVisible ? <View className='company-card__rating' aria-label={`企业评分 ${company.rating?.toFixed(1)}`}><MiniIcon name='starFilled' size='20rpx' /><Text>{company.rating?.toFixed(1)}</Text></View> : null}
              </View>
              <Text className='company-card__industry'>{meta || '企业信息待补充'}</Text>
              <Text className={`company-card__roles ${hasApplicationDirections ? 'has-directions' : ''}`}>{directions}</Text>
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
