import { Image, Text, View } from '@tarojs/components'
import { navigateTo, setClipboardData, showToast, useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import useMiniShare from '../../hooks/use-mini-share'
import { fetchCompany } from '../../services/content-service'
import { fetchCompanyFollows, followCompany, unfollowCompany } from '../../services/career-match-service'
import type { ContentBlock, MiniCompany } from '../../types'
import './index.scss'

function Blocks({ items }: { items: ContentBlock[] }) {
  return <>{items.map((item, index) => <View className={`company-block company-block--${item.type}`} key={item.id || `${item.type}-${index}`}>{item.text ? <Text>{item.text}</Text> : null}{item.items?.map((line, lineIndex) => <Text className='company-block__item' key={`${line}-${lineIndex}`}>{line}</Text>)}</View>)}</>
}

async function copyLink(value: string, message: string) {
  try { await setClipboardData({ data: value }); showToast({ title: message, icon: 'success' }) }
  catch { showToast({ title: '复制失败，请稍后重试', icon: 'none' }) }
}

function safeJobFact(value: unknown) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  if (!text || /^[\[{]/.test(text) || /["'](?:min|max|currency|amount|value|type)["']\s*:/.test(text)) return ''
  return text
}

export default function CompanyDetailPage() {
  const router = useRouter()
  const id = String(router.params.id || '')
  const [company, setCompany] = useState<MiniCompany | null>(null)
  const [followed, setFollowed] = useState(false)
  const [error, setError] = useState('')
  useMiniShare(company ? `${company.name}｜远程企业资料` : 'Haigoo 远程企业资料', `/pages/company-detail/index?id=${encodeURIComponent(id)}`)
  const load = useCallback(async () => {
    setError('')
    try {
      const [companyResult, follows] = await Promise.all([
        fetchCompany(id, true),
        fetchCompanyFollows().catch(() => ({ success: true as const, follows: [] as Array<{ company_id: string; name: string; industry: string }> }))
      ])
      setCompany(companyResult)
      setFollowed(follows.follows.some((item) => String(item.company_id) === id))
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '企业资料加载失败') }
  }, [id])
  useDidShow(() => { void load() })

  const toggleFollow = async () => {
    if (!company) return
    try {
      if (followed) await unfollowCompany(company.id); else await followCompany(company.id)
      setFollowed(!followed)
      showToast({ title: followed ? '已取消关注' : '已关注企业', icon: 'success' })
    } catch (followError) { showToast({ title: followError instanceof Error ? followError.message : '操作没有完成', icon: 'none' }) }
  }

  if (error) return <View className='page-shell'><View className='empty-state'><Text className='empty-state__title'>无法查看企业资料</Text><Text className='empty-state__copy'>{error}</Text><View className='empty-state__action' onClick={load}>重新加载</View></View></View>
  if (!company) return <View className='page-shell company-detail-loading'>正在加载企业资料…</View>

  return <View className='page-shell company-detail'>
    <View className='company-detail__hero'>
      <View className='company-detail__brand-row'><View className='company-detail__mark'>{company.logoUrl ? <Image src={company.logoUrl} mode='aspectFit' /> : <MiniIcon name='building' size={34} />}</View><View className='company-detail__identity'><Text>{company.name}</Text>{company.industry ? <Text>{company.industry}</Text> : null}</View></View>
      <View className='company-detail__facts'>{company.rating !== null && company.ratingSource ? <Text>{company.rating.toFixed(1)} · {company.ratingSource}</Text> : null}{company.employeeCount ? <Text>企业规模：{company.employeeCount}</Text> : null}{company.foundedYear ? <Text>成立时间：{company.foundedYear}</Text> : null}{company.address ? <Text>{company.address}</Text> : null}</View>
      <View className='company-detail__actions'><View className='secondary-button' onClick={() => void toggleFollow()}>{followed ? '取消关注' : '关注企业'}</View>{company.careersUrl || company.websiteUrl ? <View className='primary-button' onClick={() => void copyLink(company.careersUrl || company.websiteUrl || '', '官网链接已复制')}>复制官网链接</View> : null}</View>
    </View>

    <View className='company-detail__section'><Text className='company-detail__section-title'>企业介绍</Text><Text className='company-detail__body'>{company.description || '暂未收录公开企业介绍。'}</Text></View>
    {company.specialties.length ? <View className='company-detail__section'><Text className='company-detail__section-title'>企业标签</Text><View className='company-detail__tags'>{company.specialties.map((item) => <Text key={item}>{item}</Text>)}</View></View> : null}

    <View className='company-detail__section'><View className='company-detail__section-heading'><Text className='company-detail__section-title'>公开岗位</Text>{company.jobs?.length ? <Text>{company.jobs.length} 个</Text> : null}</View>{company.jobs?.length ? <View className='company-detail__jobs'>{company.jobs.map((job) => {
      const facts = [job.location, job.jobType, job.salary].map(safeJobFact).filter(Boolean)
      return <View className='company-job' hoverClass='mini-action--pressed' key={job.id} onClick={() => navigateTo({ url: `/pages/job-detail/index?companyId=${encodeURIComponent(company.id)}&jobId=${encodeURIComponent(job.id)}` })}><View className='company-job__copy'><Text>{job.title}</Text>{facts.length ? <Text>{facts.join(' · ')}</Text> : <Text>查看岗位信息</Text>}</View><MiniIcon name='chevronRight' size={19} /></View>
    })}</View> : <Text className='company-detail__empty-copy'>暂无公开岗位</Text>}</View>

    <View className='company-detail__section'><Text className='company-detail__section-title'>内部联系人</Text>{company.contacts ? company.contacts.length ? <View className='company-detail__contacts'>{company.contacts.map((contact) => <View className='company-contact' key={contact.id}><View><Text>{contact.name || contact.title || '企业联系信息'}</Text><Text>{[contact.name ? contact.title : '', contact.email].filter(Boolean).join(' · ')}</Text></View><Text onClick={() => void copyLink(contact.email || contact.linkedin, '联系信息已复制')}>复制</Text></View>)}</View> : <Text className='company-detail__empty-copy'>暂未收录联系人。</Text> : <View className='company-detail__locked' onClick={() => navigateTo({ url: '/pages/membership/index' })}><View><MiniIcon name='shield' size={23} /><View><Text>会员可查看内部联系人</Text></View></View><MiniIcon name='chevronRight' size={19} /></View>}</View>

    {company.remoteWork?.length ? <View className='company-detail__section'><Text className='company-detail__section-title'>远程协作特点</Text><View className='company-detail__points'>{company.remoteWork.map((item) => <Text key={item}>{item}</Text>)}</View></View> : null}
    {company.culture?.length ? <View className='company-detail__section'><Text className='company-detail__section-title'>企业文化</Text><Blocks items={company.culture} /></View> : null}
    {company.ceoInsights?.length ? <View className='company-detail__section'><Text className='company-detail__section-title'>CEO 洞察</Text><Blocks items={company.ceoInsights} /></View> : null}
    {company.insightsLocked ? <View className='company-detail__locked' onClick={() => navigateTo({ url: '/pages/membership/index' })}><View><MiniIcon name='club' size={23} /><View><Text>会员可继续阅读企业研究</Text><Text>查看已收录的企业文化与公开访谈整理。</Text></View></View><MiniIcon name='chevronRight' size={19} /></View> : null}
  </View>
}
