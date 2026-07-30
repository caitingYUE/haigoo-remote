import { Button, Image, Input, ScrollView, Text, View } from '@tarojs/components'
import { Check } from '@nutui/icons-react-taro'
import { setNavigationBarTitle, setTabBarItem, showModal, showToast, switchTab, useDidShow } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import JobCard from '../../components/job-card'
import MiniIcon from '../../components/mini-icon'
import WebsiteNotice from '../../components/website-notice'
import { buildSubscriptionTopicGroups } from '../../data/subscription-topic-groups'
import { loginWithWechat } from '../../services/mini-auth-service'
import {
  fetchSubscriptionFeed,
  getSubscriptionTopics,
  saveSubscriptionTopics,
  type SubscriptionFeed,
  type SubscriptionOption
} from '../../services/subscription-service'
import { getMiniSessionToken, getMiniUser, hasAuthenticatedSession } from '../../services/session'
import { purchaseClubPlan } from '../../services/virtual-payment-service'
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
    id: 'club_starter_monthly',
    memberType: 'starter',
    name: '远程入门启动方案',
    clubName: 'Club Starter',
    price: '¥99',
    unit: '/ 30 天',
    who: '适合首次尝试远程工作、准备第一轮有效申请的人。',
    features: ['简历文字诊断', '简历修改建议', '3–5 个站内岗位推荐', '远程入门准备材料', '30 天网站及小程序 Club 权益']
  },
  {
    id: 'club_half_year',
    memberType: 'half_year',
    name: '远程求职陪伴方案',
    clubName: 'Club Member',
    price: '¥499',
    unit: '/ 6 个月',
    who: '适合明确寻找远程工作、希望持续推进申请的人。',
    featured: true,
    features: ['工作方向与简历初步诊断', '英文简历优化或语音咨询', '定制远程求职准备材料', '定向岗位挖掘 5–10 个', '6 个月网站及小程序 Club 权益']
  },
  {
    id: 'club_annual',
    memberType: 'annual',
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
  const [memberType, setMemberType] = useState('none')
  const [feed, setFeed] = useState<SubscriptionFeed>(EMPTY_FEED)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [topicSearch, setTopicSearch] = useState('')
  const [activeTopicGroup, setActiveTopicGroup] = useState(0)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payingPlanId, setPayingPlanId] = useState('')
  const [qrDialog, setQrDialog] = useState<QrDialog | null>(null)
  const [qrFailed, setQrFailed] = useState(false)

  const maximumTopics = Math.max(1, Number(feed.limits.maximum || DEFAULT_MAX_SUBSCRIPTION_TOPICS))

  const syncIdentity = useCallback(async () => {
    if (process.env.TARO_ENV === 'weapp' && getMiniSessionToken()) {
      await loginWithWechat().catch((error) => {
        console.warn('[subscription] identity refresh failed', error)
      })
    }
    const miniUser = getMiniUser()
    const member = Boolean(miniUser?.isMember)
    setIsMember(member)
    setMemberType(member ? String(miniUser?.memberType || 'none') : 'none')
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

  const allTopicOptions = useMemo(() => {
    const optionMap = new Map<string, SubscriptionOption>()
    feed.options.forEach((option) => optionMap.set(option.value, option))
    selectedTopics.forEach((topic) => {
      if (!optionMap.has(topic)) optionMap.set(topic, { value: topic, label: topic, count: 0 })
    })
    return [...optionMap.values()]
  }, [feed.options, selectedTopics])

  const topicGroups = useMemo(
    () => buildSubscriptionTopicGroups(allTopicOptions),
    [allTopicOptions]
  )

  const topicOptions = useMemo(() => {
    const search = normalizeSearch(topicSearch)
    const groupOptions = topicGroups[activeTopicGroup]?.options || []
    const source = search ? allTopicOptions : groupOptions
    return [...source]
      .filter((option) => !search || fuzzyMatches(`${option.label}${option.value}`, search))
      .sort((a, b) => {
        const aSelected = selectedTopics.includes(a.value) ? 0 : 1
        const bSelected = selectedTopics.includes(b.value) ? 0 : 1
        return aSelected - bSelected || a.label.localeCompare(b.label, 'zh-CN')
      })
  }, [activeTopicGroup, allTopicOptions, selectedTopics, topicGroups, topicSearch])

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
      copy: '添加 Haigoo 顾问，了解适合人群、方案内容与服务边界。购买 Club 权益请使用页面内的微信官方支付。',
      image: ADVISOR_QR
    })
  }

  const handlePurchase = async (plan: typeof MEMBER_PLANS[number]) => {
    if (payingPlanId) return
    if (!hasAuthenticatedSession()) {
      const result = await showModal({
        title: '登录后购买 Club 权益',
        content: '请先在“我的”页面绑定 Haigoo 网站账号，再返回此页完成微信支付。',
        confirmText: '前往登录'
      })
      if (result.confirm) await switchTab({ url: '/pages/profile/index' })
      return
    }
    const confirmation = await showModal({
      title: `确认购买 ${plan.clubName}`,
      content: `${plan.name}，价格 ${plan.price}${plan.unit}。支付成功后，网站与小程序 Club 权益将同步生效。点击“微信支付”即表示已阅读并同意用户服务协议和隐私政策。`,
      confirmText: '微信支付'
    })
    if (!confirmation.confirm) return

    setPayingPlanId(plan.id)
    try {
      const order = await purchaseClubPlan(plan.id)
      if (order.status === 'completed') {
        await loginWithWechat()
        await syncIdentity()
        showToast({ title: 'Club 权益已开通', icon: 'success' })
        return
      }
      showModal({
        title: '支付结果确认中',
        content: '微信正在确认支付结果。请稍后重新进入 Club 页面，到账后权益会自动生效。',
        showCancel: false
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '微信支付未完成，请稍后重试'
      if (message !== '已取消支付') {
        showModal({ title: '支付未完成', content: message, showCancel: false })
      }
    } finally {
      setPayingPlanId('')
    }
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
        <Text className='membership-page__consult' onClick={() => openAdvisor()}>咨询方案</Text>
      </View>
      <View className='membership-plan-list'>
        {MEMBER_PLANS.map((plan) => {
          const isCurrentPlan = isMember && memberType === plan.memberType
          const canPurchase = !isMember || isCurrentPlan
          const buttonLabel = payingPlanId === plan.id
            ? '正在拉起微信支付…'
            : isCurrentPlan
              ? '续费当前方案'
              : isMember
                ? '到期后可更换'
                : '立即开通'
          return (
            <View
              className={`membership-plan-card ${plan.featured ? 'membership-plan-card--featured' : ''}`}
              key={plan.clubName}
            >
              <View className='membership-plan-card__header'>
                <View>
                  <Text className='membership-plan-card__name'>{plan.name}</Text>
                  <Text className='membership-plan-card__club'>{plan.clubName}</Text>
                </View>
                {isCurrentPlan
                  ? <Text className='membership-plan-card__badge'>当前方案</Text>
                  : plan.featured
                    ? <Text className='membership-plan-card__badge'>推荐</Text>
                    : null}
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
              <View
                className={`membership-plan-card__button ${payingPlanId === plan.id || !canPurchase ? 'membership-plan-card__button--disabled' : ''}`}
                onClick={() => {
                  if (canPurchase) void handlePurchase(plan)
                }}
              >
                <Text>{buttonLabel}</Text>
              </View>
            </View>
          )
        })}
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
          <Text className='membership-contact-card__title'>顾问咨询</Text>
          <Text className='membership-contact-card__copy'>了解方案内容、适合人群与服务边界</Text>
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
            <Text className='subscription-hero__title'>我订阅的岗位更新</Text>
            <Text className='subscription-hero__copy'>小程序与订阅邮件保持同步，方便随时查看最近一次发送的岗位更新。</Text>
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
            {!topicSearch && topicGroups.length > 0 ? (
              <ScrollView className='subscription-topic-groups' scrollX enhanced showScrollbar={false}>
                <View className='subscription-topic-groups__inner'>
                  {topicGroups.map((group, index) => (
                    <View
                      className={'subscription-topic-group ' + (activeTopicGroup === index ? 'subscription-topic-group--active' : '')}
                      key={group.title}
                      onClick={() => setActiveTopicGroup(index)}
                    >
                      <Text>{group.title}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : null}
            <View className='subscription-topic-list'>
              {topicOptions.map((topic) => (
                <View
                  className={'subscription-topic ' + (selectedTopics.includes(topic.value) ? 'subscription-topic--active' : '')}
                  key={topic.value}
                  onClick={() => toggleTopic(topic.value)}
                >
                  <Text>{topic.label}</Text>
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
              <Text className='subscription-page__title'>最近岗位更新</Text>
              <Text className='subscription-page__note'>仅展示最近一次实际发送到邮箱的岗位，每次不超过 5 个</Text>
            </View>
          </View>
          {loading ? (
            <View className='subscription-empty surface-card'><Text>正在同步你的岗位更新…</Text></View>
          ) : feed.jobs.length > 0 ? (
            feed.jobs.map((job) => <JobCard job={job} key={job.id} />)
          ) : (
            <View className='subscription-empty surface-card'>
              <Text className='subscription-empty__title'>{hasSubscription ? '暂时没有新的岗位更新' : '还没有设置订阅方向'}</Text>
              <Text className='subscription-empty__copy'>{hasSubscription ? '当下一封岗位邮件发出后，小程序会同步展示相同岗位。' : '请先从上方选择关注的岗位方向并保存。'}</Text>
            </View>
          )}
          <WebsiteNotice />
        </>
      ) : (
        <>
          <View className='membership-hero'>
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
