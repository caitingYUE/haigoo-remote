import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useRef, useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import { fetchFavoriteJobs, setJobFavorite } from '../../services/content-service'
import type { FavoriteJobRecord } from '../../services/content-service'
import { hasAuthenticatedSession } from '../../services/session'
import { resourceRevision } from '../../services/retained-resource-cache'
import { miniContentScope } from '../../hooks/use-retained-resource'
import './index.scss'

export default function FavoriteJobsPage() {
  const [records, setRecords] = useState<FavoriteJobRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const page = useRef(0)
  const pending = useRef(false)
  const removePending = useRef(false)
  const lastScope = useRef('')
  const hasLoaded = useRef(false)
  const loadSequence = useRef(0)
  const favoriteRevision = useRef(-1)

  const load = async (reset = false, preserve = false) => {
    const scope = miniContentScope()
    if (lastScope.current !== scope) {
      lastScope.current = scope
      loadSequence.current++
      pending.current = false
      removePending.current = false
      page.current = 0
      hasLoaded.current = false
      setRecords([])
      setHasMore(false)
      setRemoving('')
    }
    if (pending.current || removePending.current) { Taro.stopPullDownRefresh(); return }
    if (!hasAuthenticatedSession()) {
      setRecords([]); setLoading(false); setError('请先登录并绑定 Haigoo 账号'); Taro.stopPullDownRefresh(); return
    }
    pending.current = true
    const revision = resourceRevision('favorite-state')
    const sequence = ++loadSequence.current
    if (!preserve || !hasLoaded.current) setLoading(true)
    setError('')
    try {
      const result = await fetchFavoriteJobs(reset ? 1 : page.current + 1)
      if (sequence !== loadSequence.current) return
      if (scope !== miniContentScope()) throw new Error('账号状态已变化，请重新加载')
      setRecords((current) => reset ? result.favorites : [...new Map([...current, ...result.favorites].map((item) => [item.jobId, item])).values()])
      page.current = result.page
      setHasMore(result.hasMore)
      hasLoaded.current = true
      favoriteRevision.current = revision
    } catch (cause) {
      if (sequence !== loadSequence.current) return
      if (scope !== miniContentScope()) setRecords([])
      setError(cause instanceof Error ? cause.message : '收藏记录加载失败，请重试')
    }
    finally { if (sequence === loadSequence.current) { pending.current = false; setLoading(false); Taro.stopPullDownRefresh() } }
  }

  useDidShow(() => {
    const sameScope = lastScope.current === miniContentScope()
    if (sameScope && hasLoaded.current && favoriteRevision.current === resourceRevision('favorite-state')) return
    void load(true, sameScope && hasLoaded.current)
  })
  usePullDownRefresh(() => { void load(true, hasLoaded.current) })
  useReachBottom(() => { if (hasMore && !error) void load() })

  const remove = async (record: FavoriteJobRecord) => {
    if (removePending.current || pending.current) return
    const scope = miniContentScope()
    removePending.current = true; setRemoving(record.jobId)
    try {
      await setJobFavorite(record.jobId, false)
      if (scope !== miniContentScope()) return
      setRecords((current) => current.filter((item) => item.jobId !== record.jobId))
      Taro.showToast({ title: '已取消收藏', icon: 'success' })
      // Reload from page one because a removal changes server pagination offsets.
      removePending.current = false
      setRemoving('')
      void load(true, true)
    } catch (cause) { if (scope === miniContentScope()) Taro.showToast({ title: cause instanceof Error ? cause.message : '取消收藏失败', icon: 'none' }) }
    finally {
      // Busy state is local UI state and must always settle, including when an
      // authentication response changes the current content scope.
      removePending.current = false
      setRemoving('')
    }
  }

  const open = (record: FavoriteJobRecord) => {
    if (!record.job?.companyId) return
    const companyName = record.job.company || record.company
    Taro.navigateTo({ url: `/pages/job-detail/index?companyId=${encodeURIComponent(record.job.companyId)}&jobId=${encodeURIComponent(record.jobId)}&search=${encodeURIComponent(companyName)}` })
  }

  return <View className='page-shell favorite-jobs'>
    <View className='favorite-jobs__heading'><Text>收藏岗位</Text><Text>与同一 Haigoo 账号的官网收藏同步</Text></View>
    {error ? <View className='favorite-jobs__state' aria-live='polite'><Text>{error}</Text><View className='text-button' aria-role='button' onClick={() => hasAuthenticatedSession() ? void load(true) : void Taro.navigateTo({ url: '/pages/profile/index' })}>{hasAuthenticatedSession() ? '重新加载' : '去登录'}</View></View> : null}
    {!loading && !error && !records.length ? <View className='favorite-jobs__state'><Text>还没有收藏岗位</Text><Text>在岗位详情页点击收藏，即可在这里查看。</Text></View> : null}
    {records.map((record) => {
      const job = record.job
      const available = Boolean(job?.companyId)
      const metadata = [job?.location, job?.jobType, job?.experienceLevel].filter(Boolean).join(' · ')
      return <View className='favorite-jobs__card' key={record.jobId}>
        <View className='favorite-jobs__content' aria-role={available ? 'button' : undefined} aria-disabled={!available} onClick={() => open(record)}>
          <Text className='favorite-jobs__title'>{job?.titleZh || job?.title || record.title || '岗位暂不可查看'}</Text>
          {job?.company || record.company ? <Text className='favorite-jobs__company'>{job?.company || record.company}</Text> : null}
          {metadata ? <Text className='favorite-jobs__meta'>{metadata}</Text> : null}
          {job?.salary ? <Text className='favorite-jobs__salary'>{job.salary}</Text> : null}
          {!available ? <Text className='favorite-jobs__meta'>当前暂无可查看的公开岗位信息</Text> : null}
        </View>
        <View className='favorite-jobs__remove' aria-role='button' aria-label={`取消收藏${job?.title || record.title}`} aria-disabled={Boolean(removing) || loading} onClick={() => void remove(record)}><MiniIcon name='favorite' size={18} /><Text>{removing === record.jobId ? '处理中' : '取消收藏'}</Text></View>
      </View>
    })}
    {loading ? <View className='favorite-jobs__state' aria-live='polite'>正在加载收藏记录…</View> : hasMore && !error ? <View className='favorite-jobs__state text-button' aria-role='button' onClick={() => void load()}>加载更多</View> : null}
  </View>
}
