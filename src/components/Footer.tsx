import { Link } from 'react-router-dom'
import HaigooClubInfoCard from './HaigooClubInfoCard'

interface FooterProps {
  showMembershipCta?: boolean
}

export default function Footer({ showMembershipCta = true }: FooterProps) {
  return (
    <footer
      className="relative overflow-hidden bg-[linear-gradient(180deg,#fffefb_0%,#f7fbff_48%,#fffdf8_100%)]"
      role="contentinfo"
      aria-label="网站页脚"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_18%_18%,rgba(188,222,255,0.18),transparent_32%),radial-gradient(circle_at_78%_12%,rgba(255,225,166,0.18),transparent_30%)]" />
      </div>
      <div className="relative mx-auto max-w-[1420px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {showMembershipCta ? (
          <div className="mb-8 rounded-[28px] border border-[#e5ddff] bg-[linear-gradient(105deg,rgba(250,248,255,0.94)_0%,rgba(255,255,255,0.92)_58%,rgba(246,253,247,0.92)_100%)] p-6 shadow-[0_24px_70px_-58px_rgba(84,78,180,0.28)] sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-sm font-black tracking-[0.16em] text-[#7b74ff]">HAIGOO REMOTE CLUB</div>
                <h3 className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">加入 Haigoo Remote Club 会员</h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                  解锁更多申请次数、邮箱直申、内推通道和关键联系人信息，让远程求职推进更高效。
                </p>
              </div>
              <Link
                to="/profile?tab=membership"
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#7b74ff] px-6 py-3 text-sm font-black text-white shadow-[0_18px_38px_-24px_rgba(111,99,246,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#6a60f4] hover:no-underline"
              >
                了解会员权益
              </Link>
            </div>
          </div>
        ) : null}

        <HaigooClubInfoCard />
      </div>
    </footer>
  )
}
