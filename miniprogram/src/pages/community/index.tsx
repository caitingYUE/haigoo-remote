import { Image, Text, View } from '@tarojs/components'
import './index.scss'

const guidelines = [
  '请真诚交流，不发布无关广告或付费推广。',
  '不要在群里公开简历、手机号等个人信息。',
  '群内信息请自行核实，求职安排以企业官方信息为准。'
]

export default function CommunityPage() {
  return (
    <View className='page-shell community-page'>
      <View className='community-heading'>
        <Text className='community-heading__title'>开放交流群</Text>
        <Text className='community-heading__copy'>和关注远程工作的伙伴，一起分享信息与经验。</Text>
      </View>

      <View className='community-qr'>
        <View className='community-qr__frame'>
          <Image
            className='community-qr__image'
            src='/assets/haigoo-community.png'
            mode='aspectFit'
            showMenuByLongpress
          />
        </View>
        <Text className='community-qr__hint'>长按识别二维码加入群聊</Text>
      </View>

      <View className='community-guidelines'>
        <Text className='community-guidelines__title'>加入前请了解</Text>
        {guidelines.map((item) => (
          <View className='community-guidelines__item' key={item}>
            <View className='community-guidelines__dot' />
            <Text>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
