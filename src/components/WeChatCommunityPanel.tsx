import { ArrowRight, Briefcase, CheckCircle2, Crown, MessageSquare, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

type Variant = 'page' | 'embedded' | 'compact'

interface WeChatCommunityPanelProps {
  isMember?: boolean
  variant?: Variant
  showHeader?: boolean
  showActions?: boolean
  className?: string
}

function getCommunityConfig(isMember = false) {
  if (isMember) {
    return {
      badge: '会员专属企业微信群',
      title: '加入 Haigoo 会员企业微信群',
      subtitle: '会员群会同步更高价值的精选岗位、实战求职讨论和优先答疑，适合正在积极冲刺远程机会的用户。',
      qrSrc: '/Wechat_group_vip.png',
      qrAlt: 'Haigoo 会员企业微信群二维码',
      hint: '使用企业微信或微信扫码加入会员专属群。若二维码失效，请联系管理员更新。',
      bullets: [
        '会员优先岗位讨论与经验复盘',
        '高频求职问题优先答疑',
        '远程工作信息差交流与内推线索',
        '和正在上岸的会员保持同步'
      ]
    }
  }

  return {
    badge: '企业微信群',
    title: '加入 Haigoo 企业微信群',
    subtitle: '每天看精选岗位推送，和正在找远程工作的同行一起交流信息、经验和踩坑总结。',
    qrSrc: '/Wechat_group.png',
    qrAlt: 'Haigoo 企业微信群二维码',
    hint: '使用企业微信或微信扫码加入公开群。群内会同步每日精选岗位和远程工作交流内容。',
    bullets: [
      '每日精选岗位汇总推送',
      '远程求职经验与行业信息交流',
      '岗位筛选、投递、面试问题互助',
      '第一时间知道网站上的重点更新'
    ]
  }
}

export default function WeChatCommunityPanel({
  isMember = false,
  variant = 'embedded',
  showHeader = true,
  showActions = true,
  className = ''
}: WeChatCommunityPanelProps) {
  const config = getCommunityConfig(isMember)
  const baseClass = variant === 'page'
    ? 'rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)] overflow-hidden'
    : variant === 'compact'
      ? 'rounded-2xl border border-slate-200 bg-white shadow-sm'
      : 'rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden'

  const gridClass = variant === 'compact'
    ? 'grid gap-4 p-5'
    : 'grid gap-8 lg:grid-cols-[1.15fr_0.85fr] p-6 sm:p-8 lg:p-10'

  return (
    <section className={`${baseClass} ${className}`}>
      <div className="absolute" aria-hidden />
      <div className={gridClass}>
        <div className="min-w-0">
          {showHeader && (
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <Users className="h-3.5 w-3.5" />
                {config.badge}
              </div>
              <h2 className={`mt-4 font-bold tracking-tight text-slate-950 ${variant === 'compact' ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}>
                {config.title}
              </h2>
              <p className={`mt-3 max-w-2xl text-slate-600 ${variant === 'compact' ? 'text-sm leading-6' : 'text-base sm:text-lg leading-8'}`}>
                {config.subtitle}
              </p>
            </div>
          )}

          <div className={`grid gap-3 ${variant === 'compact' ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
            {[
              { icon: Briefcase, title: '每日精选岗位', desc: '固定同步重点岗位，不需要反复刷新站点。' },
              { icon: MessageSquare, title: '同行交流', desc: '和正在找远程工作的用户讨论投递、面试和工作方式。' },
              { icon: Sparkles, title: '重点信息提醒', desc: '岗位更新、运营活动和重要通知会集中在群里同步。' },
              { icon: isMember ? Crown : ShieldCheck, title: isMember ? '会员专属价值' : '更适合国内用户', desc: isMember ? '会员群交流密度更高，信息更聚焦。' : '相比邮件订阅，群消息更符合国内用户使用习惯。' }
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">{item.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-950 px-5 py-4 text-white">
            <div className="text-sm font-semibold">入群后你能获得</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {config.bullets.map((bullet) => (
                <div key={bullet} className="flex items-start gap-2 text-sm text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>

          {showActions && variant !== 'compact' && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/jobs"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                先看看今日岗位
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!isMember && (
                <Link
                  to="/membership"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  了解会员专属群
                  <Crown className="h-4 w-4 text-amber-500" />
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex min-w-0 items-center justify-center">
          <div className={`w-full rounded-[28px] border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 ${variant === 'compact' ? 'p-4' : 'p-6 sm:p-7'}`}>
            <div className="text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Scan To Join
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900">
                {isMember ? '会员社群入口' : '公开社群入口'}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                {config.hint}
              </div>
            </div>

            <div className="mx-auto mt-6 flex w-full max-w-[320px] justify-center rounded-[28px] bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
              <img
                src={config.qrSrc}
                alt={config.qrAlt}
                className="aspect-square w-full max-w-[220px] rounded-2xl object-contain"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-emerald-200 bg-white/80 px-4 py-3 text-center text-sm leading-6 text-slate-600">
              扫码后如果未自动入群，请保留截图并联系 Haigoo 管理员处理。
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
