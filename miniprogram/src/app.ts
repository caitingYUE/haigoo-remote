import Taro from '@tarojs/taro'
import { PropsWithChildren, useEffect } from 'react'
import { CLOUD_ENV_ID } from './config/api'
import { reportMiniError, trackMiniEvent } from './services/analytics-service'
import { getMiniUser } from './services/session'
import './app.scss'

function App({ children }: PropsWithChildren<Record<string, never>>) {
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
      if (CLOUD_ENV_ID) Taro.cloud.init({ env: CLOUD_ENV_ID, traceUser: true })
      Taro.setTabBarItem({ index: 2, text: getMiniUser()?.isMember ? '订阅' : '会员' })
      void trackMiniEvent('mini_app_launch', { page_key: 'app' })

      const updateManager = Taro.getUpdateManager()
      updateManager.onUpdateReady(() => {
        Taro.showModal({
          title: '发现新版本',
          content: '新版已经准备好，重启后即可使用。',
          showCancel: false,
          confirmText: '立即更新',
          success: ({ confirm }) => {
            if (confirm) updateManager.applyUpdate()
          }
        })
      })
      updateManager.onUpdateFailed(() => {
        Taro.showModal({
          title: '更新未完成',
          content: '新版本下载失败，请检查网络后重新打开小程序。',
          showCancel: false
        })
      })

      const onError = (message: string) => { void reportMiniError(message, 'taro_on_error') }
      const onUnhandledRejection = (event: Taro.onUnhandledRejection.Result) => {
        void reportMiniError(event.reason, 'taro_unhandled_rejection')
      }
      Taro.onError(onError)
      Taro.onUnhandledRejection(onUnhandledRejection)
      return () => {
        Taro.offError(onError)
        Taro.offUnhandledRejection(onUnhandledRejection)
      }
    }
  }, [])
  return children
}

export default App
