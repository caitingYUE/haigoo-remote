import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Crown, Loader2, Sparkles, X } from 'lucide-react'
import { trackingService } from '../services/tracking-service'
import { useAuth } from '../contexts/AuthContext'

interface MembershipUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  triggerSource: 'referral' | 'ai_resume' | 'general'
}

type PaymentMethod = 'alipay' | 'wechat'

interface Plan {
  id: string
  memberType: 'trial_week' | 'quarter' | 'year'
  name: string
  shortLabel?: string
  price: number
  originalPrice?: number
  discountLabel?: string
  currency: string
  features: string[]
  duration_days: number
  description?: string
  wechat_qr?: string
  alipay_qr?: string
  enabled?: boolean
}

const FALLBACK_PLANS: Plan[] = [
  {
    id: 'trial_week_lite',
    memberType: 'trial_week',
    name: '海狗远程俱乐部体验会员（周）',
    shortLabel: '体验会员',
    price: 29.9,
    currency: 'CNY',
    duration_days: 7,
    discountLabel: '7 天体验',
    alipay_qr: '/alipay_mini.jpg',
    wechat_qr: '/Wechatpay_mini.png',
    description: '适合明确意向集中投递',
    features: ['解锁全部高价值远程岗位', '解锁全部企业关键联系人信息', '岗位企业直申（无限次）', 'AI 简历优化（无限次）']
  },
  {
    id: 'club_go_quarterly',
    memberType: 'quarter',
    name: '海狗远程俱乐部会员（季度）',
    shortLabel: '季度会员',
    price: 199,
    currency: 'CNY',
    duration_days: 90,
    discountLabel: '推荐',
    alipay_qr: '/alipay.jpg',
    wechat_qr: '/wechatpay.png',
    description: '适合在职人士轻松投递',
    features: ['解锁全部高价值远程岗位', '解锁全部企业关键联系人信息', '岗位企业直申（无限次）', 'AI 简历优化（无限次）']
  }
]

const PLAN_COPY: Record<string, { title: string; hint: string; badge: string }> = {
  trial_week: {
    title: '体验会员',
    hint: '适合明确意向集中投递',
    badge: '集中冲刺'
  },
  quarter: {
    title: '季度会员',
    hint: '适合在职人士轻松投递',
    badge: '高性价比'
  }
}

const normalizeFeatureLabel = (feature: string) => {
  const compact = String(feature || '').replace(/\s+/g, ' ').trim()
  const key = compact.replace(/\s/g, '')

  if (!compact) return ''
  if (
    key.includes('解锁全部高薪远程职位') ||
    key.includes('高价值岗位') ||
    key.includes('高薪远程职位')
  ) {
    return '解锁全部高价值远程岗位'
  }
  if (
    key.includes('解锁全部企业认证信息及联系方式') ||
    key.includes('查看岗位相关HR/负责人联系方式') ||
    key.includes('企业联系人邮箱')
  ) {
    return '解锁全部企业关键联系人信息'
  }
  if (
    key.includes('AI远程工作助手') ||
    key.includes('AI工具不限次') ||
    key.includes('无限申请次数') ||
    key.includes('高价值邮箱直申')
  ) {
    return '岗位企业直申（无限次）'
  }
  if (key.includes('AI简历优化')) {
    return 'AI 简历优化（无限次）'
  }

  return compact
}

const getVisibleFeatures = (plan: Plan) => {
  const fallbackFeatures = FALLBACK_PLANS.find(item => item.memberType === plan.memberType)?.features || []
  const rawFeatures = plan.features?.length ? plan.features : fallbackFeatures
  const normalized = rawFeatures.map(normalizeFeatureLabel).filter(Boolean)
  const priority = [
    '解锁全部高价值远程岗位',
    '解锁全部企业关键联系人信息',
    '岗位企业直申（无限次）',
    'AI 简历优化（无限次）'
  ]
  const unique = Array.from(new Set(normalized))
  const ordered = [
    ...priority.filter(item => unique.includes(item)),
    ...unique.filter(item => !priority.includes(item))
  ]

  return ordered.slice(0, 4)
}

export const MembershipUpgradeModal: React.FC<MembershipUpgradeModalProps> = ({
  isOpen,
  onClose,
  triggerSource
}) => {
  const { user } = useAuth()
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS)
  const [selectedPlanId, setSelectedPlanId] = useState(FALLBACK_PLANS[1].id)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('alipay')
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimMessage, setClaimMessage] = useState('')

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setClaimMessage('')
    setPaymentMethod('alipay')
    setIsLoadingPlans(true)

    fetch('/api/membership?action=plans')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load plans: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const rawPlans = Array.isArray(data?.plans) ? data.plans : Array.isArray(data?.data?.plans) ? data.data.plans : []
        const usefulPlans = rawPlans
          .filter((plan: Plan) => ['trial_week', 'quarter'].includes(plan.memberType) && plan.enabled !== false)
          .map((plan: Plan) => ({ ...FALLBACK_PLANS.find(item => item.memberType === plan.memberType), ...plan }))

        if (usefulPlans.length > 0) {
          const merged = ['trial_week', 'quarter']
            .map(type => usefulPlans.find((plan: Plan) => plan.memberType === type))
            .filter(Boolean) as Plan[]
          setPlans(merged)
          setSelectedPlanId(merged.find(plan => plan.memberType === 'quarter')?.id || merged[0].id)
        } else {
          setPlans(FALLBACK_PLANS)
          setSelectedPlanId(FALLBACK_PLANS[1].id)
        }
      })
      .catch(() => {
        if (cancelled) return
        setPlans(FALLBACK_PLANS)
        setSelectedPlanId(FALLBACK_PLANS[1].id)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlans(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen])

  const selectedPlan = useMemo(() => {
    return plans.find(plan => plan.id === selectedPlanId) || plans[0] || FALLBACK_PLANS[0]
  }, [plans, selectedPlanId])
  const registeredEmail = String(user?.email || '').trim()

  const modalCopy = {
    referral: {
      eyebrow: '会员申请通道',
      title: '更高效的申请体验',
      description: ''
    },
    ai_resume: {
      eyebrow: '简历与面试工具',
      title: '继续打磨简历表达',
      description: '继续使用 AI 简历优化、匹配分析与求职工具。'
    },
    general: {
      eyebrow: '海狗会员',
      title: '提高远程求职申请效率',
      description: '会员岗位、联系人方式、申请工具全部打开。'
    }
  }[triggerSource]

  if (!isOpen) return null

  const qrImageUrl = paymentMethod === 'alipay'
    ? (selectedPlan.alipay_qr || (selectedPlan.price === 999 ? '/alipay_999.jpg' : '/alipay.jpg'))
    : (selectedPlan.wechat_qr || (selectedPlan.price === 999 ? '/wechatpay_999.png' : '/wechatpay.png'))

  const handleClaimPayment = async () => {
    setIsClaiming(true)
    setClaimMessage('')
    try {
      const token = localStorage.getItem('haigoo_auth_token')
      if (!token) {
        setClaimMessage('请先登录账号，再确认支付以便开通权益。')
        return
      }

      await fetch('/api/membership?action=claim_payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          paymentMethod,
          amount: selectedPlan.price,
          email: registeredEmail,
          page_key: 'job_detail',
          source_key: 'job_detail_upgrade_modal',
          flow_id: selectedPlan.id
        })
      })

      trackingService.track('complete_payment_client_claim', {
        page_key: 'job_detail',
        module: 'membership_upgrade_modal',
        source_key: 'job_detail_upgrade_modal',
        entity_type: 'plan',
        entity_id: selectedPlan.id,
        plan_id: selectedPlan.id
      })
      setClaimMessage('已收到你的支付确认，权益通常 3 分钟内生效。')
    } catch (error) {
      console.error('Failed to claim membership payment', error)
      setClaimMessage('支付确认暂未提交成功，如已付款请联系 hi@haigooremote.com。')
    } finally {
      setIsClaiming(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[4000] flex items-start justify-center overflow-y-auto p-2 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 cursor-pointer bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative my-2 max-h-[calc(100dvh-1rem)] w-full max-w-[940px] overflow-y-auto rounded-[24px] border border-indigo-100 bg-[#fffdf9] shadow-[0_36px_120px_-52px_rgba(15,23,42,0.45)] animate-in fade-in zoom-in duration-200 sm:my-0 sm:rounded-[30px] lg:overflow-hidden">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full border border-[#dce8ef] bg-white/85 p-2 text-slate-500 backdrop-blur transition-colors hover:border-indigo-200 hover:text-indigo-700"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative overflow-hidden border-b border-[#edf1f5] bg-[linear-gradient(135deg,#f8fbff_0%,#fff8ea_56%,#ffffff_100%)] px-5 py-4 sm:px-7 sm:py-5">
          <div className="pointer-events-none absolute right-8 top-5 h-28 w-28 rounded-full bg-[#e9ddff]/45 blur-3xl" />
          <div className="relative z-10 pr-12">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white/75 px-3 py-1 text-xs font-black text-indigo-700">
              <Crown className="h-3.5 w-3.5" />
              {modalCopy.eyebrow}
            </div>
            <h3 className="text-[24px] font-black leading-tight tracking-tight text-slate-950 sm:text-[32px]">
              {modalCopy.title}
            </h3>
            {modalCopy.description ? (
              <p className="mt-2 max-w-[560px] text-sm leading-6 text-slate-600">
                {modalCopy.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 p-3.5 sm:p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            {isLoadingPlans ? (
              <div className="flex h-[240px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-white/70 text-sm text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在读取会员方案
              </div>
            ) : (
              plans.map((plan) => {
                const copy = PLAN_COPY[plan.memberType] || { title: plan.shortLabel || plan.name, hint: plan.description || '', badge: '' }
                const selected = selectedPlan.id === plan.id
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(plan.id)
                      setClaimMessage('')
                    }}
                    className={`w-full rounded-[22px] border p-4 text-left transition-all sm:rounded-[24px] sm:p-5 ${
                      selected
                        ? 'border-indigo-200 bg-[linear-gradient(135deg,rgba(238,242,255,0.95),rgba(255,255,255,0.98))] shadow-[0_20px_46px_-34px_rgba(79,70,229,0.35)]'
                        : 'border-slate-100 bg-white hover:border-indigo-100 hover:bg-indigo-50/30'
                    }`}
                  >
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-slate-950">{copy.title}</span>
                          {copy.badge ? (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                              plan.memberType === 'quarter'
                                ? 'bg-[#fff3df] text-[#c26b00]'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {copy.badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{copy.hint}</p>
                      </div>
                      <div className="text-left sm:text-right">
                        {plan.memberType === 'quarter' ? (
                          <div className="mb-1 text-[11px] font-black text-slate-400 line-through">¥399 /季度</div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <span className="text-[30px] font-black leading-none text-slate-950 sm:text-[32px]">¥{plan.price}</span>
                          {plan.memberType === 'quarter' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#ffd6a6] bg-[#fff7e8] px-2 py-0.5 text-[10px] font-black text-[#c26b00]">
                              🔥 限时 5 折
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-slate-400">
                          {plan.memberType === 'trial_week' ? '7 天' : '90 天'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
                      {getVisibleFeatures(plan).map(feature => (
                        <div key={feature} className="flex min-w-0 items-start gap-2 text-sm font-semibold leading-5 text-slate-600">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="rounded-[22px] border border-[#e8eef5] bg-white p-3.5 shadow-[0_18px_46px_-38px_rgba(15,23,42,0.28)] sm:rounded-[24px] sm:p-4">
            <div className="grid grid-cols-2 gap-2">
              {(['alipay', 'wechat'] as PaymentMethod[]).map(method => (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method)
                    setClaimMessage('')
                  }}
                  className={`h-9 rounded-full border text-xs font-black transition-colors ${
                    paymentMethod === method
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                  }`}
                >
                  {method === 'alipay' ? '支付宝' : '微信'}
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-[20px] border border-slate-100 bg-slate-50/70 p-3 sm:mt-4 sm:rounded-[22px] sm:p-4">
              <img
                src={qrImageUrl}
                alt={`${paymentMethod === 'alipay' ? '支付宝' : '微信'}支付二维码`}
                className="mx-auto h-40 w-40 rounded-2xl bg-white object-contain p-2 shadow-sm sm:h-44 sm:w-44"
              />
              <div className="mt-2 text-center text-xs font-semibold text-slate-500">
                扫码支付 ¥{selectedPlan.price}
              </div>
            </div>

            <div className="mt-3 rounded-[18px] border border-[#f3dfab] bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,0.98))] px-4 py-3 sm:mt-4">
              <div className="text-xs font-black text-slate-500">付款备注注册邮箱</div>
              <div className="mt-1 break-all text-sm font-black text-[#2f6ed8]" title={registeredEmail || '登录后显示注册邮箱'}>
                {registeredEmail || '登录后显示注册邮箱'}
              </div>
              <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                支付成功后 3 分钟内生效，超出 10 分钟系统会自动补偿一天会员。
              </div>
            </div>

            <button
              type="button"
              onClick={handleClaimPayment}
              disabled={isClaiming}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-[#2f6ed8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              我已完成支付
            </button>

            {claimMessage ? (
              <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-700">
                {claimMessage}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
