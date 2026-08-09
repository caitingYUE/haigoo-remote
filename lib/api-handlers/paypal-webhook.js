import { paypalPaymentService } from '../services/paypal-payment-service.js'

function normalizedHeaders(req) {
  return Object.fromEntries(Object.entries(req.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value || '')]))
}

export default async function paypalWebhookHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })
  if (!paypalPaymentService.isEnabled() || !paypalPaymentService.isConfigured()) {
    return res.status(503).json({ success: false, error: 'PayPal webhook is disabled' })
  }
  try {
    const event = req.body && typeof req.body === 'object' ? req.body : JSON.parse(String(req.body || '{}'))
    const verified = await paypalPaymentService.verifyWebhook(normalizedHeaders(req), event)
    if (!verified) return res.status(400).json({ success: false, error: 'Invalid webhook signature' })
    const result = await paypalPaymentService.processWebhook(event)
    return res.status(200).json({ success: true, ...result })
  } catch (webhookError) {
    console.error('[paypal-webhook] Processing failed:', webhookError?.code || webhookError?.message || webhookError)
    return res.status(Number(webhookError?.statusCode || 500)).json({ success: false, error: 'Webhook processing failed' })
  }
}
