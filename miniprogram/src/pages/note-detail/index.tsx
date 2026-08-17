import { Button, Image, Text, View } from '@tarojs/components'
import { navigateBack, navigateTo, useRouter, useShareAppMessage } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import { trackMiniEvent } from '../../services/analytics-service'
import { fetchGrowthNote, fetchGrowthNotes } from '../../services/content-service'
import type { ContentBlock, GrowthNote } from '../../types'
import './index.scss'

function stripSimpleMarkdown(value: string) { return String(value || '').replace(/\*\*/g, '') }
function formatPublishedAt(value: string | null) { return value ? value.slice(0, 10).replace(/-/g, '.') : '持续更新' }

function NoteBlock({ block, index }: { block: ContentBlock; index: number }) {
  if (block.type === 'bullet_list' || block.type === 'numbered_list') {
    return <View className={`note-block note-block--${block.type}`}>{block.items?.map((item, itemIndex) => <View className='note-block__list-item' key={`${index}-${itemIndex}`}><Text className='note-block__marker'>{block.type === 'numbered_list' ? `${itemIndex + 1}.` : '·'}</Text><Text>{stripSimpleMarkdown(item)}</Text></View>)}</View>
  }
  if (block.text === '---') return <View className='note-block__divider' />
  return <Text className={`note-block note-block--${block.type}`}>{stripSimpleMarkdown(block.text || '')}</Text>
}

export default function NoteDetailPage() {
  const router = useRouter()
  const id = String(router.params.id || '')
  const [note, setNote] = useState<GrowthNote | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [related, setRelated] = useState<GrowthNote[]>([])
  const load = useCallback(async (force = false) => {
    setError('')
    try {
      const [result, allNotes] = await Promise.all([fetchGrowthNote(id, force), fetchGrowthNotes(force).catch((): GrowthNote[] => [])])
      setNote(result.note)
      setMessage(result.access.message || '')
      setRelated(allNotes.filter((item) => item.id !== id).slice(0, 2))
      if (!result.access.unlocked) void trackMiniEvent('mini_membership_wall_view', { entity_id: id, source_page: 'note_detail' })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '笔记加载失败')
    }
  }, [id])
  useEffect(() => { void load() }, [load])
  useShareAppMessage(() => ({ title: note?.titleZh || note?.title || 'Haigoo 职业笔记', path: `/pages/note-detail/index?id=${encodeURIComponent(id)}` }))

  if (error) return <View className='page-shell note-detail'><View className='empty-state'><Text className='empty-state__title'>无法打开笔记</Text><Text className='empty-state__copy'>{error}</Text><View className='empty-state__action' onClick={() => void load(true)}>重新加载</View><View className='note-detail__back' onClick={() => navigateBack()}>返回笔记列表</View></View></View>
  if (!note) return <View className='page-shell note-loading'>正在打开笔记…</View>
  return (
    <View className='page-shell note-detail'>
      <View className='note-detail__hero'>
        <Text className='eyebrow'>{note.category || '职业成长'}</Text>
        <Text className='note-detail__title'>{note.titleZh || note.title}</Text>
        {note.titleZh && note.titleZh !== note.title ? <Text className='note-detail__original'>{note.title}</Text> : null}
        <Text className='note-detail__summary'>{note.summary}</Text>
        <View className='note-detail__source'><View className='note-detail__source-mark'>H</View><View><Text>{note.authorName || 'Haigoo 职业研究'}</Text><Text>{formatPublishedAt(note.publishedAt)} · {note.durationMinutes ? `${note.durationMinutes} 分钟阅读` : '深度阅读'}{note.sourceName ? ` · ${note.sourceName}` : ''}</Text></View></View>
        <View className='note-detail__meta'><Text>{note.difficulty === 'entry' ? '入门' : '进阶'}</Text><Text>{note.tags[0] || '职业成长'}</Text><Text>{note.accessTier === 'free' ? '公开内容' : '会员内容'}</Text></View>
      </View>
      {note.coverUrl ? <Image className='note-detail__cover' src={note.coverUrl} mode='widthFix' /> : null}
      {note.unlocked ? (
        <View className='note-detail__content'>
          {note.notes?.map((block, index) => <NoteBlock block={block} index={index} key={block.id || index} />)}
        </View>
      ) : (
        <View className='note-lock'>
          <Text className='note-lock__eyebrow'>会员内容</Text><Text className='note-lock__title'>这篇笔记仅限会员阅读</Text><Text className='note-lock__copy'>{message || '开通会员后可阅读全文。'}</Text>
          <View className='primary-button note-lock__button' onClick={() => navigateTo({ url: '/pages/membership/index' })}>查看会员方案</View>
          <Text className='note-lock__consult' onClick={() => navigateTo({ url: `/pages/consultation/index?sourcePage=note&sourceContentId=${encodeURIComponent(note.id)}` })}>有疑问？咨询职业顾问</Text>
        </View>
      )}
      <View className='note-detail__finish'>
        <Button className='note-detail__share' openType='share'><MiniIcon name='share' size={21} /><Text>分享这篇笔记</Text></Button>
        {related.length ? <View className='note-related'><Text className='note-related__heading'>继续阅读</Text>{related.map((item) => <View className='note-related__item' key={item.id} aria-role='button' onClick={() => navigateTo({ url: `/pages/note-detail/index?id=${encodeURIComponent(item.id)}` })}><View><Text>{item.titleZh || item.title}</Text>{item.titleZh ? <Text>{item.title}</Text> : null}</View><MiniIcon name='chevronRight' size={18} /></View>)}</View> : null}
      </View>
    </View>
  )
}
