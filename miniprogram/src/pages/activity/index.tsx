import { Text, View } from '@tarojs/components'
import { Heart, Loading, Search } from '@nutui/icons-react-taro'
import { showToast, stopPullDownRefresh, useDidShow, usePullDownRefresh, useRouter } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import JobCard from '../../components/job-card'
import {
  fetchApplications,
  fetchFavorites,
  setJobFavorite,
  type MiniApplicationRecord
} from '../../services/user-activity-service'
import type { MiniJob } from '../../types'
import './index.scss'

type ActivityTab = 'favorites' | 'applications'

function applicationLabel(record?: MiniApplicationRecord) {
  if (!record) return '已打开申请入口'
  const status = record.status === 'applied' ? '已申请' : '已打开入口'
  if (record.interactionType === 'referral') return `内推 · ${status}`
  if (record.interactionType === 'email') return `邮箱 · ${status}`
  return `官网 · ${status}`
}

function formatActivityDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

export default function ActivityPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ActivityTab>(router.params.tab === 'applications' ? 'applications' : 'favorites')
  const [favoriteJobs, setFavoriteJobs] = useState<MiniJob[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [applications, setApplications] = useState<MiniApplicationRecord[]>([])
  const [applicationJobs, setApplicationJobs] = useState<MiniJob[]>([])
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadActivity = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [favorites, applicationFeed] = await Promise.all([
        fetchFavorites(),
        fetchApplications()
      ])
      setFavoriteJobs(favorites.jobs)
      setFavoriteIds(new Set(favorites.favoriteJobIds))
      setApplications(applicationFeed.applications)
      setApplicationJobs(applicationFeed.jobs)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '求职记录加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => { loadActivity() })
  usePullDownRefresh(() => loadActivity().finally(() => stopPullDownRefresh()))

  const applicationRecordMap = useMemo(() => {
    const records = new Map<string, MiniApplicationRecord>()
    applications.forEach((record) => {
      if (!records.has(record.jobId)) records.set(record.jobId, record)
    })
    return records
  }, [applications])

  const toggleFavorite = async (job: MiniJob) => {
    const wasFavorite = favoriteIds.has(job.id)
    setPendingIds((ids) => new Set(ids).add(job.id))
    try {
      await setJobFavorite(job.id, !wasFavorite)
      if (wasFavorite) {
        setFavoriteIds((ids) => {
          const next = new Set(ids)
          next.delete(job.id)
          return next
        })
        setFavoriteJobs((jobs) => jobs.filter((item) => item.id !== job.id))
      } else {
        setFavoriteIds((ids) => new Set(ids).add(job.id))
      }
      showToast({ title: wasFavorite ? '已取消收藏' : '已同步收藏', icon: 'success' })
    } catch (favoriteError) {
      showToast({ title: favoriteError instanceof Error ? favoriteError.message : '收藏操作失败', icon: 'none' })
    } finally {
      setPendingIds((ids) => {
        const next = new Set(ids)
        next.delete(job.id)
        return next
      })
    }
  }

  const currentJobs = activeTab === 'favorites' ? favoriteJobs : applicationJobs
  const hasRecords = activeTab === 'favorites' ? favoriteJobs.length > 0 : applications.length > 0
  const unavailableApplications = applications.filter((record) => (
    !applicationJobs.some((job) => job.id === record.jobId)
  ))

  return (
    <View className='page-shell activity-page'>
      <View className='activity-page__heading'>
        <Text className='activity-page__title'>我的求职记录</Text>
        <Text className='activity-page__subtitle'>与 Haigoo 网站账号实时共享</Text>
      </View>

      <View className='activity-tabs'>
        <View
          className={`activity-tabs__item ${activeTab === 'favorites' ? 'activity-tabs__item--active' : ''}`}
          onClick={() => setActiveTab('favorites')}
        ><Text>收藏岗位 {favoriteIds.size}</Text></View>
        <View
          className={`activity-tabs__item ${activeTab === 'applications' ? 'activity-tabs__item--active' : ''}`}
          onClick={() => setActiveTab('applications')}
        ><Text>申请记录 {applications.length}</Text></View>
      </View>

      {loading ? (
        <View className='activity-state surface-card'>
          <Loading size={30} color='#5146e5' />
          <Text>正在同步网站数据…</Text>
        </View>
      ) : error ? (
        <View className='activity-state surface-card' onClick={loadActivity}>
          <Search size={32} color='#8b82c8' />
          <Text>{error}</Text>
          <Text className='activity-state__action'>点击重试</Text>
        </View>
      ) : hasRecords ? (
        <View className='activity-list'>
          {currentJobs.map((job) => {
            const record = applicationRecordMap.get(job.id)
            return (
              <View className='activity-list__item' key={job.id}>
                {activeTab === 'applications' ? (
                  <View className='activity-list__meta'>
                    <Text>{applicationLabel(record)}</Text>
                    <Text>{formatActivityDate(record?.updatedAt)}</Text>
                  </View>
                ) : null}
                <JobCard
                  job={job}
                  favorited={favoriteIds.has(job.id)}
                  favoritePending={pendingIds.has(job.id)}
                  onToggleFavorite={toggleFavorite}
                />
              </View>
            )
          })}
          {activeTab === 'applications' ? unavailableApplications.map((record) => (
            <View className='activity-unavailable surface-card' key={`unavailable-${record.id}`}>
              <View>
                <Text className='activity-unavailable__title'>{record.jobTitle || '职位已失效'}</Text>
                <Text className='activity-unavailable__company'>{record.company || '未知企业'}</Text>
              </View>
              <View className='activity-unavailable__meta'>
                <Text>{applicationLabel(record)}</Text>
                <Text>{formatActivityDate(record.updatedAt)}</Text>
              </View>
            </View>
          )) : null}
        </View>
      ) : (
        <View className='activity-state surface-card'>
          <Heart size={34} color='#8b82c8' />
          <Text>{activeTab === 'favorites' ? '还没有收藏岗位' : '还没有申请入口记录'}</Text>
          <Text className='activity-state__copy'>在小程序和网站产生的数据都会同步显示在这里。</Text>
        </View>
      )}
    </View>
  )
}
