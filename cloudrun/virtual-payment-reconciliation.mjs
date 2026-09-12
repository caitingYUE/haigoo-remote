import crypto from 'crypto'

const QUERY_CACHE_LIMIT = 500
const QUERY_CACHE_MS = 60_000

export function virtualPaymentQuerySignature(appKey, body) {
  return crypto.createHmac('sha256', appKey).update(`/xpay/query_order&${body}`).digest('hex')
}

export function isRefundReconciliationCandidate(order) {
  return ['completed', 'partially_refunded'].includes(String(order?.status || ''))
}

export function createVirtualPaymentReconciler({ appId, appSecret, appKey, env, fetchImpl = fetch }) {
  let tokenCache = { token: '', expiresAt: 0, pending: null }
  const checkedUntil = new Map()

  async function accessToken() {
    if (tokenCache.token && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token
    if (tokenCache.pending) return tokenCache.pending
    tokenCache.pending = (async () => {
      if (!appId || !appSecret) throw new Error('微信访问凭据未配置')
      const response = await fetchImpl('https://api.weixin.qq.com/cgi-bin/stable_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'client_credential', appid: appId, secret: appSecret, force_refresh: false }),
        signal: AbortSignal.timeout(5000)
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.access_token) throw new Error(`微信访问凭证获取失败 (${data.errcode || response.status})`)
      tokenCache = {
        token: String(data.access_token),
        expiresAt: Date.now() + Math.max(300, Number(data.expires_in || 7200) - 120) * 1000,
        pending: null
      }
      return tokenCache.token
    })()
    try {
      return await tokenCache.pending
    } finally {
      tokenCache.pending = null
    }
  }

  function clearAccessToken() {
    tokenCache = { token: '', expiresAt: 0, pending: null }
  }

  async function queryOrder(body, retryAuthentication = true) {
    const token = await accessToken()
    const paySig = virtualPaymentQuerySignature(appKey, body)
    const response = await fetchImpl(`https://api.weixin.qq.com/xpay/query_order?access_token=${encodeURIComponent(token)}&pay_sig=${paySig}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(5000)
    })
    const data = await response.json().catch(() => ({}))
    if (retryAuthentication && (response.status === 401 || [40014, 42001].includes(Number(data.errcode)))) {
      clearAccessToken()
      return queryOrder(body, false)
    }
    if (!response.ok || Number(data.errcode || 0) !== 0) throw new Error(`微信支付订单查询失败 (${data.errcode || response.status})`)
    return data
  }

  async function reconcile(order, persist) {
    if (!isRefundReconciliationCandidate(order)) return false
    if (![0, 1].includes(Number(env)) || String(appKey || '').length < 16) throw new Error('微信虚拟支付环境未配置')
    const paymentId = String(order.paymentId || '')
    const cacheKey = `${Number(env)}:${paymentId}:${Math.max(0, Number(order.refundedAmountCents || 0))}`
    if (Number(checkedUntil.get(cacheKey) || 0) > Date.now()) return false
    const body = JSON.stringify({ openid: String(order.openid || ''), env: Number(env), order_id: paymentId })
    const data = await queryOrder(body)
    const providerOrder = data.order
    if (!providerOrder || typeof providerOrder !== 'object' || Array.isArray(providerOrder)) throw new Error('微信支付订单查询缺少订单数据')
    const status = Number(providerOrder.status)
    const paidFee = Number(providerOrder.paid_fee)
    const leftFee = Number(providerOrder.left_fee)
    if (
      String(providerOrder.order_id || '') !== paymentId ||
      Number(providerOrder.order_type) !== 0 ||
      Number(providerOrder.env_type) !== (Number(env) === 0 ? 1 : 2) ||
      !Number.isSafeInteger(status) || status < 0 || status > 8 ||
      !Number.isSafeInteger(paidFee) || !Number.isSafeInteger(leftFee) ||
      paidFee <= 0 || leftFee < 0 || leftFee > paidFee
    ) {
      throw new Error('微信支付订单查询响应与本地订单不匹配')
    }
    checkedUntil.set(cacheKey, Date.now() + QUERY_CACHE_MS)
    while (checkedUntil.size > QUERY_CACHE_LIMIT) checkedUntil.delete(checkedUntil.keys().next().value)
    // query_order exposes only a cumulative amount, not a provider refund id.
    // Keep partial refunds callback-driven to avoid double-counting a later real
    // callback; a full refund can safely absorb that callback in SQL.
    if (leftFee !== 0) return false
    const result = await persist({
      openid: String(order.openid || ''),
      paymentId,
      env: Number(env),
      providerStatus: status,
      paidFee,
      leftFee,
      queriedAt: new Date().toISOString()
    })
    return Boolean(result?.changed)
  }

  return { reconcile }
}
