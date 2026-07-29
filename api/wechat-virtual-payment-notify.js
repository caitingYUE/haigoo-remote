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
  if (!hasValidSignature(req)) {
    return res.status(401).json({ ErrCode: 401, ErrMsg: 'invalid signature' })
  }

  if (req.method === 'GET') {
    const echo = String(req.query?.echostr || '')
    return res.status(200).send(echo)
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ErrCode: 405, ErrMsg: 'method not allowed' })
  }

  try {
    const notification = parseBody(req.body)
    if (notification?.Encrypt || req.query?.encrypt_type === 'aes') {
      return res.status(503).json({
        ErrCode: 503,
        ErrMsg: 'encrypted message mode is not configured'
      })
    }
    const event = String(notification?.Event || '')
    if (event === 'xpay_goods_deliver_notify') {
      await wechatVirtualPaymentService.completeOrder(notification)
      return success(res)
    }
    if (event === 'xpay_refund_notify' || event === 'xpay_complaint_notify') {
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
  hasValidSignature,
  messageSignature
}
