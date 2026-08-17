import { Text, View } from '@tarojs/components'
import { Loading, Search } from '@nutui/icons-react-taro'
import {
  navigateTo,
  setClipboardData,
  showToast,
  stopPullDownRefresh,
  useDidShow,
  usePullDownRefresh
} from '@tarojs/taro'
import { useCallback, useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import {
  getVirtualPaymentOrders,
  type VirtualPaymentOrder
} from '../../services/virtual-payment-service'
import { hasAuthenticatedSession } from '../../services/session'
import './index.scss'

const PAGE_SIZE = 20

const PLAN_NAMES: Record<string, string> = {
  club_starter_monthly: 'Club Starter',
  club_half_year: 'Club Member',
  club_annual: 'Club Partner'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return [
    `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  ].join(' ')
}

function formatAmount(amountCents: number, currency: string) {
  const amount = Math.max(0, Number(amountCents || 0)) / 100
  return `${String(currency || 'CNY').toUpperCase() === 'CNY' ? '¥' : ''}${amount.toFixed(2)}`
}

function getOrderStatus(order: VirtualPaymentOrder) {
  if (order.status === 'completed') return { key: 'completed', label: '支付成功' }
  if (order.status === 'refunded') return { key: 'refunded', label: '已退款' }
  if (order.status === 'failed') return { key: 'failed', label: '支付失败' }
  const createdAt = new Date(order.createdAt || '').getTime()
  const stale = Number.isFinite(createdAt) && Date.now() - createdAt > 30 * 60 * 1000
  return stale
    ? { key: 'incomplete', label: '未完成' }
    : { key: 'pending', label: '确认中' }
}

export default function PaymentOrdersPage() {
  const [orders, setOrders] = useState<VirtualPaymentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const authenticated = hasAuthenticatedSession()

  const loadOrders = useCallback(async (requestedPage = 1, append = false) => {
    if (!hasAuthenticatedSession()) {
      setOrders([])
      setTotal(0)
      setHasMore(false)
      setLoading(false)
      return
    }
    append ? setLoadingMore(true) : setLoading(true)
    setError('')
    try {
      const result = await getVirtualPaymentOrders(requestedPage, PAGE_SIZE)
      setOrders((current) => append ? [...current, ...result.orders] : result.orders)
      setPage(result.page)
      setTotal(result.total)
      setHasMore(result.hasMore)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '订单加载失败，请稍后重试')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useDidShow(() => { void loadOrders(1, false) })
  usePullDownRefresh(() => loadOrders(1, false).finally(() => stopPullDownRefresh()))

  const copyOrderId = async (paymentId: string) => {
    try {
      await setClipboardData({ data: paymentId })
      showToast({ title: '订单号已复制', icon: 'success' })
    } catch {
      showToast({ title: '复制失败，请稍后重试', icon: 'none' })
    }
  }

  return (
    <View className='page-shell payment-orders-page'>
      <View className='payment-orders-heading'>
        <Text className='payment-orders-heading__title'>订单记录</Text>
        <Text className='payment-orders-heading__copy'>查看当前 Haigoo 账号的订单</Text>
      </View>

      {!authenticated ? (
        <View className='payment-orders-state surface-card'>
          <View className='payment-orders-state__icon'><MiniIcon name='user' size={34} /></View>
          <Text className='payment-orders-state__title'>登录后查看订单</Text>
          <Text className='payment-orders-state__copy'>登录 Haigoo 账号后，可以查看支付状态和历史订单。</Text>
          <View className='payment-orders-state__button' onClick={() => navigateTo({ url: '/pages/profile/index' })}>
            <Text>前往登录</Text>
          </View>
        </View>
      ) : loading ? (
        <View className='payment-orders-state surface-card'>
          <Loading size={30} color='#C94F22' />
          <Text className='payment-orders-state__copy'>正在加载订单…</Text>
        </View>
      ) : error ? (
        <View className='payment-orders-state surface-card' onClick={() => loadOrders(1, false)}>
          <Search size={32} color='#C94F22' />
          <Text className='payment-orders-state__title'>订单暂时无法加载</Text>
          <Text className='payment-orders-state__copy'>{error}</Text>
          <Text className='payment-orders-state__retry'>重新加载</Text>
        </View>
      ) : orders.length === 0 ? (
        <View className='payment-orders-state surface-card'>
          <View className='payment-orders-state__icon'><MiniIcon name='club' size={34} /></View>
          <Text className='payment-orders-state__title'>还没有订单</Text>
          <Text className='payment-orders-state__copy'>支付完成后，订单状态会显示在这里。</Text>
          <View className='payment-orders-state__button' onClick={() => navigateTo({ url: '/pages/membership/index' })}>
            <Text>查看会员方案</Text>
          </View>
        </View>
      ) : (
        <>
          <View className='payment-orders-summary'>
            <Text>共 {total} 笔订单</Text>
            <Text>下拉刷新</Text>
          </View>
          <View className='payment-orders-list'>
            {orders.map((order) => {
              const status = getOrderStatus(order)
              return (
                <View className='payment-order-card surface-card' key={order.paymentId}>
                  <View className='payment-order-card__header'>
                    <Text className='payment-order-card__plan'>{PLAN_NAMES[order.planId] || 'Club 权益方案'}</Text>
                    <Text className={`payment-order-card__status payment-order-card__status--${status.key}`}>
                      {status.label}
                    </Text>
                  </View>
                  <View className='payment-order-card__amount-row'>
                    <Text className='payment-order-card__amount'>{formatAmount(order.amountCents, order.currency)}</Text>
                    <Text className='payment-order-card__method'>微信支付</Text>
                  </View>
                  <View className='payment-order-card__details'>
                    <View className='payment-order-card__detail'>
                      <Text>创建时间</Text>
                      <Text>{formatDate(order.createdAt)}</Text>
                    </View>
                    {order.paidAt ? (
                      <View className='payment-order-card__detail'>
                        <Text>支付时间</Text>
                        <Text>{formatDate(order.paidAt)}</Text>
                      </View>
                    ) : null}
                    <View className='payment-order-card__detail'>
                      <Text>订单号</Text>
                      <View className='payment-order-card__order-id' onClick={() => copyOrderId(order.paymentId)}>
                        <Text>{order.paymentId}</Text>
                        <Text className='payment-order-card__copy'>复制</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
          {hasMore ? (
            <View
              className={`payment-orders-more ${loadingMore ? 'payment-orders-more--disabled' : ''}`}
              onClick={() => {
                if (!loadingMore) void loadOrders(page + 1, true)
              }}
            >
              <Text>{loadingMore ? '正在加载…' : '加载更多订单'}</Text>
            </View>
          ) : null}
        </>
      )}

      <View className='payment-orders-support' onClick={() => navigateTo({ url: '/pages/account-settings/index' })}>
        <Text>对扣款、到账或退款有疑问？</Text>
        <Text className='payment-orders-support__action'>帮助与反馈</Text>
      </View>
    </View>
  )
}
