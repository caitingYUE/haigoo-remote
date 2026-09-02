import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
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
  const cardWidth = useRef(Math.max(240, Taro.getSystemInfoSync().windowWidth - 40))
  const gesture = useRef({ x: 0, y: 0, horizontal: false, lastX: 0, lastAt: 0, velocityX: 0 })
  const depths = useMemo(() => [...Array(Math.min(4, items.length))].map((_, depth) => depth).reverse(), [items.length])

  const measure = () => {
    Taro.createSelectorQuery().select('.match-deck__card--active').boundingClientRect((rect) => {
      if (rect && !Array.isArray(rect) && Number(rect.width) > 0) cardWidth.current = Number(rect.width)
    }).exec()
  }

  const touchStart = (event) => {
    if (releasing) return
    const touch = event.touches?.[0]
    if (!touch) return
    gesture.current = { x: touch.clientX, y: touch.clientY, horizontal: false, lastX: touch.clientX, lastAt: Date.now(), velocityX: 0 }
    setHorizontal(false)
    measure()
  }

  const touchMove = (event) => {
    if (releasing) return
    const touch = event.touches?.[0]
    if (!touch) return
    const x = touch.clientX - gesture.current.x
    const y = touch.clientY - gesture.current.y
    if (!gesture.current.horizontal) {
      if (Math.abs(x) < 6 || Math.abs(x) <= Math.abs(y) * 1.05) return
      gesture.current.horizontal = true
      setHorizontal(true)
    }
    const now = Date.now()
    const elapsed = Math.max(1, now - gesture.current.lastAt)
    gesture.current.velocityX = (touch.clientX - gesture.current.lastX) / elapsed
    gesture.current.lastX = touch.clientX
    gesture.current.lastAt = now
    setOffsetX(Math.max(-cardWidth.current, Math.min(cardWidth.current, x)))
  }

  const touchEnd = () => {
    if (releasing || !gesture.current.horizontal) { setOffsetX(0); setHorizontal(false); return }
    const releaseVelocity = Date.now() - gesture.current.lastAt <= 90 ? gesture.current.velocityX : 0
    const direction = resolveDeckRelease(offsetX, cardWidth.current, releaseVelocity)
    if (!direction) { setOffsetX(0); setHorizontal(false); return }
    setReleasing(true)
    setOffsetX(direction > 0 ? -cardWidth.current * 1.12 : cardWidth.current * 1.12)
    setTimeout(() => {
      const nextIndex = wrapDeckIndex(activeIndex + direction, items.length)
      onActiveIndexChange(nextIndex, direction > 0 ? 'left' : 'right')
      setOffsetX(0)
      setHorizontal(false)
      setReleasing(false)
    }, 230)
  }

  return <View className={`match-deck ${horizontal ? 'is-dragging' : ''}`} data-snapshot-id={snapshotId} catchMove={horizontal}>
    {depths.map((depth) => {
      const stackDirection = offsetX > 0 ? -1 : 1
      const index = wrapDeckIndex(activeIndex + depth * stackDirection, items.length)
      const active = depth === 0
      const stackOffset = Math.min(48, Math.max(18, cardWidth.current * 0.08))
      const style = active
        ? { transform: `translate3d(${offsetX}px, 0, 0)` }
        : { transform: `translate3d(${stackDirection * depth * stackOffset}px, ${depth * 8}px, 0) scale(${1 - depth * 0.025})`, opacity: Math.max(0.22, 0.48 - depth * 0.08) }
      return <View
        className={`match-deck__card match-deck__card--depth-${depth} ${active ? 'match-deck__card--active' : ''} ${releasing && active ? 'is-releasing' : ''}`}
        key={`${items[index].companyId}:${depth}`}
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
