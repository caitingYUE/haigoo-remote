import { Input, ScrollView, Text, View } from '@tarojs/components'
import { Close, Loading, Search } from '@nutui/icons-react-taro'
import {
  navigateTo,
  showActionSheet,
  showModal,
  showToast,
  stopPullDownRefresh,
  useDidShow,
  usePullDownRefresh,
  useReachBottom
} from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import JobCard from '../../components/job-card'
import { MINI_JOB_CATEGORY_FILTERS } from '../../data/job-filters'
import { clearJobsRequestCache, fetchJobs } from '../../services/jobs-service'
import { fetchFavorites, setJobFavorite } from '../../services/user-activity-service'
import { hasAuthenticatedSession } from '../../services/session'
import type { MiniJob } from '../../types'
import './index.scss'

export default function JobsPage() {
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0)
  const [sortBy, setSortBy] = useState<'default' | 'recent'>('default')
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [jobs, setJobs] = useState<MiniJob[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [browse, setBrowse] = useState<{ viewedCount: number; remaining: number | null; limited: boolean } | undefined>()
  const [favoriteJobIds, setFavoriteJobIds] = useState<Set<string>>(new Set())
  const [favoritePendingIds, setFavoritePendingIds] = useState<Set<string>>(new Set())
  const requestSequence = useRef(0)
  const jobsRef = useRef<MiniJob[]>([])
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword.trim()), 350)
    return () => clearTimeout(timer)
  }, [keyword])

  const loadJobs = useCallback(async (nextPage = 1, force = false) => {
    if (nextPage > 1 && loadingMoreRef.current) return
    const sequence = ++requestSequence.current
    if (force) {
      clearJobsRequestCache()
      setRefreshing(true)
    } else if (nextPage === 1) {
      setLoading(true)
    } else {
      loadingMoreRef.current = true
      setLoadingMore(true)
    }
    if (nextPage === 1) setError('')

    try {
      const activeFilter = MINI_JOB_CATEGORY_FILTERS[activeCategoryIndex] || MINI_JOB_CATEGORY_FILTERS[0]
      const response = await fetchJobs({
        page: nextPage,
        limit: 20,
        search: debouncedKeyword,
        category: debouncedKeyword ? '' : activeFilter.value,
        featured: !debouncedKeyword && activeFilter.featured,
        sortBy
      })
      if (sequence !== requestSequence.current) return

      const nextJobs = nextPage === 1
        ? response.jobs
        : [...jobsRef.current, ...response.jobs].filter((job, index, list) => (
            list.findIndex((item) => item.id === job.id) === index
          ))
      jobsRef.current = nextJobs
      setJobs(nextJobs)
      setTotal(response.total)
      setPage(response.page)
      setHasMore(response.page < response.totalPages && response.jobs.length > 0)
      setBrowse(response.browse)
    } catch (loadError) {
      if (sequence !== requestSequence.current) return
      const message = loadError instanceof Error ? loadError.message : '岗位加载失败，请稍后重试'
      if (nextPage > 1 || jobsRef.current.length > 0) {
        showToast({ title: '刷新失败，已保留当前岗位', icon: 'none' })
      } else {
        setJobs([])
        setTotal(0)
        setError(message)
      }
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false)
        setLoadingMore(false)
        setRefreshing(false)
      }
      if (nextPage > 1) loadingMoreRef.current = false
    }
  }, [activeCategoryIndex, debouncedKeyword, sortBy])

  useEffect(() => {
    jobsRef.current = []
    setJobs([])
    setPage(1)
    setHasMore(false)
    loadJobs(1)
  }, [loadJobs])

  const syncFavorites = useCallback(async () => {
    if (!hasAuthenticatedSession()) {
      setFavoriteJobIds(new Set())
      return
    }
    try {
      const data = await fetchFavorites()
      setFavoriteJobIds(new Set(data.favoriteJobIds))
    } catch (favoriteError) {
      console.warn('[jobs] favorites sync failed', favoriteError)
    }
  }, [])

  useDidShow(() => { syncFavorites() })

  usePullDownRefresh(() => {
    Promise.all([loadJobs(1, true), syncFavorites()]).finally(() => stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (!loading && !loadingMoreRef.current && hasMore && !browse?.limited) loadJobs(page + 1)
  })

  const handleToggleFavorite = async (job: MiniJob) => {
    if (!hasAuthenticatedSession()) {
      showModal({
        title: '登录后收藏岗位',
        content: '绑定 Haigoo 网站账号后，小程序与网站会共享同一份收藏数据。',
        confirmText: '前往登录',
        success: ({ confirm }) => {
          if (confirm) navigateTo({ url: '/pages/account-bind/index' })
        }
      })
      return
    }
    const wasFavorite = favoriteJobIds.has(job.id)
    setFavoritePendingIds((ids) => new Set(ids).add(job.id))
    setFavoriteJobIds((ids) => {
      const next = new Set(ids)
      if (wasFavorite) next.delete(job.id)
      else next.add(job.id)
      return next
    })
    try {
      await setJobFavorite(job.id, !wasFavorite)
      showToast({ title: wasFavorite ? '已取消收藏' : '已同步收藏', icon: 'success' })
    } catch (favoriteError) {
      setFavoriteJobIds((ids) => {
        const next = new Set(ids)
        if (wasFavorite) next.add(job.id)
        else next.delete(job.id)
        return next
      })
      showToast({ title: favoriteError instanceof Error ? favoriteError.message : '收藏操作失败', icon: 'none' })
    } finally {
      setFavoritePendingIds((ids) => {
        const next = new Set(ids)
        next.delete(job.id)
        return next
      })
    }
  }

  const chooseSort = () => {
    showActionSheet({
      itemList: ['默认排序', '最新发布'],
      success: ({ tapIndex }) => setSortBy(tapIndex === 1 ? 'recent' : 'default')
    })
  }

  const isBrowseLimited = browse?.remaining != null

  return (
    <View className='page-shell jobs-page'>
      <View className='jobs-page__heading'>
        <View>
          <Text className='jobs-page__heading-title'>寻找适合你的远程岗位</Text>
          <Text className='page-subtitle'>精选真实在招岗位，支持全球远程与地区远程</Text>
        </View>
      </View>

      <View className='jobs-search surface-card'>
        <Search size={23} color='#98a1b2' />
        <Input
          className='jobs-search__input'
          confirmType='search'
          value={keyword}
          placeholder='搜索岗位、公司或技能'
          placeholderClass='jobs-search__placeholder'
          onInput={(event) => setKeyword(event.detail.value)}
        />
        {keyword ? (
          <View className='jobs-search__clear' onClick={() => setKeyword('')}>
            <Close size={17} color='#777f92' />
          </View>
        ) : null}
      </View>

      {!debouncedKeyword ? (
        <ScrollView className='jobs-category-scroll' scrollX enhanced showScrollbar={false}>
          <View className='jobs-category-scroll__inner'>
            {MINI_JOB_CATEGORY_FILTERS.map((category, index) => (
              <View
                className={`chip ${activeCategoryIndex === index ? 'chip--active' : ''}`}
                key={category.label}
                onClick={() => setActiveCategoryIndex(index)}
              >
                <Text>{category.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}

      <View className='jobs-page__summary'>
        <View>
          <Text className='jobs-page__summary-main'>
            {loading && jobs.length === 0 ? '正在加载岗位' : `共 ${total} 个在招岗位`}
          </Text>
          {isBrowseLimited ? <Text className='jobs-page__allowance'>免费浏览剩余 {browse?.remaining} 个</Text> : null}
        </View>
        <View className='jobs-page__summary-sort' onClick={chooseSort}>
          <Text>{sortBy === 'recent' ? '最新发布' : '默认排序'}</Text>
          <Text className='jobs-page__summary-sort-arrow'>⌄</Text>
        </View>
      </View>

      <View className='jobs-page__list'>
        {loading && jobs.length === 0 ? (
          <View className='jobs-state surface-card'>
            <View className='jobs-state__loading'>
              <Loading size={30} color='#5146e5' />
            </View>
            <Text className='jobs-state__title'>岗位加载中</Text>
            <Text className='jobs-state__copy'>正在同步网站最新岗位数据</Text>
          </View>
        ) : error ? (
          <View className='jobs-state surface-card'>
            <View className='jobs-empty__icon'>
              <Search size={34} color='#a29abf' />
            </View>
            <Text className='jobs-state__title'>暂时无法加载岗位</Text>
            <Text className='jobs-state__copy'>{error}</Text>
            <View className='jobs-state__retry' onClick={() => loadJobs(1, true)}>
              <Text>重新加载</Text>
            </View>
          </View>
        ) : jobs.length > 0 ? (
          <>
            {jobs.map((job) => (
              <JobCard
                job={job}
                key={job.id}
                favorited={favoriteJobIds.has(job.id)}
                favoritePending={favoritePendingIds.has(job.id)}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
            {loadingMore ? <Text className='jobs-page__refreshing'>正在加载更多岗位…</Text> : null}
            {!hasMore && jobs.length > 20 ? <Text className='jobs-page__refreshing'>已加载全部岗位</Text> : null}
            {refreshing ? <Text className='jobs-page__refreshing'>正在刷新最新岗位…</Text> : null}
            {isBrowseLimited ? (
              <View className='jobs-page__preview-note'>
                <Text>{browse?.limited ? '已达到免费浏览上限，开通会员后可继续查看全部岗位' : '每个岗位只计入一次免费浏览额度，开通会员可查看全部岗位'}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View className='jobs-state surface-card'>
            <View className='jobs-empty__icon'>
              <Search size={34} color='#a29abf' />
            </View>
            <Text className='jobs-state__title'>暂时没有找到相关岗位</Text>
            <Text className='jobs-state__copy'>试试其他关键词或岗位分类</Text>
          </View>
        )}
      </View>
    </View>
  )
}
