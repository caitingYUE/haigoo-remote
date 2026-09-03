import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { getCurrentPages, switchTab } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import MiniIcon from '../components/mini-icon'
import type { MiniIconName } from '../components/mini-icon'
import matchIcon from '../../assets/icons/match.svg'
import matchActiveIcon from '../../assets/icons/match-active.svg'
import './index.scss'

const tabs: Array<{ path: string; label: string; icon: MiniIconName; matchIcon?: boolean }> = [
  { path: '/pages/companies/index', label: '企业', icon: 'building' },
  { path: '/pages/index/index', label: 'Match', icon: 'target', matchIcon: true },
  { path: '/pages/growth/index', label: '笔记', icon: 'notes' }
]

function currentPath() {
  const pages = getCurrentPages()
  return `/${pages[pages.length - 1]?.route || 'pages/index/index'}`
}

export default function CustomTabBar() {
  const [activePath, setActivePath] = useState(currentPath)
  const [flowHidden, setFlowHidden] = useState(() => currentPath() === '/pages/index/index')
  useEffect(() => {
    const syncActivePath = (path: string) => {
      const nextPath = path || currentPath()
      setActivePath(nextPath)
      if (nextPath !== '/pages/index/index') setFlowHidden(false)
    }
    Taro.eventCenter.on('haigoo:tab-change', syncActivePath)
    const syncMatchStep = (step: string) => setFlowHidden(step === 'start' || step === 'setup')
    Taro.eventCenter.on('haigoo:match-step', syncMatchStep)
    syncActivePath(currentPath())
    return () => {
      Taro.eventCenter.off('haigoo:tab-change', syncActivePath)
      Taro.eventCenter.off('haigoo:match-step', syncMatchStep)
    }
  }, [])

  const selectTab = (path: string) => {
    setActivePath(path)
    setFlowHidden(false)
    Taro.eventCenter.trigger('haigoo:tab-change', path)
    void switchTab({ url: path })
  }

  return <View className={`custom-tabbar ${flowHidden ? 'custom-tabbar--hidden' : ''}`}>
    <View className='custom-tabbar__tabs'>
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
        <View className={`custom-tabbar__icon ${tab.matchIcon ? 'custom-tabbar__icon--match' : ''}`}>
          {tab.matchIcon
            ? <Image className='custom-tabbar__match-icon' src={active ? matchActiveIcon : matchIcon} mode='aspectFit' />
            : <MiniIcon name={tab.icon} size={22} />}
        </View>
        <Text className='custom-tabbar__label'>{tab.label}</Text>
      </Button>
    })}
    </View>
  </View>
}
