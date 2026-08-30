import { Text, View } from '@tarojs/components'
import { navigateTo, showModal, showToast, switchTab, useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { trackMiniEvent } from '../../services/analytics-service'
import ContentSkeleton from '../../components/content-skeleton'
import MiniIcon from '../../components/mini-icon'
import { fetchMembershipPlans } from '../../services/content-service'
import { loginWithWechat } from '../../services/mini-auth-service'
import { hasAuthenticatedSession } from '../../services/session'
import { isVirtualPaymentSupported, purchaseClubPlan } from '../../services/virtual-payment-service'
import type { MiniMembershipPlan } from '../../types'
import { formatCalendarDate } from '../../utils/runtime-compat'
import './index.scss'

function duration(plan: MiniMembershipPlan) { return plan.durationMonths ? `${plan.durationMonths} 个月` : `${plan.durationDays} 天` }
function memberTypeLabel(value?: string) { return value === 'quarter' ? '季度会员' : value === 'half_year' ? '半年会员' : 'Haigoo 会员' }

export default function MembershipPage() {
  const [plans, setPlans] = useState<MiniMembershipPlan[]>([])
  const [membership, setMembership] = useState<{ isMember: boolean; memberType: string; memberExpireAt?: string | null } | null>(null)
  const [paymentAvailable, setPaymentAvailable] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [paying, setPaying] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchMembershipPlans(); setPlans(result.plans); setMembership(result.membership); setPaymentAvailable(result.paymentAvailable)
      setSelectedPlanId((current) => {
        if (current && result.plans.some((plan) => plan.id === current)) return current
        return result.plans.find((plan) => result.membership?.isMember && plan.memberType === result.membership.memberType)?.id
          || result.plans.find((plan) => plan.featured)?.id
          || result.plans[0]?.id
          || ''
      })
      void trackMiniEvent('mini_membership_plans_view', { payment_available: result.paymentAvailable, client_payment_supported: isVirtualPaymentSupported() })
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '会员方案加载失败') } finally { setLoading(false) }
  }, [])
  useDidShow(() => { void load() })

  const purchase = async (plan: MiniMembershipPlan) => {
    if (!hasAuthenticatedSession()) {
      const result = await showModal({ title: '登录后开通会员', content: '请先登录 Haigoo 账号。', confirmText: '去登录' })
      if (result.confirm) switchTab({ url: '/pages/profile/index' })
      return
    }
    const confirmed = await showModal({ title: `开通 ${plan.shortLabel}`, content: `价格 ¥${plan.price}，有效期 ${duration(plan)}。`, confirmText: '微信支付' })
    if (!confirmed.confirm) return
    setPaying(plan.id)
    try {
      const order = await purchaseClubPlan(plan.id)
      if (order.status === 'completed') { await loginWithWechat(); await load(); showToast({ title: '会员权益已开通', icon: 'success' }) }
      else showModal({ title: '支付结果确认中', content: '稍后可在订单记录中查看结果。', showCancel: false })
    } catch (purchaseError) {
      const message = purchaseError instanceof Error ? purchaseError.message : '支付未完成'
      if (message === '已取消支付') showToast({ title: '已取消支付', icon: 'none' })
      else showModal({ title: '支付未完成', content: message, showCancel: false })
    } finally { setPaying('') }
  }

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0]
  const canPurchaseSelected = !membership?.isMember || membership.memberType === selectedPlan?.memberType

  return (
      <View className='page-shell membership-page'>
      <View className='membership-heading'><Text className='membership-brand'>HaigooRemote 会员</Text><Text className='page-heading'>选择会员方案</Text><Text className='page-subtitle'>解锁完整企业库、岗位更新和内部联系人</Text></View>
      {membership?.isMember ? <View className='membership-current'><Text className='membership-current__label'>当前有效会员</Text><Text className='membership-current__type'>{memberTypeLabel(membership.memberType)}</Text><Text className='membership-current__expire'>{formatCalendarDate(membership.memberExpireAt) ? `有效期至 ${formatCalendarDate(membership.memberExpireAt)}` : '权益正在生效'}</Text></View> : null}
      {error ? <View className='empty-state'><Text className='empty-state__title'>会员方案暂时不可用</Text><Text className='empty-state__copy'>{error}</Text></View> : null}
      <View className='membership-plans'>
        {loading ? <ContentSkeleton rows={3} /> : null}
        {plans.map((plan) => (
          <View className={`membership-plan ${selectedPlan?.id === plan.id ? 'membership-plan--selected' : ''}`} key={plan.id} aria-role='radio' aria-checked={selectedPlan?.id === plan.id} onClick={() => setSelectedPlanId(plan.id)}>
            <View className='membership-plan__header'><View className='membership-plan__title'><View className='membership-plan__selection'>{selectedPlan?.id === plan.id ? <MiniIcon name='check' size={13} /> : null}</View><View><Text className='membership-plan__name'>{plan.shortLabel}</Text><Text className='membership-plan__duration'>{duration(plan)}</Text></View></View>{plan.featured ? <Text className='membership-plan__badge'>推荐</Text> : null}</View>
            <View className='membership-plan__price'><Text>¥</Text>{plan.price}</View>
            <Text className='membership-plan__description'>{plan.description}</Text>
            <View className='membership-plan__features'>{plan.features.map((feature) => <View className='membership-plan__feature' key={feature}><MiniIcon className='membership-plan__feature-mark' name='check' size={16} /><Text>{feature}</Text></View>)}</View>
          </View>
        ))}
      </View>
      {paymentAvailable && selectedPlan && canPurchaseSelected ? <View className={`primary-button membership-plan__button ${paying ? 'primary-button--disabled' : ''}`} aria-role='button' aria-disabled={Boolean(paying)} onClick={paying ? undefined : () => purchase(selectedPlan)}>{paying === selectedPlan.id ? '正在打开微信支付…' : membership?.memberType === selectedPlan.memberType ? '续费当前方案' : `开通${selectedPlan.shortLabel}`}</View> : null}
      {paymentAvailable && selectedPlan && !canPurchaseSelected ? <View className='membership-unavailable'><Text className='membership-unavailable__title'>当前有效期内仅支持同档续费</Text><Text className='membership-unavailable__copy'>选择当前方案即可续费；方案变更可在到期后进行。</Text></View> : null}
      {!loading && plans.length > 0 && !paymentAvailable ? <View className='membership-unavailable'><Text className='membership-unavailable__title'>暂时无法购买</Text><Text className='membership-unavailable__copy'>你可以先查看方案内容，或咨询职业顾问。</Text></View> : null}
      <View className='secondary-button membership-consult' onClick={() => navigateTo({ url: '/pages/consultation/index?sourcePage=membership' })}>咨询会员方案</View>
      {hasAuthenticatedSession() ? <Text className='membership-orders' onClick={() => navigateTo({ url: '/pages/payment-orders/index' })}>查看我的订单</Text> : null}
    </View>
  )
}
