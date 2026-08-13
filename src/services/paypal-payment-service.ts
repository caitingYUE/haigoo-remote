export type PayPalPaymentStatus =
  | 'pending' | 'capture_pending' | 'completed' | 'partially_refunded'
  | 'refunded' | 'failed' | 'review_required'

export interface PayPalPublicConfig {
  enabled: boolean
  environment: 'sandbox' | 'live'
  clientId: string
  currency: 'CNY'
  sdkVersion: 'v6'
  sdkUrl: string
}

export interface PayPalOrder {
  paymentId: string
  paypalOrderId: string
  planId: string
  planName: string
  memberType: string
  amountCents: number
  refundedAmountCents: number
  currency: string
  status: PayPalPaymentStatus
  providerStatus: string
  createdAt?: string | null
  paidAt?: string | null
  refundedAt?: string | null
  startsAt?: string | null
  expiresAt?: string | null
  refundRequestStatus?: string | null
}

export interface PayPalCaptureResult {
  order: PayPalOrder
  pending?: boolean
  entitlement?: {
    success: boolean
    alreadyCompleted?: boolean
    activationState?: 'active' | 'scheduled'
    startsAt?: string
    expiresAt?: string
  }
}

function authToken() {
  return localStorage.getItem('haigoo_auth_token') || ''
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = authToken()
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {})
    }
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.success === false) {
    const error = new Error(data?.error || 'PayPal 支付请求失败') as Error & { code?: string; status?: number; data?: unknown }
    error.code = data?.code
    error.status = response.status
    error.data = data
    throw error
  }
  return data as T
}

function requestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export const paypalPaymentClient = {
  async config() {
    const data = await request<{ success: true; config: PayPalPublicConfig }>('/api/paypal?action=config')
    return data.config
  },

  async createOrder(planId: string) {
    const data = await request<{ success: true; order: PayPalOrder }>('/api/paypal?action=create-order', {
      method: 'POST', body: JSON.stringify({ planId, idempotencyKey: requestId() })
    })
    return data.order
  },

  async captureOrder(paymentId: string, paypalOrderId: string) {
    const data = await request<{ success: true } & PayPalCaptureResult>('/api/paypal?action=capture-order', {
      method: 'POST', body: JSON.stringify({ paymentId, paypalOrderId })
    })
    return data
  },

  async listOrders(page = 1, pageSize = 10) {
    return request<{ success: true; orders: PayPalOrder[]; page: number; pageSize: number; total: number; hasMore: boolean }>(
      `/api/paypal?action=orders&page=${page}&pageSize=${pageSize}`
    )
  },

  async requestRefund(paymentId: string, reason: string) {
    return request<{ success: true; refund: { refundId: string; status: string; estimatedAmountCents: number } }>(
      '/api/paypal?action=request-refund',
      { method: 'POST', body: JSON.stringify({ paymentId, reason }) }
    )
  }
}
