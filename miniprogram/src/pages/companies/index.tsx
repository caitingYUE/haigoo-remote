import { Image, Text, View } from '@tarojs/components'
import Taro, { navigateTo, stopPullDownRefresh, switchTab, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import ContentSkeleton from '../../components/content-skeleton'
import EditorialRow from '../../components/editorial-row'
import EditorialSearch from '../../components/editorial-search'
import EditorialState from '../../components/editorial-state'
import MiniIcon from '../../components/mini-icon'
import TopicScroller from '../../components/topic-scroller'
import { fetchCompanies } from '../../services/content-service'
import type { CompaniesResponse } from '../../services/content-service'
import { fetchCompanyFollows, followCompany, unfollowCompany } from '../../services/career-match-service'
import { hasAuthenticatedSession } from '../../services/session'
import useMiniShare from '../../hooks/use-mini-share'
import useMiniNavigationInset from '../../hooks/use-mini-navigation-inset'
import './index.scss'

function formatUpdatedAt(value?: string | null) {
  const time = new Date(value || '').getTime()
  if (!Number.isFinite(time)) return ''
  const date = new Date(time)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export default function CompaniesPage() {
  const [data, setData] = useState<CompaniesResponse | null>(null)
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const navigationInset = useMiniNavigationInset()
  useMiniShare('Haigoo 远程企业名单', '/pages/companies/index')

  const load = useCallback(async (force = false) => {
    setLoading(true); setError('')
    try {
      const [result, follows] = await Promise.all([
        fetchCompanies({ search, industry, page: 1, pageSize: 20, force }),
        hasAuthenticatedSession() ? fetchCompanyFollows().catch(() => ({ follows: [] })) : Promise.resolve({ follows: [] })
      ])
      setData(result)
      setFollowed(new Set(follows.follows.map((item) => String(item.company_id))))
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '企业名单加载失败') } finally { setLoading(false) }
  }, [industry, search])

  useDidShow(() => {
    Taro.eventCenter.trigger('haigoo:tab-change', '/pages/companies/index')
    void load()
  })
  usePullDownRefresh(async () => { await load(true); stopPullDownRefresh() })

  const selectIndustry = async (key: string) => {
    setIndustry(key)
    if (!data?.access.searchEnabled) return
    setLoading(true); setError('')
    try { setData(await fetchCompanies({ search, industry: key, page: 1, pageSize: 20, force: true })) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : '企业名单加载失败') }
    finally { setLoading(false) }
  }

  const loadMore = async () => {
    if (!data?.hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await fetchCompanies({ search, industry, page: data.page + 1, pageSize: data.pageSize, force: true })
      setData({ ...next, companies: [...data.companies, ...next.companies] })
    } catch (loadError) { Taro.showToast({ title: loadError instanceof Error ? loadError.message : '更多企业加载失败', icon: 'none' }) } finally { setLoadingMore(false) }
  }

  const clearFilters = async () => {
    setSearch(''); setIndustry(''); setLoading(true); setError('')
    try { setData(await fetchCompanies({ search: '', industry: '', page: 1, pageSize: 20, force: true })) }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : '企业名单加载失败') }
    finally { setLoading(false) }
  }

  const toggleFollow = async (companyId: string) => {
    try {
      if (followed.has(companyId)) await unfollowCompany(companyId)
      else await followCompany(companyId)
      setFollowed((current) => {
        const next = new Set(current)
        if (next.has(companyId)) next.delete(companyId); else next.add(companyId)
        return next
      })
      Taro.showToast({ title: followed.has(companyId) ? '已取消关注' : '已关注企业', icon: 'success' })
    } catch (followError) { Taro.showToast({ title: followError instanceof Error ? followError.message : '操作没有完成', icon: 'none' }) }
  }

  const industries = useMemo(() => data?.industries.map((item) => ({ key: item.name, label: item.name })) || [], [data?.industries])
  const matchRequired = data?.access.scope === 'match_required'
  const countLabel = data?.access.scope === 'free_fixed'
    ? `${data.total} 家匹配企业在招`
    : `共 ${data?.total || 0} 家在招企业`

  return <View className='page-shell companies-page' style={{ paddingTop: `${navigationInset}px`, '--mini-navigation-inset': `${navigationInset}px` } as any}>
    <View className='companies-navigation-mask' aria-hidden />
    <View className='companies-heading'><View><Text className='page-heading'>{data?.access.scope === 'free_fixed' ? '匹配企业' : '远程企业名单'}</Text><Text className='page-subtitle'>{data?.access.scope === 'member_all' ? '按公开岗位更新时间排序' : data?.access.scope === 'free_fixed' ? '查看当前在招的匹配企业' : '完成匹配后查看企业'}</Text></View>{data && !loading && !matchRequired ? <Text>{countLabel}</Text> : null}</View>
    {data?.access.searchEnabled ? <View className='companies-tools'><EditorialSearch value={search} placeholder='搜索企业名称、行业或介绍' onInput={setSearch} onSubmit={() => void load(true)} />{industries.length ? <TopicScroller activeKey={industry} onSelect={(key) => void selectIndustry(key)} items={[{ key: '', label: '全部' }, ...industries]} /> : null}</View> : null}
    {error ? <EditorialState title='企业名单暂时无法加载' copy={error} actionLabel='重新加载' onAction={() => void load(true)} /> : null}
    {loading ? <ContentSkeleton rows={5} /> : null}
    {!loading && !error && matchRequired ? <View className='companies-match-required'><MiniIcon name='target' size={30} /><Text>先完成匹配</Text><Text>设置求职方向后查看企业。</Text><View className='primary-button' onClick={() => switchTab({ url: '/pages/index/index' })}>去匹配</View></View> : null}
    {!loading && !error && !matchRequired && data?.companies.length === 0 ? <EditorialState title='没有找到相关企业' copy='请调整搜索或筛选条件。' actionLabel={industry || search ? '清除筛选' : undefined} onAction={() => void clearFilters()} /> : null}
    {!loading && !error && data?.companies.length ? <View className='company-list'>
      {data.companies.map((company) => <EditorialRow className='company-card' key={company.id} label={`查看 ${company.name} 企业资料`}>
        <View className='company-card__main' onClick={() => navigateTo({ url: `/pages/company-detail/index?id=${encodeURIComponent(company.id)}` })}>
          <View className='company-card__logo'>{company.logoUrl ? <Image src={company.logoUrl} mode='aspectFit' lazyLoad /> : <MiniIcon name='building' size={26} />}</View>
          <View className='company-card__identity'><Text className='company-card__name'>{company.name}</Text>{company.industry ? <Text className='company-card__industry'>{company.industry}</Text> : null}<View className='company-card__facts'>{company.rating !== null && company.ratingSource ? <Text>{company.rating.toFixed(1)} · {company.ratingSource}</Text> : null}</View></View>
          <MiniIcon name='chevronRight' size={19} />
        </View>
        <View className='company-card__footer'><View className='company-card__meta'>{company.openJobCount ? <Text>{company.openJobCount} 个公开岗位</Text> : null}{formatUpdatedAt(company.publicOpportunityUpdatedAt) ? <Text>更新于 {formatUpdatedAt(company.publicOpportunityUpdatedAt)}</Text> : null}{company.address ? <Text>{company.address}</Text> : null}</View><Text className={followed.has(company.id) ? 'is-followed' : ''} onClick={() => void toggleFollow(company.id)}>{followed.has(company.id) ? '已关注' : '关注'}</Text></View>
      </EditorialRow>)}
      {data.hasMore ? <View className='companies-load-more' onClick={() => void loadMore()}>{loadingMore ? '正在加载…' : '加载更多企业'}</View> : null}
    </View> : null}
  </View>
}
