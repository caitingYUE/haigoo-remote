import userHelper from '../../server-utils/user-helper.js'
import { paypalPaymentService } from '../services/paypal-payment-service.js'

export default async function paymentOrdersHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  const adminCheck = await userHelper.validateAdminRequest(req)
  if (!adminCheck.valid) {
    return res.status(adminCheck.error === 'Forbidden' ? 403 : 401).json({ success: false, error: adminCheck.error || 'Unauthorized' })
  }
  const admin = adminCheck.user
  const adminUserId = admin?.userId || admin?.user_id || admin?.email || 'admin'
  try {
    if (req.method === 'GET') {
      const data = await paypalPaymentService.listAdminOrders({
        page: req.query?.page, pageSize: req.query?.pageSize, status: req.query?.status, search: req.query?.search
      })
      return res.status(200).json({ success: true, ...data })
    }
    if (req.method === 'POST' && req.body?.operation === 'review_refund') {
      const result = await paypalPaymentService.reviewRefund({
        refundId: req.body?.refundId,
        adminUserId,
        approve: req.body?.decision === 'approve',
        note: req.body?.note
      })
      return res.status(200).json({ success: true, refund: result })
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (requestError) {
    console.error('[payment-orders] Request failed:', requestError?.code || requestError?.message || requestError)
    return res.status(Number(requestError?.statusCode || 500)).json({
      success: false, code: requestError?.code || 'PAYMENT_ORDER_ERROR',
      error: requestError?.message || '支付订单操作失败'
    })
  }
}
