import { Crown, MessageSquare, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import WeChatCommunityPanel from '../components/WeChatCommunityPanel'

export default function CommunityPage() {
  const { isMember } = useAuth()

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_38%),linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white/90 px-4 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm">
            <Users className="h-3.5 w-3.5" />
            Haigoo 社群入口
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            每日精选岗位，不再靠邮箱提醒
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Haigoo 已将用户侧岗位提醒统一切换到企业微信群。你可以在群里同步查看每日精选岗位，也可以和大家一起交流远程工作经验、投递反馈和行业信息。
          </p>
        </div>

        <div className="mt-12">
          <WeChatCommunityPanel isMember={isMember} variant="page" />
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: '推送更即时',
              desc: '每天在群里集中同步精选岗位，比邮件更容易被看到，也更符合国内用户的使用习惯。'
            },
            {
              icon: MessageSquare,
              title: '信息更有上下文',
              desc: '除了岗位本身，你还能看到大家对岗位、公司、投递方式和面试体验的讨论。'
            },
            {
              icon: Crown,
              title: '会员群更聚焦',
              desc: '会员用户会看到单独的会员企业微信群二维码，交流密度和内容会更垂直。'
            }
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-sm backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <item.icon className="h-6 w-6" />
              </div>
              <div className="mt-4 text-lg font-semibold text-slate-900">{item.title}</div>
              <div className="mt-2 text-sm leading-7 text-slate-600">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
