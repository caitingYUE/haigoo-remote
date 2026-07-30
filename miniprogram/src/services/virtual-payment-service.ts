import Taro from '@tarojs/taro'
import { createRequestKey, requestJson } from './api-client'
import { trackMiniEvent } from './analytics-service'
import { MINI_AGREEMENT_VERSION, MINI_PRIVACY_VERSION } from '../config/legal'

interface VirtualPaymentParams {
  mode: 'short_series_goods'
  signData: string
  paySig: string
  signature: string
}

interface VirtualPaymentOrder {
  paymentId: string
  planId: string
  amountCents: number
  currency: string
  status: 'pending' | 'completed' | 'failed' | 'refunded' | string
  createdAt?: string | null
  paidAt?: string | null
}

interface CreateVirtualPaymentResponse {
  order: VirtualPaymentOrder
  payment: VirtualPaymentParams
}

interface VirtualPaymentOrderList {
  orders: VirtualPaymentOrder[]
  page: number
  pageSize: number
  total: number
  hasMore: boolean
}

interface VirtualPaymentFailure {
  errMsg?: string
  errCode?: number
}

declare const wx: {
  canIUse(api: string): boolean
  getSystemInfoSync(): { SDKVersion?: string }
  requestVirtualPayment(options: VirtualPaymentParams & {
    success: () => void
    fail: (error: VirtualPaymentFailure) => void
  }): void
}

function compareVersion(first: string, second: string) {
  const left = String(first || '').split('.').map((value) => Number.parseInt(value, 10) || 0)
  const right = String(second || '').split('.').map((value) => Number.parseInt(value, 10) || 0)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0)
    if (difference !== 0) return difference > 0 ? 1 : -1
  }
  return 0
}

function supportsVirtualPayment() {
  if (process.env.TARO_ENV !== 'weapp' || typeof wx === 'undefined') return false
  const sdkVersion = String(wx.getSystemInfoSync()?.SDKVersion || '')
  return compareVersion(sdkVersion, '2.19.2') >= 0 || wx.canIUse('requestVirtualPayment')
}

function requestWechatVirtualPayment(payment: VirtualPaymentParams) {
  return new Promise<void>((resolve, reject) => {
    wx.requestVirtualPayment({
      ...payment,
      success: resolve,
      fail: (failure) => {
        const error = new Error(String(failure?.errMsg || '微信支付未完成'))
        ;(error as Error & { errCode?: number }).errCode = Number(failure?.errCode || 0)
        reject(error)
      }
    })
  })
}

export async function getVirtualPaymentOrder(paymentId: string) {
  const response = await requestJson<{ order: VirtualPaymentOrder }>(
    `/mini/payments/orders/${encodeURIComponent(paymentId)}`,
    { authenticated: true }
  )
  return response.order
}

export async function getVirtualPaymentOrders(page = 1, pageSize = 20) {
  return requestJson<VirtualPaymentOrderList>(
    `/mini/payments/orders?page=${Math.max(1, page)}&pageSize=${Math.min(50, Math.max(1, pageSize))}`,
    { authenticated: true }
  )
}

async function waitForPaymentConfirmation(paymentId: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const order = await getVirtualPaymentOrder(paymentId)
    if (order.status === 'completed' || order.status === 'failed' || order.status === 'refunded') return order
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  return getVirtualPaymentOrder(paymentId)
}

export async function purchaseClubPlan(planId: string) {
  if (!supportsVirtualPayment()) {
    throw new Error('当前微信版本不支持小程序虚拟支付，请升级微信后重试')
  }
  const login = await Taro.login()
  if (!login.code) throw new Error('未能获取微信支付身份，请重试')
  const created = await requestJson<CreateVirtualPaymentResponse>('/mini/payments/orders', {
    method: 'POST',
    authenticated: true,
    data: {
      planId,
      code: login.code,
      agreementVersion: MINI_AGREEMENT_VERSION,
      privacyVersion: MINI_PRIVACY_VERSION,
      acceptedAt: new Date().toISOString(),
      idempotencyKey: createRequestKey(`virtual-payment-${planId}`)
    }
  })
  if (!created.order?.paymentId || !created.payment?.signData) {
    throw new Error('微信支付订单创建失败，请稍后重试')
  }

  void trackMiniEvent('mini_virtual_payment_started', {
    entity_id: planId,
    flow_id: created.order.paymentId,
    value: created.order.amountCents
  })
  try {
    await requestWechatVirtualPayment(created.payment)
  } catch (error) {
    const message = error instanceof Error ? error.message : '微信支付未完成'
    const cancelled = /cancel/i.test(message)
    void trackMiniEvent('mini_virtual_payment_result', {
      entity_id: planId,
      flow_id: created.order.paymentId,
      status: cancelled ? 'cancelled' : 'failed'
    })
    if (cancelled) throw new Error('已取消支付')
    throw error
  }

  const order = await waitForPaymentConfirmation(created.order.paymentId)
  void trackMiniEvent('mini_virtual_payment_result', {
    entity_id: planId,
    flow_id: created.order.paymentId,
    status: order.status
  })
  return order
}

export type {
  VirtualPaymentOrder,
  VirtualPaymentOrderList
}
