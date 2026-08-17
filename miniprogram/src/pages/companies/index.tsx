import { Image, Text, View } from '@tarojs/components'
import { navigateTo, stopPullDownRefresh, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import ContentSkeleton from '../../components/content-skeleton'
import EditorialTopBar from '../../components/editorial-top-bar'
import EditorialSearch from '../../components/editorial-search'
import EditorialRow from '../../components/editorial-row'
import EditorialState from '../../components/editorial-state'
import TopicScroller from '../../components/topic-scroller'
import { trackMiniEvent } from '../../services/analytics-service'
import { fetchCompanies, type CompaniesResponse } from '../../services/content-service'
import { getMiniUser, hasAuthenticatedSession } from '../../services/session'
import './index.scss'

export default function CompaniesPage() {
  const [data, setData] = useState<CompaniesResponse | null>(null)
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const user = getMiniUser()

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchCompanies({ search, industry, pageSize: 50, force }))
      void trackMiniEvent('mini_company_directory_view', { search: Boolean(search), industry: industry || 'all' })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '企业列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [industry, search])

  useDidShow(() => { void load() })
  usePullDownRefresh(async () => { await load(true); stopPullDownRefresh() })
  useEffect(() => {
    if (!data?.access.searchEnabled) return
    const timer = setTimeout(() => { void load() }, 350)
    return () => clearTimeout(timer)
  }, [search, industry])

  const openCompany = (id: string) => {
    void trackMiniEvent('mini_company_open', { entity_id: id, source_page: 'companies' })
    navigateTo({ url: `/pages/company-detail/index?id=${encodeURIComponent(id)}` })
  }

  return (
    <View className='page-shell companies-page'>
      <EditorialTopBar authenticated={hasAuthenticatedSession()} avatar={user?.avatar} />
      <View className='companies-hero'>
        <Image className='companies-hero__image' src='/assets/home-hero-bg.jpg' mode='aspectFill' />
        <View className='companies-hero__shade' />
        <View className='companies-hero__copy'>
          <Text className='companies-hero__label'>Remote Company Index</Text>
          <Text className='companies-hero__title'>值得长期关注的远程企业</Text>
          <Text className='companies-hero__text'>先了解业务、工作方式和企业文化，再判断是否值得进一步关注。</Text>
        </View>
      </View>

      <View className='companies-tools'>
        <EditorialSearch value={search} disabled={!data || !data.access.searchEnabled} onInput={setSearch} onGateClick={data && !data.access.searchEnabled ? () => navigateTo({ url: '/pages/membership/index' }) : undefined} gateLabel={data && !data.access.searchEnabled ? '会员可用' : ''} placeholder={!data ? '正在加载企业' : !data.access.searchEnabled ? '会员可搜索全部企业' : '搜索企业、行业或业务'} />

        {data?.access.searchEnabled && data.industries.length > 0 ? (
          <TopicScroller activeKey={industry} onSelect={setIndustry} items={[{ key: '', label: '全部' }, ...data.industries.map((item) => ({ key: item.name, label: item.name }))]} />
        ) : null}
      </View>

      {data && !data.access.fullDirectory && !loading && !error ? (
        <View className='companies-access'>
          <View>
            <Text className='companies-access__title'>已展示 12 家精选企业</Text>
            <Text className='companies-access__copy'>会员可查看全部 {data.total} 家企业，并使用搜索和行业筛选。</Text>
          </View>
          <Text className='companies-access__action' onClick={() => navigateTo({ url: '/pages/membership/index' })}>查看方案</Text>
        </View>
      ) : null}

      <View className='companies-count'>
        <Text>{data?.access.fullDirectory ? `${data.total} 家远程企业` : '12 家精选企业'}</Text>
        {loading ? <Text>加载中…</Text> : null}
      </View>

      {error ? (
        <EditorialState title='企业列表暂时无法加载' copy={error} actionLabel='重新加载' onAction={() => void load(true)} />
      ) : data?.companies.length === 0 && !loading ? (
        <EditorialState title='没有找到相关企业' copy='换一个关键词，或清除行业筛选后再试。' actionLabel={industry || search ? '清除筛选' : undefined} onAction={() => { setSearch(''); setIndustry('') }} />
      ) : loading && !data ? (
        <ContentSkeleton rows={5} />
      ) : (
        <View className='company-list'>
          {data?.companies.map((company) => (
            <EditorialRow className='company-card' key={company.id} label={`查看 ${company.name} 企业资料`} onClick={() => openCompany(company.id)}>
              <View className='company-card__top'>
                <View className='company-card__logo'>
                  {company.logoUrl ? <Image src={company.logoUrl} mode='aspectFit' lazyLoad /> : <Text>{company.name.slice(0, 1).toUpperCase()}</Text>}
                </View>
                <View className='company-card__identity'><Text className='company-card__name'>{company.name}</Text><Text className='company-card__industry'>{company.industry}</Text></View>
                <MiniIcon name='chevronRight' size={19} />
              </View>
              <Text className='company-card__description'>{company.description || '企业介绍正在完善。'}</Text>
              <View className='company-card__meta'>
                {company.address ? <Text>{company.address}</Text> : null}
                {company.employeeCount ? <Text>{company.employeeCount} 人</Text> : null}
                {company.foundedYear ? <Text>创立于 {company.foundedYear}</Text> : null}
              </View>
            </EditorialRow>
          ))}
        </View>
      )}
    </View>
  )
}
