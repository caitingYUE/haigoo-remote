import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { WatchFeedItem } from '../../services/career-match-service'
import { resolveDeckRelease, wrapDeckIndex } from '../../utils/match-deck'
import './index.scss'

interface MatchCompanyDeckProps {
  items: WatchFeedItem[]
  snapshotId: string
  activeIndex: number
  onActiveIndexChange: (index: number, direction: 'left' | 'right') => void
  renderCard: (item: WatchFeedItem, active: boolean) => ReactNode
}

export default function MatchCompanyDeck({ items, snapshotId, activeIndex, onActiveIndexChange, renderCard }: MatchCompanyDeckProps) {
  const [offsetX, setOffsetX] = useState(0)
  const [horizontal, setHorizontal] = useState(false)
  const [releasing, setReleasing] = useState(false)
  const cardWidth = useRef(Math.max(240, Taro.getSystemInfoSync().windowWidth - 52))
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gesture = useRef({ x: 0, y: 0, horizontal: false, lastX: 0, lastAt: 0, velocityX: 0, offsetX: 0 })
  const positions = items.length > 1 ? [-1, 0, 1] : [0]

  useEffect(() => () => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current)
  }, [])

  const measure = () => {
    Taro.createSelectorQuery().select('.match-deck__card--active').boundingClientRect((rect) => {
      if (rect && !Array.isArray(rect) && Number(rect.width) > 0) cardWidth.current = Number(rect.width)
    }).exec()
  }

  useEffect(() => {
    measure()
  }, [activeIndex, items.length])

  const touchStart = (event) => {
    if (releasing) return
    const touch = event.touches?.[0]
    if (!touch) return
    gesture.current = { x: touch.clientX, y: touch.clientY, horizontal: false, lastX: touch.clientX, lastAt: Date.now(), velocityX: 0, offsetX: 0 }
    setHorizontal(false)
    setOffsetX(0)
    measure()
  }

  const touchMove = (event) => {
    if (releasing) return
    const touch = event.touches?.[0]
    if (!touch) return
    const x = touch.clientX - gesture.current.x
    const y = touch.clientY - gesture.current.y
    if (!gesture.current.horizontal) {
      if (Math.abs(x) < 2 || Math.abs(x) <= Math.abs(y) * 1.05) return
      gesture.current.horizontal = true
      setHorizontal(true)
    }
    const now = Date.now()
    const elapsed = Math.max(1, now - gesture.current.lastAt)
    gesture.current.velocityX = (touch.clientX - gesture.current.lastX) / elapsed
    gesture.current.lastX = touch.clientX
    gesture.current.lastAt = now
    const limit = cardWidth.current
    const bounded = Math.max(-limit, Math.min(limit, x))
    const overflow = Math.abs(x) - limit
    const resisted = overflow > 0 ? Math.sign(x) * (limit + Math.min(overflow * 0.28, limit * 0.14)) : bounded
    gesture.current.offsetX = resisted
    setOffsetX(resisted)
  }

  const touchEnd = () => {
    if (releasing || !gesture.current.horizontal) { setOffsetX(0); setHorizontal(false); return }
    const releaseVelocity = Date.now() - gesture.current.lastAt <= 90 ? gesture.current.velocityX : 0
    const currentOffset = gesture.current.offsetX
    const direction = resolveDeckRelease(currentOffset, cardWidth.current, releaseVelocity)
    if (!direction) { gesture.current.offsetX = 0; setOffsetX(0); setHorizontal(false); return }
    setReleasing(true)
    setOffsetX(direction > 0 ? -cardWidth.current * 1.12 : cardWidth.current * 1.12)
    releaseTimer.current = setTimeout(() => {
      const nextIndex = wrapDeckIndex(activeIndex + direction, items.length)
      onActiveIndexChange(nextIndex, direction > 0 ? 'left' : 'right')
      gesture.current.offsetX = 0
      setOffsetX(0)
      setHorizontal(false)
      setReleasing(false)
    }, 230)
  }

  return <View className={`match-deck ${horizontal ? 'is-dragging' : ''}`} data-snapshot-id={snapshotId} catchMove={horizontal}>
    {positions.map((position) => {
      const index = wrapDeckIndex(activeIndex + position, items.length)
      const active = position === 0
      const style = active
        ? { transform: `translate3d(${offsetX}px, 0, 0)` }
        : { transform: `translate3d(${position * (cardWidth.current + 12)}px, 0, 0)` }
      return <View
        className={`match-deck__card ${position < 0 ? 'match-deck__card--previous' : position > 0 ? 'match-deck__card--next' : 'match-deck__card--active'} ${releasing && active ? 'is-releasing' : ''}`}
        key={`${items[index].companyId}:${position}`}
        style={style}
        aria-hidden={!active}
        onTouchStart={active ? touchStart : undefined}
        onTouchMove={active ? touchMove : undefined}
        onTouchEnd={active ? touchEnd : undefined}
        onTouchCancel={active ? touchEnd : undefined}
      >{renderCard(items[index], active)}</View>
    })}
  </View>
}
