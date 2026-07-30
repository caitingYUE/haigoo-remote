import { Image, Text, View } from '@tarojs/components'
import { navigateTo, setTabBarItem, showModal, showToast, switchTab, useDidShow } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import MiniIcon, { type MiniIconName } from '../../components/mini-icon'
import { resolveMiniAvatarUrl } from '../../config/api'
import { loginWithWechat } from '../../services/mini-auth-service'
import { getMiniUser, hasAuthenticatedSession } from '../../services/session'
import './index.scss'

const profileMenus = [
  { key: 'applications', icon: 'application' as MiniIconName, title: '申请入口记录', description: '区分已打开入口与已完成申请' },
  { key: 'favorites', icon: 'favorite' as MiniIconName, title: '收藏岗位', description: '与 Haigoo 网站收藏实时共享' },
  { key: 'learning', icon: 'subscription' as MiniIconName, title: '岗位订阅', description: '查看同步到邮箱和小程序的岗位更新' },
  { key: 'orders', icon: 'club' as MiniIconName, title: 'Club 订单', description: '查看支付状态、金额与订单号' },
  { key: 'settings', icon: 'settings' as MiniIconName, title: '账号与安全', description: '密码、退出、解绑、注销与帮助反馈' }
]

export default function ProfilePage() {
  const [, setSessionVersion] = useState(0)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const isAuthenticated = hasAuthenticatedSession()
  const user = getMiniUser()
  const avatarUrl = resolveMiniAvatarUrl(user?.avatar)

  useEffect(() => {
    setAvatarFailed(false)
  }, [avatarUrl])

  useDidShow(() => {
    setSessionVersion((value) => value + 1)
    setTabBarItem({ index: 2, text: 'Club' })
  })

  const handleLogin = async () => {
    try {
      const session = await loginWithWechat()
      setSessionVersion((value) => value + 1)
      if (!session.bound) {
        navigateTo({ url: '/pages/account-bind/index' })
        return
      }
      showToast({ title: '微信登录成功', icon: 'success' })
    } catch (error) {
      showModal({
        title: '微信登录失败',
        content: error instanceof Error ? error.message : '请稍后重试',
        showCancel: false
      })
    }
  }

  const handleBindEmail = () => {
    if (!isAuthenticated) {
      handleLogin()
      return
    }
    showModal({
      title: '网站账号已连接',
      content: user?.email
        ? `当前微信已连接 ${user.email}，Club 权益、收藏、申请入口记录与订阅会在该账号下同步。`
        : '当前微信已连接 Haigoo 网站账号，账号权益与求职记录会持续同步。',
      showCancel: false
    })
  }

  const handleMenu = (key: string) => {
    if (key === 'learning') {
      switchTab({ url: '/pages/learning/index' })
      return
    }
    if (!isAuthenticated) {
      handleLogin()
      return
    }
    if (key === 'favorites' || key === 'applications') {
      navigateTo({ url: `/pages/activity/index?tab=${key}` })
      return
    }
    if (key === 'orders') {
      navigateTo({ url: '/pages/payment-orders/index' })
      return
    }
    if (key === 'settings') navigateTo({ url: '/pages/account-settings/index' })
  }

  return (
    <View className='page-shell profile-page'>
      <View className='profile-identity'>
        <View className='profile-identity__avatar-wrap'>
          <View className='profile-identity__avatar'>
            {isAuthenticated && avatarUrl && !avatarFailed ? (
              <Image
                className='profile-identity__avatar-image'
                src={avatarUrl}
                mode='aspectFill'
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <MiniIcon name='user' size={45} />
            )}
          </View>
        </View>
        <Text className='profile-identity__name'>{isAuthenticated ? user?.username || 'Haigoo 用户' : '连接你的 Haigoo 账号'}</Text>
        <Text className='profile-identity__role'>
          {isAuthenticated ? '微信与网站账号已连接' : '使用微信继续，同步收藏、申请记录和订阅'}
        </Text>
        {!isAuthenticated ? (
          <View className='profile-identity__login' onClick={handleLogin}>
            <Text>使用微信继续</Text>
          </View>
        ) : null}
      </View>

      <View className='profile-section'>
        <Text className='profile-section__title'>账号连接</Text>
        <View className='profile-record surface-card' onClick={handleBindEmail}>
          <View className='profile-record__icon'><MiniIcon name='mail' size={27} /></View>
          <View className='profile-record__copy'>
            <Text className='profile-record__title'>{isAuthenticated ? '已连接网站账号' : '连接网站账号'}</Text>
            <Text className='profile-record__meta'>
              {isAuthenticated ? user?.email || '账号权益与求职记录已同步' : '连接后同步 Club 权益、收藏、申请记录和订阅'}
            </Text>
          </View>
          <MiniIcon name='chevronRight' size={20} />
        </View>
      </View>

      <View className='profile-section'>
        <Text className='profile-section__title'>求职中心</Text>
        <View className='profile-menu surface-card'>
          {profileMenus.map((item) => {
            return (
              <View className='profile-menu__item' key={item.key} onClick={() => handleMenu(item.key)}>
                <View className='profile-menu__icon'><MiniIcon name={item.icon} size={25} /></View>
                <View className='profile-menu__copy'>
                  <Text className='profile-menu__title'>{item.title}</Text>
                  <Text className='profile-menu__description'>{item.description}</Text>
                </View>
                <MiniIcon name='chevronRight' size={19} />
              </View>
            )
          })}
        </View>
      </View>

      <View className='profile-club'>
        <View className='profile-club__heading'>
          <View className='profile-club__icon'><MiniIcon name='club' size={20} /></View>
        </View>
        <Text className='profile-club__title'>{user?.isMember ? '查看我订阅的岗位更新' : '了解 Club 权益'}</Text>
        <Text className='profile-club__copy'>岗位订阅、企业信息、申请辅助与远程职业咨询支持。</Text>
        <View className='profile-club__button' onClick={() => switchTab({ url: '/pages/learning/index' })}>
          <Text>{user?.isMember ? '进入岗位订阅' : '查看 Club 权益'}</Text>
          <MiniIcon name='chevronRight' size={19} className='profile-club__button-icon' />
        </View>
      </View>

      <Text className='profile-page__version'>Haigoo Remote Mini Program · Cloud</Text>
    </View>
  )
}
