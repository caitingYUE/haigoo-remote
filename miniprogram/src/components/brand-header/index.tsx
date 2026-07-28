import { Image, Text, View } from '@tarojs/components'
import { StarFill } from '@nutui/icons-react-taro'
import { switchTab } from '@tarojs/taro'
import './index.scss'

interface BrandHeaderProps {
  compact?: boolean
  isMember?: boolean
}

export default function BrandHeader({ compact = false, isMember = false }: BrandHeaderProps) {
  return (
    <View className={`brand-header ${compact ? 'brand-header--compact' : ''}`}>
      <View className='brand-header__brand'>
        <Text className='brand-header__brand-cn'>海狗远程</Text>
        <Image className='brand-header__logo' src='/assets/haigoo-brand-logo.png' mode='aspectFit' />
      </View>
      <View
        className={`brand-header__status ${isMember ? 'brand-header__status--club' : ''}`}
        onClick={() => switchTab({ url: '/pages/learning/index' })}
      >
        <StarFill size={14} color={isMember ? '#ffffff' : '#5146e5'} />
        <Text>{isMember ? 'Club' : 'Free'}</Text>
      </View>
      <View className='brand-header__avatar' onClick={() => switchTab({ url: '/pages/profile/index' })}>
        <Image className='brand-header__avatar-image' src='/assets/haigoo-avatar.png' mode='aspectFill' />
      </View>
    </View>
  )
}
