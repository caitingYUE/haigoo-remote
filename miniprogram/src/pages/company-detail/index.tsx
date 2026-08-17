import { Image, Text, View } from '@tarojs/components'
import { navigateTo, setClipboardData, showToast, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import { fetchCompany } from '../../services/content-service'
import type { ContentBlock, MiniCompany } from '../../types'
import './index.scss'

function Blocks({ items }: { items: ContentBlock[] }) {
  return <>{items.map((item, index) => (
    <View className={`company-block company-block--${item.type}`} key={item.id || `${item.type}-${index}`}>
      {item.text ? <Text>{item.text}</Text> : null}
      {item.items?.map((line, lineIndex) => <Text className='company-block__item' key={`${line}-${lineIndex}`}>{line}</Text>)}
    </View>
  ))}</>
}

export default function CompanyDetailPage() {
  const router = useRouter()
  const id = String(router.params.id || '')
  const [company, setCompany] = useState<MiniCompany | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setError('')
    try { setCompany(await fetchCompany(id)) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '企业资料加载失败') }
  }, [id])
  useEffect(() => { void load() }, [load])

  const copyWebsiteUrl = async () => {
    if (!company?.websiteUrl) return
    try {
      await setClipboardData({ data: company.websiteUrl })
      showToast({ title: '招聘页地址已复制', icon: 'success' })
    } catch {
      showToast({ title: '复制失败，请稍后重试', icon: 'none' })
    }
  }

  if (error) return <View className='page-shell'><View className='empty-state'><Text className='empty-state__title'>无法查看企业资料</Text><Text className='empty-state__copy'>{error}</Text><View className='empty-state__action' onClick={load}>重新加载</View></View></View>
  if (!company) return <View className='page-shell company-detail-loading'>正在加载企业资料…</View>
  const updatedAt = company.updatedAt ? company.updatedAt.slice(0, 10).replace(/-/g, '.') : '持续更新'

  return (
    <View className='page-shell company-detail'>
      <View className='company-detail__hero'>
        <View className='company-detail__mark'>{company.logoUrl ? <Image src={company.logoUrl} mode='aspectFit' /> : <Text>{company.name.slice(0, 1).toUpperCase()}</Text>}</View>
        <Text className='company-detail__industry'>{company.industry}</Text>
        <Text className='company-detail__title'>{company.name}</Text>
        <View className='company-detail__facts'>
          {company.address ? <Text>{company.address}</Text> : null}
          {company.employeeCount ? <Text>{company.employeeCount} 人</Text> : null}
          {company.foundedYear ? <Text>{company.foundedYear} 年创立</Text> : null}
        </View>
        <Text className='company-detail__updated'>资料来自公开信息 · {company.updatedAt ? `更新于 ${updatedAt}` : updatedAt}</Text>
      </View>
      <View className={`company-detail__opportunity ${company.hasPublicOpportunity ? 'company-detail__opportunity--active' : ''}`}>
        <View className='company-detail__opportunity-copy'>
          <Text className='company-detail__opportunity-title'>{company.hasPublicOpportunity ? '近期有公开机会' : '关注企业招聘动态'}</Text>
          <Text className='company-detail__opportunity-body'>
            {company.hasPublicOpportunity
              ? '海狗远程近期收录到公开机会，可能与你的方向相关。岗位状态以网站最新信息为准。'
              : '海狗远程会持续整理这家企业的公开招聘信息。'}
          </Text>
        </View>
        {company.websiteUrl ? <View className='company-detail__opportunity-action' aria-role='button' onClick={copyWebsiteUrl}>复制招聘页地址</View> : null}
      </View>
      <View className='company-detail__section'>
        <Text className='company-detail__section-title'>业务介绍</Text>
        <Text className='company-detail__body'>{company.description || '企业介绍正在完善。'}</Text>
      </View>
      {company.specialties.length > 0 ? <View className='company-detail__section'><Text className='company-detail__section-title'>业务方向</Text><View className='company-detail__tags'>{company.specialties.slice(0, 4).map((item) => <Text key={item}>{item}</Text>)}</View></View> : null}
      {company.remoteWork && company.remoteWork.length > 0 ? <View className='company-detail__section'><Text className='company-detail__section-title'>远程协作特点</Text><View className='company-detail__points'>{company.remoteWork.map((item) => <Text key={item}>· {item}</Text>)}</View></View> : null}
      {company.culture && company.culture.length > 0 ? <View className='company-detail__section'><Text className='company-detail__section-title'>企业文化</Text><Blocks items={company.culture} /></View> : null}
      {company.ceoInsights && company.ceoInsights.length > 0 ? <View className='company-detail__section'><Text className='company-detail__section-title'>CEO 洞察</Text><Blocks items={company.ceoInsights} /></View> : null}
      {company.insightsLocked ? <View className='company-detail__locked' onClick={() => navigateTo({ url: '/pages/membership/index' })}><Text>会员可继续阅读企业文化与 CEO 洞察</Text><Text>查看方案</Text></View> : null}
      <View className='company-detail__consult'><Text className='company-detail__consult-title'>想结合自己的方向继续判断？</Text><Text className='company-detail__consult-copy'>咨询时可以把这家企业作为参考。</Text><View className='primary-button' onClick={() => navigateTo({ url: `/pages/consultation/index?sourcePage=company&sourceCompanyId=${encodeURIComponent(company.id)}` })}>咨询职业顾问</View></View>
    </View>
  )
}
