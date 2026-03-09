import { ArrowRight, CheckCircle2, Mail, Users } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function UnsubscribePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email')

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">用户侧邮件订阅已停止</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Haigoo 已将用户侧岗位提醒统一切换为企业微信群推送。你无需再退订邮件，原有用户邮件订阅不会继续发送。
          </p>
          {email && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              <Mail className="h-4 w-4" />
              当前链接邮箱：{email}
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Users className="h-4 w-4 text-emerald-600" />
              推荐动作
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              进入企业微信群后，你会继续收到每日精选岗位，并能和其他求职者交流远程工作经验。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-900">管理员日报邮件保留</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              只有站点管理员邮箱会继续接收每日精选汇总，这不会影响普通用户。
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => navigate('/community')}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            前往社群中心
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate('/jobs')}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            查看岗位列表
          </button>
        </div>
      </div>
    </div>
  )
}
