import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import { ArrowRight, Loading, Search, ShieldCheck, StarFill } from '@nutui/icons-react-taro'
import { stopPullDownRefresh, switchTab, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import BrandHeader from '../../components/brand-header'
import JobCard from '../../components/job-card'
import WebsiteNotice from '../../components/website-notice'
import { fetchFeaturedJobs } from '../../services/jobs-service'
import { fetchSubscriptionFeed, type SubscriptionFeed } from '../../services/subscription-service'
import { getMiniUser } from '../../services/session'
import type { MiniJob } from '../../types'
import './index.scss'

export default function HomePage() {
  const [featuredJobs, setFeaturedJobs] = useState<MiniJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState('')
  const [isMember, setIsMember] = useState(false)
  const [subscriptionFeed, setSubscriptionFeed] = useState<SubscriptionFeed>({ subscriptions: [], jobs: [] })

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
    const member = Boolean(getMiniUser()?.isMember)
    setIsMember(member)
    if (!member) {
      setSubscriptionFeed({ subscriptions: [], jobs: [] })
      return
    }
    fetchSubscriptionFeed()
      .then(setSubscriptionFeed)
      .catch(() => setSubscriptionFeed({ subscriptions: [], jobs: [] }))
  })

  return (
    <View className='page-shell home-page'>
      <BrandHeader isMember={isMember} />

      <View className='home-welcome'>
        <Image className='home-welcome__website-bg' src='/assets/home-hero-bg.webp' mode='aspectFill' />
        <View className='home-welcome__overlay' />
        <View className='home-welcome__content'>
          <Text className='home-welcome__eyebrow'>全球远程工作探索</Text>
          <View className='home-welcome__title'>
            <Text className='home-welcome__title-line'>发现更多真实可靠的</Text>
            <Text className='home-welcome__title-line'>远程工作机会</Text>
          </View>
          <Text className='home-welcome__copy'>人工精选全球远程工作，大部分可直连HR/负责人邮箱。</Text>
          <View className='home-welcome__button' onClick={handleSearch}>
            <Text>浏览远程岗位</Text>
          </View>
        </View>
      </View>

      <View className='home-search surface-card' onClick={handleSearch}>
        <Search size={23} color='#98a1b2' />
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
                <StarFill size={15} color='#5146e5' />
              </View>
              <Text className='section-title'>{isMember ? '我订阅的岗位更新' : '了解会员服务'}</Text>
            </View>
            <Text className='home-page__section-note'>
              {isMember ? '与邮件订阅同步的最新关注岗位' : '岗位申请、更新订阅与远程求职支持'}
            </Text>
          </View>
          <Text className='section-action' onClick={() => switchTab({ url: '/pages/learning/index' })}>
            {isMember ? '管理订阅' : '查看服务'}
          </Text>
        </View>
        {isMember && subscriptionFeed.jobs.length > 0 ? (
          <JobCard compact job={subscriptionFeed.jobs[0]} />
        ) : (
          <View className='home-membership-callout surface-card' onClick={() => switchTab({ url: '/pages/learning/index' })}>
            <View className='home-membership-callout__icon'><ShieldCheck size={27} color='#5146e5' /></View>
            <View className='home-membership-callout__copy'>
              <Text className='home-membership-callout__title'>{isMember ? '设置订阅方向，开始接收更新' : '会员服务，帮你更快拿到机会'}</Text>
              <Text className='home-membership-callout__description'>
                {isMember ? '保存后，匹配岗位会同时出现在邮箱和小程序。' : '浏览完整岗位库，保存方向并接收每日匹配岗位。'}
              </Text>
            </View>
            <ArrowRight size={19} color='#5146e5' />
          </View>
        )}
      </View>

      <WebsiteNotice />
    </View>
  )
}
