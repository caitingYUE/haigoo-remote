import { Text, View } from '@tarojs/components'
import Taro, { navigateTo, showToast, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { fetchCareerWatch, markCareerWatchUpdatesRead, type CareerWatchResponse } from '../../services/career-match-service'
import { invalidateMiniResource } from '../../services/retained-resource-cache'
import { careerWatchStorageKey, getMiniUser } from '../../services/session'
import { formatCalendarDate } from '../../utils/runtime-compat'
import './index.scss'

function cacheCareerWatch(data: CareerWatchResponse) {
  const userId = getMiniUser()?.userId
  if (!userId) return
  try { Taro.setStorageSync(careerWatchStorageKey(userId), data) } catch { /* The server remains authoritative. */ }
}

export default function UnreadUpdatesPage() {
  const [items, setItems] = useState<CareerWatchResponse['followedUpdates']>([])
  useDidShow(() => {
    void fetchCareerWatch().then(async (data) => {
      setItems(data.followedUpdates)
      invalidateMiniResource('profile-dashboard')
      const unreadIds = data.followedUpdates.filter((item) => item.status === 'unread').map((item) => item.inboxId)
      if (!unreadIds.length) {
        cacheCareerWatch(data)
        Taro.eventCenter.trigger('haigoo:unread-change', 0)
        return
      }
      try {
        await markCareerWatchUpdatesRead(unreadIds)
        const readUpdates = data.followedUpdates.map((item) => unreadIds.includes(item.inboxId) ? { ...item, status: 'read' } : item)
        const readWatch = { ...data, followedUpdates: readUpdates, unreadFollowedUpdateCount: 0 }
        setItems(readUpdates)
        cacheCareerWatch(readWatch)
        Taro.eventCenter.trigger('haigoo:unread-change', 0)
      } catch {
        showToast({ title: '已读状态同步失败，请稍后重试', icon: 'none' })
      }
    }).catch(() => showToast({ title: '更新暂时无法加载', icon: 'none' }))
  })
  return <View className='unread-updates page-shell'>
    <Text className='unread-updates__title'>订阅岗位更新</Text>
    <Text className='unread-updates__hint'>你关注并订阅的企业，有匹配岗位时会集中展示在这里</Text>
    {!items.length ? <View className='unread-updates__empty'><Text>暂时没有岗位更新</Text></View> : <View className='unread-updates__list'>{items.map((item) => <View key={item.inboxId} className={`unread-updates__card ${item.jobStatus === 'inactive' ? 'is-inactive' : ''}`} onClick={() => item.companyId && item.jobId && navigateTo({ url: `/pages/job-detail/index?companyId=${encodeURIComponent(item.companyId)}&jobId=${encodeURIComponent(item.jobId)}` })}><Text className='unread-updates__company'>{item.companyName}</Text><Text className='unread-updates__job'>{item.jobTitle || '企业岗位更新'}</Text><Text className='unread-updates__meta'>{item.jobCategory || '匹配岗位'} · 发布于 {formatCalendarDate(item.publishedAt) || '近期'} · 订阅于 {formatCalendarDate(item.subscribedAt) || '—'}</Text>{item.jobStatus === 'inactive' ? <Text className='unread-updates__status'>岗位已失效</Text> : null}</View>)}</View>}
  </View>
}
