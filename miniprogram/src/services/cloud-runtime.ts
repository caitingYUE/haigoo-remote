import Taro from '@tarojs/taro'
import { CLOUD_ENV_ID } from '../config/api'

let resolveLaunch: (() => void) | null = null
let launchError: Error | null = null
let started = false

const launchReady = new Promise<void>((resolve) => {
  resolveLaunch = resolve
})

export function initializeCloudRuntime() {
  if (started) return
  started = true

  if (process.env.TARO_ENV !== 'weapp' || !CLOUD_ENV_ID) {
    launchError = new Error('Mini Program cloud environment is unavailable')
    resolveLaunch?.()
    return
  }

  try {
    Taro.cloud.init({ env: CLOUD_ENV_ID, traceUser: true })
  } catch (error) {
    launchError = error instanceof Error ? error : new Error(String(error))
  }
  if (launchError) {
    resolveLaunch?.()
  } else {
    Taro.nextTick(() => resolveLaunch?.())
  }
}

export async function waitForCloudRuntime() {
  await launchReady
  if (launchError) throw launchError
}
