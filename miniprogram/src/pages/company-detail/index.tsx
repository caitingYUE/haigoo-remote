import { Text, View } from '@tarojs/components'
import { createSelectorQuery, navigateTo, nextTick, setClipboardData, showToast, useDidShow, useResize, useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import ContentSkeleton from '../../components/content-skeleton'
import CompanyLogo from '../../components/company-logo'
import CompanyFollowAction from '../../components/company-follow-action'
import MiniIcon from '../../components/mini-icon'
import WechatReminderAction, { requestWechatReminderAuthorization } from '../../components/wechat-reminder-action'
import useMiniShare from '../../hooks/use-mini-share'
import useRetainedResource, { miniContentScope } from '../../hooks/use-retained-resource'
import { fetchCompanyDetail } from '../../services/content-service'
import { fetchCareerWatch, fetchCompanyFollows, setMatchNotifications } from '../../services/career-match-service'
import { refreshWechatSessionIfStale } from '../../services/mini-auth-service'
import { emitCompanyFollowChange, invalidateReminderSnapshot } from '../../services/company-follow-state'
import { hasAuthenticatedSession } from '../../services/session'
import type { ContentBlock, MemberOnlyContact, MiniCompanyJob } from '../../types'
import { formatCalendarDate } from '../../utils/runtime-compat'
import { buildCompanyContactsCopy } from '../../utils/company-contacts-copy'
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
  const resourceKey = `company-detail:${id}:${accessSearch}`
  const { data, refreshing, error, load: loadResource } = useRetainedResource<Awaited<ReturnType<typeof fetchCompanyDetail>>>(resourceKey)
  const company = data?.company || null
  const access = data?.access || null
  const [followed, setFollowed] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [subscriptionConfig, setSubscriptionConfig] = useState({ available: false, templateId: '' })
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'culture'>('overview')
  const [footerHeight, setFooterHeight] = useState(0)
  const loadSequence = useRef(0)
  const secondaryScope = useRef('')
  useEffect(() => () => { loadSequence.current++ }, [])
  const measureFooter = useCallback(() => {
    nextTick(() => {
      createSelectorQuery().select('.company-detail__footer').boundingClientRect((rect) => {
        if (rect && !Array.isArray(rect) && rect.height > 0) setFooterHeight(rect.height)
      }).exec()
    })
  }, [])
  useEffect(measureFooter, [measureFooter, company, followed, subscribed, error])
  useResize(measureFooter)
  useMiniShare(company ? `${company.name}｜远程企业资料` : 'Haigoo 远程企业资料', `/pages/company-detail/index?id=${encodeURIComponent(id)}${accessSearch ? `&search=${encodeURIComponent(accessSearch)}` : ''}`)
  const load = useCallback(async (force = false) => {
    const sequence = ++loadSequence.current
    const scope = miniContentScope()
    const authenticated = hasAuthenticatedSession()
    const emptyFollows = { success: true as const, follows: [] as Array<{ company_id: string; name: string; industry: string; wechat_enabled?: boolean; wechat_template_status?: string }> }
    const detailRequest = loadResource(resourceKey, () => fetchCompanyDetail(id, force, accessSearch), force)
    if (!force && secondaryScope.current === scope) { await detailRequest; return }
    const [follows, watch] = await Promise.all([
      authenticated ? fetchCompanyFollows().catch(() => null) : Promise.resolve(emptyFollows),
      authenticated ? fetchCareerWatch().catch(() => null) : Promise.resolve(null)
    ])
    await detailRequest
    if (sequence !== loadSequence.current || scope !== miniContentScope()) return
    if (follows && (!authenticated || watch)) secondaryScope.current = scope
    if (!follows) return
    const companyFollow = follows.follows.find((item) => String(item.company_id) === id)
    setFollowed(Boolean(companyFollow))
    setSubscribed(Boolean(companyFollow?.wechat_enabled && companyFollow.wechat_template_status === 'accepted'))
    setSubscriptionConfig({
      available: Boolean(watch?.entitlements.wechatSubscriptionAvailable),
      templateId: String(watch?.entitlements.wechatTemplateId || '')
    })
  }, [accessSearch, id, loadResource, resourceKey])
  useDidShow(() => {
    const previousScope = miniContentScope()
    if (!hasAuthenticatedSession()) { void load(false); return }
    void refreshWechatSessionIfStale().catch(() => null).then(() => {
      if (previousScope !== miniContentScope()) void load(true)
      else void load(false)
    })
  })

  const requestReminderAfterFollow = async () => {
    const scope = miniContentScope()
    invalidateReminderSnapshot()
    if (!subscriptionConfig.available || !subscriptionConfig.templateId) {
      showToast({ title: '已关注，可稍后开启微信提醒', icon: 'none' })
      return
    }
    try {
      const status = await requestWechatReminderAuthorization(subscriptionConfig.templateId)
      if (scope !== miniContentScope()) return
      if (status === 'accepted') {
        await setMatchNotifications(id, true, status)
        if (scope !== miniContentScope()) return
        emitCompanyFollowChange({ companyId: id, followed: true, reminderEnabled: true })
        setSubscribed(true)
        showToast({ title: '已预约下一次上新提醒', icon: 'success' })
      } else {
        await setMatchNotifications(id, false, status).catch(() => undefined)
        if (scope !== miniContentScope()) return
        emitCompanyFollowChange({ companyId: id, followed: true, reminderEnabled: false })
        setSubscribed(false)
        showToast({ title: status === 'unavailable' ? '请在小程序设置中开启订阅消息' : '已关注，可稍后开启微信提醒', icon: 'none' })
      }
    } catch {
      if (scope !== miniContentScope()) return
      setSubscribed(false)
      showToast({ title: '微信提醒未开启，关注状态已保留', icon: 'none' })
    }
  }

  if (error) return <View className='page-shell'><View className='empty-state' aria-live='polite'><Text className='empty-state__title'>无法查看企业资料</Text><Text className='empty-state__copy'>{error}</Text><View className='empty-state__action' aria-role='button' aria-label='重新加载企业资料' hoverClass='mini-action--pressed' onClick={() => void load(true)}>重新加载</View></View></View>
  if (!company) return <View className='page-shell company-detail-loading'><ContentSkeleton rows={4} /></View>

  const jobs = company.jobs || []
  const officialJobCount = jobs.length
  const renderJobs = (items = jobs) => items.length ? <View className='company-detail__jobs'>{items.map((job) => {
    const title = companyJobTitle(job)
    const facts = [job.jobType, job.location].map(safeJobFact).filter(Boolean)
    const salary = safeJobFact(job.salary)
    const publishedAt = formatCalendarDate(job.publishedAt)
    return <View className='company-job' aria-role='button' aria-label={`查看岗位 ${title}`} hoverClass='mini-action--pressed' key={job.id} onClick={() => navigateTo({ url: `/pages/job-detail/index?companyId=${encodeURIComponent(company.id)}&jobId=${encodeURIComponent(job.id)}${accessSearch ? `&search=${encodeURIComponent(accessSearch)}` : ''}` })}>
      <View className='company-job__copy'>
        <View className='company-job__heading'><Text className='company-job__title'>{title}</Text>{salary ? <Text className='company-job__salary'>{salary}</Text> : null}</View>
        {facts.length ? <Text className='company-job__facts'>{facts.join(' · ')}</Text> : null}
        {publishedAt ? <Text className='company-job__date'>{publishedAt} 发布</Text> : null}
      </View>
      <MiniIcon name='chevronRight' size={17} />
    </View>
  })}</View> : <Text className='company-detail__empty-copy'>暂无公开岗位</Text>

  const fullContacts = company.contacts || []
  const previews = company.contactPreviews || []
  const renderContactChannels = (contact: MemberOnlyContact) => <View className='company-contact__channels'>
    <View className={`company-contact__channel ${contact.email?.trim() ? 'is-available' : ''}`} aria-label={contact.email?.trim() ? '已收录工作邮箱' : '未收录工作邮箱'}>
      <MiniIcon name='mail' size={18} />{contact.email?.trim() ? <MiniIcon name='check' size={12} /> : null}
    </View>
    <View className={`company-contact__channel ${contact.linkedin?.trim() ? 'is-available' : ''}`} aria-label={contact.linkedin?.trim() ? '已收录 LinkedIn' : '未收录 LinkedIn'}>
      <Text className='company-contact__linkedin'>in</Text>{contact.linkedin?.trim() ? <MiniIcon name='check' size={12} /> : null}
    </View>
  </View>
  const contactSection = access?.contacts && fullContacts.length ? <View className='company-detail__contact-card'>
    <View className='company-detail__contact-title'><MiniIcon name='shield' size={20} /><Text>企业联系人</Text><Text className='company-detail__member-badge'>会员</Text></View>
    <View className='company-detail__contacts'>{fullContacts.map((contact) => <View className='company-contact' key={contact.id}><View className='company-contact__identity'><Text>{contact.name || contact.title || '企业联系信息'}</Text><Text>{contact.title || '企业联系人'}</Text></View>{renderContactChannels(contact)}</View>)}</View>
    <View className='company-detail__copy-contacts' aria-role='button' aria-label='复制全部联系人信息' hoverClass='mini-action--pressed' onClick={() => void copyLink(buildCompanyContactsCopy(company.name, fullContacts), '联系人信息已复制')}><MiniIcon name='orders' size={18} /><Text>一键复制联系人</Text></View>
  </View> : previews.length ? <View className='company-detail__contact-card company-detail__contact-card--preview'>
    <View className='company-detail__contact-title'><MiniIcon name='shield' size={20} /><Text>企业联系人</Text><Text className='company-detail__member-badge'>会员可见</Text></View>
    <View className='company-detail__contacts'>{previews.map((contact) => <View className='company-contact company-contact--preview' key={contact.id}><View className='company-contact__identity'><Text>{contact.maskedName}</Text><Text>{contact.title || '企业联系人'}</Text></View><MiniIcon name='shield' size={17} /></View>)}</View>
    <View className='company-detail__unlock' aria-role='button' aria-label='查看会员企业联系人权益' hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/membership/index' })}>查看会员权益</View>
  </View> : access?.contacts && Number(company.contactCount || 0) > 0 ? <View className='company-detail__contact-card'><Text className='company-detail__contact-error'>联系人信息暂时无法加载</Text><Text className='company-detail__unlock' aria-role='button' onClick={() => void load()}>重新加载</Text></View> : Number(company.contactCount || 0) > 0 ? <View className='company-detail__contact-card company-detail__contact-card--locked' aria-role='button' aria-label='查看会员企业联系人权益' hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/membership/index' })}><View className='company-detail__contact-icon'><MiniIcon name='shield' size={20} /></View><View><Text>已收录企业联系人</Text><Text>升级会员后可查看联系人信息</Text></View><Text>查看权益 →</Text></View> : null

  return <View className='page-shell company-detail' aria-busy={refreshing} style={footerHeight ? { paddingBottom: `${footerHeight}px` } : undefined}>
    <View className='company-detail__summary'>
      <View className='company-detail__brand-row'>
        <View className='company-detail__mark'><CompanyLogo name={company.name} logoUrl={company.logoUrl} logoFileId={company.logoFileId} /></View>
        <View className='company-detail__identity'><View className='company-detail__name-row'><Text className='company-detail__name'>{company.name}</Text>{company.tags[0] ? <Text className='company-detail__badge'>{company.tags[0]}</Text> : null}</View>{company.industry ? <Text className='company-detail__industry'>{company.industry}</Text> : null}{company.address ? <View className='company-detail__location'><MiniIcon name='location' size={16} /><Text>{company.address}</Text></View> : null}</View>
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
        {jobs.length ? <View className='company-detail__section company-detail__popular'><View className='company-detail__section-heading'><Text className='company-detail__eyebrow'>热门职位</Text>{jobs.length > 1 ? <Text className='company-detail__view-all' aria-role='button' onClick={() => setActiveTab('jobs')}>查看全部</Text> : null}</View>{renderJobs(jobs.slice(0, 1))}</View> : null}
      </> : null}

      {activeTab === 'jobs' ? <View className='company-detail__section'><View className='company-detail__jobs-heading'><Text className='company-detail__eyebrow'>岗位数据来自企业官网公开信息</Text></View>{renderJobs()}</View> : null}

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
      <View className='company-detail__follow-control'><CompanyFollowAction companyId={company.id} companyName={company.name} followed={followed} reminderEnabled={subscribed} unfollowedLabel='订阅更新' onChanged={(nextFollowed) => { setFollowed(nextFollowed); if (!nextFollowed) setSubscribed(false); else void requestReminderAfterFollow() }} /></View>
      {followed ? <View className='company-detail__reminder-control'><WechatReminderAction companyId={company.id} available={subscriptionConfig.available} templateId={subscriptionConfig.templateId} enabled={subscribed} onChanged={setSubscribed} /></View> : null}
      {company.careersUrl || company.websiteUrl ? <View className='company-detail__website' aria-role='button' hoverClass='mini-action--pressed' onClick={() => void copyLink(company.careersUrl || company.websiteUrl || '', '官网链接已复制')}>复制官网链接</View> : null}
    </View>
  </View>
}
