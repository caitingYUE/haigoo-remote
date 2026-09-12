import { Checkbox, CheckboxGroup, Label, Text, View } from '@tarojs/components'
import { navigateTo } from '@tarojs/taro'
import './index.scss'

export default function AuthConsent({ accepted, onChange }: { accepted: boolean; onChange: (accepted: boolean) => void }) {
  return <View className='auth-consent'>
    <CheckboxGroup onChange={(event) => onChange(event.detail.value.includes('accepted'))}>
      <Label className='auth-consent__choice'>
        <Checkbox value='accepted' checked={accepted} color='#C94F22' aria-label='我已阅读并同意用户服务协议和隐私政策' />
        <Text>我已阅读并同意</Text>
      </Label>
    </CheckboxGroup>
    <View className='auth-consent__links'>
      <Text onClick={() => navigateTo({ url: '/pages/legal/index?type=terms' })}>《用户服务协议》</Text>
      <Text className='auth-consent__and'>和</Text>
      <Text onClick={() => navigateTo({ url: '/pages/legal/index?type=privacy' })}>《隐私政策》</Text>
    </View>
  </View>
}
