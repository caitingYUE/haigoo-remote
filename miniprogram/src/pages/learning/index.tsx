import { Button, ScrollView, Text, View } from '@tarojs/components'
import { setNavigationBarTitle, setTabBarItem, showModal, showToast, useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import JobCard from '../../components/job-card'
import { loginWithWechat } from '../../services/mini-auth-service'
import { fetchSubscriptionFeed, getSubscriptionTopics, saveSubscriptionTopics, type SubscriptionFeed } from '../../services/subscription-service'
import { getMiniSessionToken, getMiniUser } from '../../services/session'
import './index.scss'

const SUBSCRIPTION_TOPICS = ['产品经理', '设计', '前端开发', '后端开发', '市场营销', '运营', '销售', '人力资源']
const MAX_SUBSCRIPTION_TOPICS = 8
const MEMBER_SERVICES = [
  ['岗位机会', '不止浏览，更快找到机会', '解锁完整远程岗位库、会员岗位与更顺畅的申请路径。'],
  ['岗位订阅', '匹配的岗位，主动找到你', '保存关注方向后，最新岗位会同步到邮箱和小程序。'],
  ['求职支持', '从准备到申请的持续支持', '获得远程求职工具、成长内容与会员专属服务。']
]

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

  if (!isMember) {
    return (
      <View className='page-shell membership-page'>
        <View className='membership-hero'>
          <Text className='membership-hero__eyebrow'>HAIGOO REMOTE CLUB</Text>
          <Text className='membership-hero__title'>让每一次远程求职{'\n'}都更有准备</Text>
          <Text className='membership-hero__copy'>会员服务将岗位机会、主动订阅与求职支持放到同一条成长路径里。</Text>
        </View>
        <View className='membership-page__heading'>
          <Text className='membership-page__title'>会员服务</Text>
          <Text className='membership-page__note'>后续将在小程序内支持开通</Text>
        </View>
        <View className='membership-service-list'>
          {MEMBER_SERVICES.map(([eyebrow, title, description], index) => (
            <View className='membership-service-card surface-card' key={title}>
              <Text className='membership-service-card__index'>0{index + 1}</Text>
              <View className='membership-service-card__copy'>
                <Text className='membership-service-card__eyebrow'>{eyebrow}</Text>
                <Text className='membership-service-card__title'>{title}</Text>
                <Text className='membership-service-card__description'>{description}</Text>
              </View>
            </View>
          ))}
        </View>
        <Button className='membership-primary-button' onClick={() => showModal({
          title: '会员服务',
          content: '小程序支付能力正在准备中。当前可前往 Haigoo Remote 网站了解并开通会员服务。',
          showCancel: false
        })}>了解会员服务</Button>
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
