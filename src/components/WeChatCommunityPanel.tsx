import { ArrowRight, Briefcase, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react'
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
      title: '加入 Haigoo 远程交流群',
      subtitle: '群里会同步更有参考价值的精选岗位、求职讨论和优先答疑，适合正在认真找机会的用户。',
      qrSrc: '/Wechat_group_vip.png',
      qrAlt: 'Haigoo 会员交流群二维码',
      qrTitle: '交流入口',
    }
  }

  return {
    title: '加入 Haigoo 远程交流群',
    subtitle: '群里会同步精选岗位、求职经验、投递反馈和产品更新，适合正在找远程工作的用户。',
    qrSrc: '/Wechat_group.png',
    qrAlt: 'Haigoo 求职交流群二维码',
      qrTitle: '交流入口',
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

  if (variant === 'compact') {
    return (
      <section className={`${baseClass} ${className}`}>
        <div className="grid gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-bold tracking-tight text-slate-950">
                {config.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{config.subtitle}</p>
              <Link
                to="/jobs"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-slate-800 hover:text-white visited:text-white active:text-white focus:text-white"
              >
                先看看今日岗位
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="shrink-0 rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-3 shadow-sm">
              <img
                src={config.qrSrc}
                alt={config.qrAlt}
                className="h-28 w-28 rounded-2xl object-contain"
              />
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={`${baseClass} ${className}`}>
      <div className="absolute" aria-hidden />
      <div className={gridClass}>
        <div className="min-w-0">
          {showHeader && (
            <div className="mb-5">
              <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {config.title}
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                {config.subtitle}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Briefcase, title: '每日精选岗位', desc: '固定同步重点岗位，不需要反复刷新站点。' },
              { icon: MessageSquare, title: '同行交流', desc: '和正在找远程工作的用户讨论投递、面试和工作方式。' },
              { icon: Sparkles, title: '重点信息提醒', desc: '岗位更新、运营活动和重要通知会集中在群里同步。' },
              { icon: ShieldCheck, title: '交流更直接', desc: '相比只看邮件或站内通知，群里更容易获得真实反馈。' }
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

          {showActions && (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/jobs"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white no-underline transition-colors hover:bg-slate-800 hover:text-white visited:text-white active:text-white focus:text-white"
              >
                先看看今日岗位
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        <div className="flex min-w-0 items-center justify-center">
          <div className="w-full rounded-[28px] border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 sm:p-7">
            <div className="text-center">
              <div className="text-xl font-bold text-slate-900">
                {config.qrTitle}
              </div>
              <div className="mt-1.5 text-sm leading-6 text-slate-600">
                微信扫一扫入群
              </div>
            </div>

            <div className="mx-auto mt-4 flex w-full max-w-[320px] justify-center rounded-[28px] bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
              <img
                src={config.qrSrc}
                alt={config.qrAlt}
                className="aspect-square w-full max-w-[220px] rounded-2xl object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
