import { Text, View } from '@tarojs/components'
import { Link } from '@nutui/icons-react-taro'
import { setClipboardData, showToast } from '@tarojs/taro'
import './index.scss'

const WEBSITE_URL = 'https://haigooremote.com/'

export default function WebsiteNotice() {
  const copyWebsite = async () => {
    await setClipboardData({ data: WEBSITE_URL })
    showToast({ title: '网站地址已复制', icon: 'success' })
  }

  return (
    <View className='website-notice' onClick={copyWebsite}>
      <Link size={18} color='#6f78a0' />
      <View className='website-notice__copy'>
        <Text>小程序主要展示岗位信息，完整功能和内容请访问网站</Text>
        <Text className='website-notice__url'>{WEBSITE_URL}</Text>
      </View>
      <Text className='website-notice__action'>复制</Text>
    </View>
  )
}
