import { Button, Image, ScrollView, Text, View } from '@tarojs/components'
import { Check, Message, QrCode } from '@nutui/icons-react-taro'
import { previewImage, setNavigationBarTitle, setTabBarItem, showModal, showToast, useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import JobCard from '../../components/job-card'
import { loginWithWechat } from '../../services/mini-auth-service'
import { fetchSubscriptionFeed, getSubscriptionTopics, saveSubscriptionTopics, type SubscriptionFeed } from '../../services/subscription-service'
import { getMiniSessionToken, getMiniUser } from '../../services/session'
import './index.scss'

const SUBSCRIPTION_TOPICS = ['产品经理', '设计', '前端开发', '后端开发', '市场营销', '运营', '销售', '人力资源']
const MAX_SUBSCRIPTION_TOPICS = 8
const MEMBER_PLANS = [
  {
    name: '远程入门启动方案',
    clubName: 'Club Starter',
    price: '¥99',
    unit: '/ 30 天',
    who: '适合首次尝试远程工作、准备第一轮有效申请的人。',
    features: ['简历文字诊断', '简历修改建议', '3–5 个站内岗位推荐', '远程入门准备材料', '30 天网站会员权限']
  },
  {
    name: '远程求职陪伴方案',
    clubName: 'Club Member',
    price: '¥499',
    unit: '/ 6 个月',
    who: '适合明确寻找远程工作、希望持续推进申请的人。',
    featured: true,
    features: ['工作方向与简历初步诊断', '英文简历优化或语音咨询', '定制远程求职准备材料', '定向岗位挖掘 5–10 个', '6 个月网站会员权限']
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
const COMMUNITY_QR = '/assets/haigoo-community.webp'

export default function LearningPage() {
  const [isMember, setIsMember] = useState(false)
  const [feed, setFeed] = useState<SubscriptionFeed>({ subscriptions: [], jobs: [] })
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const syncIdentity = useCallback(async () => {
    if (process.env.TARO_ENV === 'weapp' && getMiniSessionToken()) {
      await loginWithWechat().catch((error) => {
        console.warn('[subscription] identity refresh failed', error)
      })
    }
    const member = Boolean(getMiniUser()?.isMember)
    setIsMember(member)
    setTabBarItem({ index: 2, text: member ? '订阅' : '会员' })
    setNavigationBarTitle({ title: member ? '岗位订阅' : '会员服务' })
    if (!member) {
      setFeed({ subscriptions: [], jobs: [] })
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
      setSelectedTopics([...new Set(subscriptionSource.flatMap(getSubscriptionTopics))].slice(0, MAX_SUBSCRIPTION_TOPICS))
    } catch (error) {
      showToast({ title: error instanceof Error ? error.message : '订阅数据加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => { syncIdentity() })

  const toggleTopic = (topic: string) => {
    setSelectedTopics((topics) => {
      if (topics.includes(topic)) return topics.filter((item) => item !== topic)
      if (topics.length >= MAX_SUBSCRIPTION_TOPICS) {
        showToast({ title: `最多订阅 ${MAX_SUBSCRIPTION_TOPICS} 个方向`, icon: 'none' })
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

  const showAdvisor = (planName?: string) => {
    showModal({
      title: planName ? `了解${planName}` : '添加顾问咨询开通',
      content: '当前版本暂不支持小程序内支付。添加 Haigoo 顾问后，可了解适合人群、服务边界和开通方式。',
      confirmText: '查看顾问二维码',
      success: ({ confirm }) => {
        if (confirm) previewImage({ current: ADVISOR_QR, urls: [ADVISOR_QR] })
      }
    })
  }

  const showCommunity = () => {
    showToast({ title: '长按二维码可识别加入交流群', icon: 'none' })
    previewImage({ current: COMMUNITY_QR, urls: [COMMUNITY_QR] })
  }

  if (!isMember) {
    return (
      <View className='page-shell membership-page'>
        <View className='membership-hero'>
          <Text className='membership-hero__eyebrow'>HAIGOO REMOTE CLUB</Text>
          <Text className='membership-hero__title'>让每一次远程求职{'\n'}都更有准备</Text>
          <Text className='membership-hero__copy'>会员服务将岗位机会、主动订阅与求职支持放到同一条成长路径里。</Text>
        </View>
        <View className='membership-page__heading'>
          <View>
            <Text className='membership-page__title'>三种会员方案</Text>
            <Text className='membership-page__note'>按求职阶段选择适合自己的支持方式</Text>
          </View>
          <Text className='membership-page__consult' onClick={() => showAdvisor()}>咨询开通</Text>
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
              <View className='membership-plan-card__button' onClick={() => showAdvisor(plan.clubName)}>
                <Text>添加顾问了解</Text>
              </View>
            </View>
          ))}
        </View>

        <View className='membership-page__heading membership-page__heading--support'>
          <View>
            <Text className='membership-page__title'>咨询与交流</Text>
            <Text className='membership-page__note'>无需在小程序内支付，也可以先了解服务</Text>
          </View>
        </View>
        <View className='membership-contact-grid'>
          <View className='membership-contact-card' onClick={() => showAdvisor()}>
            <View className='membership-contact-card__icon'><Message size={23} color='#5146e5' /></View>
            <Text className='membership-contact-card__title'>顾问咨询开通</Text>
            <Text className='membership-contact-card__copy'>了解方案、适合人群与开通安排</Text>
            <Image className='membership-contact-card__qr' src={ADVISOR_QR} mode='aspectFit' />
            <Text className='membership-contact-card__action'>点击放大二维码</Text>
          </View>
          <View className='membership-contact-card' onClick={showCommunity}>
            <View className='membership-contact-card__icon'><QrCode size={23} color='#5146e5' /></View>
            <Text className='membership-contact-card__title'>微信交流群</Text>
            <Text className='membership-contact-card__copy'>交流远程岗位、申请与求职准备</Text>
            <Image className='membership-contact-card__qr' src={COMMUNITY_QR} mode='aspectFit' />
            <Text className='membership-contact-card__action'>点击放大二维码</Text>
          </View>
        </View>
      </View>
    )
  }

  const hasSubscription = feed.subscriptions.some((subscription) => String(subscription.status || 'active') === 'active')
  const visibleTopics = [...new Set([...SUBSCRIPTION_TOPICS, ...selectedTopics])]
  return (
    <View className='page-shell subscription-page'>
      <View className='subscription-hero'>
        <Text className='subscription-hero__eyebrow'>MY JOB UPDATES</Text>
        <Text className='subscription-hero__title'>我订阅的岗位更新</Text>
        <Text className='subscription-hero__copy'>保存方向后，每日新岗位会同时推送至邮箱，并沉淀在这里方便查看。</Text>
      </View>
      <View className='subscription-page__heading'>
        <View>
          <Text className='subscription-page__title'>{hasSubscription ? '订阅方向' : '先设置你的订阅方向'}</Text>
          <Text className='subscription-page__note'>{hasSubscription ? '可随时调整，保存后次日生效' : '至少选择一个方向，即可开启邮件和小程序同步'}</Text>
        </View>
      </View>
      <ScrollView className='subscription-topic-scroll' scrollX enhanced showScrollbar={false}>
        <View className='subscription-topic-scroll__inner'>
          {visibleTopics.map((topic) => (
            <View
              className={'subscription-topic ' + (selectedTopics.includes(topic) ? 'subscription-topic--active' : '')}
              key={topic}
              onClick={() => toggleTopic(topic)}
            ><Text>{topic}</Text></View>
          ))}
        </View>
      </ScrollView>
      <Button className='subscription-save-button' loading={saving} disabled={saving} onClick={handleSave}>保存订阅方向</Button>

      <View className='subscription-page__heading subscription-page__heading--updates'>
        <View>
          <Text className='subscription-page__title'>最新匹配岗位</Text>
          <Text className='subscription-page__note'>与邮箱每日摘要保持同步</Text>
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
    </View>
  )
}
