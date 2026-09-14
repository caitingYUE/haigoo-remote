import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { navigateTo } from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
import { resolveMiniAvatarUrl } from '../../config/api'
import defaultUserIcon from '../../../assets/icons/default-user.svg'
import './index.scss'

interface EditorialTopBarProps {
  authenticated: boolean
  avatar?: string
  unread?: number
  showAccount?: boolean
}

export default function EditorialTopBar({ authenticated, avatar = '', unread = 0, showAccount = true }: EditorialTopBarProps) {
  const [avatarFailed, setAvatarFailed] = useState(false)
  const avatarUrl = resolveMiniAvatarUrl(avatar)
  const metrics = useMemo(() => {
    const system = Taro.getSystemInfoSync()
    const statusBarHeight = system.statusBarHeight || 20
    const menu = Taro.getMenuButtonBoundingClientRect?.()
    const barHeight = menu?.height ? (menu.top - statusBarHeight) * 2 + menu.height : 44
    const rightInset = menu?.left ? Math.max(96, system.windowWidth - menu.left + 8) : 96
    return { statusBarHeight, barHeight, rightInset }
  }, [])

  useEffect(() => setAvatarFailed(false), [avatarUrl])

  return (
    <View
      className='editorial-topbar'
      style={{ paddingTop: `${metrics.statusBarHeight}px`, height: `${metrics.statusBarHeight + metrics.barHeight}px` }}
    >
      <View className='editorial-topbar__inner' style={{ height: `${metrics.barHeight}px`, paddingRight: `${metrics.rightInset}px` }}>
        <View className='editorial-topbar__brand'>
          <Text className='editorial-topbar__brand-cn'>海狗远程</Text>
          <Text className='editorial-topbar__brand-en'>HaigooRemote</Text>
        </View>
        {showAccount ? <Button className='editorial-topbar__account' aria-label={authenticated ? unread > 0 ? '打开个人中心，有未读岗位更新' : '打开个人中心' : '登录或连接账号'} onClick={() => navigateTo({ url: '/pages/profile/index' })}>
          {authenticated && avatarUrl && !avatarFailed ? (
            <Image className='editorial-topbar__avatar' src={avatarUrl} mode='aspectFill' onError={() => setAvatarFailed(true)} />
          ) : <Image className='editorial-topbar__avatar editorial-topbar__avatar--default' src={defaultUserIcon} mode='aspectFit' />}
          {authenticated && unread > 0 ? <Text className='editorial-topbar__badge' aria-hidden /> : null}
        </Button> : null}
      </View>
    </View>
  )
}
