import { Image, Text, View } from '@tarojs/components'
import { switchTab } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { resolveMiniAvatarUrl } from '../../config/api'
import MiniIcon from '../mini-icon'
import './index.scss'

interface BrandHeaderProps {
  compact?: boolean
  authenticated: boolean
  isMember?: boolean
  avatar?: string
}

export default function BrandHeader({
  compact = false,
  authenticated,
  isMember = false,
  avatar = ''
}: BrandHeaderProps) {
  const [avatarFailed, setAvatarFailed] = useState(false)
  const avatarUrl = resolveMiniAvatarUrl(avatar)

  useEffect(() => {
    setAvatarFailed(false)
  }, [avatarUrl])

  return (
    <View className={`brand-header ${compact ? 'brand-header--compact' : ''}`}>
      <View className='brand-header__brand'>
        <Text className='brand-header__brand-cn'>海狗远程</Text>
        <Image className='brand-header__logo' src='/assets/haigoo-brand-logo.png' mode='aspectFit' />
      </View>
      {authenticated ? (
        <View className='brand-header__account'>
          <View
            className={`brand-header__status ${isMember ? 'brand-header__status--club' : ''}`}
            onClick={() => switchTab({ url: '/pages/learning/index' })}
          >
            <MiniIcon name='club' size={14} />
            <Text>{isMember ? 'Club' : 'Free'}</Text>
          </View>
          <View className='brand-header__avatar' onClick={() => switchTab({ url: '/pages/profile/index' })}>
            {avatarUrl && !avatarFailed ? (
              <Image
                className='brand-header__avatar-image'
                src={avatarUrl}
                mode='aspectFill'
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <MiniIcon name='user' size={24} />
            )}
          </View>
        </View>
      ) : null}
    </View>
  )
}
