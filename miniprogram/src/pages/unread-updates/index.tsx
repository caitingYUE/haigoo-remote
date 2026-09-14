import { Text, View } from '@tarojs/components'
import { navigateTo, showToast, useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { fetchCareerWatch, type CareerWatchResponse } from '../../services/career-match-service'
import './index.scss'

export default function UnreadUpdatesPage() {
  const [items, setItems] = useState<CareerWatchResponse['followedUpdates']>([])
  useDidShow(() => { fetchCareerWatch().then((data) => setItems(data.followedUpdates)).catch(() => showToast({ title: '更新暂时无法加载', icon: 'none' })) })
  return <View className='unread-updates page-shell'>
    <Text className='unread-updates__title'>匹配岗位更新</Text>
    <Text className='unread-updates__hint'>你关注并订阅的企业，有匹配岗位时会集中展示在这里</Text>
    {!items.length ? <View className='unread-updates__empty'><Text>暂时没有岗位更新</Text></View> : <View className='unread-updates__list'>{items.map((item) => <View key={item.inboxId} className={`unread-updates__card ${item.jobStatus === 'inactive' ? 'is-inactive' : ''}`} onClick={() => item.jobId && navigateTo({ url: `/pages/job-detail/index?id=${encodeURIComponent(item.jobId)}` })}><Text className='unread-updates__company'>{item.companyName}</Text><Text className='unread-updates__job'>{item.jobTitle || '企业岗位更新'}</Text><Text className='unread-updates__meta'>{item.jobCategory || '匹配岗位'} · 发布于 {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : '近期'} · 订阅于 {item.subscribedAt ? new Date(item.subscribedAt).toLocaleDateString() : '—'}</Text>{item.jobStatus === 'inactive' ? <Text className='unread-updates__status'>岗位已失效</Text> : null}</View>)}</View>}
  </View>
}
