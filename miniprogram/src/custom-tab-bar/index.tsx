import { Button, Text, View } from '@tarojs/components'
import Taro, { getCurrentPages, switchTab } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import MiniIcon from '../components/mini-icon'
import type { MiniIconName } from '../components/mini-icon'
import { getMiniUser } from '../services/session'
import './index.scss'

const tabs: Array<{ path: string; label: string; icon: MiniIconName }> = [
  { path: '/pages/index/index', label: '匹配', icon: 'target' },
  { path: '/pages/companies/index', label: '企业', icon: 'building' },
  { path: '/pages/growth/index', label: '笔记', icon: 'notes' },
  { path: '/pages/profile/index', label: '我的', icon: 'user' }
]

function currentPath() {
  const pages = getCurrentPages()
  return `/${pages[pages.length - 1]?.route || 'pages/index/index'}`
}

function unreadCount() {
  const user = getMiniUser()
  if (!user?.userId) return 0
  try {
    return Math.min(99, Number(Taro.getStorageSync(`haigoo-career-watch:${user.userId}`)?.followedUpdates?.length || 0))
  } catch { return 0 }
}

export default function CustomTabBar() {
  const [activePath, setActivePath] = useState(currentPath)
  const [unread, setUnread] = useState(unreadCount)
  useEffect(() => {
    const syncActivePath = (path: string) => { setActivePath(path || currentPath()); setUnread(unreadCount()) }
    const syncUnread = (count?: number) => setUnread(Number.isFinite(Number(count)) ? Math.min(99, Number(count)) : unreadCount())
    Taro.eventCenter.on('haigoo:tab-change', syncActivePath)
    Taro.eventCenter.on('haigoo:unread-change', syncUnread)
    syncActivePath(currentPath())
    return () => { Taro.eventCenter.off('haigoo:tab-change', syncActivePath); Taro.eventCenter.off('haigoo:unread-change', syncUnread) }
  }, [])

  const selectTab = (path: string) => {
    setActivePath(path)
    Taro.eventCenter.trigger('haigoo:tab-change', path)
    void switchTab({ url: path })
  }

  return <View className='custom-tabbar'>
    {tabs.map((tab) => {
      const active = activePath === tab.path
      return <Button
        className={`custom-tabbar__item ${active ? 'custom-tabbar__item--active' : ''}`}
        key={tab.path}
        aria-role='tab'
        aria-label={tab.label}
        aria-selected={active}
        hoverClass='custom-tabbar__item--pressed'
        hoverStartTime={0}
        hoverStayTime={80}
        onClick={() => selectTab(tab.path)}
      >
        <View className='custom-tabbar__icon'><MiniIcon name={tab.icon} size={22} /></View>
        <Text className='custom-tabbar__label'>{tab.label}</Text>
        {tab.path === '/pages/profile/index' && unread > 0 ? <Text className='custom-tabbar__badge'>{unread > 9 ? '9+' : unread}</Text> : null}
      </Button>
    })}
  </View>
}
