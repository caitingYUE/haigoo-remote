import { Image, View } from '@tarojs/components'
import { Search } from '@nutui/icons-react-taro'
import { switchTab } from '@tarojs/taro'
import './index.scss'

interface BrandHeaderProps {
  compact?: boolean
}

export default function BrandHeader({ compact = false }: BrandHeaderProps) {
  return (
    <View className={`brand-header ${compact ? 'brand-header--compact' : ''}`}>
      <Image className='brand-header__logo' src='/assets/haigoo-brand-logo.png' mode='aspectFit' />
      <View className='brand-header__search' onClick={() => switchTab({ url: '/pages/jobs/index' })}>
        <Search size={22} color='#7f8798' />
      </View>
      <View className='brand-header__avatar' onClick={() => switchTab({ url: '/pages/profile/index' })}>
        <Image className='brand-header__avatar-image' src='/assets/haigoo-avatar.png' mode='aspectFill' />
      </View>
    </View>
  )
}
