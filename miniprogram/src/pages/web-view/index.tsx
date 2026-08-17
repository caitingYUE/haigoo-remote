import { Text, View, WebView } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useMemo } from 'react'
import './index.scss'

export default function ApplyWebViewPage() {
  const router = useRouter()
  const source = useMemo(() => {
    try {
      const value = decodeURIComponent(String(router.params.url || ''))
      const parsed = new URL(value)
      return parsed.protocol === 'https:' && ['haigooremote.com', 'www.haigooremote.com'].includes(parsed.hostname) ? parsed.toString() : ''
    } catch {
      return ''
    }
  }, [router.params.url])

  if (!source) return <View className='web-view-error'><Text>申请入口无效</Text><Text>请返回 Match 页面重新打开。</Text></View>
  return <WebView src={source} />
}
