import { Text, View } from '@tarojs/components'
import Taro, { navigateBack, navigateTo, showModal, showToast, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { trackMiniEvent } from '../../services/analytics-service'
import ContentSkeleton from '../../components/content-skeleton'
import MiniIcon from '../../components/mini-icon'
import useRetainedResource from '../../hooks/use-retained-resource'
import { fetchMembershipPlans } from '../../services/content-service'
import { refreshWechatSession } from '../../services/mini-auth-service'
import { hasAuthenticatedSession } from '../../services/session'
import { isVirtualPaymentSupported, purchaseClubPlan } from '../../services/virtual-payment-service'
import type { MiniMembershipPlan } from '../../types'
import { formatCalendarDate } from '../../utils/runtime-compat'
import './index.scss'

function duration(plan: MiniMembershipPlan) { return plan.durationMonths ? `${plan.durationMonths} 个月` : `${plan.durationDays} 天` }
function memberTypeLabel(value?: string) { return value === 'starter' ? '月度会员' : value === 'quarter' ? '季度会员' : value === 'half_year' ? '半年会员' : 'Haigoo 会员' }
const planPresentationByType: Record<string, { positioning: string; badge?: string; original?: string; auxiliary: string; explanation: string }> = {
  starter: {
    positioning: '短期体验',
    auxiliary: '1个月',
    explanation: '适合短期体验或明确方向直接冲刺'
  },
  quarter: {
    positioning: '认真准备申请',
    badge: '推荐 · 省¥98',
    original: '原价 ¥297',
    auxiliary: '3个月',
    explanation: '最优推荐，持续关注3个月更容易遇到合适机会'
  },
  half_year: {
    positioning: '1对1申请协助',
    badge: '含3项1对1',
    auxiliary: '权益总值¥1,195 · 省¥496',
    explanation: '适合正处于迷茫或转型期，需要协助梳理职业方向和申请的人'
  }
}
type MembershipBenefit = { key: string; group: '数字权益' | '1对1服务'; title: string; value?: string; aliases: string[] }
const membershipBenefits: MembershipBenefit[] = [
  { key: 'website_apply', group: '数字权益', title: 'HaigooRemote官网无限申请', aliases: [] },
  { key: 'notes', group: '数字权益', title: '远程职业笔记无限学习', aliases: [] },
  { key: 'matching', group: '数字权益', title: '全库企业无限匹配', aliases: ['浏览在招远程企业', '企业无限匹配'] },
  { key: 'updates', group: '数字权益', title: '所有企业岗位更新通知', aliases: ['按方向接收岗位更新', '接收方向更新', '岗位更新'] },
  { key: 'contacts', group: '数字权益', title: '查看内部联系人信息', aliases: ['查看已收录联系人', '内部联系人'] },
  { key: 'support', group: '数字权益', title: '优先客服响应', aliases: ['优先客服响应', '客服优先'] },
  { key: 'career_direction', group: '1对1服务', title: '职业方向诊断', value: '¥299/次', aliases: ['职业方向诊断指导'] },
  { key: 'resume', group: '1对1服务', title: '中英文简历优化', value: '¥199/次', aliases: ['中英文简历优化'] },
  { key: 'materials', group: '1对1服务', title: '定制求职材料包', value: '¥299/次', aliases: ['定制求职材料包'] }
]

function isBenefitIncluded(plan: MiniMembershipPlan, benefit: MembershipBenefit) {
  // These shared website entitlements are already granted by membership.js and
  // free-usage.js. Only render them for the validated plans returned by the API.
  if (benefit.key === 'website_apply' || benefit.key === 'notes') return ['starter', 'quarter', 'half_year'].includes(plan.memberType)
  if (benefit.group === '1对1服务' && plan.memberType !== 'half_year') return false
  if (benefit.key === 'support') return plan.memberType === 'quarter' || plan.memberType === 'half_year'
  return plan.features.some((feature) => benefit.aliases.some((alias) => feature.includes(alias)))
}

export default function MembershipPage() {
  const loadVersion = useRef(0)
  const navigation = useMemo(() => {
    const system = Taro.getSystemInfoSync()
    const statusBarHeight = system.statusBarHeight || 20
    const menu = Taro.getMenuButtonBoundingClientRect?.()
    const barHeight = menu?.height ? (menu.top - statusBarHeight) * 2 + menu.height : 44
    const rightInset = menu?.left ? Math.max(96, system.windowWidth - menu.left + 8) : 96
    return { statusBarHeight, barHeight, rightInset }
  }, [])
  const { data, loading, refreshing, error: resourceError, load: loadResource } = useRetainedResource<Awaited<ReturnType<typeof fetchMembershipPlans>>>('membership-plans')
  const plans = data?.plans || []
  const membership = data?.membership || null
  const paymentAvailable = Boolean(data?.paymentAvailable)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [paying, setPaying] = useState('')
  const [sessionError, setSessionError] = useState('')
  const error = resourceError || sessionError
  const load = useCallback(async () => {
    const currentLoadVersion = ++loadVersion.current
    setSessionError('')
    try {
      if (hasAuthenticatedSession()) await refreshWechatSession()
      if (currentLoadVersion !== loadVersion.current) return
      await loadResource('membership-plans', async () => {
        const result = await fetchMembershipPlans()
        void trackMiniEvent('mini_membership_plans_view', { payment_available: result.paymentAvailable, client_payment_supported: isVirtualPaymentSupported() })
        return result
      }, true)
    } catch (loadError) {
      if (currentLoadVersion === loadVersion.current) {
        const message = loadError instanceof Error ? loadError.message : '会员状态加载失败'
        if (data) showToast({ title: '暂时无法更新，已保留上次内容', icon: 'none' })
        else setSessionError(message)
      }
    }
  }, [data, loadResource])
  useDidShow(() => { void load() })
  useEffect(() => {
    setSelectedPlanId((current) => {
      if (current && plans.some((plan) => plan.id === current)) return current
      return plans.find((plan) => membership?.isMember && plan.memberType === membership.memberType)?.id
        || plans.find((plan) => plan.memberType === 'quarter')?.id
        || plans.find((plan) => plan.featured)?.id
        || plans[0]?.id
        || ''
    })
  }, [data])

  const purchase = async (plan: MiniMembershipPlan) => {
    if (!hasAuthenticatedSession()) {
      const result = await showModal({ title: '登录后开通会员', content: '请先登录 Haigoo 账号。', confirmText: '去登录' })
      if (result.confirm) navigateTo({ url: '/pages/profile/index' })
      return
    }
    if (membership?.isMember && membership.memberType === 'half_year' && plan.memberType === 'half_year') {
      const result = await showModal({ title: '无需重复购买', content: '你的半年会员仍在有效期内。如有需要，请咨询顾问。', confirmText: '咨询顾问' })
      if (result.confirm) navigateTo({ url: '/pages/consultation/index?sourcePage=membership' })
      return
    }
    const isRenewal = Boolean(membership?.isMember && membership.memberType === plan.memberType)
    const confirmed = await showModal({ title: `${isRenewal ? '续费' : '开通'}${plan.shortLabel}`, content: isRenewal ? `价格 ¥${plan.price}。购买后，有效期将在当前到期日基础上顺延 ${duration(plan)}，并发送购买成功邮件告知新的到期日期。` : `价格 ¥${plan.price}，有效期 ${duration(plan)}。`, confirmText: '微信支付' })
    if (!confirmed.confirm) return
    setPaying(plan.id)
    try {
      const order = await purchaseClubPlan(plan.id)
      if (order.status === 'completed') { await load(); showToast({ title: isRenewal ? '续费成功' : '会员权益已开通', icon: 'success' }) }
      else showModal({ title: '支付结果确认中', content: '稍后可在订单记录中查看结果。', showCancel: false })
    } catch (purchaseError) {
      const message = purchaseError instanceof Error ? purchaseError.message : '支付未完成'
      if (message === '已取消支付') showToast({ title: '已取消支付', icon: 'none' })
      else showModal({ title: '支付未完成', content: message, showCancel: false })
    } finally { setPaying('') }
  }

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0]
  const selectedPlanPresentation = selectedPlan ? planPresentationByType[selectedPlan.memberType] : null
  const selectedPlanAvailable = selectedPlan?.purchaseAvailable !== false
  const halfYearAlreadyActive = Boolean(membership?.isMember && membership.memberType === 'half_year' && selectedPlan?.memberType === 'half_year')
  const canPurchaseSelected = !halfYearAlreadyActive && selectedPlanAvailable && (!membership?.isMember || membership.memberType === selectedPlan?.memberType)

  return (
    <View className='membership-root'>
      <View
        className='membership-topbar'
        style={{ paddingTop: `${navigation.statusBarHeight}px`, height: `${navigation.statusBarHeight + navigation.barHeight}px` }}
      >
        <View className='membership-topbar__inner' style={{ height: `${navigation.barHeight}px`, paddingRight: `${navigation.rightInset}px` }}>
          <View className='membership-topbar__back' aria-role='button' aria-label='返回' hoverClass='mini-action--pressed' onClick={() => navigateBack()}>
            <MiniIcon name='chevronLeft' size={20} />
          </View>
          <Text className='membership-topbar__title'>会员方案</Text>
        </View>
      </View>
      <View className='page-shell membership-page' style={{ minHeight: `calc(100vh - ${navigation.statusBarHeight + navigation.barHeight}px)` }}>
      <View className='membership-heading'><Text className='page-heading'>打开全球机会</Text><Text className='membership-heading__accent'>从远程工作开始</Text><Text className='page-subtitle'>10w+人正在通过 Haigoo Remote 发现全球新机会。</Text><View className='membership-tags'><Text>无限匹配</Text><Text>企业联系人</Text><Text>简历优化</Text><Text>岗位提醒</Text></View></View>
      <View className='membership-content'>
      {membership?.isMember ? <View className='membership-current'><Text className='membership-current__label'>当前有效会员</Text><Text className='membership-current__type'>{memberTypeLabel(membership.memberType)}</Text><Text className='membership-current__expire'>{formatCalendarDate(membership.memberExpireAt) ? `有效期至 ${formatCalendarDate(membership.memberExpireAt)}` : '权益正在生效'}</Text></View> : null}
      {error && !data ? <View className='empty-state'><Text className='empty-state__title'>会员方案暂时不可用</Text><Text className='empty-state__copy'>{error}</Text></View> : null}
      {refreshing && data ? <View className='membership-refreshing' aria-live='polite' aria-busy><View className='membership-refreshing__spinner' /><Text>正在更新方案</Text></View> : null}
      <View className='membership-plans'>
        {loading && !data && !error ? <ContentSkeleton rows={3} /> : null}
        {plans.map((plan) => {
          const presentation = planPresentationByType[plan.memberType]
          return <View className={`membership-plan ${selectedPlan?.id === plan.id ? 'membership-plan--selected' : ''}`} key={plan.id} aria-role='radio' aria-label={`选择${plan.shortLabel}`} aria-checked={selectedPlan?.id === plan.id} hoverClass='mini-action--pressed' onClick={() => setSelectedPlanId(plan.id)}>
            {presentation?.badge ? <Text className='membership-plan__badge'>{presentation.badge}</Text> : null}
            <Text className='membership-plan__name'>{plan.shortLabel}</Text>
            <Text className='membership-plan__positioning'>{presentation?.positioning || plan.description}</Text>
            <View className='membership-plan__price'><Text>¥</Text>{plan.price}</View>
            {presentation?.original ? <Text className='membership-plan__original'>{presentation.original}</Text> : null}
            <Text className='membership-plan__auxiliary'>{presentation?.auxiliary || duration(plan)}</Text>
          </View>
        })}
      </View>
      {selectedPlanPresentation ? <Text className='membership-plan-explanation'>{selectedPlanPresentation.explanation}</Text> : null}
      {selectedPlan ? <View className='membership-benefits'>
        <View className='membership-benefits__header'><Text>当前方案包含的权益</Text><Text>{selectedPlan.shortLabel}</Text></View>
        {(['数字权益', '1对1服务'] as const).map((group, groupIndex) => <View className='membership-benefits__group' key={group}>
          <Text className='membership-benefits__group-title'>{group}</Text>
          <View className='membership-benefits__list'>{membershipBenefits.filter((benefit) => benefit.group === group).map((benefit) => {
            const included = isBenefitIncluded(selectedPlan, benefit)
            return <View className={`membership-benefit ${included ? 'membership-benefit--included' : 'membership-benefit--locked'}`} key={benefit.key}>
              <View className='membership-benefit__icon' aria-label={included ? '已包含' : '未包含'}>{included ? <MiniIcon name='check' size={15} /> : <View className='membership-benefit__lock' />}</View>
              <Text className='membership-benefit__title'>{benefit.title}</Text>
              {benefit.value ? <Text className='membership-benefit__value'>{benefit.value}</Text> : null}
            </View>
          })}</View>
          {groupIndex === 0 ? <View className='membership-benefits__divider' /> : null}
        </View>)}
      </View> : null}
      {paymentAvailable && selectedPlan && canPurchaseSelected ? <View className='membership-purchase'><View className={`primary-button membership-plan__button ${paying ? 'primary-button--disabled' : ''}`} aria-role='button' aria-label={paying === selectedPlan.id ? '正在支付' : membership?.memberType === selectedPlan.memberType ? `续费${selectedPlan.shortLabel}` : `开通${selectedPlan.shortLabel}`} aria-disabled={Boolean(paying)} hoverClass={paying ? undefined : 'mini-action--pressed'} onClick={paying ? undefined : () => purchase(selectedPlan)}>{paying === selectedPlan.id ? '正在支付…' : membership?.memberType === selectedPlan.memberType ? `续费${selectedPlan.shortLabel} · ¥${selectedPlan.price}` : `开通${selectedPlan.shortLabel} · ¥${selectedPlan.price}`}</View><Text className='membership-purchase__note'>{membership?.isMember ? `在当前到期日基础上顺延 ${duration(selectedPlan)}` : `有效期 ${duration(selectedPlan)}`} · 到期不自动续费</Text></View> : null}
      {halfYearAlreadyActive ? <View className='membership-unavailable'><Text className='membership-unavailable__title'>半年会员无需重复购买</Text><Text className='membership-unavailable__copy'>你的半年会员仍在有效期内。如有需要，可通过下方入口咨询顾问。</Text></View> : null}
      {paymentAvailable && selectedPlan && !selectedPlanAvailable ? <View className='membership-unavailable'><Text className='membership-unavailable__title'>该方案暂时无法购买</Text><Text className='membership-unavailable__copy'>其他会员方案可正常开通，请稍后再试。</Text></View> : null}
      {paymentAvailable && selectedPlan && selectedPlanAvailable && !canPurchaseSelected && !halfYearAlreadyActive ? <View className='membership-unavailable'><Text className='membership-unavailable__title'>当前有效期内仅支持同档续费</Text><Text className='membership-unavailable__copy'>选择当前方案即可续费；方案变更可在到期后进行。</Text></View> : null}
      {!loading && plans.length > 0 && !paymentAvailable ? <View className='membership-unavailable'><Text className='membership-unavailable__title'>暂时无法购买</Text><Text className='membership-unavailable__copy'>你可以先查看方案内容，或咨询职业顾问。</Text></View> : null}
      <View className='membership-support'>
        <View aria-role='button' aria-label='咨询会员方案' onClick={() => navigateTo({ url: '/pages/consultation/index?sourcePage=membership' })}>咨询会员方案</View>
        {hasAuthenticatedSession() ? <Text aria-role='button' aria-label='查看我的订单' onClick={() => navigateTo({ url: '/pages/payment-orders/index' })}>查看我的订单</Text> : null}
      </View>
      </View>
      </View>
    </View>
  )
}
