import { ArrowRight, MessageSquare, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

type Variant = 'card' | 'compact' | 'minimal'

export default function JobAlertSubscribe({ variant = 'card', theme = 'dark' }: { variant?: Variant, theme?: 'light' | 'dark' }) {
  const navigate = useNavigate()
  const isLight = theme === 'light'

  if (variant === 'compact') {
    return (
      <div className="cta-inline flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">加入企业微信群</div>
          <div className="text-xs text-slate-500">每日精选岗位推送 + 同行交流</div>
        </div>
        <button onClick={() => navigate('/community')} className="cta-btn rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">
          去加群
        </button>
      </div>
    )
  }

  if (variant === 'minimal') {
    return (
      <div className="flex flex-col gap-3">
        <div className={`rounded-2xl border px-4 py-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/20 bg-white/10 backdrop-blur-sm'}`}>
          <div className={`flex items-start gap-3 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-white/15 text-white'}`}>
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold">加入企业微信群，获取每日精选岗位</div>
              <div className={`mt-1 text-sm leading-6 ${isLight ? 'text-slate-500' : 'text-white/75'}`}>
                邮件订阅已切换为企业微信群推送。群内会同步精选岗位，也可以和大家交流远程工作经验。
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/community')}
          className={`${isLight ? 'bg-slate-950 text-white hover:bg-slate-800' : 'bg-white text-indigo-700 hover:bg-indigo-50'} inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors`}
        >
          前往社群中心
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <div className="font-semibold text-slate-900">加入企业微信群</div>
          <div className="text-sm text-slate-500">每日精选岗位推送，和远程求职同行实时交流。</div>
        </div>
      </div>
      <button
        onClick={() => navigate('/community')}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
      >
        前往社群中心
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}
