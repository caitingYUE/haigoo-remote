import { Image, Text, View } from '@tarojs/components'
import { switchTab } from '@tarojs/taro'
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
            {avatar ? (
              <Image className='brand-header__avatar-image' src={avatar} mode='aspectFill' />
            ) : (
              <MiniIcon name='user' size={24} />
            )}
          </View>
        </View>
      ) : null}
    </View>
  )
}
