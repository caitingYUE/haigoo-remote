import { Image, Text, View } from '@tarojs/components'
import { navigateTo, showModal, showToast, useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import MiniIcon, { type MiniIconName } from '../../components/mini-icon'
import { resolveMiniAvatarUrl } from '../../config/api'
import { loginWithWechat } from '../../services/mini-auth-service'
import { getMiniUser, hasAuthenticatedSession } from '../../services/session'
import './index.scss'

const profileMenus = [
  { key: 'career_profile', icon: 'target' as MiniIconName, title: '职业资料', description: '查看或更新你的资料' },
  { key: 'consultations', icon: 'target' as MiniIconName, title: '职业咨询', description: '提交问题，查看咨询记录' },
  { key: 'community', icon: 'community' as MiniIconName, title: '开放交流群', description: '和大家聊聊远程工作' },
  { key: 'membership', icon: 'club' as MiniIconName, title: '会员与权益', description: '查看方案和会员有效期' },
  { key: 'orders', icon: 'application' as MiniIconName, title: '订单记录', description: '查看支付和退款状态' },
  { key: 'settings', icon: 'settings' as MiniIconName, title: '账号与安全', description: '管理密码、绑定和隐私' }
]

export default function ProfilePage() {
  const [, setSessionVersion] = useState(0)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const isAuthenticated = hasAuthenticatedSession()
  const user = getMiniUser()
  const avatarUrl = resolveMiniAvatarUrl(user?.avatar)
  useEffect(() => setAvatarFailed(false), [avatarUrl])
  useDidShow(() => setSessionVersion((value) => value + 1))

  const handleLogin = async () => {
    try {
      const session = await loginWithWechat(); setSessionVersion((value) => value + 1)
      if (!session.bound) navigateTo({ url: '/pages/account-bind/index' })
      else showToast({ title: '微信登录成功', icon: 'success' })
    } catch (error) { showModal({ title: '微信登录失败', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false }) }
  }
  const handleBindEmail = () => {
    if (!isAuthenticated) return void handleLogin()
    showModal({ title: 'Haigoo 账号已连接', content: user?.email ? `当前账号：${user.email}` : '当前微信已连接 Haigoo 账号。', showCancel: false })
  }
  const handleMenu = (key: string) => {
    if (key === 'community') return navigateTo({ url: '/pages/community/index' })
    if (key === 'membership') return navigateTo({ url: '/pages/membership/index' })
    if (!isAuthenticated) return void handleLogin()
    if (key === 'career_profile') return navigateTo({ url: '/pages/career-data/index' })
    if (key === 'consultations') return navigateTo({ url: '/pages/consultation/index' })
    if (key === 'orders') return navigateTo({ url: '/pages/payment-orders/index' })
    if (key === 'settings') navigateTo({ url: '/pages/account-settings/index' })
  }

  return (
    <View className='page-shell profile-page'>
      <View className='profile-identity'>
        <View className='profile-identity__avatar-wrap'><View className='profile-identity__avatar'>{isAuthenticated && avatarUrl && !avatarFailed ? <Image className='profile-identity__avatar-image' src={avatarUrl} mode='aspectFill' onError={() => setAvatarFailed(true)} /> : <MiniIcon name='user' size={34} />}</View></View>
        <View className='profile-identity__copy'><Text className='profile-identity__name'>{isAuthenticated ? user?.username || 'Haigoo 用户' : '登录 Haigoo'}</Text><Text className='profile-identity__role'>{isAuthenticated ? user?.email || '查看你的资料与服务' : '查看职业资料、会员和咨询记录'}</Text></View>
        {!isAuthenticated ? <View className='profile-identity__login' onClick={handleLogin}><Text>微信登录</Text></View> : null}
      </View>

      <View className='profile-section'>
        <Text className='profile-section__title'>账号状态</Text>
        <View className='profile-record' aria-role='button' onClick={handleBindEmail}>
          <View className='profile-record__icon'><MiniIcon name='mail' size={27} /></View><View className='profile-record__copy'><Text className='profile-record__title'>{isAuthenticated ? 'Haigoo 账号' : '连接 Haigoo 账号'}</Text><Text className='profile-record__meta'>{isAuthenticated ? user?.email || '已连接' : '登录后可查看会员与服务记录'}</Text></View><MiniIcon name='chevronRight' size={20} />
        </View>
        <View className='profile-record' aria-role='button' onClick={() => navigateTo({ url: '/pages/membership/index' })}>
          <View className='profile-record__icon'><MiniIcon name='club' size={27} /></View><View className='profile-record__copy'><Text className='profile-record__title'>会员与权益</Text><Text className='profile-record__meta'>{user?.isMember ? `${user.memberType || 'Haigoo 会员'} · 查看有效期与续费` : '查看会员方案'}</Text></View><MiniIcon name='chevronRight' size={20} />
        </View>
      </View>

      <View className='profile-section'>
        <Text className='profile-section__title'>服务与账号</Text>
        <View className='profile-menu'>{profileMenus.filter((item) => item.key !== 'membership').map((item) => <View className='profile-menu__item' aria-role='button' key={item.key} onClick={() => handleMenu(item.key)}><View className='profile-menu__icon'><MiniIcon name={item.icon} size={25} /></View><View className='profile-menu__copy'><Text className='profile-menu__title'>{item.title}</Text><Text className='profile-menu__description'>{item.description}</Text></View><MiniIcon name='chevronRight' size={19} /></View>)}</View>
      </View>
    </View>
  )
}
