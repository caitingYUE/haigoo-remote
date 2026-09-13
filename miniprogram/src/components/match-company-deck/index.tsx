import { Swiper, SwiperItem, View } from '@tarojs/components'
import type { ReactNode } from 'react'
import type { WatchFeedItem } from '../../services/career-match-service'
import { wrapDeckIndex } from '../../utils/match-deck'
import './index.scss'

interface MatchCompanyDeckProps {
  items: WatchFeedItem[]
  snapshotId: string
  activeIndex: number
  onActiveIndexChange: (index: number, direction: 'left' | 'right') => void
  renderCard: (item: WatchFeedItem, active: boolean) => ReactNode
}

export default function MatchCompanyDeck({ items, snapshotId, activeIndex, onActiveIndexChange, renderCard }: MatchCompanyDeckProps) {
  const current = wrapDeckIndex(activeIndex, items.length)
  if (!items.length) return null
  return <View className='match-deck' data-snapshot-id={snapshotId}>
    <Swiper
      className='match-deck__swiper'
      current={current}
      autoplay={false}
      circular={items.length > 1}
      duration={280}
      easingFunction='easeOutCubic'
      previousMargin='64rpx'
      nextMargin='64rpx'
      onChange={(event) => {
        // Programmatic updates must not trigger a second exposure/navigation.
        if (event.detail.source !== 'touch' || event.detail.current === current) return
        const next = event.detail.current
        const forward = next === wrapDeckIndex(current + 1, items.length)
        onActiveIndexChange(next, forward ? 'left' : 'right')
      }}
    >{items.map((item, index) => <SwiperItem className='match-deck__item' key={item.companyId}>
      <View className={`match-deck__card ${index === current ? 'match-deck__card--active' : ''}`} aria-hidden={index !== current}>
        {renderCard(item, index === current)}
      </View>
    </SwiperItem>)}</Swiper>
  </View>
}
