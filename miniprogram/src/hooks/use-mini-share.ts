import Taro, { useShareAppMessage } from '@tarojs/taro'
import { useEffect } from 'react'

export default function useMiniShare(title: string, path: string) {
  useEffect(() => {
    void Taro.showShareMenu({ withShareTicket: false }).catch(() => undefined)
  }, [])
  useShareAppMessage(() => ({ title, path }))
}
