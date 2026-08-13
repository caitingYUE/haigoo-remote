import type { PayPalOrder } from './paypal-payment-service'

export interface AdminPaymentOrder extends PayPalOrder {
  userEmail: string
  userName: string
  refundId?: string | null
  refundReason?: string
  refundRequestedAmountCents?: number
  refundRequestedAt?: string | null
}

function token() {
  return localStorage.getItem('haigoo_auth_token') || ''
}

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token()}`,
      ...(init?.headers || {})
    }
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.success === false) throw new Error(data?.error || '支付订单操作失败')
  return data
}

export const paymentOrdersAdminService = {
  async list(params: { page?: number; pageSize?: number; status?: string; search?: string } = {}) {
    const query = new URLSearchParams({
      action: 'payment-orders',
      page: String(params.page || 1),
      pageSize: String(params.pageSize || 25),
      status: params.status || 'all',
      search: params.search || ''
    })
    return request(`/api/admin-ops?${query}`) as Promise<{
      success: true; orders: AdminPaymentOrder[]; page: number; pageSize: number; total: number; totalPages: number
    }>
  },

  async reviewRefund(refundId: string, decision: 'approve' | 'reject', note: string) {
    return request('/api/admin-ops?action=payment-orders', {
      method: 'POST', body: JSON.stringify({ operation: 'review_refund', refundId, decision, note })
    })
  }
}
