import { Image, Text, View } from '@tarojs/components'
import Taro, { navigateTo, stopPullDownRefresh, useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { trackMiniEvent } from '../../services/analytics-service'
import ContentSkeleton from '../../components/content-skeleton'
import EditorialTopBar from '../../components/editorial-top-bar'
import EditorialSearch from '../../components/editorial-search'
import EditorialRow from '../../components/editorial-row'
import EditorialState from '../../components/editorial-state'
import TopicScroller from '../../components/topic-scroller'
import { fetchGrowthNotes } from '../../services/content-service'
import type { GrowthNote } from '../../types'
import useMiniShare from '../../hooks/use-mini-share'
import { careerWatchStorageKey, getMiniUser, hasAuthenticatedSession } from '../../services/session'
import useRetainedResource from '../../hooks/use-retained-resource'
import './index.scss'

const difficultyLabels: Record<string, string> = { entry: '入门', intermediate: '进阶', advanced: '深入' }
const noteMetadata = (note: GrowthNote) => [
  difficultyLabels[note.difficulty],
  note.durationMinutes ? `${note.durationMinutes} 分钟` : '',
  note.tags[0] || note.category
].filter(Boolean).join(' · ')

export default function GrowthPage() {
  const { data, loading, refreshing, error, load: loadResource } = useRetainedResource<GrowthNote[]>('growth-notes')
  const notes = data || []
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('')
  const [unread, setUnread] = useState(0)
  useMiniShare('Haigoo 职业笔记｜远程工作的实用方法', '/pages/growth/index')
  const load = useCallback((force = false) => loadResource('growth-notes', () => fetchGrowthNotes(force), force), [loadResource])
  useDidShow(() => {
    Taro.eventCenter.trigger('haigoo:tab-change', '/pages/growth/index')
    const userId = getMiniUser()?.userId
    const cached = userId ? Taro.getStorageSync(careerWatchStorageKey(userId)) : null
    setUnread(userId ? Number((cached?.unreadFollowedUpdateCount ?? cached?.followedUpdates?.filter((item: any) => item.status === 'unread').length) || 0) : 0)
    void load()
  })
  useEffect(() => {
    const syncUnread = (count?: number) => setUnread(Math.max(0, Number(count || 0)))
    Taro.eventCenter.on('haigoo:unread-change', syncUnread)
    return () => { Taro.eventCenter.off('haigoo:unread-change', syncUnread) }
  }, [])
  usePullDownRefresh(async () => { await load(true); stopPullDownRefresh() })

  const topics = useMemo(() => [...new Set(notes.flatMap((note) => note.tags).filter(Boolean))].slice(0, 8), [notes])
  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return notes.filter((note) => {
      const matchesTopic = !topic || note.tags.includes(topic)
      const haystack = [note.titleZh, note.title, note.summary, note.category, ...note.tags].join(' ').toLowerCase()
      return matchesTopic && (!query || haystack.includes(query))
    })
  }, [notes, search, topic])
  const featured = visibleNotes.find((note) => note.isFeatured && note.coverUrl) || null
  const listNotes = featured ? visibleNotes.filter((note) => note.id !== featured.id) : visibleNotes

  const open = (note: GrowthNote) => {
    void trackMiniEvent('mini_growth_note_open', { entity_id: note.id, source_page: 'growth', unlocked: note.unlocked })
    navigateTo({ url: `/pages/note-detail/index?id=${encodeURIComponent(note.id)}` })
  }

  const chooseMoreTopic = async () => {
    const moreTopics = topics.slice(4)
    if (!moreTopics.length) return
    try {
      const result = await Taro.showActionSheet({ itemList: moreTopics })
      setTopic(moreTopics[result.tapIndex] || '')
    } catch { /* user cancelled */ }
  }

  const user = getMiniUser()
  return (
    <View className='growth-root'>
      <EditorialTopBar authenticated={hasAuthenticatedSession()} avatar={user?.avatar} unread={unread} />
      <View className='page-shell growth-page'>
      <View className='growth-heading'>
        <Text className='page-heading'>职业笔记</Text>
        <Text className='page-subtitle'>关于远程协作、职业转型与长期成长。</Text>
      </View>
      <EditorialSearch value={search} placeholder='搜索笔记、主题或关键词' onInput={setSearch} />
      {topics.length ? <TopicScroller activeKey={topic && !topics.slice(0, 4).includes(topic) ? '__more' : topic} onSelect={(key) => key === '__more' ? void chooseMoreTopic() : setTopic(key)} items={[{ key: '', label: '全部' }, ...topics.slice(0, 4).map((item) => ({ key: item, label: item })), ...(topics.length > 4 ? [{ key: '__more', label: '更多' }] : [])]} /> : null}
      <View className='growth-meta'><Text>{notes.length ? `${visibleNotes.length} 篇笔记${refreshing ? ' · 正在更新' : ''}` : loading ? '正在加载笔记' : '0 篇笔记'}</Text><Text>Haigoo 职业研究</Text></View>
      {error ? <EditorialState title='笔记暂时无法加载' copy={error} actionLabel='重新加载' onAction={() => void load(true)} /> : null}
      {!loading && !error && featured ? <View aria-role='button' aria-label={`阅读 ${featured.titleZh || featured.title}`} className='growth-featured' hoverClass='mini-action--pressed' onClick={() => open(featured)}>
        <View className='growth-featured__media'><Image src={featured.coverUrl!} mode='aspectFill' lazyLoad /></View>
        <View className='growth-featured__body'>
          <Text className='growth-featured__title'>{featured.titleZh || featured.title}</Text>
          <View className='growth-featured__meta'><Text>{noteMetadata(featured)}</Text>{!featured.unlocked ? <Text className='growth-featured__access'>会员</Text> : null}</View>
        </View>
      </View> : null}
      <View className='growth-list'>
        {loading && notes.length === 0 ? <ContentSkeleton rows={4} /> : null}
        {!loading && !error && visibleNotes.length === 0 ? <View className='growth-empty'><Text>没有找到相关笔记</Text><Text onClick={() => { setSearch(''); setTopic('') }}>清除筛选</Text></View> : null}
        {listNotes.map((note) => (
          <EditorialRow className={`growth-card ${note.coverUrl ? '' : 'growth-card--no-cover'}`} key={note.id} label={`阅读 ${note.titleZh || note.title}`} onClick={() => open(note)}>
            <View className='growth-card__body'>
              <Text className='growth-card__title'>{note.titleZh || note.title}</Text>
              {note.titleZh && note.titleZh !== note.title ? <Text className='growth-card__original'>{note.title}</Text> : null}
              <Text className='growth-card__summary'>{note.summary}</Text>
              <View className='growth-card__footer'>{noteMetadata(note) ? <Text>{noteMetadata(note)}</Text> : null}{!note.unlocked ? <Text className='growth-card__access'>会员</Text> : null}</View>
            </View>
            {note.coverUrl ? <Image className='growth-card__cover' src={note.coverUrl} mode='aspectFill' lazyLoad /> : null}
          </EditorialRow>
        ))}
      </View>
      </View>
    </View>
  )
}
