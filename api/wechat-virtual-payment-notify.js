import crypto from 'crypto'
import { wechatVirtualPaymentService } from '../lib/services/wechat-virtual-payment-service.js'

function messageSignature(token, timestamp, nonce) {
  return crypto
    .createHash('sha1')
    .update([String(token || ''), String(timestamp || ''), String(nonce || '')].sort().join(''))
    .digest('hex')
}

function hasValidSignature(req) {
  const token = String(process.env.WECHAT_MESSAGE_TOKEN || '')
  const signature = String(req.query?.signature || '')
  const timestamp = String(req.query?.timestamp || '')
  const nonce = String(req.query?.nonce || '')
  if (!token || !signature || !timestamp || !nonce) return false
  const expected = messageSignature(token, timestamp, nonce)
  return signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

function parseBody(body) {
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body
  const text = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '')
  if (!text.trim()) return {}
  return JSON.parse(text)
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function relaySignature(secret, timestamp, notification) {
  return crypto
    .createHmac('sha256', String(secret || ''))
    .update(`${String(timestamp || '')}.${canonicalJson(notification)}`)
    .digest('hex')
}

function hasValidRelaySignature(req, notification) {
  const secret = String(process.env.WECHAT_VIRTUAL_PAYMENT_RELAY_SECRET || '')
  const timestamp = String(req.headers?.['x-haigoo-payment-relay-timestamp'] || '')
  const signature = String(req.headers?.['x-haigoo-payment-relay-signature'] || '')
  const timestampMs = Number(timestamp)
  if (
    !secret ||
    !signature ||
    !Number.isFinite(timestampMs) ||
    Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000
  ) {
    return false
  }
  const expected = relaySignature(secret, timestamp, notification)
  return signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

async function forwardSandboxNotification(notification) {
  const origin = String(process.env.WECHAT_VIRTUAL_PAYMENT_SANDBOX_CALLBACK_ORIGIN || '')
    .trim()
    .replace(/\/+$/, '')
  const secret = String(process.env.WECHAT_VIRTUAL_PAYMENT_RELAY_SECRET || '')
  if (!/^https:\/\/[A-Za-z0-9.-]+$/.test(origin) || !secret) {
    throw Object.assign(new Error('微信沙箱支付回调转发尚未配置'), {
      statusCode: 503,
      code: 'VIRTUAL_PAYMENT_SANDBOX_RELAY_NOT_CONFIGURED'
    })
  }
  const timestamp = String(Date.now())
  const headers = {
    'content-type': 'application/json',
    'x-haigoo-payment-relay-timestamp': timestamp,
    'x-haigoo-payment-relay-signature': relaySignature(secret, timestamp, notification)
  }
  const bypassSecret = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '')
  if (bypassSecret) headers['x-vercel-protection-bypass'] = bypassSecret

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(`${origin}/api/wechat-virtual-payment-notify`, {
      method: 'POST',
      headers,
      body: JSON.stringify(notification),
      signal: controller.signal
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.ErrCode == null || Number(payload.ErrCode) !== 0) {
      throw new Error(`sandbox callback returned ${response.status}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}

function success(res) {
  return res.status(200).json({ ErrCode: 0, ErrMsg: 'success' })
}

/**
 * WeChat Mini Program message-push endpoint for virtual-payment events.
 *
 * Configure the Mini Program message service as:
 * - data format: JSON
 * - encryption: plaintext
 *
 * HTTPS plus the WeChat SHA-1 message signature authenticate plaintext mode.
 * Encrypted/compatibility mode is deliberately rejected until its AES key is
 * configured and the corresponding decryptor is enabled.
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!hasValidSignature(req)) {
      return res.status(401).json({ ErrCode: 401, ErrMsg: 'invalid signature' })
    }
    const echo = String(req.query?.echostr || '')
    return res.status(200).send(echo)
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ErrCode: 405, ErrMsg: 'method not allowed' })
  }

  try {
    const notification = parseBody(req.body)
    const validWechatSignature = hasValidSignature(req)
    const validRelaySignature = hasValidRelaySignature(req, notification)
    if (!validWechatSignature && !validRelaySignature) {
      console.warn('[wechat-virtual-payment] callback authentication rejected', {
        event: String(notification?.Event || ''),
        env: Number(notification?.Env),
        hasWechatSignature: Boolean(req.query?.signature && req.query?.timestamp && req.query?.nonce),
        hasRelaySignature: Boolean(
          req.headers?.['x-haigoo-payment-relay-timestamp']
          && req.headers?.['x-haigoo-payment-relay-signature']
        )
      })
      return res.status(401).json({ ErrCode: 401, ErrMsg: 'invalid signature' })
    }
    if (validRelaySignature && !(notification?.Event === 'xpay_refund_notify' && notification?.Env == null) && Number(notification?.Env) !== 1) {
      return res.status(400).json({ ErrCode: 400, ErrMsg: 'invalid relay environment' })
    }
    if (notification?.Encrypt || req.query?.encrypt_type === 'aes') {
      return res.status(503).json({
        ErrCode: 503,
        ErrMsg: 'encrypted message mode is not configured'
      })
    }
    const event = String(notification?.Event || '')
    const paymentEvent = ['xpay_goods_deliver_notify', 'xpay_refund_notify'].includes(event)
    if (paymentEvent) {
      if (validRelaySignature && process.env.VERCEL_ENV === 'production') {
        return res.status(400).json({ ErrCode: 400, ErrMsg: 'relay loop rejected' })
      }
      // WeChat's documented refund payload does not include Env. Resolve from the original order.
      let env = notification?.Env
      if (event === 'xpay_refund_notify' && env == null) {
        env = await wechatVirtualPaymentService.getRefundEnvironment(notification)
        if (env == null) {
          // Sandbox refunds also omit Env. The Preview callback performs the
          // same order/OpenId/amount checks before applying the notification.
          if (process.env.VERCEL_ENV === 'production' && validWechatSignature && !validRelaySignature) {
            await forwardSandboxNotification(notification)
            return success(res)
          }
          return res.status(404).json({ ErrCode: 404, ErrMsg: 'order environment unresolved' })
        }
      }
      if (env == null || ![0, 1].includes(Number(env))) {
        return res.status(400).json({ ErrCode: 400, ErrMsg: 'invalid environment' })
      }
      if (process.env.VERCEL_ENV === 'production' && Number(env) === 1) {
        if (validRelaySignature) return res.status(400).json({ ErrCode: 400, ErrMsg: 'relay loop rejected' })
        await forwardSandboxNotification(notification)
        return success(res)
      }
      if (process.env.VERCEL_ENV === 'preview' && Number(env) !== 1) {
        return res.status(400).json({ ErrCode: 400, ErrMsg: 'invalid preview environment' })
      }
    }
    if (event === 'xpay_goods_deliver_notify') {
      await wechatVirtualPaymentService.completeOrder(notification)
      return success(res)
    }
    if (event === 'xpay_refund_notify' || event === 'xpay_complaint_notify') {
      if (event === 'xpay_refund_notify') {
        const result = await wechatVirtualPaymentService.applyRefund(notification)
        if (result.requiresManualReview) console.warn('[wechat-virtual-payment] refund requires review', { paymentId: notification.MchOrderId })
        return success(res)
      }
      console.warn('[wechat-virtual-payment] manual follow-up event received', {
        event,
        outTradeNo: String(notification?.OutTradeNo || ''),
        transactionId: String(notification?.WeChatPayInfo?.TransactionId || '')
      })
      return success(res)
    }
    // A shared Mini Program message-push URL can receive unrelated events.
    // Acknowledge them without exposing request data or changing entitlements.
    return success(res)
  } catch (error) {
    console.error('[wechat-virtual-payment] notification failed', {
      code: error?.code || 'INTERNAL_ERROR',
      message: error?.message || 'unknown error'
    })
    const status = Number(error?.statusCode || 500)
    return res.status(status >= 400 && status <= 599 ? status : 500).json({
      ErrCode: status >= 400 && status <= 599 ? status : 500,
      ErrMsg: 'failed'
    })
  }
}

export {
  canonicalJson,
  hasValidRelaySignature,
  hasValidSignature,
  messageSignature,
  relaySignature
}
