import { Button, Image, Text, View } from '@tarojs/components'
import { getCurrentPages, switchTab } from '@tarojs/taro'
import './index.scss'

const tabs: Array<{ path: string; label: string }> = [
  { path: '/pages/companies/index', label: '企业' },
  { path: '/pages/index/index', label: 'Match' },
  { path: '/pages/growth/index', label: '笔记' }
]

export default function CustomTabBar() {
  const pages = getCurrentPages()
  const route = `/${pages[pages.length - 1]?.route || 'pages/index/index'}`
  return (
    <View className='custom-tabbar'>
      {tabs.map((tab, index) => {
        const active = route === tab.path
        const isMatch = index === 1
        return (
          <Button
            className={`custom-tabbar__item ${isMatch ? 'custom-tabbar__item--match' : 'custom-tabbar__item--text'} ${active ? 'custom-tabbar__item--active' : ''}`}
            key={tab.path}
            aria-role='tab'
            aria-label={tab.label}
            aria-selected={active}
            hoverClass='custom-tabbar__item--pressed'
            hoverStartTime={0}
            hoverStayTime={80}
            onClick={() => switchTab({ url: tab.path })}
          >
            {isMatch ? (
              <Image
                className='custom-tabbar__match-icon'
                src={active ? '/assets/icons/match-active.svg' : '/assets/icons/match.svg'}
                mode='aspectFit'
              />
            ) : null}
            <Text className='custom-tabbar__label'>{tab.label}</Text>
          </Button>
        )
      })}
    </View>
  )
}
