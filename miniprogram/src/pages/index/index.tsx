import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import { Loading } from '@nutui/icons-react-taro'
import { stopPullDownRefresh, switchTab, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import BrandHeader from '../../components/brand-header'
import JobCard from '../../components/job-card'
import MiniIcon from '../../components/mini-icon'
import WebsiteNotice from '../../components/website-notice'
import { fetchFeaturedJobs } from '../../services/jobs-service'
import { fetchSubscriptionFeed, type SubscriptionFeed } from '../../services/subscription-service'
import { getMiniUser, hasAuthenticatedSession } from '../../services/session'
import type { MiniJob } from '../../types'
import './index.scss'

const EMPTY_SUBSCRIPTION_FEED: SubscriptionFeed = {
  subscriptions: [],
  jobs: [],
  options: [],
  limits: { recommended: 5, maximum: 8 }
}

export default function HomePage() {
  const [featuredJobs, setFeaturedJobs] = useState<MiniJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState('')
  const [authenticated, setAuthenticated] = useState(hasAuthenticatedSession())
  const [isMember, setIsMember] = useState(false)
  const [userAvatar, setUserAvatar] = useState('')
  const [subscriptionFeed, setSubscriptionFeed] = useState<SubscriptionFeed>(EMPTY_SUBSCRIPTION_FEED)

  const handleSearch = () => {
    switchTab({ url: '/pages/jobs/index' })
  }

  const loadFeaturedJobs = useCallback(async () => {
    setJobsLoading(true)
    setJobsError('')
    try {
      setFeaturedJobs((await fetchFeaturedJobs()).slice(0, 6))
    } catch (error) {
      setJobsError(error instanceof Error ? error.message : '精选岗位加载失败')
    } finally {
      setJobsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFeaturedJobs()
  }, [loadFeaturedJobs])

  usePullDownRefresh(() => {
    loadFeaturedJobs().finally(() => stopPullDownRefresh())
  })

  useDidShow(() => {
    const user = getMiniUser()
    const nextAuthenticated = hasAuthenticatedSession()
    const member = nextAuthenticated && Boolean(user?.isMember)
    setAuthenticated(nextAuthenticated)
    setIsMember(member)
    setUserAvatar(nextAuthenticated ? String(user?.avatar || '') : '')
    if (!member) {
      setSubscriptionFeed(EMPTY_SUBSCRIPTION_FEED)
      return
    }
    fetchSubscriptionFeed()
      .then(setSubscriptionFeed)
      .catch(() => setSubscriptionFeed(EMPTY_SUBSCRIPTION_FEED))
  })

  return (
    <View className='page-shell home-page'>
      <BrandHeader authenticated={authenticated} isMember={isMember} avatar={userAvatar} />

      <View className='home-welcome'>
        <Image className='home-welcome__website-bg' src='/assets/home-hero-bg.jpg' mode='aspectFill' />
        <View className='home-welcome__overlay' />
        <View className='home-welcome__content'>
          <Text className='home-welcome__eyebrow'>全球远程工作探索</Text>
          <View className='home-welcome__title'>
            <Text className='home-welcome__title-line'>用你喜欢的方式</Text>
            <Text className='home-welcome__title-line'>工作和生活</Text>
          </View>
          <Text className='home-welcome__copy'>可以全球旅居，也可以居家办公。Haigoo 帮你获得理想的远程工作，在喜欢的地方，做有价值的事。</Text>
          <View className='home-welcome__button' onClick={handleSearch}>
            <Text>浏览远程岗位</Text>
          </View>
        </View>
      </View>

      <View className='home-search surface-card' onClick={handleSearch}>
        <MiniIcon name='search' size={23} />
        <Input
          className='home-search__input'
          disabled
          placeholder='搜索岗位、公司或技能'
          placeholderClass='home-search__placeholder'
        />
        <Text className='home-search__filter'>搜索</Text>
      </View>

      <View className='section'>
        <View className='section-heading-row'>
          <View>
            <Text className='section-title'>今日精选推荐</Text>
            <Text className='home-page__section-note'>精选真实在招的全球远程机会</Text>
          </View>
          <Text className='section-action' onClick={() => switchTab({ url: '/pages/jobs/index' })}>查看全部</Text>
        </View>

        {jobsLoading && featuredJobs.length === 0 ? (
          <View className='home-jobs-state surface-card'>
            <View className='home-jobs-state__loading'>
              <Loading size={28} color='#5146e5' />
            </View>
            <Text>正在同步精选岗位</Text>
          </View>
        ) : jobsError && featuredJobs.length === 0 ? (
          <View className='home-jobs-state surface-card' onClick={loadFeaturedJobs}>
            <Text>精选岗位加载失败，点击重试</Text>
          </View>
        ) : (
          <ScrollView className='home-job-scroll' scrollX enhanced showScrollbar={false}>
            <View className='home-job-scroll__inner'>
              {featuredJobs.map((job) => (
                <JobCard compact job={job} key={job.id} />
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <View className='section'>
        <View className='section-heading-row'>
          <View>
            <View className='home-page__club-heading'>
              <View className='home-page__club-icon'>
                <MiniIcon name='club' size={17} />
              </View>
              <Text className='section-title'>{isMember ? '我订阅的岗位更新' : '了解 Club 权益'}</Text>
            </View>
            <Text className='home-page__section-note'>
              {isMember ? '与邮件订阅同步的最新关注岗位' : '岗位申请、更新订阅与远程求职支持'}
            </Text>
          </View>
          <Text className='section-action' onClick={() => switchTab({ url: '/pages/learning/index' })}>
            {isMember ? '管理订阅' : '查看权益'}
          </Text>
        </View>
        {isMember && subscriptionFeed.jobs.length > 0 ? (
          <JobCard compact job={subscriptionFeed.jobs[0]} />
        ) : (
          <View className='home-membership-callout surface-card' onClick={() => switchTab({ url: '/pages/learning/index' })}>
            <View className='home-membership-callout__icon'><MiniIcon name='shield' size={29} /></View>
            <View className='home-membership-callout__copy'>
              <Text className='home-membership-callout__title'>{isMember ? '设置订阅方向，开始接收更新' : 'Club 权益，助你更快推进求职'}</Text>
              <Text className='home-membership-callout__description'>
                {isMember ? '保存后，匹配岗位会同时出现在邮箱和小程序。' : '浏览完整岗位库，保存方向并接收每日匹配岗位。'}
              </Text>
            </View>
            <MiniIcon name='chevronRight' size={20} />
          </View>
        )}
      </View>

      <WebsiteNotice />
    </View>
  )
}
