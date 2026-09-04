import { Image, Text, View } from '@tarojs/components'
import Taro, { navigateTo, setClipboardData, showToast, useDidShow, useRouter } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import useMiniShare from '../../hooks/use-mini-share'
import { fetchCompany } from '../../services/content-service'
import { fetchCareerWatch, fetchCompanyFollows, followCompany, setMatchNotifications, unfollowCompany } from '../../services/career-match-service'
import { hasAuthenticatedSession } from '../../services/session'
import type { ContentBlock, MiniCompany, MiniCompanyJob } from '../../types'
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

function companyJobTitle(job: MiniCompanyJob) {
  return String(job.titleZh || job.title || job.titleOriginal || '查看岗位').trim()
}

function employeeCountLabel(value: string) {
  return value.replace(/\s*位?员工$/u, '').trim() || value
}

export default function CompanyDetailPage() {
  const router = useRouter()
  const id = String(router.params.id || '')
  const accessSearch = String(router.params.search || '').trim()
  const [company, setCompany] = useState<MiniCompany | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)
  const [followed, setFollowed] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [subscriptionBusy, setSubscriptionBusy] = useState(false)
  const [subscriptionConfig, setSubscriptionConfig] = useState({ available: false, templateId: '' })
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'culture'>('overview')
  const [error, setError] = useState('')
  useMiniShare(company ? `${company.name}｜远程企业资料` : 'Haigoo 远程企业资料', `/pages/company-detail/index?id=${encodeURIComponent(id)}${accessSearch ? `&search=${encodeURIComponent(accessSearch)}` : ''}`)
  const load = useCallback(async () => {
    setError('')
    try {
      const authenticated = hasAuthenticatedSession()
      const emptyFollows = { success: true as const, follows: [] as Array<{ company_id: string; name: string; industry: string; wechat_enabled?: boolean; wechat_template_status?: string }> }
      const [companyResult, follows, watch] = await Promise.all([
        fetchCompany(id, true, accessSearch),
        authenticated ? fetchCompanyFollows().catch(() => emptyFollows) : Promise.resolve(emptyFollows),
        authenticated ? fetchCareerWatch().catch(() => null) : Promise.resolve(null)
      ])
      const companyFollow = follows.follows.find((item) => String(item.company_id) === id)
      setCompany(companyResult)
      setFollowed(Boolean(companyFollow))
      setSubscribed(Boolean(companyFollow?.wechat_enabled && companyFollow.wechat_template_status === 'accepted'))
      setSubscriptionConfig({
        available: Boolean(watch?.entitlements.wechatSubscriptionAvailable),
        templateId: String(watch?.entitlements.wechatTemplateId || '')
      })
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '企业资料加载失败') }
  }, [accessSearch, id])
  useDidShow(() => { void load() })

  const requestWechatNotice = async (templateId: string) => {
    try {
      const requestSubscribeMessage = Taro.requestSubscribeMessage as unknown as (options: { tmplIds: string[] }) => Promise<Record<string, string>>
      const result = await requestSubscribeMessage({ tmplIds: [templateId] })
      const status = String(result[templateId] || '')
      if (status === 'accept') return true
      if (status === 'ban') await Taro.showModal({ title: '订阅消息未开启', content: '请在小程序设置中开启订阅消息后重试。', showCancel: false, confirmText: '知道了' })
      else showToast({ title: '未订阅更新，可稍后再试', icon: 'none' })
      return false
    } catch {
      showToast({ title: '微信订阅暂不可用，请稍后再试', icon: 'none' })
      return false
    }
  }

  const toggleSubscription = async () => {
    if (!company || subscriptionBusy) return
    if (!hasAuthenticatedSession()) {
      const result = await Taro.showModal({ title: '登录后订阅更新', content: '登录后可订阅企业岗位更新。', confirmText: '去登录' })
      if (result.confirm) navigateTo({ url: '/pages/profile/index' })
      return
    }
    setSubscriptionBusy(true)
    let addedFollow = false
    try {
      if (subscribed) {
        await setMatchNotifications(company.id, false, 'not_requested')
        await unfollowCompany(company.id)
        setFollowed(false)
        setSubscribed(false)
        showToast({ title: '已取消订阅', icon: 'success' })
        return
      }
      if (!subscriptionConfig.available || !subscriptionConfig.templateId) {
        showToast({ title: '微信订阅暂不可用，请稍后再试', icon: 'none' })
        return
      }
      if (!followed) {
        await followCompany(company.id)
        addedFollow = true
      }
      const accepted = await requestWechatNotice(subscriptionConfig.templateId)
      if (!accepted) {
        if (addedFollow) await unfollowCompany(company.id).catch(() => undefined)
        return
      }
      await setMatchNotifications(company.id, true, 'accepted')
      setFollowed(true)
      setSubscribed(true)
      showToast({ title: '已订阅企业更新', icon: 'success' })
    } catch (subscriptionError) {
      if (addedFollow) await unfollowCompany(company.id).catch(() => undefined)
      showToast({ title: subscriptionError instanceof Error ? subscriptionError.message : '订阅没有完成，请重试', icon: 'none' })
    } finally { setSubscriptionBusy(false) }
  }

  if (error) return <View className='page-shell'><View className='empty-state' aria-live='polite'><Text className='empty-state__title'>无法查看企业资料</Text><Text className='empty-state__copy'>{error}</Text><View className='empty-state__action' aria-role='button' aria-label='重新加载企业资料' hoverClass='mini-action--pressed' onClick={load}>重新加载</View></View></View>
  if (!company) return <View className='page-shell company-detail-loading'>正在加载企业资料…</View>

  const jobs = company.jobs || []
  const officialJobCount = jobs.length
  const renderJobs = (items = jobs) => items.length ? <View className='company-detail__jobs'>{items.map((job) => {
    const title = companyJobTitle(job)
    const facts = [job.location, job.jobType].map(safeJobFact).filter(Boolean)
    const salary = safeJobFact(job.salary)
    return <View className='company-job' aria-role='button' aria-label={`查看岗位 ${title}`} hoverClass='mini-action--pressed' key={job.id} onClick={() => navigateTo({ url: `/pages/job-detail/index?companyId=${encodeURIComponent(company.id)}&jobId=${encodeURIComponent(job.id)}${accessSearch ? `&search=${encodeURIComponent(accessSearch)}` : ''}` })}>
      <View className='company-job__icon'><MiniIcon name='briefcase' size={17} /></View>
      <View className='company-job__copy'>
        <Text>{title}</Text>
        <Text>{facts.length ? facts.join(' · ') : '查看岗位信息'}</Text>
      </View>
      {salary ? <Text className='company-job__salary'>{salary}</Text> : null}
      <MiniIcon name='chevronRight' size={17} />
    </View>
  })}</View> : <Text className='company-detail__empty-copy'>暂无公开岗位</Text>

  const contactSection = company.contacts?.length ? <View className='company-detail__contact-card'>
    <View className='company-detail__contact-title'><MiniIcon name='shield' size={20} /><Text>企业联系人</Text><Text className='company-detail__member-badge'>会员</Text></View>
    <View className='company-detail__contacts'>{company.contacts.map((contact) => {
      const copyValue = contact.email || contact.linkedin
      const contactMeta = [contact.name ? contact.title : '', contact.email || (contact.linkedin ? 'LinkedIn' : '')].filter(Boolean).join(' · ')
      return <View className='company-contact' key={contact.id}><View><Text>{contact.name || contact.title || '企业联系信息'}</Text><Text>{contactMeta}</Text></View><Text aria-role='button' aria-label={`复制 ${contact.name || contact.title || '联系信息'}`} onClick={() => void copyLink(copyValue, '联系信息已复制')}>复制</Text></View>
    })}</View>
  </View> : Number(company.contactCount || 0) > 0 ? <View className='company-detail__contact-card company-detail__contact-card--locked' aria-role='button' aria-label='查看会员企业联系人权益' hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/membership/index' })}><View className='company-detail__contact-icon'><MiniIcon name='shield' size={20} /></View><View><Text>企业联系人</Text><Text>会员专属 · 开通后可查看已收录联系人</Text></View><Text>查看权益 →</Text></View> : <Text className='company-detail__empty-copy'>暂未收录联系人</Text>

  return <View className='page-shell company-detail'>
    <View className='company-detail__summary'>
      <View className='company-detail__brand-row'>
        <View className='company-detail__mark'>{company.logoUrl && !logoFailed ? <Image src={company.logoUrl} mode='aspectFit' onError={() => setLogoFailed(true)} /> : <MiniIcon name='building' size={38} />}</View>
        <View className='company-detail__identity'><View><Text>{company.name}</Text>{company.tags[0] ? <Text>{company.tags[0]}</Text> : null}</View>{company.industry ? <Text>{company.industry}</Text> : null}{company.address ? <View><MiniIcon name='location' size={16} /><Text>{company.address}</Text></View> : null}</View>
      </View>
      <View className='company-detail__metrics'>
        <View><MiniIcon name='star' size={19} /><Text>{company.rating !== null ? company.rating.toFixed(1) : '—'}</Text><Text>{company.ratingSource || '企业评分'}</Text></View>
        <View><MiniIcon name='user' size={19} /><Text>{company.employeeCount ? employeeCountLabel(company.employeeCount) : '—'}</Text><Text>员工数</Text></View>
        <View><MiniIcon name='clock' size={19} /><Text>{company.foundedYear || '—'}</Text><Text>成立</Text></View>
        <View><MiniIcon name='briefcase' size={19} /><Text>{officialJobCount}</Text><Text>开放岗位</Text></View>
      </View>
    </View>

    <View className='company-detail__tabs' aria-role='tablist'>
      {([
        ['overview', '概览'],
        ['jobs', `职位 (${officialJobCount})`],
        ['culture', '文化']
      ] as const).map(([key, label]) => <View className={activeTab === key ? 'is-active' : ''} key={key} aria-role='tab' aria-selected={activeTab === key} onClick={() => setActiveTab(key)}><Text>{label}</Text></View>)}
    </View>

    <View className='company-detail__content'>
      {activeTab === 'overview' ? <>
        <View className='company-detail__section company-detail__about'><Text className='company-detail__eyebrow'>关于企业</Text><Text className='company-detail__body'>{company.description || '暂未收录公开企业介绍。'}</Text>{company.specialties.length ? <View className='company-detail__tags'>{company.specialties.map((item) => <Text key={item}>{item}</Text>)}</View> : null}</View>
        {contactSection}
        {jobs.length ? <View className='company-detail__section'><View className='company-detail__section-heading'><Text className='company-detail__eyebrow'>热门职位</Text>{jobs.length > 1 ? <Text aria-role='button' onClick={() => setActiveTab('jobs')}>查看全部</Text> : null}</View>{renderJobs(jobs.slice(0, 1))}</View> : null}
      </> : null}

      {activeTab === 'jobs' ? <View className='company-detail__section'><View className='company-detail__jobs-heading'><Text className='company-detail__eyebrow'>{officialJobCount} 个开放岗位</Text><Text className='company-detail__jobs-source'>岗位来自企业官网</Text></View>{renderJobs()}</View> : null}

      {activeTab === 'culture' ? <>
        <View className='company-detail__culture-facts'>
          {company.employeeCount ? <View><Text>团队规模</Text><Text>{company.employeeCount}</Text></View> : null}
          {company.foundedYear ? <View><Text>成立年份</Text><Text>{company.foundedYear}</Text></View> : null}
          {company.rating !== null ? <View><Text>{company.ratingSource || '企业评分'}</Text><Text>{company.rating.toFixed(1)} / 5.0</Text></View> : null}
          {company.address ? <View><Text>办公地点</Text><Text>{company.address}</Text></View> : null}
        </View>
        {company.remoteWork?.length ? <View className='company-detail__section'><Text className='company-detail__eyebrow'>远程协作特点</Text><View className='company-detail__tags'>{company.remoteWork.map((item) => <Text key={item}>{item}</Text>)}</View></View> : null}
        {company.culture?.length ? <View className='company-detail__section'><Text className='company-detail__eyebrow'>企业文化</Text><Blocks items={company.culture} /></View> : null}
        {company.ceoInsights?.length ? <View className='company-detail__section'><Text className='company-detail__eyebrow'>CEO 洞察</Text><Blocks items={company.ceoInsights} /></View> : null}
        {company.insightsLocked ? <View className='company-detail__contact-card company-detail__contact-card--locked' aria-role='button' aria-label='查看会员企业研究权益' hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/membership/index' })}><View className='company-detail__contact-icon'><MiniIcon name='club' size={20} /></View><View><Text>企业研究</Text><Text>会员可继续阅读企业文化与公开访谈整理</Text></View><Text>升级 →</Text></View> : null}
      </> : null}
    </View>

    <View className='company-detail__footer'>
      <View className={`company-detail__subscribe ${subscriptionBusy ? 'is-busy' : ''}`} aria-role='button' aria-disabled={subscriptionBusy} aria-label={subscribed ? `取消订阅 ${company.name} 更新` : `订阅 ${company.name} 更新`} hoverClass='mini-action--pressed' onClick={subscriptionBusy ? undefined : () => void toggleSubscription()}>{subscriptionBusy ? '正在处理…' : subscribed ? '取消订阅' : '订阅更新'}</View>
      {company.careersUrl || company.websiteUrl ? <View className='company-detail__website' aria-role='button' hoverClass='mini-action--pressed' onClick={() => void copyLink(company.careersUrl || company.websiteUrl || '', '官网链接已复制')}>复制官网链接</View> : null}
    </View>
  </View>
}
