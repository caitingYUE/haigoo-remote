import { Button, Image, Input, Text, View } from '@tarojs/components'
import { Check } from '@nutui/icons-react-taro'
import { setNavigationBarTitle, setTabBarItem, showModal, showToast, useDidShow } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import JobCard from '../../components/job-card'
import MiniIcon from '../../components/mini-icon'
import WebsiteNotice from '../../components/website-notice'
import { loginWithWechat } from '../../services/mini-auth-service'
import {
  fetchSubscriptionFeed,
  getSubscriptionTopics,
  saveSubscriptionTopics,
  type SubscriptionFeed,
  type SubscriptionOption
} from '../../services/subscription-service'
import { getMiniSessionToken, getMiniUser } from '../../services/session'
import './index.scss'

const DEFAULT_MAX_SUBSCRIPTION_TOPICS = 8
const EMPTY_FEED: SubscriptionFeed = {
  subscriptions: [],
  jobs: [],
  options: [],
  limits: { recommended: 5, maximum: DEFAULT_MAX_SUBSCRIPTION_TOPICS }
}

const MEMBER_PLANS = [
  {
    name: '远程入门启动方案',
    clubName: 'Club Starter',
    price: '¥99',
    unit: '/ 30 天',
    who: '适合首次尝试远程工作、准备第一轮有效申请的人。',
    features: ['简历文字诊断', '简历修改建议', '3–5 个站内岗位推荐', '远程入门准备材料', '30 天网站及小程序会员权限']
  },
  {
    name: '远程求职陪伴方案',
    clubName: 'Club Member',
    price: '¥499',
    unit: '/ 6 个月',
    who: '适合明确寻找远程工作、希望持续推进申请的人。',
    featured: true,
    features: ['工作方向与简历初步诊断', '英文简历优化或语音咨询', '定制远程求职准备材料', '定向岗位挖掘 5–10 个', '6 个月网站及小程序会员权限']
  },
  {
    name: '远程职业共建方案',
    clubName: 'Club Partner',
    price: '¥998',
    unit: '/ 年',
    who: '适合长期远程工作者，将企业和行业连接沉淀为职业资源。',
    features: ['包含 Club Member 全部支持', '一次年度远程职业规划', '优先参与主题交流', '共建讨论与同行连接', '岗位发布与品牌传播支持']
  }
]

const ADVISOR_QR = '/assets/haigoo-advisor.png'
const COMMUNITY_QR = '/assets/haigoo-community.png'

interface QrDialog {
  title: string
  copy: string
  image: string
}

function normalizeSearch(value: string) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '')
}

function fuzzyMatches(value: string, query: string) {
  const haystack = normalizeSearch(value)
  const needle = normalizeSearch(query)
  if (!needle) return true
  if (haystack.includes(needle)) return true
  let offset = 0
  for (const character of haystack) {
    if (character === needle[offset]) offset += 1
    if (offset === needle.length) return true
  }
  return false
}

export default function LearningPage() {
  const [isMember, setIsMember] = useState(false)
  const [feed, setFeed] = useState<SubscriptionFeed>(EMPTY_FEED)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [topicSearch, setTopicSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [qrDialog, setQrDialog] = useState<QrDialog | null>(null)
  const [qrFailed, setQrFailed] = useState(false)

  const maximumTopics = Math.max(1, Number(feed.limits.maximum || DEFAULT_MAX_SUBSCRIPTION_TOPICS))

  const syncIdentity = useCallback(async () => {
    if (process.env.TARO_ENV === 'weapp' && getMiniSessionToken()) {
      await loginWithWechat().catch((error) => {
        console.warn('[subscription] identity refresh failed', error)
      })
    }
    const member = Boolean(getMiniUser()?.isMember)
    setIsMember(member)
    setTabBarItem({ index: 2, text: 'Club' })
    setNavigationBarTitle({ title: 'Club' })
    if (!member) {
      setFeed(EMPTY_FEED)
      setSelectedTopics([])
      return
    }
    setLoading(true)
    try {
      const nextFeed = await fetchSubscriptionFeed()
      setFeed(nextFeed)
      const activeSubscriptions = nextFeed.subscriptions.filter((subscription) => (
        String(subscription.status || 'active') === 'active'
      ))
      const subscriptionSource = activeSubscriptions.length > 0 ? activeSubscriptions : nextFeed.subscriptions.slice(0, 1)
      setSelectedTopics([
        ...new Set(subscriptionSource.flatMap(getSubscriptionTopics))
      ].slice(0, nextFeed.limits.maximum || DEFAULT_MAX_SUBSCRIPTION_TOPICS))
    } catch (error) {
      showToast({ title: error instanceof Error ? error.message : '订阅数据加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => { syncIdentity() })

  const topicOptions = useMemo(() => {
    const optionMap = new Map<string, SubscriptionOption>()
    feed.options.forEach((option) => optionMap.set(option.value, option))
    selectedTopics.forEach((topic) => {
      if (!optionMap.has(topic)) optionMap.set(topic, { value: topic, label: topic, count: 0 })
    })
    const search = normalizeSearch(topicSearch)
    return [...optionMap.values()]
      .filter((option) => !search || fuzzyMatches(`${option.label}${option.value}`, search))
      .sort((a, b) => {
        const aSelected = selectedTopics.includes(a.value) ? 0 : 1
        const bSelected = selectedTopics.includes(b.value) ? 0 : 1
        return aSelected - bSelected || b.count - a.count || a.label.localeCompare(b.label, 'zh-CN')
      })
      .slice(0, search ? 30 : 24)
  }, [feed.options, selectedTopics, topicSearch])

  const toggleTopic = (topic: string) => {
    setSelectedTopics((topics) => {
      if (topics.includes(topic)) return topics.filter((item) => item !== topic)
      if (topics.length >= maximumTopics) {
        showToast({ title: `最多订阅 ${maximumTopics} 个方向`, icon: 'none' })
        return topics
      }
      return [...topics, topic]
    })
  }

  const handleSave = async () => {
    if (selectedTopics.length === 0) {
      showToast({ title: '请至少选择一个岗位方向', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      await saveSubscriptionTopics(selectedTopics)
      await syncIdentity()
      showToast({ title: '订阅已保存，邮箱和小程序将同步更新', icon: 'success' })
    } catch (error) {
      showModal({ title: '保存失败', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false })
    } finally {
      setSaving(false)
    }
  }

  const openAdvisor = (planName?: string) => {
    setQrFailed(false)
    setQrDialog({
      title: planName ? `了解 ${planName}` : '添加顾问了解',
      copy: '当前版本暂不支持小程序内支付。添加 Haigoo 顾问后，可了解适合人群、服务边界和开通方式。',
      image: ADVISOR_QR
    })
  }

  const openCommunity = () => {
    setQrFailed(false)
    setQrDialog({
      title: '加入微信交流群',
      copy: '长按识别二维码，交流远程岗位、申请与求职准备。',
      image: COMMUNITY_QR
    })
  }

  const hasSubscription = feed.subscriptions.some((subscription) => String(subscription.status || 'active') === 'active')

  const clubBenefits = (
    <>
      <View className='membership-page__heading'>
        <View>
          <Text className='membership-page__title'>Club 权益方案</Text>
          <Text className='membership-page__note'>按求职阶段选择适合自己的支持方式</Text>
        </View>
        <Text className='membership-page__consult' onClick={() => openAdvisor()}>咨询开通</Text>
      </View>
      <View className='membership-plan-list'>
        {MEMBER_PLANS.map((plan) => (
          <View className={`membership-plan-card ${plan.featured ? 'membership-plan-card--featured' : ''}`} key={plan.clubName}>
            <View className='membership-plan-card__header'>
              <View>
                <Text className='membership-plan-card__name'>{plan.name}</Text>
                <Text className='membership-plan-card__club'>{plan.clubName}</Text>
              </View>
              {plan.featured ? <Text className='membership-plan-card__badge'>推荐</Text> : null}
            </View>
            <View className='membership-plan-card__price-row'>
              <Text className='membership-plan-card__price'>{plan.price}</Text>
              <Text className='membership-plan-card__unit'>{plan.unit}</Text>
            </View>
            <Text className='membership-plan-card__who'>{plan.who}</Text>
            <View className='membership-plan-card__features'>
              {plan.features.map((feature) => (
                <View className='membership-plan-card__feature' key={feature}>
                  <Check size={16} color='#5146e5' />
                  <Text>{feature}</Text>
                </View>
              ))}
            </View>
            <View className='membership-plan-card__button' onClick={() => openAdvisor(plan.clubName)}>
              <Text>添加顾问了解</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  )

  const supportSection = (
    <>
      <View className='membership-page__heading membership-page__heading--support'>
        <View>
          <Text className='membership-page__title'>咨询与交流</Text>
          <Text className='membership-page__note'>添加顾问，了解方案或加入交流群</Text>
        </View>
      </View>
      <View className='membership-contact-grid'>
        <View className='membership-contact-card' onClick={() => openAdvisor()}>
          <Text className='membership-contact-card__title'>顾问咨询开通</Text>
          <Text className='membership-contact-card__copy'>了解方案、适合人群与开通安排</Text>
          <Image className='membership-contact-card__qr' src={ADVISOR_QR} mode='aspectFit' />
          <Text className='membership-contact-card__action'>点击放大二维码</Text>
        </View>
        <View className='membership-contact-card' onClick={openCommunity}>
          <Text className='membership-contact-card__title'>微信交流群</Text>
          <Text className='membership-contact-card__copy'>交流远程岗位、申请与求职准备</Text>
          <Image className='membership-contact-card__qr' src={COMMUNITY_QR} mode='aspectFit' />
          <Text className='membership-contact-card__action'>点击放大二维码</Text>
        </View>
      </View>
    </>
  )

  return (
    <View className={`page-shell membership-page ${isMember ? 'subscription-page' : ''}`}>
      {isMember ? (
        <>
          <View className='subscription-hero'>
            <Text className='subscription-hero__eyebrow'>MY JOB UPDATES</Text>
            <Text className='subscription-hero__title'>我订阅的岗位更新</Text>
            <Text className='subscription-hero__copy'>保存方向后，每日新岗位会同时推送至邮箱，并沉淀在这里方便查看。</Text>
          </View>
          <View className='subscription-page__heading'>
            <View>
              <Text className='subscription-page__title'>{hasSubscription ? '订阅方向' : '先设置你的订阅方向'}</Text>
              <Text className='subscription-page__note'>
                建议选择 {feed.limits.recommended} 个方向，最多 {maximumTopics} 个；保存后邮箱与小程序同步。
              </Text>
            </View>
            <Text className='subscription-page__count'>{selectedTopics.length}/{maximumTopics}</Text>
          </View>
          <View className='subscription-topic-picker surface-card'>
            <View className='subscription-topic-search'>
              <MiniIcon name='search' size={21} />
              <Input
                className='subscription-topic-search__input'
                value={topicSearch}
                placeholder='搜索岗位方向'
                onInput={(event) => setTopicSearch(event.detail.value)}
              />
            </View>
            <View className='subscription-topic-list'>
              {topicOptions.map((topic) => (
                <View
                  className={'subscription-topic ' + (selectedTopics.includes(topic.value) ? 'subscription-topic--active' : '')}
                  key={topic.value}
                  onClick={() => toggleTopic(topic.value)}
                >
                  <Text>{topic.label}</Text>
                  {topic.count > 0 ? <Text className='subscription-topic__count'>{topic.count}</Text> : null}
                </View>
              ))}
            </View>
            {topicOptions.length === 0 ? (
              <Text className='subscription-topic-picker__empty'>当前真实岗位分类中没有匹配结果，请尝试其他关键词。</Text>
            ) : null}
          </View>
          <Button className='subscription-save-button' loading={saving} disabled={saving} onClick={handleSave}>保存订阅方向</Button>

          <View className='subscription-page__heading subscription-page__heading--updates'>
            <View>
              <Text className='subscription-page__title'>最新匹配岗位</Text>
              <Text className='subscription-page__note'>保存后立即匹配当前岗位，后续与邮箱每日摘要同步</Text>
            </View>
          </View>
          {loading ? (
            <View className='subscription-empty surface-card'><Text>正在同步你的岗位更新…</Text></View>
          ) : feed.jobs.length > 0 ? (
            feed.jobs.map((job) => <JobCard job={job} key={job.id} />)
          ) : (
            <View className='subscription-empty surface-card'>
              <Text className='subscription-empty__title'>{hasSubscription ? '暂时没有新的匹配岗位' : '保存方向后，匹配岗位会出现在这里'}</Text>
              <Text className='subscription-empty__copy'>{hasSubscription ? '新的岗位更新会与邮件摘要同步出现。' : '你可以先从上方选择关注的岗位方向。'}</Text>
            </View>
          )}
          <WebsiteNotice />
        </>
      ) : (
        <>
          <View className='membership-hero'>
            <Text className='membership-hero__eyebrow'>HAIGOO REMOTE CLUB</Text>
            <Text className='membership-hero__title'>打开全球机会，从远程开始</Text>
            <Text className='membership-hero__copy'>免费版本，小程序远程岗位信息有限开放，网站全开放。你可以根据当前阶段，选择适合自己的 Club 权益方案。</Text>
          </View>
          <WebsiteNotice />
        </>
      )}

      {clubBenefits}
      {supportSection}

      {qrDialog ? (
        <View className='membership-qr-dialog' onClick={() => setQrDialog(null)}>
          <View
            className='membership-qr-dialog__panel'
            onClick={(event) => event.stopPropagation()}
          >
            <Text className='membership-qr-dialog__title'>{qrDialog.title}</Text>
            <Text className='membership-qr-dialog__copy'>{qrDialog.copy}</Text>
            {!qrFailed ? (
              <Image
                className='membership-qr-dialog__image'
                src={qrDialog.image}
                mode='aspectFit'
                showMenuByLongpress
                onError={() => setQrFailed(true)}
              />
            ) : (
              <Text className='membership-qr-dialog__error'>二维码暂时无法加载，请稍后重试或访问官网联系顾问。</Text>
            )}
            <Text className='membership-qr-dialog__hint'>长按二维码可识别或保存</Text>
            <View className='membership-qr-dialog__close' onClick={() => setQrDialog(null)}>
              <Text>关闭</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
