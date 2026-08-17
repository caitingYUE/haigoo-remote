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
        {items.map((item) => <View className={`topic-scroller__item ${activeKey === item.key ? 'is-active' : ''}`} key={item.key} aria-role='tab' aria-selected={activeKey === item.key} onClick={() => onSelect(item.key)}>{item.label}</View>)}
      </View>
    </ScrollView>
  )
}
