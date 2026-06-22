import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Crown, Loader2, Sparkles, X } from 'lucide-react'
import { trackingService } from '../services/tracking-service'

interface MembershipUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  triggerSource: 'referral' | 'ai_resume' | 'general' | 'corporate_english'
  planScope?: 'all' | 'quarterly'
  preferredMemberType?: Plan['memberType']
}

interface Plan {
  id: string
  memberType: 'trial_week' | 'quarter' | 'quarter_pro' | 'year' | 'half_year' | 'annual'
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
    id: 'club_half_year',
    memberType: 'half_year',
    name: 'Club Member',
    shortLabel: 'Club Member',
    price: 499,
    currency: 'CNY',
    duration_days: 183,
    discountLabel: '长期陪伴',
    description: '适合正在认真探索远程工作，希望获得长期岗位资源和求职支持的用户。',
    features: ['全部精选岗位资源', '全部申请路径和联系人信息', '全部外企英语/企业文化/CEO等材料', 'AI 简历优化等辅助建议', '1 次 30 分钟语音 1V1 咨询']
  },
  {
    id: 'club_annual',
    memberType: 'annual',
    name: 'Club Partner',
    shortLabel: 'Club Partner',
    price: 998,
    currency: 'CNY',
    duration_days: 365,
    discountLabel: '推荐｜适合 HR / 品牌 / 市场 / 运营',
    description: '适合希望长期探索远程职业机会，并沉淀个人职业资源的用户。',
    features: ['Club Member 全部权益', '1 次远程求职规划', '优先参与会员闭门交流', '可申请成为共建伙伴', '企业岗位发布与品牌传播支持额度（1季度1次）']
  }
]

const PLAN_COPY: Record<string, { title: string; hint: string; badge: string }> = {
  half_year: {
    title: 'Club Member',
    hint: '适合正在认真探索远程工作，希望获得长期岗位资源和求职支持的用户。',
    badge: '长期陪伴'
  },
  annual: {
    title: 'Club Partner',
    hint: '适合希望长期探索远程职业机会，并沉淀个人职业资源的用户。',
    badge: '推荐'
  }
}

const PLAN_FEATURE_COPY: Partial<Record<Plan['memberType'], string[]>> = {
  half_year: [
    '全部精选岗位资源',
    '全部申请路径和联系人信息',
    '全部外企英语/企业文化/CEO等材料',
    'AI 简历优化等辅助建议',
    '1 次 30 分钟语音 1V1 咨询'
  ],
  annual: [
    'Club Member 全部权益',
    '1 次远程求职规划',
    '优先参与会员闭门交流',
    '可申请成为共建伙伴',
    '企业岗位发布与品牌传播支持额度（1季度1次）'
  ]
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
  const fallbackFeatures = PLAN_FEATURE_COPY[plan.memberType] || FALLBACK_PLANS.find(item => item.memberType === plan.memberType)?.features || []
  const rawFeatures = plan.memberType in PLAN_FEATURE_COPY ? fallbackFeatures : plan.features?.length ? plan.features : fallbackFeatures
  const normalized = rawFeatures.map(normalizeFeatureLabel).filter(Boolean)
  const priority = [
    '全部精选岗位资源',
    '全部申请路径和联系人信息',
    '全部外企英语/企业文化/CEO等材料',
    'AI 简历优化等辅助建议',
    'Club Member 全部权益',
    '1 次远程求职规划',
    '优先参与会员闭门交流',
    '可申请成为共建伙伴',
    '解锁全部高价值远程岗位',
    '解锁全部企业关键联系人信息',
    '岗位企业直申（无限次）',
    'AI 简历优化（无限次）',
    '精选岗位与申请路径',
    '联系人资源支持',
    '外企英语学习工具',
    '企业文化与 CEO 访谈资料'
  ]
  const unique = Array.from(new Set(normalized))
  const ordered = [
    ...priority.filter(item => unique.includes(item)),
    ...unique.filter(item => !priority.includes(item))
  ]

  return ordered.slice(0, 3)
}

const getPlanAdvisorCta = (memberType: Plan['memberType']) => {
  if (memberType === 'annual') return '了解 Club Partner'
  return '了解 Club Member'
}

const normalizePreferredMemberType = (memberType?: Plan['memberType']) => {
  if (memberType === 'annual' || memberType === 'year' || memberType === 'quarter_pro') return 'annual'
  return 'half_year'
}

export const MembershipUpgradeModal: React.FC<MembershipUpgradeModalProps> = ({
  isOpen,
  onClose,
  triggerSource,
  planScope = 'all',
  preferredMemberType
}) => {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS)
  const [selectedPlanId, setSelectedPlanId] = useState(FALLBACK_PLANS[0].id)
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)
  const [claimMessage, setClaimMessage] = useState('')

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setClaimMessage('')
    setIsLoadingPlans(true)

    fetch('/api/membership?action=plans')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load plans: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const rawPlans = Array.isArray(data?.plans) ? data.plans : Array.isArray(data?.data?.plans) ? data.data.plans : []
        const allowedTypes = ['half_year', 'annual']
        const preferredType = normalizePreferredMemberType(preferredMemberType)
        const usefulPlans = rawPlans
          .filter((plan: Plan) => allowedTypes.includes(plan.memberType) && plan.enabled !== false)
          .map((plan: Plan) => ({ ...FALLBACK_PLANS.find(item => item.memberType === plan.memberType), ...plan }))

        if (usefulPlans.length > 0) {
          const merged = allowedTypes
            .map(type => usefulPlans.find((plan: Plan) => plan.memberType === type))
            .filter(Boolean) as Plan[]
          setPlans(merged)
          setSelectedPlanId(
            merged.find(plan => plan.memberType === preferredType)?.id
            || merged[0].id
          )
        } else {
          const fallback = FALLBACK_PLANS.filter((plan) => allowedTypes.includes(plan.memberType))
          setPlans(fallback)
          setSelectedPlanId(
            fallback.find(plan => plan.memberType === preferredType)?.id
            || fallback[0]?.id
            || FALLBACK_PLANS[0].id
          )
        }
      })
      .catch(() => {
        if (cancelled) return
        const allowedTypes = ['half_year', 'annual']
        const preferredType = normalizePreferredMemberType(preferredMemberType)
        const fallback = FALLBACK_PLANS.filter((plan) => allowedTypes.includes(plan.memberType))
        setPlans(fallback)
        setSelectedPlanId(
          fallback.find(plan => plan.memberType === preferredType)?.id
          || fallback[0]?.id
          || FALLBACK_PLANS[0].id
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlans(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, planScope, preferredMemberType])

  const selectedPlan = useMemo(() => {
    return plans.find(plan => plan.id === selectedPlanId) || plans[0] || FALLBACK_PLANS[0]
  }, [plans, selectedPlanId])
  const planGridClass = plans.length <= 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'
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
      eyebrow: 'Haigoo Remote Club',
      title: '申请加入 Haigoo Remote Club',
      description: '加入 Club 后，可获得更多岗位申请路径、联系人资源和求职支持。'
    },
    corporate_english: {
      eyebrow: '外企英语',
      title: '了解外企英语会员工具',
      description: '外企英语是 Haigoo Remote Club 会员专属学习工具，帮助你通过 CEO 访谈和企业文化资料练习口语表达、理解外企文化，更好准备远程岗位申请。'
    }
  }[triggerSource]

  if (!isOpen) return null

  const handleAdvisorAdded = () => {
    trackingService.track('membership_advisor_added_click', {
      page_key: triggerSource === 'corporate_english' ? 'corporate_english' : 'job_detail',
      module: 'membership_upgrade_modal',
      source_key: `${triggerSource}_advisor_modal`,
      entity_type: 'plan',
      entity_id: selectedPlan.id,
      plan_id: selectedPlan.id,
      plan_name: selectedPlan.name
    })
    setClaimMessage('已记录你的顾问添加状态。顾问会协助确认适合方案并开通对应权限。')
  }

  return createPortal(
    <div className="fixed inset-0 z-[4000] flex items-start justify-center overflow-y-auto p-2 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 cursor-pointer bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative my-2 max-h-[calc(100dvh-1rem)] w-full max-w-[1120px] overflow-y-auto rounded-[24px] border border-indigo-100 bg-[#fffdf9] shadow-[0_36px_120px_-52px_rgba(15,23,42,0.45)] animate-in fade-in zoom-in duration-200 sm:my-0 sm:rounded-[30px]">
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
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                {modalCopy.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 p-3.5 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="space-y-4">
          <div className={`grid gap-3 ${planGridClass}`}>
            {isLoadingPlans ? (
              <div className="flex h-[240px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-white/70 text-sm text-slate-500 md:col-span-2">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在读取会员方案
              </div>
            ) : (
              plans.map((plan) => {
                const copy = PLAN_COPY[plan.memberType] || { title: plan.shortLabel || plan.name, hint: plan.description || '', badge: '' }
                const selected = selectedPlan.id === plan.id
                const isAnnualPlan = plan.memberType === 'annual'
                const selectedClass = isAnnualPlan
                  ? 'border-indigo-200 bg-[linear-gradient(135deg,rgba(238,242,255,0.95),rgba(255,255,255,0.98))] shadow-[0_20px_46px_-34px_rgba(79,70,229,0.35)]'
                  : 'border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.98))] shadow-[0_20px_46px_-34px_rgba(16,185,129,0.28)]'
                return (
                  <button
                    key={plan.id}
                    type="button"
                      onClick={() => {
                        setSelectedPlanId(plan.id)
                        setClaimMessage('')
                        trackingService.track('membership_plan_click', {
                          page_key: triggerSource === 'corporate_english' ? 'corporate_english' : 'job_detail',
                          module: 'membership_upgrade_modal',
                          source_key: `${triggerSource}_plan_card`,
                          entity_type: 'plan',
                          entity_id: plan.id,
                          plan_id: plan.id,
                          plan_name: plan.name,
                          feature_key: plan.memberType === 'annual' ? 'membership_plan_annual' : 'membership_plan_half_year'
                        })
                      }}
                    className={`w-full rounded-[22px] border p-4 text-left transition-all sm:rounded-[24px] sm:p-5 ${
                      selected
                        ? selectedClass
                        : 'border-slate-100 bg-white hover:border-indigo-100 hover:bg-indigo-50/30'
                    }`}
                  >
                    <div className="space-y-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-black text-slate-950">{copy.title}</span>
                          {copy.badge ? (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                              isAnnualPlan
                                ? 'bg-[#f1efff] text-[#6f63f6]'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {copy.badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-500">{copy.hint}</p>
                      </div>
                      <div className="text-left">
                        <div className="flex flex-wrap items-end gap-2">
                          <span className="text-[30px] font-black leading-none text-slate-950 sm:text-[32px]">¥{plan.price}</span>
                          <span className="pb-0.5 text-xs font-bold text-slate-400">
                            {isAnnualPlan ? '/ 年' : '/ 半年'}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-slate-400">
                          {isAnnualPlan ? '12 个月' : '6 个月'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2.5">
                      {getVisibleFeatures(plan).map(feature => (
                        <div key={feature} className="flex min-w-0 items-start gap-2 text-sm font-semibold leading-5 text-slate-600">
                          <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${isAnnualPlan ? 'text-[#6f63f6]' : 'text-emerald-500'}`} />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <div className={`mt-4 inline-flex rounded-full px-3 py-1.5 text-xs font-black ${
                      isAnnualPlan
                        ? 'bg-[#f1efff] text-[#6f63f6]'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {getPlanAdvisorCta(plan.memberType)}
                    </div>
                  </button>
                )
              })
            )}
          </div>
          </div>

          <div className="rounded-[22px] border border-[#e8eef5] bg-white p-3.5 shadow-[0_18px_46px_-38px_rgba(15,23,42,0.28)] sm:rounded-[24px] sm:p-4 lg:sticky lg:top-4">
            <div>
              <div className="text-lg font-black text-slate-950">添加顾问，了解 Club 服务</div>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                添加 Haigoo 顾问后，可了解会员方案、适合人群和开通方式。
              </p>
            </div>

            <div className="mt-3 border border-slate-100 bg-slate-50/70 p-3 sm:mt-4 sm:p-4">
              <img
                src="/series_assistant.png"
                alt="企业微信顾问二维码"
                className="mx-auto h-40 w-40 bg-white object-contain p-2 shadow-sm sm:h-44 sm:w-44"
              />
            </div>

            <div className="mt-3 rounded-[18px] border border-[#e8eef5] bg-[#fbfdff] px-4 py-3">
              {[
                '添加 Haigoo 顾问',
                '发送注册邮箱和想了解的会员方案',
                '顾问确认后开通对应网站权限'
              ].map((step, index) => (
                <div key={step} className="flex items-center gap-2 py-1 text-xs font-semibold leading-5 text-slate-600">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f0edff] text-[11px] font-black text-[#6f63f6]">{index + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-[18px] border border-[#e8eef5] bg-white px-4 py-3 text-left text-xs leading-5 text-slate-600">
              <div className="grid grid-cols-[64px_1fr] gap-3 py-1">
                <span className="font-black text-slate-500">服务主体</span>
                <span className="font-semibold text-slate-700">行渡科技（杭州）有限责任公司</span>
              </div>
              <div className="grid grid-cols-[64px_1fr] gap-3 py-1">
                <span className="font-black text-slate-500">可咨询</span>
                <span className="font-semibold text-slate-700">会员权益、远程求职建议、外企英语、简历优化</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAdvisorAdded}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-[#2f6ed8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              我已添加顾问
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
