import { ScrollView, View } from '@tarojs/components'
import './index.scss'

interface TopicItem { key: string; label: string }
interface TopicScrollerProps {
  items: TopicItem[]
  activeKey: string
  onSelect: (key: string) => void
}

export default function TopicScroller({ items, activeKey, onSelect }: TopicScrollerProps) {
  return (
    <ScrollView className='topic-scroller' scrollX enhanced showScrollbar={false}>
      <View className='topic-scroller__inner'>
        {items.map((item) => <View className={`topic-scroller__item ${activeKey === item.key ? 'is-active' : ''}`} key={item.key} aria-role='tab' aria-label={`筛选 ${item.label}`} aria-selected={activeKey === item.key} hoverClass='mini-action--pressed' onClick={() => onSelect(item.key)}>{item.label}</View>)}
      </View>
    </ScrollView>
  )
}
