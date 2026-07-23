import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import { ArrowRight, Loading, Search, ShieldCheck } from '@nutui/icons-react-taro'
import { stopPullDownRefresh, switchTab, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import BrandHeader from '../../components/brand-header'
import JobCard from '../../components/job-card'
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
      <BrandHeader />

      <View className='home-welcome'>
        <Image className='home-welcome__website-bg' src='/assets/home-hero-bg.webp' mode='aspectFill' />
        <View className='home-welcome__overlay' />
        <View className='home-welcome__content'>
          <Text className='home-welcome__eyebrow'>全球远程工作平台</Text>
          <View className='home-welcome__title'>
            <Text className='home-welcome__title-line'>发现更多真实可靠的</Text>
            <Text className='home-welcome__title-line'>远程工作机会</Text>
          </View>
          <Text className='home-welcome__copy'>聚合全球在招岗位，清晰标注全球远程与地区远程范围。</Text>
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
            <Text className='section-title'>精选远程岗位</Text>
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
            <Text className='section-title'>{isMember ? '我订阅的岗位更新' : '了解会员服务'}</Text>
            <Text className='home-page__section-note'>
              {isMember ? '与邮箱每日摘要同步的最新匹配岗位' : '岗位机会、主动订阅与持续求职支持'}
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

    </View>
  )
}
