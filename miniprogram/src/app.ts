import Taro from '@tarojs/taro'
import { PropsWithChildren, useEffect } from 'react'
import { configure as configureNutIcons } from '@nutui/icons-react-taro'
import { reportMiniError, trackMiniEvent } from './services/analytics-service'
import './app.scss'

// NutUI defaults to the unsupported HTML `i` tag. Render icons with the
// native Mini Program view node so Taro can resolve every dynamic template.
configureNutIcons({ tag: 'view' })

function App({ children }: PropsWithChildren<Record<string, never>>) {
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp') {
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
