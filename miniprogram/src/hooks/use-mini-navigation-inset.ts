import Taro from '@tarojs/taro'
import { useMemo } from 'react'

export default function useMiniNavigationInset(gap = 12) {
  return useMemo(() => {
    try {
      const menu = Taro.getMenuButtonBoundingClientRect()
      if (Number(menu?.bottom) > 0) return Math.ceil(Number(menu.bottom) + gap)
      const system = Taro.getSystemInfoSync()
      return Math.ceil(Number(system.statusBarHeight || 20) + 44 + gap)
    } catch {
      return 76
    }
  }, [gap])
}
